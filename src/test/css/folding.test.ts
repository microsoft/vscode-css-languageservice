/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { TextDocument } from 'vscode-languageserver-types';
import { getFoldingRegions } from '../../services/cssFolding';
import { FoldingRange, FoldingRangeType } from '../../protocol/foldingProvider.proposed';

function assertRanges(lines: string[], expected: FoldingRange[]): void {
	const document = TextDocument.create('test://foo/bar.css', 'css', 1, lines.join('\n'));
	let actualRanges = getFoldingRegions(document).ranges;

	actualRanges = actualRanges.sort((r1, r2) => r1.startLine - r2.startLine);
	assert.deepEqual(actualRanges, expected);
}

function r(startLine: number, endLine: number, type?: FoldingRangeType | string): FoldingRange {
	return { startLine, endLine, type };
}

suite('CSS Folding - Basic', () => {
	test('Fold single rule', () => {
		const input = [
			/*0*/'.foo {',
			/*1*/'  color: red;',
			/*2*/'}'
		];
		assertRanges(input, [r(0, 2)]);
	});

	test('No fold for single line', () => {
		const input = [
			'.foo { color: red; }'
		];
		assertRanges(input, []);
	});

	test('Fold multiple rules', () => {
		const input = [
			/*0*/'.foo {',
			/*1*/'  color: red;',
			/*2*/'  opacity: 1;',
			/*3*/'}'
		];
		assertRanges(input, [r(0, 3)]);
	});


	test('Fold with no indentation', () => {
		const input = [
			/*0*/'.foo{',
			/*1*/'color: red;',
			/*2*/'}'
		];
		assertRanges(input, [r(0, 2)]);
	});

	test('Fold with opening curly brace on new line', () => {
		const input = [
			/*0*/'.foo',
			/*1*/'{',
			/*2*/'color: red;',
			/*3*/'}'
		];
		assertRanges(input, [r(1, 3)]);
	});

	test('Fold with closing curly brace on same line', () => {
		const input = [
			/*0*/'.foo',
			/*1*/'{',
			/*2*/'color: red; }'
		];
		assertRanges(input, [r(1, 2)]);
	});
});

suite('CSS Folding - Partial', () => {
	test('Without closing curly brace', () => {
		const input = [
			/*0*/'.foo {',
			/*1*/'color: red;'
		];
		assertRanges(input, []);
	});

	test('Without closing curly brace creates correct folding ranges', () => {
		const input = [
			/*0*/'.foo {',
			/*1*/'color: red;',
			/*2*/'.bar {',
			/*3*/'color: blue;',
			/*4*/'}',
		];
		assertRanges(input, [r(2, 4)]);
	});

	/**
	 * The correct folding ranges should be (0, 5), (2, 4). However the current naive stack approach cannot handle it
	 */
	test('Without closing curly brace in nested rules creates correct folding ranges', () => {
		const input = [
			/*0*/'.foo {',
			/*1*/'  .bar {',
			/*2*/'  .baz {',
			/*3*/'    color: blue;',
			/*4*/'  }',
			/*5*/'}'
		];
		assertRanges(input, [r(1, 5), r(2, 4)]);
	});
});

suite('CSS Folding - Comments', () => {
	test('Comment - single star', () => {
		const input = [
			/*0*/'/*',
			/*1*/'.foo {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'*/'
		];
		assertRanges(input, [r(0, 4, 'comment')]);
	});

	test('Comment - double star', () => {
		const input = [
			/*0*/'/**',
			/*1*/'.foo {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'*/'
		];
		assertRanges(input, [r(0, 4, 'comment')]);
	});

	test('Comment - wrong indentation and no newline', () => {
		const input = [
			/*0*/'/**',
			/*1*/'.foo{',
			/*2*/'color: red;',
			/*3*/'} */'
		];
		assertRanges(input, [r(0, 3, 'comment')]);
	});

	test('Comment - Single line ', () => {
		const input = [
			'./* .foo { color: red; } */'
		];
		assertRanges(input, []);
	});
});

suite('CSS Folding - Nested', () => {
	test('Postcss nested', () => {
		const input = [
			/*0*/'.foo {',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'}'
		];
		assertRanges(input, [r(0, 4), r(1, 3)]);
	});

	test('Media query', () => {
		const input = [
			/*0*/'@media screen {',
			/*1*/'.foo {',
			/*2*/'color: red;',
			/*3*/'}',
			/*4*/'}'
		];
		assertRanges(input, [r(0, 4), r(1, 3)]);
	});
});
