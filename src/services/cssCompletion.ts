/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import { Symbols, Symbol } from '../parser/cssSymbolScope';
import * as languageFacts from './languageFacts';
import * as strings from '../utils/strings';
import { findFirst } from '../utils/arrays';
import { TextDocument, Position, CompletionList, CompletionItem, CompletionItemKind, Range, TextEdit, InsertTextFormat } from 'vscode-languageserver-types';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

const SnippetFormat = InsertTextFormat.Snippet;

export class CSSCompletion {

	variablePrefix: string;
	position: Position;
	offset: number;
	currentWord: string;
	textDocument: TextDocument;
	styleSheet: nodes.Stylesheet;
	symbolContext: Symbols;
	defaultReplaceRange: Range;
	nodePath: nodes.Node[];

	constructor(variablePrefix: string = null) {
		this.variablePrefix = variablePrefix;
	}

	private getSymbolContext(): Symbols {
		if (!this.symbolContext) {
			this.symbolContext = new Symbols(this.styleSheet);
		}
		return this.symbolContext;
	}

	public doComplete(document: TextDocument, position: Position, styleSheet: nodes.Stylesheet): CompletionList {
		this.offset = document.offsetAt(position);
		this.position = position;
		this.currentWord = getCurrentWord(document, this.offset);
		this.defaultReplaceRange = Range.create(Position.create(this.position.line, this.position.character - this.currentWord.length), this.position);
		this.textDocument = document;
		this.styleSheet = styleSheet;
		try {
			let result: CompletionList = { isIncomplete: false, items: [] };
			this.nodePath = nodes.getNodePath(this.styleSheet, this.offset);

			for (let i = this.nodePath.length - 1; i >= 0; i--) {
				let node = this.nodePath[i];
				if (node instanceof nodes.Property) {
					this.getCompletionsForDeclarationProperty(node.getParent() as nodes.Declaration, result);
				} else if (node instanceof nodes.Expression) {
					this.getCompletionsForExpression(<nodes.Expression>node, result);
				} else if (node instanceof nodes.SimpleSelector) {
					let parentRuleSet = <nodes.RuleSet>node.findParent(nodes.NodeType.Ruleset);
					this.getCompletionsForSelector(parentRuleSet, parentRuleSet.isNested(), result);
				} else if (node instanceof nodes.FunctionArgument) {
					this.getCompletionsForFunctionArgument(<nodes.FunctionArgument>node, <nodes.Function>node.getParent(), result);
				} else if (node instanceof nodes.Declarations) {
					this.getCompletionsForDeclarations(<nodes.Declarations>node, result);
				} else if (node instanceof nodes.VariableDeclaration) {
					this.getCompletionsForVariableDeclaration(<nodes.VariableDeclaration>node, result);
				} else if (node instanceof nodes.RuleSet) {
					this.getCompletionsForRuleSet(<nodes.RuleSet>node, result);
				} else if (node instanceof nodes.Interpolation) {
					this.getCompletionsForInterpolation(<nodes.Interpolation>node, result);
				} else if (node instanceof nodes.FunctionDeclaration) {
					this.getCompletionsForFunctionDeclaration(<nodes.FunctionDeclaration>node, result);
				} else if (node instanceof nodes.MixinReference) {
					this.getCompletionsForMixinReference(<nodes.MixinReference>node, result);
				} else if (node instanceof nodes.Function) {
					this.getCompletionsForFunctionArgument(null, <nodes.Function>node, result);
				}
				if (result.items.length > 0) {
					return this.finalize(result);
				}
			}
			this.getCompletionsForStylesheet(result);
			if (result.items.length === 0) {
				if (this.variablePrefix && this.currentWord.indexOf(this.variablePrefix) === 0) {
					this.getVariableProposals(null, result);
				}
			}
			return this.finalize(result);

		} finally {
			// don't hold on any state, clear symbolContext
			this.position = null;
			this.currentWord = null;
			this.textDocument = null;
			this.styleSheet = null;
			this.symbolContext = null;
			this.defaultReplaceRange = null;
			this.nodePath = null;
		}
	}

	private finalize(result: CompletionList): CompletionList {
		let needsSortText = result.items.some(i => !!i.sortText);
		if (needsSortText) {
			result.items.forEach(i => {
				if (!i.sortText) { i.sortText = 'd'; }
			});
		}
		return result;
	}

