/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { suite, test } from 'node:test';
import * as assert from 'node:assert';

import { testCompletionFor } from '../testUtil/completion.js';
import { getCSSLanguageService, getSCSSLanguageService, TextDocument, newCSSDataProvider, LanguageSettings } from '../../cssLanguageService.js';


suite('CSS - Custom Data', async () => {

	const customData = [newCSSDataProvider({
		version: 1,
		properties: [
			{
				name: 'foo',
				description: {
					kind: 'markdown',
					value: 'Foo property. See link on [MDN](https://developer.mozilla.org/).',
				},
				references: [
					{
						name: 'MDN Reference',
						url: 'https://developer.mozilla.org/docs/Web/CSS/foo'
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
						value: 'Foo property. See link on [MDN](https://developer.mozilla.org/).\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/foo)'
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

		await testCompletionFor('::foo|', {
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

suite('SCSS - Custom Data Diagnostics', () => {
	test('interpolation in custom at-rules', () => {
		const document = TextDocument.create('test://test/test.scss', 'scss', 0,
			'$base: 16px; .container { @custom { --a-variable: #{90 * $base}; } }');
		const service = getSCSSLanguageService();
		const stylesheet = service.parseStylesheet(document);
		assert.deepEqual(service.doValidation(document, stylesheet).map(d => d.code), ['unknownAtRules']);
		service.setDataProviders(true, [newCSSDataProvider({ version: 1.1, atDirectives: [{ name: '@custom', description: 'Custom directive' }] })]);
		assert.deepEqual(service.doValidation(document, stylesheet), []);
		const offset = document.getText().indexOf('@custom');
		assert.deepEqual(service.doHover(document, document.positionAt(offset + 1), stylesheet), {
			contents: { kind: 'markdown', value: 'Custom directive' },
			range: { start: document.positionAt(offset), end: document.positionAt(offset + '@custom'.length) }
		});
	});
});
