/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import { getCSSLanguageService, getLESSLanguageService, getSCSSLanguageService, TextDocument } from '../../cssLanguageService.js';

const colorFunctions = [
	'rgb(34, 89, 234)',
	'rgba(34, 89, 234, 0.5)',
	'hsl(120deg, 100%, 50%)',
	'hsla(240 100% 50% / 0.25)',
	'hwb(120 0% 0% / 0.5)',
	'lab(46.41 39.24 33.51 / 0.5)',
	'lch(46.41 51.60 139.50 / 0.5)',
	'oklab(62.796% 0.22486 0.12585 / 0.5)',
	'oklch(62.7955% 0.257683 29.2339 / 0.5)',
	'color(srgb 0.2 0.4 0.6 / 0.5)',
];

for (const [languageId, createService] of [
	['css', getCSSLanguageService],
	['less', getLESSLanguageService],
	['scss', getSCSSLanguageService],
] as const) {
	suite(`${languageId.toUpperCase()} - Color function casing`, () => {
		const service = createService();

		function findColors(value: string) {
			const document = TextDocument.create(`test://test/value.${languageId}`, languageId, 0, `.test { color: ${value}; }`);
			const stylesheet = service.parseStylesheet(document);
			return { document, colors: service.findDocumentColors(document, stylesheet) };
		}

		for (const value of colorFunctions) {
			const name = value.slice(0, value.indexOf('('));
			test(`recognizes uppercase and mixed-case ${name}()`, () => {
				const expected = findColors(value).colors;
				assert.strictEqual(expected.length, 1, 'lowercase control');

				for (const casedName of [name.toUpperCase(), name[0].toUpperCase() + name.slice(1)]) {
					const casedValue = casedName + value.slice(name.length);
					const { document, colors } = findColors(casedValue);
					assert.strictEqual(colors.length, 1, casedValue);
					assert.deepStrictEqual(colors[0].color, expected[0].color, casedValue);
					assert.deepStrictEqual(colors[0].range, expected[0].range, casedValue);
					assert.strictEqual(document.getText(colors[0].range), casedValue);
				}
			});
		}

		test('does not turn invalid or unknown functions into document colors', () => {
			for (const value of ['RGB(255)', 'COLOR(srgb 1 0 / 0.5)', 'CUSTOMCOLOR(1 0 0)', 'o\u212Alab(62.796% 0.22486 0.12585)']) {
				assert.deepStrictEqual(findColors(value).colors, [], value);
			}
		});
	});
}
