/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as languageFacts from '../languageFacts/facts';
import * as scssLanguageFacts from '../languageFacts/scssFacts';
import { CSSCompletion } from './cssCompletion';
import * as nodes from '../parser/cssNodes';
import { CompletionList, CompletionItemKind, TextEdit, CompletionItem } from 'vscode-languageserver-types';
import { ClientCapabilities } from '../cssLanguageTypes';

export class SCSSCompletion extends CSSCompletion {
	constructor(clientCapabilities: ClientCapabilities | undefined) {
		super('$', clientCapabilities);
	}

	protected isImportPathParent(type: nodes.NodeType): boolean {
		return type === nodes.NodeType.Forward || type === nodes.NodeType.Use || super.isImportPathParent(type);
	}

	public getCompletionForImportPath(importPathNode: nodes.Node, result: CompletionList): CompletionList {
		const parentType = importPathNode.getParent()!.type;

		if (parentType === nodes.NodeType.Forward || parentType === nodes.NodeType.Use) {
			result.items.push(...scssLanguageFacts.getBuiltinModules());
		}

		return super.getCompletionForImportPath(importPathNode, result);
	}

	private convertInsertTextToReplaceTextEdit(items: CompletionItem[], existingNode: nodes.Node) {
		const replaceRange = this.getCompletionRange(existingNode);
		items.forEach(i => {
			if (i.insertText) {
				i.textEdit = TextEdit.replace(replaceRange, i.insertText);
			}
		});
	}

	private sortToEnd(items: CompletionItem[]) {
		items.forEach(i => {
			i.sortText = 'z';
		});
	}

	public getCompletionsForSelector(ruleSet: nodes.RuleSet | null, isNested: boolean, result: CompletionList): CompletionList {
		const selectorFunctionCompletionItems = scssLanguageFacts.getSelectorFunctions();
		this.sortToEnd(selectorFunctionCompletionItems);

		result.items.push(...selectorFunctionCompletionItems);

		return super.getCompletionsForSelector(ruleSet, isNested, result);
	}

	public getTermProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		const builtinFunctionCompletionItems = scssLanguageFacts.getBuiltInFunctions(entry.restrictions);
		this.convertInsertTextToReplaceTextEdit(builtinFunctionCompletionItems, existingNode);
		this.sortToEnd(builtinFunctionCompletionItems);

		result.items.push(...builtinFunctionCompletionItems);

		return super.getTermProposals(entry, existingNode, result);
	}

	protected getColorProposals(entry: languageFacts.IEntry, existingNode: nodes.Node, result: CompletionList): CompletionList {
		const colorFunctionCompletionItems = scssLanguageFacts.getColorFunctions();
		this.convertInsertTextToReplaceTextEdit(colorFunctionCompletionItems, existingNode);

		result.items.push(...colorFunctionCompletionItems);

		return super.getColorProposals(entry, existingNode, result);
	}

	public getCompletionsForDeclarationProperty(declaration: nodes.Declaration, result: CompletionList): CompletionList {
		this.getCompletionForAtDirectives(result);
		this.getCompletionsForSelector(null, true, result);
		return super.getCompletionsForDeclarationProperty(declaration, result);
	}

	public getCompletionsForExtendsReference(_extendsRef: nodes.ExtendsReference, existingNode: nodes.Node, result: CompletionList): CompletionList {
		const symbols = this.getSymbolContext().findSymbolsAtOffset(this.offset, nodes.ReferenceType.Rule);
		for (const symbol of symbols) {
			const suggest: CompletionItem = {
				label: symbol.name,
				textEdit: TextEdit.replace(this.getCompletionRange(existingNode), symbol.name),
				kind: CompletionItemKind.Function
			};
			result.items.push(suggest);
		}
		return result;
	}

	public getCompletionForAtDirectives(result: CompletionList): CompletionList {
		result.items.push(...scssLanguageFacts.getAtDirectives());
		return result;
	}

	public getCompletionForTopLevel(result: CompletionList): CompletionList {
		this.getCompletionForAtDirectives(result);
		this.getCompletionForModuleLoaders(result);
		super.getCompletionForTopLevel(result);
		return result;
	}

	public getCompletionForModuleLoaders(result: CompletionList): CompletionList {
		result.items.push(...scssLanguageFacts.getModuleAtDirectives());
		return result;
	}
}
