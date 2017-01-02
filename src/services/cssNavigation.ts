/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import {TextDocument, Range, Position, Location, DocumentHighlightKind, DocumentHighlight,
	SymbolInformation, SymbolKind, WorkspaceEdit, TextEdit, VersionedTextDocumentIdentifier} from 'vscode-languageserver-types';
import {Symbols} from '../parser/cssSymbolScope';
import {isColorValue} from '../services/languageFacts';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class CSSNavigation {

	public findDefinition(document: TextDocument, position: Position, stylesheet: nodes.Node): Location {

		let symbols = new Symbols(stylesheet);
		let offset = document.offsetAt(position);
		let node = nodes.getNodeAtOffset(stylesheet, offset);

		if (!node) {
			//workaround for https://github.com/Microsoft/vscode-languageserver-node/issues/45
			return {
				uri: document.uri,
				range: Range.create(position, position)
			};
		}

		let symbol = symbols.findSymbolFromNode(node);
		if (!symbol) {
			//workaround for https://github.com/Microsoft/vscode-languageserver-node/issues/45
			return {
				uri: document.uri,
				range: Range.create(position, position)
			};
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
				locationNode = node.findParent(nodes.NodeType.Ruleset)
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

	public findColorSymbols(document: TextDocument, stylesheet: nodes.Stylesheet): Range[] {
		let result: Range[] = [];
		stylesheet.accept((node) => {
			if (isColorValue(node)) {
				result.push(getRange(node, document));
			}
			return true;
		});
		return result;
	}

	public doRename(document: TextDocument, position: Position, newName: string, stylesheet: nodes.Stylesheet): WorkspaceEdit {
		let highlights = this.findDocumentHighlights(document, position, stylesheet);
		let edits = highlights.map(h => TextEdit.replace(h.range, newName));
		return {
			changes: [
				{
					textDocument: {uri: document.uri, version: document.version} as VersionedTextDocumentIdentifier,
					edits
				}
			]
		};
	}

}

function getRange(node: nodes.Node, document: TextDocument) : Range {
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

