/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import { Symbols, Symbol } from '../parser/cssSymbolScope';
import * as languageFacts from '../languageFacts/facts';
import * as strings from '../utils/strings';
import {
	ICompletionParticipant, LanguageSettings, TextDocument,
	Position, CompletionList, CompletionItem, CompletionItemKind, Range, TextEdit, InsertTextFormat, MarkupKind, CompletionItemTag, DocumentContext, LanguageServiceOptions, IPropertyData, CompletionSettings
} from '../cssLanguageTypes';

import * as nls from 'vscode-nls';
import { isDefined } from '../utils/objects';
import { CSSDataManager } from '../languageFacts/dataManager';
import { PathCompletionParticipant } from './pathCompletion';

const localize = nls.loadMessageBundle();
const SnippetFormat = InsertTextFormat.Snippet;

enum SortTexts {
	// char code 32, comes before everything
	Enums = ' ',

	Normal = 'd',

	VendorPrefixed = 'x',
	Term = 'y',
	Variable = 'z'
}

export class CSSCompletion {

	private defaultSettings?: CompletionSettings;

	private supportsMarkdown: boolean | undefined;

	position!: Position;
	offset!: number;
	currentWord!: string;
	textDocument!: TextDocument;
	styleSheet!: nodes.Stylesheet;
	symbolContext!: Symbols;
	defaultReplaceRange!: Range;
	nodePath!: nodes.Node[];
	completionParticipants: ICompletionParticipant[] = [];
	documentSettings?: CompletionSettings;


	constructor(public variablePrefix: string | null = null, private lsOptions: LanguageServiceOptions, private cssDataManager: CSSDataManager) {
	}

	public configure(settings?: CompletionSettings) {
		this.defaultSettings = settings;
	}

	protected getSymbolContext(): Symbols {
		if (!this.symbolContext) {
			this.symbolContext = new Symbols(this.styleSheet);
		}
		return this.symbolContext;
	}

	public setCompletionParticipants(registeredCompletionParticipants: ICompletionParticipant[]) {
		this.completionParticipants = registeredCompletionParticipants || [];
	}

	public async doComplete2(document: TextDocument, position: Position, styleSheet: nodes.Stylesheet, documentContext: DocumentContext, completionSettings = this.defaultSettings): Promise<CompletionList> {
		if (!this.lsOptions.fileSystemProvider || !this.lsOptions.fileSystemProvider.readDirectory) {
			return this.doComplete(document, position, styleSheet, completionSettings);
		}

		const participant: PathCompletionParticipant = new PathCompletionParticipant(this.lsOptions.fileSystemProvider.readDirectory);
		const contributedParticipants = this.completionParticipants;
		this.completionParticipants = [participant as ICompletionParticipant].concat(contributedParticipants);

		const result = this.doComplete(document, position, styleSheet, completionSettings);
		try {
			const pathCompletionResult = await participant.computeCompletions(document, documentContext);
			return {
				isIncomplete: result.isIncomplete || pathCompletionResult.isIncomplete,
				items: pathCompletionResult.items.concat(result.items)
			};
		} finally {
			this.completionParticipants = contributedParticipants;
		}
	}


