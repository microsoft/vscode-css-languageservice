/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';

import { getSCSSLanguageService, TextDocument, Position, InsertTextFormat, CompletionItemKind, ImportPathCompletionContext } from '../../cssLanguageService';

import { assertCompletion, ItemDescription } from '../css/completion.test';
import { newRange } from '../css/navigation.test';

suite('SCSS - Completions', () => {

	let testCompletionFor = function (
		value: string,
		expected: {
			count?: number,
			items?: ItemDescription[],
			participant?: {
				onImportPath?: ImportPathCompletionContext[],
			},
		},
	) {
		let offset = value.indexOf('|');
		value = value.substr(0, offset) + value.substr(offset + 1);

		let actualImportPathContexts: ImportPathCompletionContext[] = [];

		let ls = getSCSSLanguageService();

		if (expected.participant) {
			ls.setCompletionParticipants([
				{
					onCssImportPath: context => actualImportPathContexts.push(context)
				}
			]);
		}

		let document = TextDocument.create('test://test/test.scss', 'scss', 0, value);
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
			if (expected.participant.onImportPath) {
				assert.deepEqual(actualImportPathContexts, expected.participant.onImportPath);
			}
		}
	};

	test('stylesheet', function (): any {
		testCompletionFor('$i: 0; body { width: |', {
			items: [
				{ label: '$i', documentation: '0' }
			]
		});
		testCompletionFor('@for $i from 1 through 3 { .item-#{|} { width: 2em * $i; } }', {
			items: [
				{ label: '$i' }
			]
		});
		testCompletionFor('@for $i from 1 through 3 { .item-#{|$i} { width: 2em * $i; } }', {
			items: [
				{ label: '$i' }
			]
		});
		testCompletionFor('.foo { background-color: d|', {
			items: [
				{ label: 'darken', resultText: '.foo { background-color: darken(\\$color: ${1:#000000}, \\$amount: ${2:0})' },
				{ label: 'desaturate' }
			]
		});
		testCompletionFor('@function foo($x, $y) { @return $x + $y; } .foo { background-color: f|', {
			items: [
				{ label: 'foo', resultText: '@function foo($x, $y) { @return $x + $y; } .foo { background-color: foo(${1:$x}, ${2:$y})' }
			]
		});
		testCompletionFor('@mixin mixin($a: 1, $b) { content: $|}', {
			items: [
				{ label: '$a', documentation: '1', detail: 'argument from \'mixin\'' },
				{ label: '$b', documentation: null, detail: 'argument from \'mixin\'' }
			]
		});
		testCompletionFor('@mixin mixin($a: 1, $b) { content: $a + $b; } @include m|', {
			items: [
				{ label: 'mixin', resultText: '@mixin mixin($a: 1, $b) { content: $a + $b; } @include mixin(${1:$a}, ${2:$b})' }
			]
		});
		testCompletionFor('di| span { } ', {
			items: [
				{ label: 'div' },
				{ label: 'display', notAvailable: true }
			]
		});
		testCompletionFor('span { di|} ', {
			items: [
				{ notAvailable: true, label: 'div' },
				{ label: 'display' }
			]
		});
		testCompletionFor('.foo { .|', {
			items: [
				{ label: '.foo' }
			]
		});
		// issue #250
		testCompletionFor('.foo { display: block;|', {
			count: 0
		});
		// issue #17726
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
		// issue 33911
		testCompletionFor('@include media(\'ddd\') { dis| &:not(:first-child) {', {
			items: [
				{ label: 'display' }
			]
		});
		// issue 43876
		testCompletionFor('.foo { } @mixin bar { @extend | }', {
			items: [
				{ label: '.foo' }
			]
		});
		testCompletionFor('.foo { } @mixin bar { @extend fo| }', {
			items: [
				{ label: '.foo' }
			]
		});
		// issue 76572
		testCompletionFor('.foo { mask: no|', {
			items: [
				{ label: 'round' }
			]
		});
		// issue 76507
		testCompletionFor('.foo { .foobar { .foobar2 {  outline-color: blue; cool  }| } .fokzlb {} .baaaa { counter - reset: unset;}', {
			items: [
				{ label: 'display' }
			]
		});
	});

	test('at rules', function (): any {
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

		testCompletionFor('@', {
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

		testCompletionFor('.foo { | }', allAtProposals);

		testCompletionFor(`@for $i from 1 through 3 { .item-#{$i} { width: 2em * $i; } } @|`, allAtProposals);

		testCompletionFor('.foo { @if $a = 5 { } @| }', allAtProposals);
		testCompletionFor('.foo { @debug 10em + 22em; @| }', allAtProposals);
		testCompletionFor('.foo { @if $a = 5 { } @f| }', {
			items: [
				{ label: '@for' }
			]
		});
	});

	suite('Modules', function (): any {
		test('module-loading at-rules', function (): any {
			testCompletionFor('@', {
				items: [
					{ label: '@use', documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/at-rules/use)' },
					{ label: '@forward', documentationIncludes: '[Sass documentation](https://sass-lang.com/documentation/at-rules/forward)' },
				],
			});

			// Limit to top-level scope.
			testCompletionFor('.foo { @| }', {
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
			testCompletionFor(`@use '|'`, builtIns);
			testCompletionFor(`@forward '|'`, builtIns);

			testCompletionFor(`@use './|'`, {
				participant: {
					onImportPath: [{ pathValue: `'./'`, position: Position.create(0, 8), range: newRange(5, 9) }]
				}
			});

			testCompletionFor(`@forward './|'`, {
				participant: {
					onImportPath: [{ pathValue: `'./'`, position: Position.create(0, 12), range: newRange(9, 13) }]
				}
			});
		});
	});

	test('Enum + color restrictions are sorted properly', () => {
		testCompletionFor('.foo { text-decoration: | }', {
			items: [
				// Enum come before everything
				{ label: 'dashed', sortText: ' d_0180' },
				// Others come later
				{ label: 'aqua' },
				{ label: 'inherit' }
			]
		});
	});

});