	private findInNodePath(...types: nodes.NodeType[]) {
		for (let i = this.nodePath.length - 1; i >= 0; i--) {
			let node = this.nodePath[i];
			if (types.indexOf(node.type) !== -1) {
				return node;
			}
		}
		return null;
	}

	public getCompletionsForDeclarationProperty(declaration: nodes.Declaration, result: CompletionList): CompletionList {
		return this.getPropertyProposals(declaration, result);
	}

	private getPropertyProposals(declaration: nodes.Declaration, result: CompletionList): CompletionList {
		let properties = languageFacts.getProperties();

		for (let key in properties) {
			if (properties.hasOwnProperty(key)) {
				let entry = properties[key];
				if (entry.browsers.onCodeComplete) {
					let range: Range;
					let insertText: string;
					if (declaration) {
						range = this.getCompletionRange(declaration.getProperty());
						insertText = entry.name + (!isDefined(declaration.colonPosition) ? ': ' : '');
					} else {
						range = this.getCompletionRange(null);
						insertText = entry.name + ': ';
					}
					let item: CompletionItem = {
						label: entry.name,
						documentation: languageFacts.getEntryDescription(entry),
						textEdit: TextEdit.replace(range, insertText),
						kind: CompletionItemKind.Property
					}
					if (strings.startsWith(entry.name, '-')) {
						item.sortText = 'x';
					}
					result.items.push(item);
				}
			}
		}
		return result;
	}

	private valueTypes = [
		nodes.NodeType.Identifier, nodes.NodeType.Value, nodes.NodeType.StringLiteral, nodes.NodeType.URILiteral, nodes.NodeType.NumericValue,
		nodes.NodeType.HexColorValue, nodes.NodeType.VariableName, nodes.NodeType.Prio
	];

