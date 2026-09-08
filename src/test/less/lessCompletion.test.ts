/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { suite, test } from 'node:test';
import { testCompletionFor as testCSSCompletionFor, ExpectedCompetions } from '../testUtil/completion.js';
import { LanguageSettings, Position } from '../../cssLanguageService.js';
import { newRange } from '../testUtil/navigation.js';

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
				{ label: 'grid', sortText: ' ' },
				{ label: '-moz-grid', sortText: ' x' },
				{ label: '-ms-grid', sortText: ' x' },
			]
		});
	});

	test('no completions in comments', async () => {
		await testCompletionFor('// foo:|', { count: 0 });
		await testCompletionFor('.foo { // colo|\n}', { count: 0 });
		await testCompletionFor('.foo { /* colo| */ }', { count: 0 });
		// an unterminated `url(` must not leave the scanner in URL mode for the rest of the document
		await testCompletionFor('.foo { background: url(\n}\n// colo|', { count: 0 });
	});

	test('completions next to comments', async () => {
		await testCompletionFor('// foo\n.foo { colo| }', { items: [{ label: 'color' }] });
		// `//` inside an unquoted URL does not start a comment
		await testCompletionFor('.foo { background: url(http://server/a.png); colo| }', { items: [{ label: 'color' }] });
		// the same holds with the cursor inside the URL, where the scan has to start before `url(`
		await testCompletionFor('.a { background: url(http://ex.com/a|) }', {
			participant: {
				onURILiteralValue: [{ uriValue: 'http://ex.com/a', position: Position.create(0, 36), range: newRange(21, 36) }]
			}
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
