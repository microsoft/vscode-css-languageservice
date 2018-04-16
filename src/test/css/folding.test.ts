/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { TextDocument } from 'vscode-languageserver-types';
import { getFoldingRegions } from '../../services/cssFolding';
import { FoldingRange, FoldingRangeType } from '../../protocol/foldingProvider.proposed';

function assertRanges(lines: string[], expected: FoldingRange[], languageId = 'css', maxRanges = null): void {
	const document = TextDocument.create(`test://foo/bar.${languageId}`, languageId, 1, lines.join('\n'));
	let actualRanges = getFoldingRegions(document, maxRanges).ranges;

	actualRanges = actualRanges.sort((r1, r2) => r1.startLine - r2.startLine);
	assert.deepEqual(actualRanges, expected);
}
function assertRangesForLanguages(lines: string[], expected: FoldingRange[], languageIds: string[]): void {
	languageIds.forEach(id => {
		assertRanges(lines, expected, id);
	});
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
		assertRanges(input, [r(0, 1)]);
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
		assertRanges(input, [r(0, 2)]);
	});


	test('Fold with no indentation', () => {
		const input = [
			/*0*/'.foo{',
			/*1*/'color: red;',
			/*2*/'}'
		];
		assertRanges(input, [r(0, 1)]);
	});

	test('Fold with opening curly brace on new line', () => {
		const input = [
			/*0*/'.foo',
			/*1*/'{',
			/*2*/'color: red;',
			/*3*/'}'
		];
		assertRanges(input, [r(1, 2)]);
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
		assertRanges(input, [r(2, 3)]);
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
		assertRanges(input, [r(1, 4), r(2, 3)]);
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
		assertRanges(input, [r(0, 3), r(1, 2)]);
	});

	test('Media query', () => {
		const input = [
			/*0*/'@media screen {',
			/*1*/'.foo {',
			/*2*/'color: red;',
			/*3*/'}',
			/*4*/'}'
		];
		assertRanges(input, [r(0, 3), r(1, 2)]);
	});
});

suite('CSS Folding - Regions', () => {
	test('Simple region with comment', () => {
		const input = [
			/*0*/'/* #region */',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'/* #endregion */'
		];
		assertRanges(input, [r(0, 4, 'region'), r(1, 2)]);
	});

	test('Simple region with padded comment', () => {
		const input = [
			/*0*/'/*  #region   */',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'/*   #endregion   */'
		];
		assertRanges(input, [r(0, 4, 'region'), r(1, 2)]);
	});

	test('Simple region without spaces', () => {
		const input = [
			/*0*/'/*#region*/',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'/*#endregion*/'
		];
		assertRanges(input, [r(0, 4, 'region'), r(1, 2)]);
	});

	test('Simple region with description', () => {
		const input = [
			/*0*/'/* #region Header page */',
			/*1*/'.bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'/* #endregion */'
		];
		assertRanges(input, [r(0, 4, 'region'), r(1, 2)]);
	});
});

suite('CSS Folding - maxRanges', () => {
	test('Max ranges', () => {
		const input = [
			/*0*/'/* #region Header page */',
			/*1*/'.bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'/* #endregion */'
		];
		assertRanges(input, [r(1, 2)], 'css', 1);
	});
});

suite('SCSS Folding', () => {
	test('SCSS Mixin', () => {
		const input = [
			/*0*/'@mixin clearfix($width) {',
			/*1*/'  @if !$width {',
			/*2*/'    // if width is not passed, or empty do this',
			/*3*/'  } @else {',
			/*4*/'    display: inline-block;',
			/*5*/'    width: $width;',
			/*6*/'  }',
			/*7*/'}'
		];
		assertRanges(input, [r(0, 6), r(1, 2), r(3, 5)], 'scss');
	});
	test('SCSS Interolation', () => {
		const input = [
			/*0*/'.orbit-#{$d}-prev {',
			/*1*/'  foo-#{$d}-bar: 1;',
			/*2*/'  #{$d}-bar-#{$d}: 2;',
			/*3*/'}'
		];
		assertRanges(input, [r(0, 2)], 'scss');
	});
	test('SCSS While', () => {
		const input = [
			/*0*/'@while $i > 0 {',
			/*1*/'  .item-#{$i} { width: 2em * $i; }',
			/*2*/'  $i: $i - 2;',
			/*3*/'}'
		];
		assertRanges(input, [r(0, 2)], 'scss');
	});
	test('SCSS Nested media query', () => {
		const input = [
			/*0*/'@mixin desktop {',
			/*1*/'  $desktop-width: 1024px;',
			/*2*/'  @media(min-width: #{$desktop-width}) {',
			/*3*/'    width: 500px;',
			/*4*/'  }',
			/*5*/'}'
		];
		assertRanges(input, [r(0, 4), r(2, 3)], 'scss');
	});
});

suite('SCSS/LESS Folding - Regions', () => {
	test('Simple region with comment', () => {
		const input = [
			/*0*/'/* #region */',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'/* #endregion */'
		];
		assertRangesForLanguages(input, [r(0, 4, 'region'), r(1, 2)], ['scss', 'less']);
	});

	test('Simple region with padded comment', () => {
		const input = [
			/*0*/'/*  #region  */',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'/*   #endregion   */'
		];
		assertRangesForLanguages(input, [r(0, 4, 'region'), r(1, 2)], ['scss', 'less']);
	});


	test('Region with SCSS single line comment', () => {
		const input = [
			/*0*/'// #region',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'// #endregion'
		];
		assertRangesForLanguages(input, [r(0, 4, 'region'), r(1, 2)], ['scss', 'less']);
	});

	test('Region with SCSS single line padded comment', () => {
		const input = [
			/*0*/'//   #region  ',
			/*1*/'& .bar {',
			/*2*/'  color: red;',
			/*3*/'}',
			/*4*/'//   #endregion'
		];
		assertRangesForLanguages(input, [r(0, 4, 'region'), r(1, 2)], ['scss', 'less']);
	});


	test('Region with both simple comments and region comments', () => {
		const input = [
			/*0*/'// #region',
			/*1*/'/*',
			/*2*/'comments',
			/*3*/'*/',
			/*4*/'& .bar {',
			/*5*/'  color: red;',
			/*6*/'}',
			/*7*/'// #endregion'
		];
		assertRangesForLanguages(input, [r(0, 7, 'region'), r(1, 3, 'comment'), r(4, 5)], ['scss', 'less']);
	});
});
