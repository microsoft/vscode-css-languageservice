/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import path from 'node:path';
import {
	Command, CompletionItemKind, CompletionList, getCSSLanguageService, getLESSLanguageService, getSCSSLanguageService,
	ICSSDataProvider, InsertTextFormat, LanguageSettings, MarkupContent, MixinReferenceCompletionContext,
	PropertyCompletionContext, PropertyValueCompletionContext, TextDocument, URILiteralCompletionContext,
	ImportPathCompletionContext
} from '../../cssLanguageService.js';
import { TextEdit } from 'vscode-languageserver-types';
import { getDocumentContext } from './documentContext.js';
import { getFsProvider } from './fsProvider.js';

export interface ItemDescription {
	label: string;
	detail?: string;
	documentation?: string | MarkupContent | null;
	documentationIncludes?: string;
	kind?: CompletionItemKind;
	insertTextFormat?: InsertTextFormat;
	resultText?: string;
	notAvailable?: boolean;
	command?: Command;
	sortText?: string;
}

function assertCompletion(completions: CompletionList, expected: ItemDescription, document: TextDocument): void {
	const matches = completions.items.filter(completion => completion.label === expected.label);
	if (expected.notAvailable) {
		assert.equal(matches.length, 0, expected.label + ' should not be present');
	} else {
		assert.equal(matches.length, 1, expected.label + ' should only existing once: Actual: ' + completions.items.map(c => c.label).join(', '));
	}
	const match = matches[0];
	if (expected.detail) {
		assert.equal(match.detail, expected.detail);
	}
	if (expected.documentation) {
		assert.deepEqual(match.documentation, expected.documentation);
	}
	if (expected.documentationIncludes) {
		assert.ok(match.documentation !== undefined);
		if (typeof match.documentation === 'string') {
			assert.ok(match.documentation.includes(expected.documentationIncludes));
		} else {
			assert.ok(match.documentation!.value.includes(expected.documentationIncludes));
		}
	}
	if (expected.kind) {
		assert.equal(match.kind, expected.kind);
	}
	if (expected.resultText && match.textEdit) {
		const edit = TextEdit.is(match.textEdit) ? match.textEdit : TextEdit.replace(match.textEdit.replace, match.textEdit.newText);
		assert.equal(TextDocument.applyEdits(document, [edit]), expected.resultText);
	}
	if (expected.insertTextFormat) {
		assert.equal(match.insertTextFormat, expected.insertTextFormat);
	}
	if (expected.command) {
		assert.deepEqual(match.command, expected.command);
	}
	if (expected.sortText) {
		assert.equal(match.sortText, expected.sortText);
	}
}

export type ExpectedCompetions = {
	count?: number;
	items?: ItemDescription[];
	participant?: {
		onProperty?: PropertyCompletionContext[];
		onPropertyValue?: PropertyValueCompletionContext[];
		onURILiteralValue?: URILiteralCompletionContext[];
		onImportPath?: ImportPathCompletionContext[];
		onMixinReference?: MixinReferenceCompletionContext[];
	};
};

export async function testCompletionFor(
	value: string,
	expected: ExpectedCompetions,
	settings: LanguageSettings = {
		completion: {
			triggerPropertyValueCompletion: true,
			completePropertyWithSemicolon: false
		}
	},
	testUri = 'test://test/test.css',
	workspaceFolderUri = 'test://test',
	customData: ICSSDataProvider[] = [],
): Promise<void> {
	const offset = value.indexOf('|');
	assert.ok(offset !== -1, '| missing in ' + value);
	value = value.slice(0, offset) + value.slice(offset + 1);
	const actualPropertyContexts: PropertyCompletionContext[] = [];
	const actualPropertyValueContexts: PropertyValueCompletionContext[] = [];
	const actualURILiteralValueContexts: URILiteralCompletionContext[] = [];
	const actualImportPathContexts: ImportPathCompletionContext[] = [];
	const actualMixinReferenceContexts: MixinReferenceCompletionContext[] = [];
	const lang = path.extname(testUri).slice(1);
	const lsOptions = { fileSystemProvider: getFsProvider() };
	const ls = lang === 'scss' ? getSCSSLanguageService(lsOptions) : lang === 'less' ? getLESSLanguageService(lsOptions) : getCSSLanguageService(lsOptions);
	ls.setDataProviders(true, customData);
	ls.configure(settings);
	if (expected.participant) {
		ls.setCompletionParticipants([{
			onCssProperty: context => actualPropertyContexts.push(context),
			onCssPropertyValue: context => actualPropertyValueContexts.push(context),
			onCssURILiteralValue: context => actualURILiteralValueContexts.push(context),
			onCssImportPath: context => actualImportPathContexts.push(context),
			onCssMixinReference: context => actualMixinReferenceContexts.push(context)
		}]);
	}
	const document = TextDocument.create(testUri, lang, 0, value);
	const list = await ls.doComplete2(document, document.positionAt(offset), ls.parseStylesheet(document), getDocumentContext(workspaceFolderUri));
	if (typeof expected.count === 'number') {
		assert.equal(list.items.length, expected.count);
	}
	expected.items?.forEach(item => assertCompletion(list, item, document));
	if (expected.participant?.onProperty) {
		assert.deepEqual(actualPropertyContexts, expected.participant.onProperty);
	}
	if (expected.participant?.onPropertyValue) {
		assert.deepEqual(actualPropertyValueContexts, expected.participant.onPropertyValue);
	}
	if (expected.participant?.onURILiteralValue) {
		assert.deepEqual(actualURILiteralValueContexts, expected.participant.onURILiteralValue);
	}
	if (expected.participant?.onImportPath) {
		assert.deepEqual(actualImportPathContexts, expected.participant.onImportPath);
	}
	if (expected.participant?.onMixinReference) {
		assert.deepEqual(actualMixinReferenceContexts, expected.participant.onMixinReference);
	}
}
