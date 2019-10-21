/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Color, ColorInformation, ColorPresentation, DocumentHighlight, DocumentHighlightKind, DocumentLink, Location, Position, Range, SymbolInformation, SymbolKind, TextDocument, TextEdit, WorkspaceEdit } from 'vscode-languageserver-types';
import * as nls from 'vscode-nls';
import { DocumentContext } from '../cssLanguageTypes';
import * as nodes from '../parser/cssNodes';
import { Symbols } from '../parser/cssSymbolScope';
import { getColorValue, hslFromColor } from '../languageFacts/facts';
import { endsWith, startsWith } from '../utils/strings';

const localize = nls.loadMessageBundle();

export class CSSNavigation {

	public findDefinition(document: TextDocument, position: Position, stylesheet: nodes.Node): Location | null {

		const symbols = new Symbols(stylesheet);
		const offset = document.offsetAt(position);
		const node = nodes.getNodeAtOffset(stylesheet, offset);

		if (!node) {
			return null;
		}

		const symbol = symbols.findSymbolFromNode(node);
		if (!symbol) {
			return null;
		}

		return {
			uri: document.uri,
			range: getRange(symbol.node, document)
		};
	}

	public findReferences(document: TextDocument, position: Position, stylesheet: nodes.Stylesheet): Location[] {
		const highlights = this.findDocumentHighlights(document, position, stylesheet);
		return highlights.map(h => {
			return {
				uri: document.uri,
				range: h.range
			};
		});
	}

	public findDocumentHighlights(document: TextDocument, position: Position, stylesheet: nodes.Stylesheet): DocumentHighlight[] {
		const result: DocumentHighlight[] = [];

		const offset = document.offsetAt(position);
		let node = nodes.getNodeAtOffset(stylesheet, offset);
		if (!node || node.type === nodes.NodeType.Stylesheet || node.type === nodes.NodeType.Declarations) {
			return result;
		}
		if (node.type === nodes.NodeType.Identifier && node.parent && node.parent.type === nodes.NodeType.ClassSelector) {
			node = node.parent;
		}

		const symbols = new Symbols(stylesheet);
		const symbol = symbols.findSymbolFromNode(node);
		const name = node.getText();

		stylesheet.accept(candidate => {
			if (symbol) {
				if (symbols.matchesSymbol(candidate, symbol)) {
					result.push({
						kind: getHighlightKind(candidate),
						range: getRange(candidate, document)
					});
					return false;
				}
			} else if (node && node.type === candidate.type && candidate.matches(name)) {
				// Same node type and data
				result.push({
					kind: getHighlightKind(candidate),
					range: getRange(candidate, document)
				});
			}
			return true;
		});

		return result;
	}

	public findDocumentLinks(document: TextDocument, stylesheet: nodes.Stylesheet, documentContext: DocumentContext): DocumentLink[] {
		const result: DocumentLink[] = [];

		stylesheet.accept(candidate => {
			if (candidate.type === nodes.NodeType.URILiteral) {
				const link = uriLiteralNodeToDocumentLink(document, candidate, documentContext);
				if (link) {
					result.push(link);
				}
				return false;
			}

			/**
			 * In @import, it is possible to include links that do not use `url()`
			 * For example, `@import 'foo.css';`
			 */
			if (candidate.parent && candidate.parent.type === nodes.NodeType.Import) {
				const rawText = candidate.getText();
				if (startsWith(rawText, `'`) || startsWith(rawText, `"`)) {
					const link = uriStringNodeToDocumentLink(document, candidate, documentContext);
					if (link) {
						result.push(link);
					}
				}

				return false;
			}

			return true;
		});

		return result;
	}

	public async findDocumentLinks2(document: TextDocument, stylesheet: nodes.Stylesheet, documentContext: DocumentContext): Promise<DocumentLink[]> {
		return this.findDocumentLinks(document, stylesheet, documentContext);
	}

	public findDocumentSymbols(document: TextDocument, stylesheet: nodes.Stylesheet): SymbolInformation[] {

		const result: SymbolInformation[] = [];

		stylesheet.accept((node) => {

			const entry: SymbolInformation = {
				name: null!,
				kind: SymbolKind.Class, // TODO@Martin: find a good SymbolKind
				location: null!
			};
			let locationNode: nodes.Node | null = node;
			if (node instanceof nodes.Selector) {
				entry.name = node.getText();
				locationNode = node.findAParent(nodes.NodeType.Ruleset, nodes.NodeType.ExtendsReference);
				if (locationNode) {
					entry.location = Location.create(document.uri, getRange(locationNode, document));
					result.push(entry);
				}
				return false;
			} else if (node instanceof nodes.VariableDeclaration) {
				entry.name = (<nodes.VariableDeclaration>node).getName();
				entry.kind = SymbolKind.Variable;
			} else if (node instanceof nodes.MixinDeclaration) {
				entry.name = (<nodes.MixinDeclaration>node).getName();
				entry.kind = SymbolKind.Method;
			} else if (node instanceof nodes.FunctionDeclaration) {
				entry.name = (<nodes.FunctionDeclaration>node).getName();
				entry.kind = SymbolKind.Function;
			} else if (node instanceof nodes.Keyframe) {
				entry.name = localize('literal.keyframes', "@keyframes {0}", (<nodes.Keyframe>node).getName());
			} else if (node instanceof nodes.FontFace) {
				entry.name = localize('literal.fontface', "@font-face");
			} else if (node instanceof nodes.Media) {
				const mediaList = node.getChild(0);
				if (mediaList instanceof nodes.Medialist) {
					entry.name = '@media ' + mediaList.getText();
				}
			}

			if (entry.name) {
				entry.location = Location.create(document.uri, getRange(locationNode, document));
				result.push(entry);
			}

			return true;
		});

		return result;
	}

