/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';

import { assertCompletion, ItemDescription } from '../css/completion.test';
import { getLESSLanguageService, Position, TextDocument, ClientCapabilities, MixinReferenceCompletionContext } from '../../cssLanguageService';
import { newRange } from '../css/navigation.test';

suite('LESS - Completions', () => {

	let testCompletionFor = function(
		value: string,
		expected: {
			count?: number,
			items?: ItemDescription[],
			participant?: {
				onMixinReference?: MixinReferenceCompletionContext[],
			},
		},
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

		let document = TextDocument.create('test://test/test.less', 'less', 0, value);
		let position = Position.create(0, offset);
		let jsonDoc = ls.parseStylesheet(document);
		let list = ls.doComplete(document, position, jsonDoc);

		if (expected.count) {
			assert.equal(list.items, expected.count);
		}
		if (expected.items) {
			for (let item of expected.items) {
				assertCompletion(list, item, document, offset);
			}
		}
		if (expected.participant) {
			if (expected.participant.onMixinReference) {
				assert.deepEqual(actualMixinReferenceContexts, expected.participant.onMixinReference);
			}
		}
	};

	test('stylesheet', function(): any {
		testCompletionFor('body { |', {
			items: [
				{ label: 'display' },
				{ label: 'background' }
			]
		});
		testCompletionFor('body { ver|', {
			items: [
				{ label: 'vertical-align' }
			]
		});
		testCompletionFor('body { word-break: |', {
			items: [
				{ label: 'keep-all' }
			]
		});
		testCompletionFor('body { inner { vertical-align: |}', {
			items: [
				{ label: 'bottom' }
			]
		});
		testCompletionFor('@var1: 3; body { inner { vertical-align: |}', {
			items: [
				{ label: '@var1', documentation: '3' }
			]
		});
		testCompletionFor('@var1: { content: 1; }; body { inner { vertical-align: |}', {
			items: [
				{ label: '@var1', documentation: '{ content: 1; }' }
			]
		});
		testCompletionFor('.mixin(@a: 1, @b) { content: @|}', {
			items: [
				{ label: '@a', documentation: '1', detail: 'argument from \'.mixin\'' },
				{ label: '@b', documentation: null, detail: 'argument from \'.mixin\'' }
			]
		});
		testCompletionFor('.foo { background-color: d|', {
			items: [
				{ label: 'darken' },
				{ label: 'desaturate' }
			]
		});
		testCompletionFor('.btn-group { .btn:| }', {
			items: [
				{ label: '::after', resultText: '.btn-group { .btn::after }' }
			]
		});
		testCompletionFor('.foo { &:|', {
			items: [
				{ label: ':last-of-type', resultText: '.foo { &:last-of-type' }
			]
		});
		testCompletionFor('.foo { &:l|', {
			items: [
				{ label: ':last-of-type', resultText: '.foo { &:last-of-type' }
			]
		});
		testCompletionFor('.foo { appearance:| }', {
			items: [
				{
					label: 'inherit', resultText: '.foo { appearance:inherit }'
				}
			]
		});
		testCompletionFor('.foo { mask: no|', { // bug 76572
			items: [
				{ label: 'round' }
			]
		});

		// https://github.com/Microsoft/vscode/issues/71791
		test('Items that start with `-` are sorted lower than normal attribute values', () => {
			testCompletionFor('.foo { display: | }', {
				items: [
					{ label: 'grid', sortText: 'd' },
					{ label: '-moz-grid', sortText: 'x' },
					{ label: '-ms-grid', sortText: 'x' },
				]
			});
		});
	});

	test('suggestParticipants', function(): any {
		testCompletionFor(`html { .m| }`, {
			participant: {
				onMixinReference: [{ mixinName: '.m', range: newRange(7, 9) }]
			}
		});

		testCompletionFor(`html { .mixin(|) }`, {
			participant: {
				onMixinReference: [{ mixinName: '', range: newRange(14, 14) }]
			}
		});
	});
});