	public getCompletionsForDeclarationValue(node: nodes.Declaration, result: CompletionList): CompletionList {
		let propertyName = node.getFullPropertyName();
		let entry = languageFacts.getProperties()[propertyName];
		let existingNode: nodes.Node = node.getValue();

		while (existingNode && existingNode.hasChildren()) {
			existingNode = existingNode.findChildAtOffset(this.offset, false);
		}

		if (entry) {
			for (let restriction of entry.restrictions) {
				switch (restriction) {
					case 'color':
						this.getColorProposals(entry, existingNode, result);
						break;
					case 'position':
						this.getPositionProposals(entry, existingNode, result);
						break;
					case 'repeat':
						this.getRepeatStyleProposals(entry, existingNode, result);
						break;
					case 'line-style':
						this.getLineStyleProposals(entry, existingNode, result);
						break;
					case 'line-width':
						this.getLineWidthProposals(entry, existingNode, result);
						break;
					case 'geometry-box':
						this.getGeometryBoxProposals(entry, existingNode, result);
						break;
					case 'box':
						this.getBoxProposals(entry, existingNode, result);
						break;
					case 'image':
						this.getImageProposals(entry, existingNode, result);
						break;
					case 'timing-function':
						this.getTimingFunctionProposals(entry, existingNode, result);
						break;
					case 'shape':
						this.getBasicShapeProposals(entry, existingNode, result);
						break;
				}
			}
			this.getValueEnumProposals(entry, existingNode, result);
			this.getCSSWideKeywordProposals(entry, existingNode, result);
			this.getUnitProposals(entry, existingNode, result);
		} else {
			let existingValues = new Set();
			this.styleSheet.accept(new ValuesCollector(propertyName, existingValues));
			existingValues.getEntries().forEach((existingValue) => {
				result.items.push({
					label: existingValue,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), existingValue),
					kind: CompletionItemKind.Value
				});
			});
		}
		this.getVariableProposals(existingNode, result);
		this.getTermProposals(entry, existingNode, result);
		return result;
	}

	public getValueEnumProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.values) {
			entry.values.forEach((value) => {
				if (languageFacts.isCommonValue(value)) { // only show if supported by more than one browser
					let insertString = value.name;
					let insertTextFormat;
					if (strings.endsWith(insertString, ')')) {
						let from = insertString.lastIndexOf('(');
						if (from !== -1) {
							insertString = insertString.substr(0, from) + '($1)';
							insertTextFormat = SnippetFormat;
						}
					}
					let item: CompletionItem = {
						label: value.name,
						documentation: languageFacts.getEntryDescription(value),
						textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertString),
						kind: CompletionItemKind.Value,
						insertTextFormat
					};
					result.items.push(item);
				}
			});
		}
		return result;
	}

	public getCSSWideKeywordProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let keywords in languageFacts.cssWideKeywords) {
			result.items.push({
				label: keywords,
				documentation: languageFacts.cssWideKeywords[keywords],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), keywords),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	public getCompletionsForInterpolation(node: nodes.Interpolation, result: CompletionList): CompletionList {
		if (this.offset >= node.offset + 2) {
			this.getVariableProposals(null, result);
		}
		return result;
	}

	public getVariableProposals(existingNode: nodes.Node, result: CompletionList): CompletionList {
		let symbols = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Variable);
		symbols.forEach((symbol) => {
			let insertText = strings.startsWith(symbol.name, '--') ? `var(${symbol.name})` : symbol.name;
			const suggest: CompletionItem = {
				label: symbol.name,
				documentation: symbol.value ? strings.getLimitedString(symbol.value) : symbol.value,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				kind: CompletionItemKind.Variable,
				sortText: 'z'
			};

			if (symbol.node.type === nodes.NodeType.FunctionParameter) {
				const mixinNode = <nodes.MixinDeclaration>(symbol.node.getParent());
				if (mixinNode.type === nodes.NodeType.MixinDeclaration) {
					suggest.detail = localize('completion.argument', 'argument from \'{0}\'', mixinNode.getName());
				}
			}

			result.items.push(suggest);
		});
		return result;
	}

	public getVariableProposalsForCSSVarFunction(result: CompletionList): CompletionList {
		let symbols = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Variable);
		symbols = symbols.filter((symbol): boolean => {
			return strings.startsWith(symbol.name, '--');
		});
		symbols.forEach((symbol) => {
			result.items.push({
				label: symbol.name,
				documentation: symbol.value ? strings.getLimitedString(symbol.value) : symbol.value,
				textEdit: TextEdit.replace(this.getCompletionRange(null), symbol.name),
				kind: CompletionItemKind.Variable
			});
		});
		return result;
	}

	public getUnitProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		let currentWord = '0';
		if (this.currentWord.length > 0) {
			let numMatch = this.currentWord.match(/^-?\d[\.\d+]*/);
			if (numMatch) {
				currentWord = numMatch[0];
				result.isIncomplete = currentWord.length === this.currentWord.length;
			}
		} else if (this.currentWord.length === 0) {
			result.isIncomplete = true;
		}
		if (existingNode && existingNode.parent && existingNode.parent.type === nodes.NodeType.Term) {
			existingNode = existingNode.getParent(); // include the unary operator
		}
		entry.restrictions.forEach((restriction) => {
			let units = languageFacts.units[restriction];
			if (units) {
				units.forEach((unit: string) => {
					let insertText = currentWord + unit;
					result.items.push({
						label: insertText,
						textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
						kind: CompletionItemKind.Unit
					});
				});
			}
		});
		return result;
	}

	protected getCompletionRange(existingNode: nodes.Node) {
		if (existingNode && existingNode.offset <= this.offset) {
			let end = existingNode.end !== -1 ? this.textDocument.positionAt(existingNode.end) : this.position;
			return Range.create(this.textDocument.positionAt(existingNode.offset), end);
		}
		return this.defaultReplaceRange;
	}

	protected getColorProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let color in languageFacts.colors) {
			result.items.push({
				label: color,
				documentation: languageFacts.colors[color],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), color),
				kind: CompletionItemKind.Color
			});
		}
		for (let color in languageFacts.colorKeywords) {
			result.items.push({
				label: color,
				documentation: languageFacts.colorKeywords[color],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), color),
				kind: CompletionItemKind.Value
			});
		}
		let colorValues = new Set();
		this.styleSheet.accept(new ColorValueCollector(colorValues));
		colorValues.getEntries().forEach((color) => {
			result.items.push({
				label: color,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), color),
				kind: CompletionItemKind.Color
			});
		});
		languageFacts.colorFunctions.forEach((p) => {
			let tabStop = 1;
			let replaceFunction = (match, p1) => '${' + tabStop++ + ':' + p1 + '}';
			let insertText = p.func.replace(/\[?\$(\w+)\]?/g, replaceFunction);
			result.items.push({
				label: p.func.substr(0, p.func.indexOf('(')),
				detail: p.func,
				documentation: p.desc,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				insertTextFormat: SnippetFormat,
				kind: CompletionItemKind.Function
			});
		});
		return result;
	}

	protected getPositionProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let position in languageFacts.positionKeywords) {
			result.items.push({
				label: position,
				documentation: languageFacts.positionKeywords[position],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), position),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getRepeatStyleProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let repeat in languageFacts.repeatStyleKeywords) {
			result.items.push({
				label: repeat,
				documentation: languageFacts.repeatStyleKeywords[repeat],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), repeat),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getLineStyleProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let lineStyle in languageFacts.lineStyleKeywords) {
			result.items.push({
				label: lineStyle,
				documentation: languageFacts.lineStyleKeywords[lineStyle],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), lineStyle),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getLineWidthProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		languageFacts.lineWidthKeywords.forEach((lineWidth) => {
			result.items.push({
				label: lineWidth,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), lineWidth),
				kind: CompletionItemKind.Value
			});
		});
		return result;
	}

	protected getGeometryBoxProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let box in languageFacts.geometryBoxKeywords) {
			result.items.push({
				label: box,
				documentation: languageFacts.geometryBoxKeywords[box],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), box),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getBoxProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let box in languageFacts.boxKeywords) {
			result.items.push({
				label: box,
				documentation: languageFacts.boxKeywords[box],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), box),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getImageProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let image in languageFacts.imageFunctions) {
			let insertText = image.replace(/\(\)$/, "($1)");
			result.items.push({
				label: image,
				documentation: languageFacts.imageFunctions[image],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				kind: CompletionItemKind.Function,
				insertTextFormat: image !== insertText ? SnippetFormat : void 0
			});
		}
		return result;
	}

	protected getTimingFunctionProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let timing in languageFacts.transitionTimingFunctions) {
			let insertText = timing.replace(/\(\)$/, "($1)");
			result.items.push({
				label: timing,
				documentation: languageFacts.transitionTimingFunctions[timing],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				kind: CompletionItemKind.Function,
				insertTextFormat: timing !== insertText ? SnippetFormat : void 0
			});
		}
		return result;
	}

	protected getBasicShapeProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		for (let shape in languageFacts.basicShapeFunctions) {
			let insertText = shape.replace(/\(\)$/, "($1)");
			result.items.push({
				label: shape,
				documentation: languageFacts.basicShapeFunctions[shape],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				kind: CompletionItemKind.Function,
				insertTextFormat: shape !== insertText ? SnippetFormat : void 0
			});
		}
		return result;
	}

	public getCompletionsForStylesheet(result: CompletionList): CompletionList {
		let node = this.styleSheet.findFirstChildBeforeOffset(this.offset);
		if (!node) {
			return this.getCompletionForTopLevel(result);
		}
		if (node instanceof nodes.RuleSet) {
			return this.getCompletionsForRuleSet(<nodes.RuleSet>node, result);
		}
		return result;
	}

	public getCompletionForTopLevel(result: CompletionList): CompletionList {
		languageFacts.getAtDirectives().forEach((entry) => {
			if (entry.browsers.count > 0) {
				result.items.push({
					label: entry.name,
					textEdit: TextEdit.replace(this.getCompletionRange(null), entry.name),
					documentation: languageFacts.getEntryDescription(entry),
					kind: CompletionItemKind.Keyword
				});
			}
		});
		this.getCompletionsForSelector(null, false, result);
		return result;
	}

	public getCompletionsForRuleSet(ruleSet: nodes.RuleSet, result: CompletionList): CompletionList {
		let declarations = ruleSet.getDeclarations();

		let isAfter = declarations && declarations.endsWith('}') && this.offset >= declarations.end;
		if (isAfter) {
			return this.getCompletionForTopLevel(result);
		}
		let isInSelectors = !declarations || this.offset <= declarations.offset;
		if (isInSelectors) {
			return this.getCompletionsForSelector(ruleSet, ruleSet.isNested(), result);
		}
		ruleSet.findParent(nodes.NodeType.Ruleset);

		return this.getCompletionsForDeclarations(ruleSet.getDeclarations(), result);
	}

	public getCompletionsForSelector(ruleSet: nodes.RuleSet, isNested: boolean, result: CompletionList): CompletionList {
		let existingNode = this.findInNodePath(nodes.NodeType.PseudoSelector, nodes.NodeType.IdentifierSelector, nodes.NodeType.ClassSelector, nodes.NodeType.ElementNameSelector);
		if (!existingNode && this.offset - this.currentWord.length > 0 && this.textDocument.getText()[this.offset - this.currentWord.length - 1] === ':') {
			// after the ':' of a pseudo selector, no node generated for just ':'
			this.currentWord = ':' + this.currentWord;
			this.defaultReplaceRange = Range.create(Position.create(this.position.line, this.position.character - this.currentWord.length), this.position);
		}

		languageFacts.getPseudoClasses().forEach((entry) => {
			if (entry.browsers.onCodeComplete) {
				let item: CompletionItem = {
					label: entry.name,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), entry.name),
					documentation: languageFacts.getEntryDescription(entry),
					kind: CompletionItemKind.Function
				};
				if (strings.startsWith(entry.name, ':-')) {
					item.sortText = 'x';
				}
				result.items.push(item);
			}
		});
		languageFacts.getPseudoElements().forEach((entry) => {
			if (entry.browsers.onCodeComplete) {
				let item: CompletionItem = {
					label: entry.name,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), entry.name),
					documentation: languageFacts.getEntryDescription(entry),
					kind: CompletionItemKind.Function
				};
				if (strings.startsWith(entry.name, '::-')) {
					item.sortText = 'x';
				}
				result.items.push(item);
			}
		});
		if (!isNested) { // show html tags only for top level
			languageFacts.html5Tags.forEach((entry) => {
				result.items.push({
					label: entry,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), entry),
					kind: CompletionItemKind.Keyword
				});
			});
			languageFacts.svgElements.forEach((entry) => {
				result.items.push({
					label: entry,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), entry),
					kind: CompletionItemKind.Keyword
				});
			});
		}

		let visited: { [name: string]: boolean } = {};
		visited[this.currentWord] = true;
		let textProvider = this.styleSheet.getTextProvider();
		this.styleSheet.accept(n => {
			if (n.type === nodes.NodeType.SimpleSelector && n.length > 0) {
				let selector = textProvider(n.offset, n.length);
				if (selector.charAt(0) === '.' && !visited[selector]) {
					visited[selector] = true;
					result.items.push({
						label: selector,
						textEdit: TextEdit.replace(this.getCompletionRange(existingNode), selector),
						kind: CompletionItemKind.Keyword
					});
				}
				return false;
			}
			return true;
		});

		if (ruleSet && ruleSet.isNested()) {
			let selector = ruleSet.getSelectors().findFirstChildBeforeOffset(this.offset);
			if (selector && ruleSet.getSelectors().getChildren().indexOf(selector) === 0) {
				this.getPropertyProposals(null, result);
			}
		}
		return result;
	}

	public getCompletionsForDeclarations(declarations: nodes.Declarations, result: CompletionList): CompletionList {
		if (!declarations || this.offset === declarations.offset) { // incomplete nodes
			return result;
		}

		let node = declarations.findFirstChildBeforeOffset(this.offset);
		if (!node) {
			return this.getCompletionsForDeclarationProperty(null, result);
		}

		if (node instanceof nodes.AbstractDeclaration) {
			let declaration = <nodes.AbstractDeclaration>node;
			if (!isDefined(declaration.colonPosition || this.offset <= declaration.colonPosition)) {

				// complete property
				return this.getCompletionsForDeclarationProperty(declaration as nodes.Declaration, result);
			} else if ((isDefined(declaration.semicolonPosition) && declaration.semicolonPosition < this.offset)) {
				if (this.offset === declaration.semicolonPosition + 1) {
					return result; // don't show new properties right after semicolon (see Bug 15421:[intellisense] [css] Be less aggressive when manually typing CSS)
				}

				// complete next property
				return this.getCompletionsForDeclarationProperty(null, result);
			}

			if (declaration instanceof nodes.Declaration) {
				// complete value
				return this.getCompletionsForDeclarationValue(declaration, result);
			}
		}
		return result;
	}

	public getCompletionsForVariableDeclaration(declaration: nodes.VariableDeclaration, result: CompletionList): CompletionList {
		if (this.offset > declaration.colonPosition) {
			this.getVariableProposals(declaration.getValue(), result);
		}
		return result;
	}

	public getCompletionsForExpression(expression: nodes.Expression, result: CompletionList): CompletionList {
		if (expression.getParent() instanceof nodes.FunctionArgument) {
			this.getCompletionsForFunctionArgument(<nodes.FunctionArgument>expression.getParent(), <nodes.Function>expression.getParent().getParent(), result);
			return result;
		}

		let declaration = <nodes.Declaration>expression.findParent(nodes.NodeType.Declaration);
		if (!declaration) {
			this.getTermProposals(null, null, result);
			return result;
		}

		let node = expression.findChildAtOffset(this.offset, true);
		if (!node) {
			return this.getCompletionsForDeclarationValue(declaration, result);
		}
		if (node instanceof nodes.NumericValue || node instanceof nodes.Identifier) {
			return this.getCompletionsForDeclarationValue(declaration, result);
		}
		return result;
	}

	public getCompletionsForFunctionArgument(arg: nodes.FunctionArgument, func: nodes.Function, result: CompletionList): CompletionList {
		if (func.getIdentifier().getText() === 'var') {
			if (!func.getArguments().hasChildren() || func.getArguments().getChild(0) === arg) {
				this.getVariableProposalsForCSSVarFunction(result);
			}
		}
		return result;
	}

	public getCompletionsForFunctionDeclaration(decl: nodes.FunctionDeclaration, result: CompletionList): CompletionList {
		let declarations = decl.getDeclarations();
		if (declarations && this.offset > declarations.offset && this.offset < declarations.end) {
			this.getTermProposals(null, null, result);
		}
		return result;
	}

	public getCompletionsForMixinReference(ref: nodes.MixinReference, result: CompletionList): CompletionList {
		let allMixins = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Mixin);
		allMixins.forEach((mixinSymbol) => {
			if (mixinSymbol.node instanceof nodes.MixinDeclaration) {
				result.items.push(this.makeTermProposal(mixinSymbol, mixinSymbol.node.getParameters(), null));
			}
		});
		return result;
	}

	public getTermProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		let allFunctions = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Function);
		allFunctions.forEach((functionSymbol) => {
			if (functionSymbol.node instanceof nodes.FunctionDeclaration) {
				result.items.push(this.makeTermProposal(functionSymbol, functionSymbol.node.getParameters(), existingNode));
			}
		});
		return result;
	}

	private makeTermProposal(symbol: Symbol, parameters: nodes.Nodelist, existingNode: nodes.Node): CompletionItem {
		const decl = <nodes.FunctionDeclaration>symbol.node;
		const params = parameters.getChildren().map((c) => {
			return (c instanceof nodes.FunctionParameter) ? (<nodes.FunctionParameter>c).getName() : c.getText();
		});
		const insertText = symbol.name + '(' + params.map((p, index) => '${' + (index + 1) + ':' + p + '}').join(', ') + ')';
		return {
			label: symbol.name,
			detail: symbol.name + '(' + params.join(', ') + ')',
			textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
			insertTextFormat: SnippetFormat,
			kind: CompletionItemKind.Function,
			sortText: 'z'
		};
	}

}