	public findDocumentColors(document: TextDocument, stylesheet: nodes.Stylesheet): ColorInformation[] {
		const result: ColorInformation[] = [];
		stylesheet.accept((node) => {
			const colorInfo = getColorInformation(node, document);
			if (colorInfo) {
				result.push(colorInfo);
			}
			return true;
		});
		return result;
	}

	public getColorPresentations(document: TextDocument, stylesheet: nodes.Stylesheet, color: Color, range: Range): ColorPresentation[] {
		const result: ColorPresentation[] = [];
		const red256 = Math.round(color.red * 255), green256 = Math.round(color.green * 255), blue256 = Math.round(color.blue * 255);

		let label;
		if (color.alpha === 1) {
			label = `rgb(${red256}, ${green256}, ${blue256})`;
		} else {
			label = `rgba(${red256}, ${green256}, ${blue256}, ${color.alpha})`;
		}
		result.push({ label: label, textEdit: TextEdit.replace(range, label) });

		if (color.alpha === 1) {
			label = `#${toTwoDigitHex(red256)}${toTwoDigitHex(green256)}${toTwoDigitHex(blue256)}`;
		} else {
			label = `#${toTwoDigitHex(red256)}${toTwoDigitHex(green256)}${toTwoDigitHex(blue256)}${toTwoDigitHex(Math.round(color.alpha * 255))}`;
		}
		result.push({ label: label, textEdit: TextEdit.replace(range, label) });

		const hsl = hslFromColor(color);
		if (hsl.a === 1) {
			label = `hsl(${hsl.h}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%)`;
		} else {
			label = `hsla(${hsl.h}, ${Math.round(hsl.s * 100)}%, ${Math.round(hsl.l * 100)}%, ${hsl.a})`;
		}
		result.push({ label: label, textEdit: TextEdit.replace(range, label) });

		return result;
	}

	public doRename(document: TextDocument, position: Position, newName: string, stylesheet: nodes.Stylesheet): WorkspaceEdit {
		const highlights = this.findDocumentHighlights(document, position, stylesheet);
		const edits = highlights.map(h => TextEdit.replace(h.range, newName));
		return {
			changes: { [document.uri]: edits }
		};
	}

}

function getColorInformation(node: nodes.Node, document: TextDocument): ColorInformation | null {
	const color = getColorValue(node);
	if (color) {
		const range = getRange(node, document);
		return { color, range };
	}
	return null;
}

function uriLiteralNodeToDocumentLink(document: TextDocument, uriLiteralNode: nodes.Node, documentContext: DocumentContext): DocumentLink | null {
	if (uriLiteralNode.getChildren().length === 0) {
		return null;
	}

	const uriStringNode = uriLiteralNode.getChild(0);

	return uriStringNodeToDocumentLink(document, uriStringNode, documentContext);
}

function uriStringNodeToDocumentLink(document: TextDocument, uriStringNode: nodes.Node | null, documentContext: DocumentContext): DocumentLink | null {
	if (!uriStringNode) {
		return null;
	}

	let rawUri = uriStringNode.getText();
	const range = getRange(uriStringNode, document);
	// Make sure the range is not empty
	if (range.start.line === range.end.line && range.start.character === range.end.character) {
		return null;
	}

	if (startsWith(rawUri, `'`) || startsWith(rawUri, `"`)) {
		rawUri = rawUri.slice(1, -1);
	}
	let target: string;
	if (startsWith(rawUri, 'http://') || startsWith(rawUri, 'https://')) {
		target = rawUri;
	} else if (/^\w+:\/\//g.test(rawUri)) {
		target = rawUri;
	}
	else {
		target = documentContext.resolveReference(rawUri, document.uri);
	}
	return {
		range,
		target
	};
}

function getRange(node: nodes.Node, document: TextDocument): Range {
	return Range.create(document.positionAt(node.offset), document.positionAt(node.end));
}

function getHighlightKind(node: nodes.Node): DocumentHighlightKind {

	if (node.type === nodes.NodeType.Selector) {
		return DocumentHighlightKind.Write;
	}

	if (node instanceof nodes.Identifier) {
		if (node.parent && node.parent instanceof nodes.Property) {
			if (node.isCustomProperty) {
				return DocumentHighlightKind.Write;
			}
		}
	}

	if (node.parent) {
		switch (node.parent.type) {
			case nodes.NodeType.FunctionDeclaration:
			case nodes.NodeType.MixinDeclaration:
			case nodes.NodeType.Keyframe:
			case nodes.NodeType.VariableDeclaration:
			case nodes.NodeType.FunctionParameter:
				return DocumentHighlightKind.Write;
		}
	}

	return DocumentHighlightKind.Read;
}

function toTwoDigitHex(n: number): string {
	const r = n.toString(16);
	return r.length !== 2 ? '0' + r : r;
}
