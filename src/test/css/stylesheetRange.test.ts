/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import { TextDocument } from '../../cssLanguageTypes.js';
import { getSCSSLanguageService } from '../../cssLanguageService.js';
import { Parser } from '../../parser/cssParser.js';
import { LESSParser } from '../../parser/lessParser.js';
import { SCSSParser } from '../../parser/scssParser.js';
import { getNodeAtOffset } from '../../parser/cssNodes.js';

suite('Stylesheet range', () => {
	test('SCSS variables remain available after incomplete statements', () => {
		const service = getSCSSLanguageService();
		for (const fixture of ['$a: red;\n@media ($|', '$a: red;\n@media $|', '$a: red;\n@mixin foo($|', '$a: red;\n@function foo($|', '$a: red;\n@each $|']) {
			const offset = fixture.indexOf('|');
			const text = fixture.replace('|', '');
			const document = TextDocument.create('file:///test.scss', 'scss', 1, text);
			const result = service.doComplete(document, document.positionAt(offset), service.parseStylesheet(document));
			assert.ok(result.items.some(item => item.label === '$a'), `Missing $a in ${text}`);
		}
	});

	for (const [language, createParser] of [
		['css', () => new Parser()],
		['scss', () => new SCSSParser()],
		['less', () => new LESSParser()]
	] as const) {
		test(`${language}: keeps offsets after an incomplete declaration reachable`, () => {
			for (const fixture of ['.bar {\n  op0.1|\n}', '.foo {\n    padding\n    m|\n}', '.bar { op0.1|']) {
				const offset = fixture.indexOf('|');
				const text = fixture.replace('|', '');
				const document = TextDocument.create(`file:///test.${language}`, language, 1, text);
				const stylesheet = createParser().parseStylesheet(document);
				assert.ok(getNodeAtOffset(stylesheet, offset), `No AST node at ${offset} in ${text}`);
				assert.strictEqual(stylesheet.end, text.length);
			}
		});

		test(`${language}: includes trailing trivia without extending beyond the document`, () => {
			for (const text of ['', ' \n', '/* comment */', 'a { color: red; }\n\n', 'a { color: red; } /* comment */\n']) {
				const document = TextDocument.create(`file:///test.${language}`, language, 1, text);
				const stylesheet = createParser().parseStylesheet(document);
				assert.strictEqual(stylesheet.end, text.length);
				assert.ok(getNodeAtOffset(stylesheet, text.length));
				assert.strictEqual(getNodeAtOffset(stylesheet, text.length + 1), null);
			}
		});
	}
});
