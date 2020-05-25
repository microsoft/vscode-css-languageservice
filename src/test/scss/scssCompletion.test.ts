/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as path from 'path';

import { Position, InsertTextFormat, CompletionItemKind, LanguageSettings } from '../../cssLanguageService';
import { testCompletionFor as testCSSCompletionFor, ExpectedCompetions } from '../css/completion.test';
import { newRange } from '../css/navigation.test';
import { URI } from 'vscode-uri';

async function testCompletionFor(
	value: string,
	expected: ExpectedCompetions,
	settings: LanguageSettings | undefined = undefined,
	testUri: string = 'test://test/test.scss',
	workspaceFolderUri: string = 'test://test'
) {
	testCSSCompletionFor(value, expected, settings, testUri, workspaceFolderUri);
};

suite('SCSS - Completions', () => {
	test('stylesheet', async () => {
		await testCompletionFor('$i: 0; body { width: |', {
			items: [
				{ label: '$i', documentation: '0' }
			]
		});
		await testCompletionFor('@for $i from 1 through 3 { .item-#{|} { width: 2em * $i; } }', {
			items: [
				{ label: '$i' }
			]
		});
		await testCompletionFor('@for $i from 1 through 3 { .item-#{|$i} { width: 2em * $i; } }', {
			items: [
				{ label: '$i' }
			]
		});
		await testCompletionFor('.foo { background-color: d|', {
			items: [
				{ label: 'darken', resultText: '.foo { background-color: darken(\\$color: ${1:#000000}, \\$amount: ${2:0})' },
				{ label: 'desaturate' }
			]
		});
		await testCompletionFor('@function foo($x, $y) { @return $x + $y; } .foo { background-color: f|', {
			items: [
				{ label: 'foo', resultText: '@function foo($x, $y) { @return $x + $y; } .foo { background-color: foo(${1:$x}, ${2:$y})' }
			]
		});
		await testCompletionFor('@mixin mixin($a: 1, $b) { content: $|}', {
			items: [
				{ label: '$a', documentation: '1', detail: 'argument from \'mixin\'' },
				{ label: '$b', documentation: null, detail: 'argument from \'mixin\'' }
			]
		});
		await testCompletionFor('@mixin mixin($a: 1, $b) { content: $a + $b; } @include m|', {
			items: [
				{ label: 'mixin', resultText: '@mixin mixin($a: 1, $b) { content: $a + $b; } @include mixin(${1:$a}, ${2:$b})' }
			]
		});
		await testCompletionFor('di| span { } ', {
			items: [
				{ label: 'div' },
				{ label: 'display', notAvailable: true }
			]
		});
		await testCompletionFor('span { di|} ', {
			items: [
				{ notAvailable: true, label: 'div' },
				{ label: 'display' }
			]
		});
		await testCompletionFor('.foo { .|', {
			items: [
				{ label: '.foo' }
			]
		});
		// issue #250
		await testCompletionFor('.foo { display: block;|', {
			count: 0
		});
		// issue #17726
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
		// issue 33911
		await testCompletionFor('@include media(\'ddd\') { dis| &:not(:first-child) {', {
			items: [
				{ label: 'display' }
			]
		});
		// issue 43876
		await testCompletionFor('.foo { } @mixin bar { @extend | }', {
			items: [
				{ label: '.foo' }
			]
		});
		await testCompletionFor('.foo { } @mixin bar { @extend fo| }', {
			items: [
				{ label: '.foo' }
			]
		});
		// issue 76572
		await testCompletionFor('.foo { mask: no|', {
			items: [
				{ label: 'round' }
			]
		});
		// issue 76507
		await testCompletionFor('.foo { .foobar { .foobar2 {  outline-color: blue; cool  }| } .fokzlb {} .baaaa { counter - reset: unset;}', {
			items: [
				{ label: 'display' }
			]
		});
		await testCompletionFor('div { &:hover { } | }', {
			items: [
				{ label: 'display' }
			]
		});
	});

	test('suggestParticipants', async () => {
		await testCompletionFor(`html { @include | }`, {
			participant: {
				onMixinReference: [{ mixinName: '', range: newRange(16, 16) }]
			}
		});

		await testCompletionFor(`html { @include m| }`, {
			participant: {
				onMixinReference: [{ mixinName: 'm', range: newRange(16, 17) }]
			}
		});

		await testCompletionFor(`html { @include mixin(|) }`, {
			participant: {
				onMixinReference: [{ mixinName: '', range: newRange(22, 22) }]
			}
		});
	});

	test('at rules', async () => {
		const allAtProposals = {
			items: [
				{ label: '@extend' },
				{ label: '@at-root' },
				{ label: '@debug' },
				{ label: '@warn' },
				{ label: '@error' },
				{ label: '@if' },
				{ label: '@for' },
				{ label: '@each' },
				{ label: '@while' },
				{ label: '@mixin' },
				{ label: '@include' },
				{ label: '@function' }
			]
		};

		await testCompletionFor('@', {
			items: [
				{ label: '@extend' },
				{ label: '@at-root' },
				{ label: '@debug' },
				{ label: '@warn' },
				{ label: '@error' },
				{ label: '@if', insertTextFormat: InsertTextFormat.Snippet },
				{ label: '@for', insertTextFormat: InsertTextFormat.Snippet },
				{ label: '@each', insertTextFormat: InsertTextFormat.Snippet },
				{ label: '@while', insertTextFormat: InsertTextFormat.Snippet },
				{ label: '@mixin', insertTextFormat: InsertTextFormat.Snippet },
				{ label: '@include' },
				{ label: '@function' }
			]
		});

		await testCompletionFor('.foo { | }', allAtProposals);

		await testCompletionFor(`@for $i from 1 through 3 { .item-#{$i} { width: 2em * $i; } } @|`, allAtProposals);

		await testCompletionFor('.foo { @if $a = 5 { } @| }', allAtProposals);
		await testCompletionFor('.foo { @debug 10em + 22em; @| }', allAtProposals);
		await testCompletionFor('.foo { @if $a = 5 { } @f| }', {
			items: [
				{ label: '@for' }
			]
		});
	});

	suite('Modules', async () => {
		test('module-loading at-rules', async () => {
			await testCompletionFor('@', {
				items: [
					{ label: '@use', documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/at-rules/use)' },
					{ label: '@forward', documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/at-rules/forward)' },
				],
			});

			// Limit to top-level scope.
			await testCompletionFor('.foo { @| }', {
				items: [
					{ label: '@use', notAvailable: true },
					{ label: '@forward', notAvailable: true },
				],
			});

			const builtIns = {
				items: [
					{ label: 'sass:math', kind: CompletionItemKind.Module, documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/modules/math)' },
					{ label: 'sass:string', kind: CompletionItemKind.Module, documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/modules/string)' },
					{ label: 'sass:color', kind: CompletionItemKind.Module, documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/modules/color)' },
					{ label: 'sass:list', kind: CompletionItemKind.Module, documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/modules/list)' },
					{ label: 'sass:map', kind: CompletionItemKind.Module, documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/modules/map)' },
					{ label: 'sass:selector', kind: CompletionItemKind.Module, documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/modules/selector)' },
					{ label: 'sass:meta', kind: CompletionItemKind.Module, documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/modules/meta)' },
				],
			};
			await testCompletionFor(`@use '|'`, builtIns);
			await testCompletionFor(`@forward '|'`, builtIns);

			await testCompletionFor(`@use 'sass:|'`, {
				items: [
					{ label: 'sass:math', resultText: `@use 'sass:math'` }
				],
			});

			await testCompletionFor(`@use '|'`, {
				items: [
					{ label: 'sass:math', resultText: `@use 'sass:math'` }
				],
			});

			await testCompletionFor(`@use '|`, {
				items: [
					{ label: 'sass:math', resultText: `@use 'sass:math'` }
				],
			});

			await testCompletionFor(`@use './|'`, {
				participant: {
					onImportPath: [{ pathValue: `'./'`, position: Position.create(0, 8), range: newRange(5, 9) }]
				}
			});

			await testCompletionFor(`@forward './|'`, {
				participant: {
					onImportPath: [{ pathValue: `'./'`, position: Position.create(0, 12), range: newRange(9, 13) }]
				}
			});
		});
	});

	test('Enum + color restrictions are sorted properly', async () => {
		await testCompletionFor('.foo { text-decoration: | }', {
			items: [
				// Enum come before everything
				{ label: 'dashed', sortText: ' d_0180' },
				// Others come later
				{ label: 'aqua' },
				{ label: 'inherit' }
			]
		});
	});

	const testFixturesPath = path.join(__dirname, '../../../../test');

	/**
	 * For SCSS, `@import 'foo';` can be used for importing partial file `_foo.scss`
	 */
	test('SCSS @import Path completion', async function () {
		let testCSSUri = URI.file(path.resolve(testFixturesPath, 'pathCompletionFixtures/about/about.css')).toString();
		let workspaceFolderUri = URI.file(path.resolve(testFixturesPath)).toString();

		/**
		 * We are in a CSS file, so no special treatment for SCSS partial files
		*/
		await testCSSCompletionFor(`@import '../scss/|'`, {
			items: [
				{ label: 'main.scss', resultText: `@import '../scss/main.scss'` },
				{ label: '_foo.scss', resultText: `@import '../scss/_foo.scss'` }
			]
		}, undefined, testCSSUri, workspaceFolderUri);

		let testSCSSUri = URI.file(path.resolve(testFixturesPath, 'pathCompletionFixtures/scss/main.scss')).toString();
		await testCompletionFor(`@import './|'`, {
			items: [
				{ label: '_foo.scss', resultText: `@import './foo'` }
			]
		}, undefined, testSCSSUri, workspaceFolderUri);
	});

});
