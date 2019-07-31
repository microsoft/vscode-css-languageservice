/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';

import { TextDocument, CompletionList, Position } from 'vscode-languageserver-types';
import { getCSSLanguageService } from '../../cssLanguageService';
import { ItemDescription } from './completion.test';
import { ICSSDataProvider, CSSDataV1, PropertyCompletionContext, PropertyValueCompletionContext, URILiteralCompletionContext, ImportPathCompletionContext } from '../../cssLanguageTypes';
import { CSSDataProvider } from '../../languageFacts/facts';

function getLanguageService(data: CSSDataV1) {
	const provider = new CSSDataProvider(data);
	return getCSSLanguageService({ customDataProviders: [provider] });
}

function assertCompletion(completions: CompletionList, expected: ItemDescription, document: TextDocument) {
	let matches = completions.items.filter(completion => {
		return completion.label === expected.label;
	});
	if (expected.notAvailable) {
		assert.equal(matches.length, 0, expected.label + ' should not be present');
	} else {
		assert.equal(
			matches.length,
			1,
			expected.label + ' should only existing once: Actual: ' + completions.items.map(c => c.label).join(', ')
		);
	}

	let match = matches[0];
	if (expected.detail) {
		assert.equal(match.detail, expected.detail);
	}
	if (expected.documentation) {
		if (typeof expected.documentation === 'string') {
			assert.equal(match.documentation, expected.documentation);
		} else {
			assert.deepStrictEqual(match.documentation, expected.documentation);
		}
	}
	if (expected.kind) {
		assert.equal(match.kind, expected.kind);
	}
	if (expected.resultText) {
		assert.equal(TextDocument.applyEdits(document, [match.textEdit!]), expected.resultText);
	}
	if (expected.insertTextFormat) {
		assert.equal(match.insertTextFormat, expected.insertTextFormat);
	}
}

suite('CSS - Custom Data', () => {

	const customData: CSSDataV1 = {
		version: 1,
		properties: [
			{
				name: 'foo',
				description: {
					kind: 'markdown',
					value: 'Foo property. See link on [MDN](https://developer.mozilla.org/en-US/).'
				}
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
	};

	const cssLS = getLanguageService(customData);

	const testCompletionFor = function(
		value: string,
		expected: {
			count?: number;
			items?: ItemDescription[];
			participant?: { onProperty?: PropertyCompletionContext; onPropertyValue?: PropertyValueCompletionContext; onURILiteralValue?: URILiteralCompletionContext; onImportPath?: ImportPathCompletionContext };
		}
	) {
		let offset = value.indexOf('|');
		value = value.substr(0, offset) + value.substr(offset + 1);

		let document = TextDocument.create('test://test/test.css', 'css', 0, value);
		let position = Position.create(0, offset);
		let cssDoc = cssLS.parseStylesheet(document);
		let list = cssLS.doComplete(document, position, cssDoc);
		if (typeof expected.count === 'number') {
			assert.equal(list.items, expected.count);
		}
		if (expected.items) {
			for (let item of expected.items) {
				assertCompletion(list, item, document);
			}
		}
	};

	test('Completion', () => {
		testCompletionFor('body { | }', {
			items: [
				{ label: 'foo', resultText: 'body { foo:  }', documentation: { kind: 'markdown', value: 'Foo property. See link on [MDN](https://developer.mozilla.org/en-US/).' } }
			]
		});

		testCompletionFor('|', {
			items: [{ label: '@foo', resultText: '@foo' }]
		});

		testCompletionFor(':|', {
			items: [{ label: ':foo', resultText: ':foo' }]
		});

		testCompletionFor('::foo', {
			items: [{ label: '::foo', resultText: '::foo' }]
		});
	});
});

suite('CSS - Custom Data Diagnostics', () => {
	const data: CSSDataV1 = {
		version: 1,
		properties: [
			{
				name: 'foo'
			},
			{
				name: '_foo'
			}
		]
	};

	const cssLS = getLanguageService(data);

	const testValidationFor = function(
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
	});
});