	public doComplete(document: TextDocument, position: Position, styleSheet: nodes.Stylesheet, documentSettings: CompletionSettings | undefined): CompletionList {
		this.offset = document.offsetAt(position);
		this.position = position;
		this.currentWord = getCurrentWord(document, this.offset);
		this.defaultReplaceRange = Range.create(Position.create(this.position.line, this.position.character - this.currentWord.length), this.position);
		this.textDocument = document;
		this.styleSheet = styleSheet;
		this.documentSettings = documentSettings;
		try {
			const result: CompletionList = { isIncomplete: false, items: [] };
			this.nodePath = nodes.getNodePath(this.styleSheet, this.offset);

			for (let i = this.nodePath.length - 1; i >= 0; i--) {
				const node = this.nodePath[i];
				if (node instanceof nodes.Property) {
					this.getCompletionsForDeclarationProperty(node.getParent() as nodes.Declaration, result);
				} else if (node instanceof nodes.Expression) {
					if (node.parent instanceof nodes.Interpolation) {
						this.getVariableProposals(null, result);
					} else {
						this.getCompletionsForExpression(<nodes.Expression>node, result);
					}
				} else if (node instanceof nodes.SimpleSelector) {
					const parentRef = node.findAParent(nodes.NodeType.ExtendsReference, nodes.NodeType.Ruleset);
					if (parentRef) {
						if (parentRef.type === nodes.NodeType.ExtendsReference) {
							this.getCompletionsForExtendsReference(<nodes.ExtendsReference>parentRef, node, result);
						} else {
							const parentRuleSet = <nodes.RuleSet>parentRef;
							this.getCompletionsForSelector(parentRuleSet, parentRuleSet && parentRuleSet.isNested(), result);
						}
					}
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
				} else if (node instanceof nodes.Supports) {
					this.getCompletionsForSupports(<nodes.Supports>node, result);
				} else if (node instanceof nodes.SupportsCondition) {
					this.getCompletionsForSupportsCondition(<nodes.SupportsCondition>node, result);
				} else if (node instanceof nodes.ExtendsReference) {
					this.getCompletionsForExtendsReference(<nodes.ExtendsReference>node, null, result);
				} else if (node.type === nodes.NodeType.URILiteral) {
					this.getCompletionForUriLiteralValue(node, result);
				} else if (node.parent === null) {
					this.getCompletionForTopLevel(result);
				} else if (node.type === nodes.NodeType.StringLiteral && this.isImportPathParent(node.parent.type)) {
					this.getCompletionForImportPath(node, result);
					// } else if (node instanceof nodes.Variable) {
					// this.getCompletionsForVariableDeclaration()
				} else {
					continue;
				}
				if (result.items.length > 0 || this.offset > node.offset) {
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
			this.position = null!;
			this.currentWord = null!;
			this.textDocument = null!;
			this.styleSheet = null!;
			this.symbolContext = null!;
			this.defaultReplaceRange = null!;
			this.nodePath = null!;
		}
	}

	protected isImportPathParent(type: nodes.NodeType): boolean {
		return type === nodes.NodeType.Import;
	}

	private finalize(result: CompletionList): CompletionList {
		return result;
	}

	private findInNodePath(...types: nodes.NodeType[]) {
		for (let i = this.nodePath.length - 1; i >= 0; i--) {
			const node = this.nodePath[i];
			if (types.indexOf(node.type) !== -1) {
				return node;
			}
		}
		return null;
	}

	public getCompletionsForDeclarationProperty(declaration: nodes.Declaration | null, result: CompletionList): CompletionList {
		return this.getPropertyProposals(declaration, result);
	}

	private getPropertyProposals(declaration: nodes.Declaration | null, result: CompletionList): CompletionList {
		const triggerPropertyValueCompletion = this.isTriggerPropertyValueCompletionEnabled;
		const completePropertyWithSemicolon = this.isCompletePropertyWithSemicolonEnabled;
		const properties = this.cssDataManager.getProperties();

		properties.forEach(entry => {
			let range: Range;
			let insertText: string;
			let retrigger = false;
			if (declaration) {
				range = this.getCompletionRange(declaration.getProperty());
				insertText = entry.name;
				if (!isDefined(declaration.colonPosition)) {
					insertText += ': ';
					retrigger = true;
				}
			} else {
				range = this.getCompletionRange(null);
				insertText = entry.name + ': ';
				retrigger = true;
			}
			// Empty .selector { | } case
			if (!declaration && completePropertyWithSemicolon) {
				insertText += '$0;';
			}

			// Cases such as .selector { p; } or .selector { p:; }
			if (declaration && !declaration.semicolonPosition) {
				if (completePropertyWithSemicolon && this.offset >= this.textDocument.offsetAt(range.end)) {
					insertText += '$0;';
				}
			}

			const item: CompletionItem = {
				label: entry.name,
				documentation: languageFacts.getEntryDescription(entry, this.doesSupportMarkdown()),
				tags: isDeprecated(entry) ? [CompletionItemTag.Deprecated] : [],
				textEdit: TextEdit.replace(range, insertText),
				insertTextFormat: InsertTextFormat.Snippet,
				kind: CompletionItemKind.Property
			};
			if (!entry.restrictions) {
				retrigger = false;
			}
			if (triggerPropertyValueCompletion && retrigger) {
				item.command = {
					title: 'Suggest',
					command: 'editor.action.triggerSuggest'
				};
			}
			const relevance = typeof entry.relevance === 'number' ? Math.min(Math.max(entry.relevance, 0), 99) : 50;
			const sortTextSuffix = (255 - relevance).toString(16);
			const sortTextPrefix = strings.startsWith(entry.name, '-') ? SortTexts.VendorPrefixed : SortTexts.Normal;
			item.sortText = sortTextPrefix + '_' + sortTextSuffix;
			result.items.push(item);
		});

		this.completionParticipants.forEach(participant => {
			if (participant.onCssProperty) {
				participant.onCssProperty({
					propertyName: this.currentWord,
					range: this.defaultReplaceRange
				});
			}
		});
		return result;
	}

	private get isTriggerPropertyValueCompletionEnabled(): boolean {
		return this.documentSettings?.triggerPropertyValueCompletion ?? true;
	}

	private get isCompletePropertyWithSemicolonEnabled(): boolean {
		return this.documentSettings?.completePropertyWithSemicolon ?? true;
	}

	public getCompletionsForDeclarationValue(node: nodes.Declaration, result: CompletionList): CompletionList {
		const propertyName = node.getFullPropertyName();
		const entry = this.cssDataManager.getProperty(propertyName);
		let existingNode: nodes.Node | null = node.getValue() || null;

		while (existingNode && existingNode.hasChildren()) {
			existingNode = existingNode.findChildAtOffset(this.offset, false);
		}

		this.completionParticipants.forEach(participant => {
			if (participant.onCssPropertyValue) {
				participant.onCssPropertyValue({
					propertyName,
					propertyValue: this.currentWord,
					range: this.getCompletionRange(existingNode)
				});
			}
		});

		if (entry) {
			if (entry.restrictions) {
				for (const restriction of entry.restrictions) {
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
			}
			this.getValueEnumProposals(entry, existingNode, result);
			this.getCSSWideKeywordProposals(entry, existingNode, result);
			this.getUnitProposals(entry, existingNode, result);
		} else {
			const existingValues = collectValues(this.styleSheet, node);
			for (const existingValue of existingValues.getEntries()) {
				result.items.push({
					label: existingValue,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), existingValue),
					kind: CompletionItemKind.Value
				});
			}
		}
		this.getVariableProposals(existingNode, result);
		this.getTermProposals(entry, existingNode, result);
		return result;
	}

	public getValueEnumProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		if (entry.values) {
			for (const value of entry.values) {
				let insertString = value.name;
				let insertTextFormat: InsertTextFormat | undefined;
				if (strings.endsWith(insertString, ')')) {
					const from = insertString.lastIndexOf('(');
					if (from !== -1) {
						insertString = insertString.substr(0, from) + '($1)';
						insertTextFormat = SnippetFormat;
					}
				}
				let sortText: string = SortTexts.Enums;
				if (strings.startsWith(value.name, '-')) {
					sortText += SortTexts.VendorPrefixed;
				}

				const item: CompletionItem = {
					label: value.name,
					documentation: languageFacts.getEntryDescription(value, this.doesSupportMarkdown()),
					tags: isDeprecated(entry) ? [CompletionItemTag.Deprecated] : [],
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertString),
					sortText,
					kind: CompletionItemKind.Value,
					insertTextFormat
				};
				result.items.push(item);
			}
		}
		return result;
	}

	public getCSSWideKeywordProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const keywords in languageFacts.cssWideKeywords) {
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

	public getVariableProposals(existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		const symbols = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Variable);
		for (const symbol of symbols) {
			const insertText = strings.startsWith(symbol.name, '--') ? `var(${symbol.name})` : symbol.name;
			const completionItem: CompletionItem = {
				label: symbol.name,
				documentation: symbol.value ? strings.getLimitedString(symbol.value) : symbol.value,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				kind: CompletionItemKind.Variable,
				sortText: SortTexts.Variable
			};

			if (typeof completionItem.documentation === 'string' && isColorString(completionItem.documentation)) {
				completionItem.kind = CompletionItemKind.Color;
			}

			if (symbol.node.type === nodes.NodeType.FunctionParameter) {
				const mixinNode = <nodes.MixinDeclaration>(symbol.node.getParent());
				if (mixinNode.type === nodes.NodeType.MixinDeclaration) {
					completionItem.detail = localize('completion.argument', 'argument from \'{0}\'', mixinNode.getName());
				}
			}

			result.items.push(completionItem);
		}
		return result;
	}

	public getVariableProposalsForCSSVarFunction(result: CompletionList): CompletionList {
		let symbols = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Variable);
		symbols = symbols.filter((symbol): boolean => {
			return strings.startsWith(symbol.name, '--');
		});
		for (const symbol of symbols) {
			const completionItem: CompletionItem = {
				label: symbol.name,
				documentation: symbol.value ? strings.getLimitedString(symbol.value) : symbol.value,
				textEdit: TextEdit.replace(this.getCompletionRange(null), symbol.name),
				kind: CompletionItemKind.Variable
			};

			if (typeof completionItem.documentation === 'string' && isColorString(completionItem.documentation)) {
				completionItem.kind = CompletionItemKind.Color;
			}

			result.items.push(completionItem);
		}
		return result;
	}

	public getUnitProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		let currentWord = '0';
		if (this.currentWord.length > 0) {
			const numMatch = this.currentWord.match(/^-?\d[\.\d+]*/);
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
		if (entry.restrictions) {
			for (const restriction of entry.restrictions) {
				const units = languageFacts.units[restriction];
				if (units) {
					for (const unit of units) {
						const insertText = currentWord + unit;
						result.items.push({
							label: insertText,
							textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
							kind: CompletionItemKind.Unit
						});
					}
				}
			}
		}
		return result;
	}

	protected getCompletionRange(existingNode: nodes.Node | null) {
		if (existingNode && existingNode.offset <= this.offset && this.offset <= existingNode.end) {
			const end = existingNode.end !== -1 ? this.textDocument.positionAt(existingNode.end) : this.position;
			const start = this.textDocument.positionAt(existingNode.offset);
			if (start.line === end.line) {
				return Range.create(start, end); // multi line edits are not allowed
			}
		}
		return this.defaultReplaceRange;
	}

	protected getColorProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const color in languageFacts.colors) {
			result.items.push({
				label: color,
				documentation: languageFacts.colors[color],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), color),
				kind: CompletionItemKind.Color
			});
		}
		for (const color in languageFacts.colorKeywords) {
			result.items.push({
				label: color,
				documentation: languageFacts.colorKeywords[color],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), color),
				kind: CompletionItemKind.Value
			});
		}
		const colorValues = new Set();
		this.styleSheet.acceptVisitor(new ColorValueCollector(colorValues, this.offset));
		for (const color of colorValues.getEntries()) {
			result.items.push({
				label: color,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), color),
				kind: CompletionItemKind.Color
			});
		}
		for (const p of languageFacts.colorFunctions) {
			let tabStop = 1;
			const replaceFunction = (_match: string, p1: string) => '${' + tabStop++ + ':' + p1 + '}';
			const insertText = p.func.replace(/\[?\$(\w+)\]?/g, replaceFunction);
			result.items.push({
				label: p.func.substr(0, p.func.indexOf('(')),
				detail: p.func,
				documentation: p.desc,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				insertTextFormat: SnippetFormat,
				kind: CompletionItemKind.Function
			});
		}
		return result;
	}

	protected getPositionProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const position in languageFacts.positionKeywords) {
			result.items.push({
				label: position,
				documentation: languageFacts.positionKeywords[position],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), position),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getRepeatStyleProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const repeat in languageFacts.repeatStyleKeywords) {
			result.items.push({
				label: repeat,
				documentation: languageFacts.repeatStyleKeywords[repeat],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), repeat),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getLineStyleProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const lineStyle in languageFacts.lineStyleKeywords) {
			result.items.push({
				label: lineStyle,
				documentation: languageFacts.lineStyleKeywords[lineStyle],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), lineStyle),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getLineWidthProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const lineWidth of languageFacts.lineWidthKeywords) {
			result.items.push({
				label: lineWidth,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), lineWidth),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getGeometryBoxProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const box in languageFacts.geometryBoxKeywords) {
			result.items.push({
				label: box,
				documentation: languageFacts.geometryBoxKeywords[box],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), box),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getBoxProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const box in languageFacts.boxKeywords) {
			result.items.push({
				label: box,
				documentation: languageFacts.boxKeywords[box],
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), box),
				kind: CompletionItemKind.Value
			});
		}
		return result;
	}

	protected getImageProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const image in languageFacts.imageFunctions) {
			const insertText = moveCursorInsideParenthesis(image);
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

	protected getTimingFunctionProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const timing in languageFacts.transitionTimingFunctions) {
			const insertText = moveCursorInsideParenthesis(timing);
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

	protected getBasicShapeProposals(entry: IPropertyData, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		for (const shape in languageFacts.basicShapeFunctions) {
			const insertText = moveCursorInsideParenthesis(shape);
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
		const node = this.styleSheet.findFirstChildBeforeOffset(this.offset);
		if (!node) {
			return this.getCompletionForTopLevel(result);
		}
		if (node instanceof nodes.RuleSet) {
			return this.getCompletionsForRuleSet(<nodes.RuleSet>node, result);
		}
		if (node instanceof nodes.Supports) {
			return this.getCompletionsForSupports(<nodes.Supports>node, result);
		}
		return result;
	}

	public getCompletionForTopLevel(result: CompletionList): CompletionList {
		this.cssDataManager.getAtDirectives().forEach(entry => {
			result.items.push({
				label: entry.name,
				textEdit: TextEdit.replace(this.getCompletionRange(null), entry.name),
				documentation: languageFacts.getEntryDescription(entry, this.doesSupportMarkdown()),
				tags: isDeprecated(entry) ? [CompletionItemTag.Deprecated] : [],
				kind: CompletionItemKind.Keyword
			});
		});

		this.getCompletionsForSelector(null, false, result);
		return result;
	}

	public getCompletionsForRuleSet(ruleSet: nodes.RuleSet, result: CompletionList): CompletionList {
		const declarations = ruleSet.getDeclarations();

		const isAfter = declarations && declarations.endsWith('}') && this.offset >= declarations.end;
		if (isAfter) {
			return this.getCompletionForTopLevel(result);
		}
		const isInSelectors = !declarations || this.offset <= declarations.offset;
		if (isInSelectors) {
			return this.getCompletionsForSelector(ruleSet, ruleSet.isNested(), result);
		}

		return this.getCompletionsForDeclarations(ruleSet.getDeclarations(), result);
	}

	public getCompletionsForSelector(ruleSet: nodes.RuleSet | null, isNested: boolean, result: CompletionList): CompletionList {
		const existingNode = this.findInNodePath(nodes.NodeType.PseudoSelector, nodes.NodeType.IdentifierSelector, nodes.NodeType.ClassSelector, nodes.NodeType.ElementNameSelector);
		if (!existingNode && this.hasCharacterAtPosition(this.offset - this.currentWord.length - 1, ':')) {
			// after the ':' of a pseudo selector, no node generated for just ':'
			this.currentWord = ':' + this.currentWord;
			if (this.hasCharacterAtPosition(this.offset - this.currentWord.length - 1, ':')) {
				this.currentWord = ':' + this.currentWord; // for '::'
			}
			this.defaultReplaceRange = Range.create(Position.create(this.position.line, this.position.character - this.currentWord.length), this.position);
		}

		const pseudoClasses = this.cssDataManager.getPseudoClasses();
		pseudoClasses.forEach(entry => {
			const insertText = moveCursorInsideParenthesis(entry.name);
			const item: CompletionItem = {
				label: entry.name,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				documentation: languageFacts.getEntryDescription(entry, this.doesSupportMarkdown()),
				tags: isDeprecated(entry) ? [CompletionItemTag.Deprecated] : [],
				kind: CompletionItemKind.Function,
				insertTextFormat: entry.name !== insertText ? SnippetFormat : void 0
			};
			if (strings.startsWith(entry.name, ':-')) {
				item.sortText = SortTexts.VendorPrefixed;
			}
			result.items.push(item);
		});

		const pseudoElements = this.cssDataManager.getPseudoElements();
		pseudoElements.forEach(entry => {
			const insertText = moveCursorInsideParenthesis(entry.name);
			const item: CompletionItem = {
				label: entry.name,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), insertText),
				documentation: languageFacts.getEntryDescription(entry, this.doesSupportMarkdown()),
				tags: isDeprecated(entry) ? [CompletionItemTag.Deprecated] : [],
				kind: CompletionItemKind.Function,
				insertTextFormat: entry.name !== insertText ? SnippetFormat : void 0
			};
			if (strings.startsWith(entry.name, '::-')) {
				item.sortText = SortTexts.VendorPrefixed;
			}
			result.items.push(item);
		});
		if (!isNested) { // show html tags only for top level
			for (const entry of languageFacts.html5Tags) {
				result.items.push({
					label: entry,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), entry),
					kind: CompletionItemKind.Keyword
				});
			}
			for (const entry of languageFacts.svgElements) {
				result.items.push({
					label: entry,
					textEdit: TextEdit.replace(this.getCompletionRange(existingNode), entry),
					kind: CompletionItemKind.Keyword
				});
			}
		}

		const visited: { [name: string]: boolean } = {};
		visited[this.currentWord] = true;
		const docText = this.textDocument.getText();
		this.styleSheet.accept(n => {
			if (n.type === nodes.NodeType.SimpleSelector && n.length > 0) {
				const selector = docText.substr(n.offset, n.length);
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
			const selector = ruleSet.getSelectors().findFirstChildBeforeOffset(this.offset);
			if (selector && ruleSet.getSelectors().getChildren().indexOf(selector) === 0) {
				this.getPropertyProposals(null, result);
			}
		}
		return result;
	}

	public getCompletionsForDeclarations(declarations: nodes.Declarations | null | undefined, result: CompletionList): CompletionList {
		if (!declarations || this.offset === declarations.offset) { // incomplete nodes
			return result;
		}

		const node = declarations.findFirstChildBeforeOffset(this.offset);
		if (!node) {
			return this.getCompletionsForDeclarationProperty(null, result);
		}


		if (node instanceof nodes.AbstractDeclaration) {
			const declaration = <nodes.AbstractDeclaration>node;
			if (!isDefined(declaration.colonPosition) || this.offset <= declaration.colonPosition) {

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
		} else if (node instanceof nodes.ExtendsReference) {
			this.getCompletionsForExtendsReference(node, null, result);
		} else if (this.currentWord && this.currentWord[0] === '@') {
			this.getCompletionsForDeclarationProperty(null, result);
		} else if (node instanceof nodes.RuleSet) {
			this.getCompletionsForDeclarationProperty(null, result);
		}

		return result;
	}

	public getCompletionsForVariableDeclaration(declaration: nodes.VariableDeclaration, result: CompletionList): CompletionList {
		if (this.offset && isDefined(declaration.colonPosition) && this.offset > declaration.colonPosition) {
			this.getVariableProposals(declaration.getValue(), result);
		}
		return result;
	}

	public getCompletionsForExpression(expression: nodes.Expression, result: CompletionList): CompletionList {
		const parent = expression.getParent();
		if (parent instanceof nodes.FunctionArgument) {
			this.getCompletionsForFunctionArgument(parent, <nodes.Function>parent.getParent(), result);
			return result;
		}

		const declaration = <nodes.Declaration>expression.findParent(nodes.NodeType.Declaration);
		if (!declaration) {
			this.getTermProposals(undefined, null, result);
			return result;
		}

		const node = expression.findChildAtOffset(this.offset, true);
		if (!node) {
			return this.getCompletionsForDeclarationValue(declaration, result);
		}
		if (node instanceof nodes.NumericValue || node instanceof nodes.Identifier) {
			return this.getCompletionsForDeclarationValue(declaration, result);
		}
		return result;
	}

	public getCompletionsForFunctionArgument(arg: nodes.FunctionArgument | null, func: nodes.Function, result: CompletionList): CompletionList {
		const identifier = func.getIdentifier();
		if (identifier && identifier.matches('var')) {
			if (!func.getArguments().hasChildren() || func.getArguments().getChild(0) === arg) {
				this.getVariableProposalsForCSSVarFunction(result);
			}
		}
		return result;
	}

	public getCompletionsForFunctionDeclaration(decl: nodes.FunctionDeclaration, result: CompletionList): CompletionList {
		const declarations = decl.getDeclarations();
		if (declarations && this.offset > declarations.offset && this.offset < declarations.end) {
			this.getTermProposals(undefined, null, result);
		}
		return result;
	}

	public getCompletionsForMixinReference(ref: nodes.MixinReference, result: CompletionList): CompletionList {
		const allMixins = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Mixin);
		for (const mixinSymbol of allMixins) {
			if (mixinSymbol.node instanceof nodes.MixinDeclaration) {
				result.items.push(this.makeTermProposal(mixinSymbol, mixinSymbol.node.getParameters(), null));
			}
		}

		const identifierNode: nodes.Node | null = ref.getIdentifier() || null;

		this.completionParticipants.forEach(participant => {
			if (participant.onCssMixinReference) {
				participant.onCssMixinReference({
					mixinName: this.currentWord,
					range: this.getCompletionRange(identifierNode)
				});
			}
		});

		return result;
	}

	public getTermProposals(entry: IPropertyData | undefined, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		const allFunctions = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Function);
		for (const functionSymbol of allFunctions) {
			if (functionSymbol.node instanceof nodes.FunctionDeclaration) {
				result.items.push(this.makeTermProposal(functionSymbol, functionSymbol.node.getParameters(), existingNode));
			}
		}
		return result;
	}

	private makeTermProposal(symbol: Symbol, parameters: nodes.Nodelist, existingNode: nodes.Node | null): CompletionItem {
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
			sortText: SortTexts.Term
		};
	}

	public getCompletionsForSupportsCondition(supportsCondition: nodes.SupportsCondition, result: CompletionList): CompletionList {
		const child = supportsCondition.findFirstChildBeforeOffset(this.offset);
		if (child) {
			if (child instanceof nodes.Declaration) {
				if (!isDefined(child.colonPosition) || this.offset <= child.colonPosition) {
					return this.getCompletionsForDeclarationProperty(child, result);
				} else {
					return this.getCompletionsForDeclarationValue(child, result);
				}
			} else if (child instanceof nodes.SupportsCondition) {
				return this.getCompletionsForSupportsCondition(child, result);
			}
		}
		if (isDefined(supportsCondition.lParent) && this.offset > supportsCondition.lParent && (!isDefined(supportsCondition.rParent) || this.offset <= supportsCondition.rParent)) {
			return this.getCompletionsForDeclarationProperty(null, result);
		}
		return result;
	}

	public getCompletionsForSupports(supports: nodes.Supports, result: CompletionList): CompletionList {
		const declarations = supports.getDeclarations();

		const inInCondition = !declarations || this.offset <= declarations.offset;
		if (inInCondition) {
			const child = supports.findFirstChildBeforeOffset(this.offset);
			if (child instanceof nodes.SupportsCondition) {
				return this.getCompletionsForSupportsCondition(child, result);
			}
			return result;
		}
		return this.getCompletionForTopLevel(result);
	}

	public getCompletionsForExtendsReference(extendsRef: nodes.ExtendsReference, existingNode: nodes.Node | null, result: CompletionList): CompletionList {
		return result;
	}

	public getCompletionForUriLiteralValue(uriLiteralNode: nodes.Node, result: CompletionList): CompletionList {
		let uriValue: string;
		let position: Position;
		let range: Range;
		// No children, empty value
		if (!uriLiteralNode.hasChildren()) {
			uriValue = '';
			position = this.position;
			const emptyURIValuePosition = this.textDocument.positionAt(uriLiteralNode.offset + 'url('.length);
			range = Range.create(emptyURIValuePosition, emptyURIValuePosition);
		} else {
			const uriValueNode = uriLiteralNode.getChild(0)!;
			uriValue = uriValueNode.getText();
			position = this.position;
			range = this.getCompletionRange(uriValueNode);
		}
		this.completionParticipants.forEach(participant => {
			if (participant.onCssURILiteralValue) {
				participant.onCssURILiteralValue({
					uriValue,
					position,
					range
				});
			}
		});

		return result;
	}

	public getCompletionForImportPath(importPathNode: nodes.Node, result: CompletionList): CompletionList {
		this.completionParticipants.forEach(participant => {
			if (participant.onCssImportPath) {
				participant.onCssImportPath({
					pathValue: importPathNode.getText(),
					position: this.position,
					range: this.getCompletionRange(importPathNode)
				});
			}
		});
		return result;
	}

	private hasCharacterAtPosition(offset: number, char: string) {
		const text = this.textDocument.getText();
		return (offset >= 0 && offset < text.length) && text.charAt(offset) === char;
	}

	private doesSupportMarkdown() {
		if (!isDefined(this.supportsMarkdown)) {
			if (!isDefined(this.lsOptions.clientCapabilities)) {
				this.supportsMarkdown = true;
				return this.supportsMarkdown;
			}
			const documentationFormat = this.lsOptions.clientCapabilities.textDocument?.completion?.completionItem?.documentationFormat;
			this.supportsMarkdown = Array.isArray(documentationFormat) && documentationFormat.indexOf(MarkupKind.Markdown) !== -1;
		}
		return <boolean>this.supportsMarkdown;
	}
}

