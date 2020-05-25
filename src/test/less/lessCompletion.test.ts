/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';

import { assertCompletion, ItemDescription } from '../css/completion.test';
import { getLESSLanguageService, Position, TextDocument, ClientCapabilities, MixinReferenceCompletionContext } from '../../cssLanguageService';
import { newRange } from '../css/navigation.test';
import { getDocumentContext } from '../testUtil/documentContext';

async function testCompletionFor(
	value: string,
	expected: {
		count?: number,
		items?: ItemDescription[],
		participant?: {
			onMixinReference?: MixinReferenceCompletionContext[],
		},
	},
	testUri: string = 'test://test/test.less',
	workspaceFolderUri: string = 'test://test'
) {
	let offset = value.indexOf('|');
	value = value.substr(0, offset) + value.substr(offset + 1);

	let actualMixinReferenceContexts: MixinReferenceCompletionContext[] = [];

	let ls = getLESSLanguageService();

	if (expected.participant) {
		ls.setCompletionParticipants([
			{
				onCssMixinReference: context => actualMixinReferenceContexts.push(context)
			}
		]);
	}

	const context = getDocumentContext(testUri, workspaceFolderUri);

	let document = TextDocument.create(testUri, 'less', 0, value);
	let position = Position.create(0, offset);
	let jsonDoc = ls.parseStylesheet(document);
	let list = await ls.doComplete2(document, position, jsonDoc, context);

	if (expected.count) {
		assert.equal(list.items, expected.count);
	}
	if (expected.items) {
		for (let item of expected.items) {
			assertCompletion(list, item, document);
		}
	}
	if (expected.participant) {
		if (expected.participant.onMixinReference) {
			assert.deepEqual(actualMixinReferenceContexts, expected.participant.onMixinReference);
		}
	}
};


suite('LESS - Completions', () => {
	test('stylesheet', async () => {
		await testCompletionFor('body { |', {
			items: [
				{ label: 'display' },
				{ label: 'background' }
			]
		});
		await testCompletionFor('body { ver|', {
			items: [
				{ label: 'vertical-align' }
			]
		});
		await testCompletionFor('body { word-break: |', {
			items: [
				{ label: 'keep-all' }
			]
		});
		await testCompletionFor('body { inner { vertical-align: |}', {
			items: [
				{ label: 'bottom' }
			]
		});
		await testCompletionFor('@var1: 3; body { inner { vertical-align: |}', {
			items: [
				{ label: '@var1', documentation: '3' }
			]
		});
		await testCompletionFor('@var1: { content: 1; }; body { inner { vertical-align: |}', {
			items: [
				{ label: '@var1', documentation: '{ content: 1; }' }
			]
		});
		await testCompletionFor('.mixin(@a: 1, @b) { content: @|}', {
			items: [
				{ label: '@a', documentation: '1', detail: 'argument from \'.mixin\'' },
				{ label: '@b', documentation: null, detail: 'argument from \'.mixin\'' }
			]
		});
		await testCompletionFor('.foo { background-color: d|', {
			items: [
				{ label: 'darken' },
				{ label: 'desaturate' }
			]
		});
		await testCompletionFor('.btn-group { .btn:| }', {
			items: [
				{ label: '::after', resultText: '.btn-group { .btn::after }' }
			]
		});
		await testCompletionFor('.foo { &:|', {
			items: [
				{ label: ':last-of-type', resultText: '.foo { &:last-of-type' }
			]
		});
		await testCompletionFor('.foo { &:l|', {
			items: [
				{ label: ':last-of-type', resultText: '.foo { &:last-of-type' }
			]
		});
		await testCompletionFor('.foo { appearance:| }', {
			items: [
				{
					label: 'inherit', resultText: '.foo { appearance:inherit }'
				}
			]
		});
		await testCompletionFor('.foo { mask: no|', { // bug 76572
			items: [
				{ label: 'round' }
			]
		});
	});

	// https://github.com/Microsoft/vscode/issues/71791
	test('Items that start with `-` are sorted lower than normal attribute values', async () => {
		await testCompletionFor('.foo { display: | }', {
			items: [
				{ label: 'grid', sortText: ' d_0005' },
				{ label: '-moz-grid', sortText: ' x_0014' },
				{ label: '-ms-grid', sortText: ' x_0025' },
			]
		});
	});

	test('suggestParticipants', async () => {
		await testCompletionFor(`html { .m| }`, {
			participant: {
				onMixinReference: [{ mixinName: '.m', range: newRange(7, 9) }]
			}
		});

		await testCompletionFor(`html { .mixin(|) }`, {
			participant: {
				onMixinReference: [{ mixinName: '', range: newRange(14, 14) }]
			}
		});
	});
});
