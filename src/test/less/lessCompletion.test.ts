/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';

import * as cssLanguageService from '../../cssLanguageService';
import { LESSCompletion } from '../../services/lessCompletion';
import { TextDocument, Position } from 'vscode-languageserver-types';
import { assertCompletion, ItemDescription } from '../css/completion.test';


suite('LESS - Completions', () => {

	let testCompletionFor = function (value: string, expected: { count?: number, items?: ItemDescription[] }) {
		let offset = value.indexOf('|');
		value = value.substr(0, offset) + value.substr(offset + 1);

		let ls = cssLanguageService.getLESSLanguageService();
		let ls2 = new LESSCompletion();

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
	};

	test('stylesheet', function (): any {
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
	});
});
