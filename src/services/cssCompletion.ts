/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import {Symbols, Symbol} from '../parser/cssSymbolScope';
import * as languageFacts from './languageFacts';
import * as strings from '../utils/strings';
import {findFirst} from '../utils/arrays';
import {TextDocument, Position, CompletionList, CompletionItem, CompletionItemKind, Range, SnippetString} from 'vscode-languageserver-types';

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
					this.getCompletionsForSelector(parentRuleSet, result);
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
				}else if (node instanceof nodes.Function) {
					this.getCompletionsForFunctionArgument(null, <nodes.Function>node, result);
				}
				if (result.items.length > 0) {
					return result;
				}
			}
			this.getCompletionsForStylesheet(result);
			if (result.items.length > 0) {
				return result;
			}

			if (this.variablePrefix && this.currentWord.indexOf(this.variablePrefix) === 0) {
				this.getVariableProposals(null, result);
				if (result.items.length > 0) {
					return result;
				}
			}

			// no match, don't show text matches
			return result;

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
					result.items.push({
						label: entry.name,
						documentation: languageFacts.getEntryDescription(entry),
						insertText,
						range,
						kind: CompletionItemKind.Property
					});
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
			this.getColorProposals(entry, existingNode, result);
			this.getPositionProposals(entry, existingNode, result);
			this.getRepeatStyleProposals(entry, existingNode, result);
			this.getLineProposals(entry, existingNode, result);
			this.getBoxProposals(entry, existingNode, result);
			this.getImageProposals(entry, existingNode, result);
			this.getTimingFunctionProposals(entry, existingNode, result);
			this.getBasicShapeProposals(entry, existingNode, result);
			this.getValueEnumProposals(entry, existingNode, result);
			this.getCSSWideKeywordProposals(entry, existingNode, result);
			this.getUnitProposals(entry, existingNode, result);
		} else {
			let existingValues = new Set();
			this.styleSheet.accept(new ValuesCollector(propertyName, existingValues));
			existingValues.getEntries().forEach((existingValue) => {
				result.items.push({
					label: existingValue,
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			});
		}
		this.getVariableProposals(existingNode, result);
		this.getTermProposals(existingNode, result);
		return result;
	}

	public getValueEnumProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.values) {
			entry.values.forEach((value) => {
				if (languageFacts.isCommonValue(value)) { // only show if supported by more than one browser
					result.items.push({
						label: value.name,
						documentation: languageFacts.getEntryDescription(value),
						range: this.getCompletionRange(existingNode),
						kind: CompletionItemKind.Value
					});
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
				range: this.getCompletionRange(existingNode),
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
			result.items.push({
				label: symbol.name,
				insertText: strings.startsWith(symbol.name, '--') ? `var(${symbol.name})` : symbol.name,
				range: this.getCompletionRange(existingNode),
				kind: CompletionItemKind.Variable
			});
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
				range: this.getCompletionRange(null),
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
		entry.restrictions.forEach((restriction) => {
			let units = languageFacts.units[restriction];
			if (units) {
				units.forEach((unit: string) => {
					result.items.push({
						label: currentWord + unit,
						range: this.getCompletionRange(existingNode),
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
		if (entry.restrictions.indexOf('color') !== -1) {
			for (let color in languageFacts.colors) {
				result.items.push({
					label: color,
					documentation: languageFacts.colors[color],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Color
				});
			}
			for (let color in languageFacts.colorKeywords) {
				result.items.push({
					label: color,
					documentation: languageFacts.colorKeywords[color],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			}
			let colorValues = new Set();
			this.styleSheet.accept(new ColorValueCollector(colorValues));
			colorValues.getEntries().forEach((color) => {
				result.items.push({
					label: color,
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Color
				});
			});
			languageFacts.colorFunctions.forEach((p) => {
				let tabStop = 1;
				let replaceFunction = (match, p1) => '${' + tabStop++ + ':' + p1 + '}';
				result.items.push({
					label: p.func.substr(0, p.func.indexOf('(')),
					detail: p.func,
					documentation: p.desc,
					insertText: SnippetString.create(p.func.replace(/\[?\$(\w+)\]?/g, replaceFunction)),
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Function
				});
			});
		}
		return result;
	}

	protected getPositionProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.restrictions.indexOf('position') !== -1) {
			for (let position in languageFacts.positionKeywords) {
				result.items.push({
					label: position,
					documentation: languageFacts.positionKeywords[position],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			}
		}
		return result;
	}

	protected getRepeatStyleProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.restrictions.indexOf('repeat') !== -1) {
			for (let repeat in languageFacts.repeatStyleKeywords) {
				result.items.push({
					label: repeat,
					documentation: languageFacts.repeatStyleKeywords[repeat],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			}
		}
		return result;
	}

	protected getLineProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.restrictions.indexOf('line-style') !== -1) {
			for (let lineStyle in languageFacts.lineStyleKeywords) {
				result.items.push({
					label: lineStyle,
					documentation: languageFacts.lineStyleKeywords[lineStyle],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			}
		}
		if (entry.restrictions.indexOf('line-width') !== -1) {
			languageFacts.lineWidthKeywords.forEach((lineWidth) => {
				result.items.push({
					label: lineWidth,
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			});
		}
		return result;
	}

	protected getBoxProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		let geometryBox = entry.restrictions.indexOf('geometry-box');
		if (geometryBox !== -1) {
			for (let box in languageFacts.geometryBoxKeywords) {
				result.items.push({
					label: box,
					documentation: languageFacts.geometryBoxKeywords[box],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			}
		}
		if (entry.restrictions.indexOf('box') !== -1 || geometryBox !== -1) {
			for (let box in languageFacts.boxKeywords) {
				result.items.push({
					label: box,
					documentation: languageFacts.boxKeywords[box],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Value
				});
			}
		}
		return result;
	}

	protected getImageProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.restrictions.indexOf('image') !== -1) {
			for (let image in languageFacts.imageFunctions) {
				result.items.push({
					label: image,
					documentation: languageFacts.imageFunctions[image],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Function
				});
			}
		}
		return result;
	}

	protected getTimingFunctionProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.restrictions.indexOf('timing-function') !== -1) {
			for (let timing in languageFacts.transitionTimingFunctions) {
				result.items.push({
					label: timing,
					documentation: languageFacts.transitionTimingFunctions[timing],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Function
				});
			}
		}
		return result;
	}

	protected getBasicShapeProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		if (entry.restrictions.indexOf('shape') !== -1) {
			for (let shape in languageFacts.basicShapeFunctions) {
				result.items.push({
					label: shape,
					documentation: languageFacts.basicShapeFunctions[shape],
					range: this.getCompletionRange(existingNode),
					kind: CompletionItemKind.Function
				});
			}
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
					range: this.getCompletionRange(null),
					documentation: languageFacts.getEntryDescription(entry),
					kind: CompletionItemKind.Keyword
				});
			}
		});
		this.getCompletionsForSelector(null, result);
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
			let currentWordStart = this.textDocument.offsetAt(this.defaultReplaceRange.start);
			while (currentWordStart > 0 && this.textDocument.getText().charAt(currentWordStart - 1) === ':') {
				currentWordStart--;
			}
			return this.getCompletionsForSelector(ruleSet, result);
		}
		ruleSet.findParent(nodes.NodeType.Ruleset);

		return this.getCompletionsForDeclarations(ruleSet.getDeclarations(), result);
	}

	public getCompletionsForSelector(ruleSet: nodes.RuleSet, result: CompletionList): CompletionList {
		let existingNode = this.findInNodePath(nodes.NodeType.PseudoSelector, nodes.NodeType.IdentifierSelector, nodes.NodeType.ClassSelector, nodes.NodeType.ElementNameSelector);
		if (!existingNode && this.currentWord.length === 0 && this.offset > 0 && this.textDocument.getText()[this.offset - 1] === ':') {
			// after the ':' of a pseudo selector, no node generated for just ':'
			this.currentWord = ':';
			this.defaultReplaceRange = Range.create(Position.create(this.position.line, this.position.character - 1), this.position);
		}
		
		languageFacts.getPseudoClasses().forEach((entry) => {
			if (entry.browsers.onCodeComplete) {
				result.items.push({
					label: entry.name,
					range: this.getCompletionRange(existingNode),
					documentation: languageFacts.getEntryDescription(entry),
					kind: CompletionItemKind.Function
				});
			}
		});
		languageFacts.getPseudoElements().forEach((entry) => {
			if (entry.browsers.onCodeComplete) {
				result.items.push({
					label: entry.name,
					range: this.getCompletionRange(existingNode),
					documentation: languageFacts.getEntryDescription(entry),
					kind: CompletionItemKind.Function
				});
			}
		});
		languageFacts.html5Tags.forEach((entry) => {
			result.items.push({
				label: entry,
				range: this.getCompletionRange(existingNode),
				kind: CompletionItemKind.Keyword
			});
		});
		languageFacts.svgElements.forEach((entry) => {
			result.items.push({
				label: entry,
				range: this.getCompletionRange(existingNode),
				kind: CompletionItemKind.Keyword
			});
		});

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
						range: this.getCompletionRange(existingNode),
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
		if (!declarations) { // incomplete nodes
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
			this.getTermProposals(null, result);
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
			this.getTermProposals(null, result);
		}
		return result;
	}

	public getCompletionsForMixinReference(ref: nodes.MixinReference, result: CompletionList): CompletionList {
		let allMixins = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Mixin);
		allMixins.forEach((mixinSymbol) => {
			if (mixinSymbol.node instanceof nodes.MixinDeclaration) {
				result.items.push(this.makeTermProposal(null, mixinSymbol));
			}
		});
		return result;
	}

	public getTermProposals(existingNode: nodes.Node, result: CompletionList): CompletionList {
		let allFunctions = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Function);
		allFunctions.forEach((functionSymbol) => {
			if (functionSymbol.node instanceof nodes.FunctionDeclaration) {
				result.items.push(this.makeTermProposal(existingNode, functionSymbol));
			}
		});
		return result;
	}

	public makeTermProposal(existingNode: nodes.Node, symbol: Symbol): CompletionItem {
		const decl = <nodes.FunctionDeclaration>symbol.node;
		const params = decl.getParameters().getChildren().map((c) => {
			return (c instanceof nodes.FunctionParameter) ? (<nodes.FunctionParameter>c).getName() : c.getText();
		});
		
		return {
			label: symbol.name,
			detail: symbol.name + '(' + params.join(', ') + ')',
			insertText: SnippetString.create(symbol.name + '(' + params.map((p, index) => '${' + (index + 1) + ':' + p + '}').join(', ') + ')'),
			range: this.getCompletionRange(existingNode),
			kind: CompletionItemKind.Function
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
	while (i >= 0 && ' \t\n\r":{[()]},'.indexOf(text.charAt(i)) === -1) {
		i--;
	}
	return text.substring(i + 1, offset);
}