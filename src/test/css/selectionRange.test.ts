/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import 'mocha';
import * as assert from 'assert';
import { TextDocument } from 'vscode-languageserver-types';
import { getCSSLanguageService } from '../../cssLanguageService';
import { Stylesheet } from '../../parser/cssNodes';

function assertRanges(content: string, expected: (number | string)[][]): void {
	let message = `${content} gives selection range:\n`;

	const offset = content.indexOf('|');
	content = content.substr(0, offset) + content.substr(offset + 1);

	const ls = getCSSLanguageService();

	const document = TextDocument.create('test://foo/bar.css', 'css', 1, content);
	const actualRanges = ls.getSelectionRanges(document, [document.positionAt(offset)], ls.parseStylesheet(document) as Stylesheet);
	assert.equal(actualRanges.length, 1);
	const offsetPairs: [number, string][] = [];
	let curr = actualRanges[0];
	while (curr) {
		offsetPairs.push([document.offsetAt(curr.range.start), document.getText(curr.range)]);
		curr = curr.parent;
	}

	message += `${JSON.stringify(offsetPairs)}\n but should give:\n${JSON.stringify(expected)}\n`;
	assert.deepEqual(offsetPairs, expected, message);
}

/**
 * We don't do much testing since as long as the parser generates a valid AST,
 * correct selection ranges will be generated.
 */
suite('CSS SelectionRange', () => {
	test('Basic', () => {
		assertRanges('.foo { |color: blue; }', [
			[7, 'color'],
			[7, 'color: blue'],
			[6, ' color: blue; '],
			[0, '.foo { color: blue; }']
		]);
		assertRanges('.foo { c|olor: blue; }', [
			[7, 'color'],
			[7, 'color: blue'],
			[6, ' color: blue; '],
			[0, '.foo { color: blue; }']
		]);
		assertRanges('.foo { color|: blue; }', [
			[7, 'color'],
			[7, 'color: blue'],
			[6, ' color: blue; '],
			[0, '.foo { color: blue; }']
		]);

		assertRanges('.foo { color: |blue; }', [
			[14, 'blue'],
			[7, 'color: blue'],
			[6, ' color: blue; '],
			[0, '.foo { color: blue; }']
		]);
		assertRanges('.foo { color: b|lue; }', [
			[14, 'blue'],
			[7, 'color: blue'],
			[6, ' color: blue; '],
			[0, '.foo { color: blue; }']
		]);
		assertRanges('.foo { color: blue|; }', [
			[14, 'blue'],
			[7, 'color: blue'],
			[6, ' color: blue; '],
			[0, '.foo { color: blue; }']
		]);

		assertRanges('.|foo { color: blue; }', [[1, 'foo'], [0, '.foo'], [0, '.foo { color: blue; }']]);
		assertRanges('.fo|o { color: blue; }', [[1, 'foo'], [0, '.foo'], [0, '.foo { color: blue; }']]);
		assertRanges('.foo| { color: blue; }', [[1, 'foo'], [0, '.foo'], [0, '.foo { color: blue; }']]);
	});

	test('Multiple values', () => {
		assertRanges(`.foo { font-family: '|Courier New', Courier, monospace; }`, [
			[20, `'Courier New'`],
			[20, `'Courier New', Courier, monospace`],
			[7, `font-family: 'Courier New', Courier, monospace`],
			[6, ` font-family: 'Courier New', Courier, monospace; `],
			[0, `.foo { font-family: 'Courier New', Courier, monospace; }`]
		]);
	});
});
