/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';

import { testCompletionFor } from './completion.test';
import { getCSSLanguageService, TextDocument, newCSSDataProvider, LanguageSettings } from '../../cssLanguageService';


suite('CSS - Custom Data', async () => {

	const customData = [newCSSDataProvider({
		version: 1,
		properties: [
			{
				name: 'foo',
				description: {
					kind: 'markdown',
					value: 'Foo property. See link on [MDN](https://developer.mozilla.org/en-US/).',
				},
				references: [
					{
						name: 'MDN Reference',
						url: 'https://developer.mozilla.org/en-US/docs/Web/CSS/foo'
					}
				]
			}
		],
		atDirectives: [
			{
				name: '@foo',
				description: 'Foo at directive'
			}
		],
		pseudoClasses: [
			{
				name: ':foo',
				description: 'Foo pseudo class'
			}
		],
		pseudoElements: [
			{
				name: '::foo',
				description: 'Foo pseudo element'
			}
		]
	})];

	const settings: LanguageSettings = {
		completion: {
			triggerPropertyValueCompletion: true,
			completePropertyWithSemicolon: true
		}
	};

	test('Completion', async () => {
		await testCompletionFor('body { | }', {
			items: [
				{
					label: 'foo',
					resultText: 'body { foo: $0; }',
					documentation: {
						kind: 'markdown',
						value: 'Foo property. See link on [MDN](https://developer.mozilla.org/en-US/).\n\n[MDN Reference](https://developer.mozilla.org/en-US/docs/Web/CSS/foo)'
					}
				}
			]
		}, settings, undefined, undefined, customData);

		await testCompletionFor('|', {
			items: [{ label: '@foo', resultText: '@foo' }]
		}, settings, undefined, undefined, customData);

		await testCompletionFor(':|', {
			items: [{ label: ':foo', resultText: ':foo' }]
		}, settings, undefined, undefined, customData);

		await testCompletionFor('::foo', {
			items: [{ label: '::foo', resultText: '::foo' }]
		}, settings, undefined, undefined, customData);
	});
});

suite('CSS - Custom Data Diagnostics', () => {
	const customDataProviders = [newCSSDataProvider({
		version: 1,
		properties: [
			{
				name: 'foo'
			},
			{
				name: '_foo'
			}
		],
		atDirectives: [
			{
				name: '@foo'
			}
		]
	})];

	const cssLS = getCSSLanguageService({ customDataProviders });

	const testValidationFor = function (
		value: string,
		expected: (number | string)[]
	) {
		const document = TextDocument.create('test://test/test.css', 'css', 0, value);
		const cssDoc = cssLS.parseStylesheet(document);
		const codeList = cssLS.doValidation(document, cssDoc).map(d => d.code);
		const message = `Return diagnostics: ${JSON.stringify(codeList)} do not match expected diagnostics: ${JSON.stringify(expected)}`;

		assert.deepEqual(codeList, expected, message);
	};


	test('No unknown properties', () => {
		testValidationFor('.foo { foo: 1; _foo: 1 }', []);
		testValidationFor('.foo { FOO: 1; }', []);
	});

	test('No unknown at-directives', () => {
		testValidationFor(`@foo 'bar';`, []);
	});
});