function isDeprecated(entry: languageFacts.IEntry2): boolean {
	if (entry.status && (entry.status === 'nonstandard' || entry.status === 'obsolete')) {
		return true;
	}

	return false;
}

/**
 * Rank number should all be same length strings
 */
function computeRankNumber(n: Number): string {
	const nstr = n.toString();
	switch (nstr.length) {
		case 4:
			return nstr;
		case 3:
			return '0' + nstr;
		case 2:
			return '00' + nstr;
		case 1:
			return '000' + nstr;
		default:
			return '0000';
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

function moveCursorInsideParenthesis(text: string): string {
	return text.replace(/\(\)$/, "($1)");
}

function collectValues(styleSheet: nodes.Stylesheet, declaration: nodes.Declaration): Set {
	const fullPropertyName = declaration.getFullPropertyName();
	const entries: Set = new Set();

	function visitValue(node: nodes.Node) {
		if (node instanceof nodes.Identifier || node instanceof nodes.NumericValue || node instanceof nodes.HexColorValue) {
			entries.add(node.getText());
		}
		return true;
	}

	function matchesProperty(decl: nodes.Declaration): boolean {
		const propertyName = decl.getFullPropertyName();
		return fullPropertyName === propertyName;
	}

	function vistNode(node: nodes.Node): boolean {
		if (node instanceof nodes.Declaration && node !== declaration) {
			if (matchesProperty(<nodes.Declaration>node)) {
				const value = (<nodes.Declaration>node).getValue();
				if (value) {
					value.accept(visitValue);
				}
			}
		}
		return true;
	}
	styleSheet.accept(vistNode);
	return entries;
}


class ColorValueCollector implements nodes.IVisitor {

	constructor(public entries: Set, private currentOffset: number) {
		// nothing to do
	}

	public visitNode(node: nodes.Node): boolean {
		if (node instanceof nodes.HexColorValue || (node instanceof nodes.Function && languageFacts.isColorConstructor(<nodes.Function>node))) {
			if (this.currentOffset < node.offset || node.end < this.currentOffset) {
				this.entries.add(node.getText());
			}
		}
		return true;
	}
}

function getCurrentWord(document: TextDocument, offset: number): string {
	let i = offset - 1;
	const text = document.getText();
	while (i >= 0 && ' \t\n\r":{[()]},*>+'.indexOf(text.charAt(i)) === -1) {
		i--;
	}
	return text.substring(i + 1, offset);
}

function isColorString(s: string) {
	// From https://stackoverflow.com/questions/8027423/how-to-check-if-a-string-is-a-valid-hex-color-representation/8027444
	return (s.toLowerCase() in languageFacts.colors) || /(^#[0-9A-F]{6}$)|(^#[0-9A-F]{3}$)/i.test(s);
}
