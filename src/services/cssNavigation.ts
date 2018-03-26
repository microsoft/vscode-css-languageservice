/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import {
	TextDocument, Range, Position, Location, DocumentHighlightKind, DocumentHighlight,
	SymbolInformation, SymbolKind, WorkspaceEdit, TextEdit, TextDocumentEdit
} from 'vscode-languageserver-types';
import { Symbols } from '../parser/cssSymbolScope';
import { getColorValue, hslFromColor } from '../services/languageFacts';

import * as nls from 'vscode-nls';
import { ColorInformation, ColorPresentation, Color } from '../cssLanguageService';
import { FoldingRangeList } from 'vscode-languageserver-protocol-foldingprovider';
import { getFoldingRegions } from './cssFolding';
const localize = nls.loadMessageBundle();

export class CSSNavigation {

	public findDefinition(document: TextDocument, position: Position, stylesheet: nodes.Node): Location | null {

		let symbols = new Symbols(stylesheet);
		let offset = document.offsetAt(position);
		let node = nodes.getNodeAtOffset(stylesheet, offset);

		if (!node) {
			return null;
		}

		let symbol = symbols.findSymbolFromNode(node);
		if (!symbol) {
			return null;
		}

		return {
			uri: document.uri,
			range: getRange(symbol.node, document)
		};
	}

	public findReferences(document: TextDocument, position: Position, stylesheet: nodes.Stylesheet): Location[] {
		let highlights = this.findDocumentHighlights(document, position, stylesheet);
		return highlights.map(h => {
			return {
				uri: document.uri,
				range: h.range
			};
		});
	}

	public findDocumentHighlights(document: TextDocument, position: Position, stylesheet: nodes.Stylesheet): DocumentHighlight[] {
		let result: DocumentHighlight[] = [];

		let offset = document.offsetAt(position);
		let node = nodes.getNodeAtOffset(stylesheet, offset);
		if (!node || node.type === nodes.NodeType.Stylesheet || node.type === nodes.NodeType.Declarations) {
			return result;
		}

		let symbols = new Symbols(stylesheet);
		let symbol = symbols.findSymbolFromNode(node);
		let name = node.getText();

		stylesheet.accept(candidate => {
			if (symbol) {
				if (symbols.matchesSymbol(candidate, symbol)) {
					result.push({
						kind: getHighlightKind(candidate),
						range: getRange(candidate, document)
					});
					return false;
				}
			} else if (node.type === candidate.type && node.length === candidate.length && name === candidate.getText()) {
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

	public findDocumentSymbols(document: TextDocument, stylesheet: nodes.Stylesheet): SymbolInformation[] {

		let result: SymbolInformation[] = [];

		stylesheet.accept((node) => {

			let entry: SymbolInformation = {
				name: null,
				kind: SymbolKind.Class, // TODO@Martin: find a good SymbolKind
				location: null
			};
			let locationNode = node;
			if (node instanceof nodes.Selector) {
				entry.name = node.getText();
				locationNode = node.findParent(nodes.NodeType.Ruleset);
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
		let result: ColorInformation[] = [];
		stylesheet.accept((node) => {
			let colorInfo = getColorInformation(node, document);
			if (colorInfo) {
				result.push(colorInfo);
			}
			return true;
		});
		return result;
	}

	public getColorPresentations(document: TextDocument, stylesheet: nodes.Stylesheet, color: Color, range: Range): ColorPresentation[] {
		let result: ColorPresentation[] = [];
		let red256 = Math.round(color.red * 255), green256 = Math.round(color.green * 255), blue256 = Math.round(color.blue * 255);

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
		let highlights = this.findDocumentHighlights(document, position, stylesheet);
		let edits = highlights.map(h => TextEdit.replace(h.range, newName));
		return {
			changes: { [document.uri]: edits }
		};
	}

	public findFoldingRegions(document: TextDocument): FoldingRangeList {
		return getFoldingRegions(document);
	}

}

function getColorInformation(node: nodes.Node, document: TextDocument): ColorInformation | null {
	let color = getColorValue(node);
	if (color) {
		let range = getRange(node, document);
		return { color, range };
	}
	return null;
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