class Set {
	private entries: { [key: string]: boolean } = {};
	public add(entry: string): void {
		this.entries[entry] = true;
	}
	public getEntries(): string[] {
		return Object.keys(this.entries);
	}
}


class InternalValueCollector implements nodes.IVisitor {

	constructor(public entries: Set) {
		// nothing to do
	}

	public visitNode(node: nodes.Node): boolean {
		if (node instanceof nodes.Identifier || node instanceof nodes.NumericValue || node instanceof nodes.HexColorValue) {
			this.entries.add(node.getText());
		}
		return true;
	}
}

class ValuesCollector implements nodes.IVisitor {


	constructor(public propertyName: string, public entries: Set) {
		// nothing to do
	}

	private matchesProperty(decl: nodes.Declaration): boolean {
		let propertyName = decl.getFullPropertyName();
		return this.propertyName === propertyName;
	}

	public visitNode(node: nodes.Node): boolean {
		if (node instanceof nodes.Declaration) {
			if (this.matchesProperty(<nodes.Declaration>node)) {
				let value = (<nodes.Declaration>node).getValue();
				if (value) {
					value.accept(new InternalValueCollector(this.entries));
				}
			}
		}
		return true;
	}
}

class ColorValueCollector implements nodes.IVisitor {

	constructor(public entries: Set) {
		// nothing to do
	}

	public visitNode(node: nodes.Node): boolean {
		if (node instanceof nodes.HexColorValue || (node instanceof nodes.Function && languageFacts.isColorConstructor(<nodes.Function>node))) {
			this.entries.add(node.getText());
		}
		return true;
	}
}

function isDefined(obj: any): boolean {
	return typeof obj !== 'undefined';
}

function getCurrentWord(document: TextDocument, offset: number) {
	let i = offset - 1;
	let text = document.getText();
	while (i >= 0 && ' \t\n\r":{[()]},*>+'.indexOf(text.charAt(i)) === -1) {
		i--;
	}
	return text.substring(i + 1, offset);
}