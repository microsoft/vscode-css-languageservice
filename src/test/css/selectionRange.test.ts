/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import 'mocha';
import * as assert from 'assert';
import { TextDocument } from 'vscode-languageserver-types';
import { getApplicableRanges } from '../../services/cssSelectionRange';
import { getCSSLanguageService } from '../../cssLanguageService';
import { Stylesheet } from '../../parser/cssNodes';

function assertRanges(content: string, expected: number[][]): void {
	let ls = getCSSLanguageService();

	let message = `Test ${content}`;

	let offset = content.indexOf('|');
	content = content.substr(0, offset) + content.substr(offset + 1);

	const document = TextDocument.create('test://foo/bar.css', 'css', 1, content);
	const actualRanges = getApplicableRanges(document, document.positionAt(offset), ls.parseStylesheet(
		document
	) as Stylesheet);

	message += `\n${JSON.stringify(actualRanges)} should equal to ${JSON.stringify(expected)}`;
	assert.deepEqual(actualRanges, expected, message);
}

/**
 * We don't do much testing since as long as the parser generates a valid AST,
 * correct selection ranges will be generated.
 */
suite('CSS SelectionRange', () => {
	test('Basic', () => {
		assertRanges('.foo { |color: blue; }', [[7, 12], [7, 18], [5, 21], [0, 21]]);
		assertRanges('.foo { c|olor: blue; }', [[7, 12], [7, 18], [5, 21], [0, 21]]);
		assertRanges('.foo { color|: blue; }', [[7, 12], [7, 18], [5, 21], [0, 21]]);

		assertRanges('.foo { color: |blue; }', [[14, 18], [7, 18], [5, 21], [0, 21]]);
		assertRanges('.foo { color: b|lue; }', [[14, 18], [7, 18], [5, 21], [0, 21]]);
		assertRanges('.foo { color: blue|; }', [[14, 18], [7, 18], [5, 21], [0, 21]]);

		assertRanges('.|foo { color: blue; }', [[1, 4], [0, 4], [0, 21]]);
		assertRanges('.fo|o { color: blue; }', [[1, 4], [0, 4], [0, 21]]);
		assertRanges('.foo| { color: blue; }', [[1, 4], [0, 4], [0, 21]]);
	});

	test('Multiple values', () => {
		assertRanges(`.foo { font-family: '|Courier New', Courier, monospace; }`, [
			[20, 33],
			[20, 53],
			[7, 53],
			[5, 56],
			[0, 56]
		]);
	});
});
