/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { getCSSLanguageService, TextDocument, Range, getLESSLanguageService, LanguageService } from '../../cssLanguageService';
import * as assert from 'assert';
import { CSSFormatConfiguration } from '../../cssLanguageTypes';


export function assertFormat(unformatted: string, expected: string, options: CSSFormatConfiguration = { tabSize: 2, insertSpaces: true }, ls: LanguageService = getCSSLanguageService()) {
	let range: Range | undefined = void 0;
	const uri = 'test://test.html';

	const rangeStart = unformatted.indexOf('|');
	const rangeEnd = unformatted.lastIndexOf('|');
	if (rangeStart !== -1 && rangeEnd !== -1) {
		// remove '|'
		unformatted = unformatted.substring(0, rangeStart) + unformatted.substring(rangeStart + 1, rangeEnd) + unformatted.substring(rangeEnd + 1);
		const unformattedDoc = TextDocument.create(uri, 'html', 0, unformatted);
		const startPos = unformattedDoc.positionAt(rangeStart);
		const endPos = unformattedDoc.positionAt(rangeEnd - 1);
		range = Range.create(startPos, endPos);
	}

	const document = TextDocument.create(uri, 'html', 0, unformatted);
	const edits = ls.format(document, range, options);
	const formatted = TextDocument.applyEdits(document, edits);
	assert.strictEqual(formatted, expected);
}

suite('CSS - Formatter', () => {

	test('full document', () => {
		const content = [
			'@font-face { src: url(http://test) }',
			'.monaco  .list { background: "#FFF"  ; }',
		].join('\n');

		const expected = [
			'@font-face {',
			'  src: url(http://test)',
			'}',
			'',
			'.monaco .list {',
			'  background: "#FFF";',
			'}'
		].join('\n');

		assertFormat(content, expected);
	});

	test('range', () => {
		const content = [
			'@font-face { src: url(http://test) }',
			'|.monaco  .list { background: "#FFF"  ; }|',
		].join('\n');

		const expected = [
			'@font-face { src: url(http://test) }',
			'.monaco .list {',
			'  background: "#FFF";',
			'}'
		].join('\n');

		assertFormat(content, expected);
	});

	test('range2', () => {
		const content = [
			'div {',
			'|  color:green|',
			'}',
		].join('\n');

		const expected = [
			'div {',
			'  color: green',
			'}',
		].join('\n');

		assertFormat(content, expected);
	});

	test('@media', () => {
		const content = [
			'@media print { @page { margin: 10% } blockquote, pre { page-break-inside: avoid } }'
		].join('\n');

		const expected = [
			'@media print {',
			'  @page {',
			'    margin: 10%',
			'  }',
			'',
			'  blockquote,',
			'  pre {',
			'    page-break-inside: avoid',
			'  }',
			'}'
		].join('\n');

		assertFormat(content, expected);
	});

	test('selectors and functions', () => {
		const content = [
			'.foo,.bar,li:first-of-type + li{--widthB:  calc(  const(--widthA)   / 2);}'
		].join('\n');

		const expected = [
			'.foo,',
			'.bar,',
			'li:first-of-type+li {',
			'  --widthB: calc(const(--widthA) / 2);',
			'}'
		].join('\n');

		assertFormat(content, expected);
	});

	test('selectors and functions, options', () => {
		const content = [
			'.foo,.bar,li:first-of-type + li{--widthB:  calc(  const(--widthA)   / 2);}'
		].join('\n');

		const expected = [
			'.foo, .bar, li:first-of-type + li {',
			'  --widthB: calc(const(--widthA) / 2);',
			'}'
		].join('\n');

		assertFormat(content, expected, { newlineBetweenSelectors: false, insertSpaces: true, tabSize: 2, spaceAroundSelectorSeparator: true });
	});

	test('insertFinalNewline', () => {
		const content = [
			'.emptyMarkdownCell::before { outline:  1px  solid -webkit-focus-ring-color;  }'
		].join('\n');

		const expected = [
			'.emptyMarkdownCell::before {',
			'  outline: 1px solid -webkit-focus-ring-color;',
			'}',
			''
		].join('\n');

		assertFormat(content, expected, { insertSpaces: true, tabSize: 2, insertFinalNewline: true });

	});

	test('braceStyle', () => {
		const content = [
			'.foo { display:  node;  }'
		].join('\n');

		const expected = [
			'.foo',
			'{',
			'  display: node;',
			'}',
		].join('\n');

		assertFormat(content, expected, { insertSpaces: true, tabSize: 2, braceStyle: 'expand' });

		const expected2 = [
			'.foo {',
			'  display: node;',
			'}',
		].join('\n');

		assertFormat(content, expected2, { insertSpaces: true, tabSize: 2, braceStyle: 'collapse' });

	});

	test('preserveNewLines', () => {
		const content = [
			'.foo { display: node;',
			'',
			'',
			'',
			'}'
		].join('\n');

		const expected = [
			'.foo {',
			'  display: node;',
			'',
			'',
			'}'
		].join('\n');

		assertFormat(content, expected, { insertSpaces: true, tabSize: 2, preserveNewLines: true, maxPreserveNewLines: 3 });

		const expected2 = [
			'.foo {',
			'  display: node;',
			'}'
		].join('\n');

		assertFormat(content, expected2, { insertSpaces: true, tabSize: 2, preserveNewLines: false });

	});

	test('spaces', () => {
		// https://github.com/microsoft/vscode/issues/159295
		const content = [
			'.body {',
			' font-size: @fs  !important; // 2 space -> BUG',
			'}'
		].join('\n');

		const expected = [
			'.body {',
			'  font-size: @fs !important; // 2 space -> BUG',
			'}'
		].join('\n');

		assertFormat(content, expected, { insertSpaces: true, tabSize: 2, preserveNewLines: true, maxPreserveNewLines: 3 });

	});



});
