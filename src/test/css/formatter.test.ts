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
		var unformattedDoc = TextDocument.create(uri, 'html', 0, unformatted);
		const startPos = unformattedDoc.positionAt(rangeStart);
		const endPos = unformattedDoc.positionAt(rangeEnd - 1);
		range = Range.create(startPos, endPos);
	}

	var document = TextDocument.create(uri, 'html', 0, unformatted);
	const edits = ls.format(document, range, options);
	const formatted = TextDocument.applyEdits(document, edits);
	assert.strictEqual(formatted, expected);
}

suite('CSS - Formatter', () => {

	test('full document', () => {
		var content = [
			'@font-face { src: url(http://test) }',
			'.monaco  .list { background: "#FFF"  ; }',
		].join('\n');

		var expected = [
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
		var content = [
			'@font-face { src: url(http://test) }',
			'|.monaco  .list { background: "#FFF"  ; }|',
		].join('\n');

		var expected = [
			'@font-face { src: url(http://test) }',
			'.monaco .list {',
			'  background: "#FFF";',
			'}'
		].join('\n');

		assertFormat(content, expected);
	});

	test('@media', () => {
		var content = [
			'@media print { @page { margin: 10% } blockquote, pre { page-break-inside: avoid } }'
		].join('\n');

		var expected = [
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
		var content = [
			'.foo,.bar,li:first-of-type + li{--widthB:  calc(  var(--widthA)   / 2);}'
		].join('\n');

		var expected = [
			'.foo,',
			'.bar,',
			'li:first-of-type+li {',
			'  --widthB: calc(var(--widthA) / 2);',
			'}'
		].join('\n');

		assertFormat(content, expected);
	});

	test('selectors and functions, options', () => {
		var content = [
			'.foo,.bar,li:first-of-type + li{--widthB:  calc(  var(--widthA)   / 2);}'
		].join('\n');

		var expected = [
			'.foo, .bar, li:first-of-type + li {',
			'  --widthB: calc(var(--widthA) / 2);',
			'}'
		].join('\n');

		assertFormat(content, expected, { selectorSeparatorNewline: false, insertSpaces: true, tabSize: 2, spaceAroundSelectorSeparator: true });
	});

	test('insertFinalNewline', () => {
		var content = [
			'.emptyMarkdownCell::before { outline:  1px  solid -webkit-focus-ring-color;  }'
		].join('\n');

		var expected = [
			'.emptyMarkdownCell::before {',
			'  outline: 1px solid -webkit-focus-ring-color;',
			'}',
			''
		].join('\n');

		assertFormat(content, expected, { insertSpaces: true, tabSize: 2, insertFinalNewline: true });

	});



});
