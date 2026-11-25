/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'node:assert/strict';
import { suite, test } from 'node:test';
import { getCSSLanguageService, getLESSLanguageService, getSCSSLanguageService, type LanguageService } from '../../cssLanguageService.js';
import { Color, TextDocument } from '../../cssLanguageTypes.js';

const cases: [string, Color][] = [
	['rgb(300, -20, 0)', { red: 1, green: 0, blue: 0, alpha: 1 }],
	['rgba(-1, 300, 256, .25)', { red: 0, green: 1, blue: 1, alpha: 0.25 }],
	['rgb(120%, -10%, 0%)', { red: 1, green: 0, blue: 0, alpha: 1 }],
	['rgba(-10%, 120%, 110%, .5)', { red: 0, green: 1, blue: 1, alpha: 0.5 }],
	['rgb(300 -20 127.5)', { red: 1, green: 0, blue: 0.5, alpha: 1 }],
	['rgba(-1 300 256 / 25%)', { red: 0, green: 1, blue: 1, alpha: 0.25 }],
	['rgb(120% -10% 50%)', { red: 1, green: 0, blue: 0.5, alpha: 1 }],
	['rgba(-10% 120% 110% / .75)', { red: 0, green: 1, blue: 1, alpha: 0.75 }],
];

function assertPreview(service: LanguageService, languageId: string, expression: string, expected: Color | null): void {
	const text = `.a { color: ${expression}; }`;
	const document = TextDocument.create(`test://test/example.${languageId}`, languageId, 0, text);
	const colors = service.findDocumentColors(document, service.parseStylesheet(document));
	if (expected === null) {
		assert.deepEqual(colors, []);
	} else {
		assert.equal(colors.length, 1);
		assert.deepEqual(colors[0].color, expected);
		const start = text.indexOf(expression);
		assert.deepEqual(colors[0].range, {
			start: document.positionAt(start),
			end: document.positionAt(start + expression.length),
		});
	}
}

suite('RGB channel clamping', () => {
	for (const [languageId, createService] of [
		['css', getCSSLanguageService],
		['scss', getSCSSLanguageService],
		['less', getLESSLanguageService],
	] as const) {
		for (const [expression, expected] of cases) {
			test(`${languageId}: ${expression}`, () => {
				assertPreview(createService(), languageId, expression, expected);
			});
		}

		for (let channel = 0; channel < 3; channel++) {
			for (const value of [-1, 256]) {
				test(`${languageId}: clamps channel ${channel} at ${value}`, () => {
					const channels = [0, 0, 0];
					channels[channel] = value;
					const expected = [0, 0, 0];
					expected[channel] = value > 255 ? 1 : 0;
					assertPreview(createService(), languageId, `rgb(${channels.join(', ')})`, {
						red: expected[0], green: expected[1], blue: expected[2], alpha: 1,
					});
				});
			}
		}

		for (const expression of ['rgb(300px, 0, 0)', 'rgb(300 0)', 'rgba(300 0 0 / invalid)']) {
			test(`${languageId}: still rejects ${expression}`, () => {
				assertPreview(createService(), languageId, expression, null);
			});
		}

		for (const expression of ['rgb(0, 127.5, 255)', 'rgba(0% 50% 100% / 1)']) {
			test(`${languageId}: preserves ${expression}`, () => {
				assertPreview(createService(), languageId, expression, { red: 0, green: 0.5, blue: 1, alpha: 1 });
			});
		}
	}
});
