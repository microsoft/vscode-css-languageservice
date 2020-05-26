/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { testCompletionFor as testCSSCompletionFor, ExpectedCompetions } from '../css/completion.test';
import { LanguageSettings } from '../../cssLanguageService';
import { newRange } from '../css/navigation.test';

function testCompletionFor(
	value: string,
	expected: ExpectedCompetions,
	settings: LanguageSettings | undefined = undefined,
	testUri: string = 'test://test/test.less',
	workspaceFolderUri: string = 'test://test'
) {
	return testCSSCompletionFor(value, expected, settings, testUri, workspaceFolderUri);
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
