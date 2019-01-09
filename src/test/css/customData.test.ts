/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';

import { TextDocument, CompletionList, Position } from 'vscode-languageserver-types';
import { getCSSLanguageService } from '../../cssLanguageService';
import { ItemDescription } from './completion.test';

function getLanguageService() {
	const customData = {
		properties: [
			{
				name: 'foo',
				desc: 'Foo property',
			}
		],
		atDirectives: [
			{
				name: '@foo',
				desc: 'Foo at directive',
			}
		],
		pseudoClasses: [
			{
				name: ':foo',
				desc: 'Foo pseudo class'
			}
		],
		pseudoElements: [
			{
				name: '::foo',
				desc: 'Foo pseudo element'
			}
		]
	};
	return getCSSLanguageService({ customDataCollections: [customData] });
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
		assert.equal(match.documentation, expected.documentation);
	}
	if (expected.kind) {
		assert.equal(match.kind, expected.kind);
	}
	if (expected.resultText) {
		assert.equal(TextDocument.applyEdits(document, [match.textEdit]), expected.resultText);
	}
	if (expected.insertTextFormat) {
		assert.equal(match.insertTextFormat, expected.insertTextFormat);
	}
}

suite('CSS - Custom Data', () => {
	const cssLS = getLanguageService();

	let testCompletionFor = function(
		value: string,
		expected: {
			count?: number;
			items?: ItemDescription[];
			participant?: { onProperty?; onPropertValue?; onURILiteralValue?; onImportPath? };
		}
	) {
		let offset = value.indexOf('|');
		value = value.substr(0, offset) + value.substr(offset + 1);

		let document = TextDocument.create('test://test/test.css', 'css', 0, value);
		let position = Position.create(0, offset);
		let jsonDoc = cssLS.parseStylesheet(document);
		let list = cssLS.doComplete(document, position, jsonDoc);
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
			items: [{ label: 'foo', resultText: 'body { foo:  }' }]
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
