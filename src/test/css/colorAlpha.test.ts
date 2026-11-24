/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import { getCSSLanguageService, getLESSLanguageService, getSCSSLanguageService, TextDocument } from '../../cssLanguageService.js';

const colorFunctions = [
	'rgb(34 89 234 / ALPHA)',
	'rgb(34, 89, 234, ALPHA)',
	'rgba(34, 89, 234, ALPHA)',
	'hsl(120deg, 100%, 50%, ALPHA)',
	'hsla(240 100% 50% / ALPHA)',
	'hwb(120 0% 0% / ALPHA)',
	'lab(46.41 39.24 33.51 / ALPHA)',
	'lch(46.41 51.60 139.50 / ALPHA)',
	'oklab(62.796% 0.22486 0.12585 / ALPHA)',
	'oklch(62.7955% 0.257683 29.2339 / ALPHA)',
	'color(srgb 0.2 0.4 0.6 / ALPHA)',
];

for (const [languageId, createService] of [
	['css', getCSSLanguageService],
	['less', getLESSLanguageService],
	['scss', getSCSSLanguageService],
] as const) {
	suite(`${languageId.toUpperCase()} - Color alpha clamping`, () => {
		const service = createService();

		function findColors(value: string) {
			const document = TextDocument.create(`test://test/value.${languageId}`, languageId, 0, `.test { color: ${value}; }`);
			const stylesheet = service.parseStylesheet(document);
			return { document, colors: service.findDocumentColors(document, stylesheet) };
		}

		for (const template of colorFunctions) {
			test(`clamps alpha in ${template}`, () => {
				for (const [alpha, expectedAlpha] of [['-0.5', 0], ['-50%', 0], ['1.5', 1], ['150%', 1]] as const) {
					const expected = findColors(template.replace('ALPHA', String(expectedAlpha))).colors;
					assert.strictEqual(expected.length, 1, 'boundary control');
					const value = template.replace('ALPHA', alpha);
					const { document, colors } = findColors(value);
					assert.strictEqual(colors.length, 1, value);
					assert.strictEqual(colors[0].color.alpha, expectedAlpha, value);
					assert.deepStrictEqual(colors[0].color, expected[0].color, value);
					assert.strictEqual(document.getText(colors[0].range), value);
				}
			});
		}

		test('preserves alpha values already in range', () => {
			for (const template of colorFunctions) {
				for (const [alpha, expectedAlpha] of [['0', 0], ['0.5', 0.5], ['1', 1], ['0%', 0], ['50%', 0.5], ['100%', 1]] as const) {
					const value = template.replace('ALPHA', alpha);
					const { colors } = findColors(value);
					assert.strictEqual(colors.length, 1, value);
					assert.strictEqual(colors[0].color.alpha, expectedAlpha, value);
				}
			}
		});

		test('does not coerce invalid or unresolved alpha values', () => {
			for (const template of colorFunctions) {
				for (const alpha of ['1px', 'var(--opacity)']) {
					const value = template.replace('ALPHA', alpha);
					assert.deepStrictEqual(findColors(value).colors, [], value);
				}
			}
		});
	});
}
