/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { suite, test } from 'node:test';
import { getCSSLanguageService, getLESSLanguageService, getSCSSLanguageService, TextDocument } from '../../cssLanguageService.js';
import { NumericValue, Stylesheet } from '../../parser/cssNodes.js';
import { Scanner, TokenType } from '../../parser/cssScanner.js';
import { LESSScanner } from '../../parser/lessScanner.js';
import { SCSSScanner } from '../../parser/scssScanner.js';

const numbers = [
	['1e2', TokenType.Num, '1e2', undefined],
	['1E+2', TokenType.Num, '1E+2', undefined],
	['-1.5e-2', TokenType.Num, '-1.5e-2', undefined],
	['.5e1', TokenType.Num, '.5e1', undefined],
	['1e2%', TokenType.Percentage, '1e2', '%'],
	['1e2px', TokenType.Length, '1e2', 'px'],
	['.5e1em', TokenType.EMS, '.5e1', 'em'],
	['2.4E2deg', TokenType.Angle, '2.4E2', 'deg'],
	['1e-3s', TokenType.Time, '1e-3', 's'],
] as const;

const colors = [
	['rgb(1e2 0 0)', 'rgb(100 0 0)'],
	['rgba(0, 5e1, 0, 5e-1)', 'rgba(0, 50, 0, 0.5)'],
	['rgb(1e2% 2.5E1% 0%)', 'rgb(100% 25% 0%)'],
	['hsl(1.2e2 1e2% 5e1%)', 'hsl(120 100% 50%)'],
	['hsl(-2.4E2deg 100% 50%)', 'hsl(-240deg 100% 50%)'],
	['hsl(5e-1turn 100% 50%)', 'hsl(0.5turn 100% 50%)'],
	['lab(5e1 -2.5e1 3e1)', 'lab(50 -25 30)'],
	['color(srgb 2e-1 4e-1 6e-1 / 5e-1)', 'color(srgb 0.2 0.4 0.6 / 0.5)'],
] as const;

for (const [languageId, createService, ScannerClass] of [
	['css', getCSSLanguageService, Scanner],
	['less', getLESSLanguageService, LESSScanner],
	['scss', getSCSSLanguageService, SCSSScanner],
] as const) {
	suite(`${languageId.toUpperCase()} - Scientific notation`, () => {
		const service = createService();

		function parse(value: string, property = 'width') {
			const document = TextDocument.create(`test://test/value.${languageId}`, languageId, 0, `.test { ${property}: ${value}; }`);
			return { document, stylesheet: service.parseStylesheet(document) as Stylesheet };
		}

		for (const [text, type, value, unit] of numbers) {
			test(`tokenizes and splits ${text}`, () => {
				const scanner = new ScannerClass();
				scanner.setSource(text);
				assert.deepStrictEqual(scanner.scan(), { type, text, offset: 0, len: text.length });
				assert.strictEqual(scanner.scan().type, TokenType.EOF);

				const { stylesheet } = parse(text);
				const numericNodes: NumericValue[] = [];
				stylesheet.accept(node => {
					if (node instanceof NumericValue) {
						numericNodes.push(node);
					}
					return true;
				});
				assert.strictEqual(numericNodes.length, 1);
				assert.deepStrictEqual(numericNodes[0].getValue(), { value, unit });
			});
		}

		test('preserves em/ex units and incomplete exponent token boundaries', () => {
			for (const [text, expected] of [
				['1em', [[TokenType.EMS, '1em']]],
				['1ex', [[TokenType.EXS, '1ex']]],
				['1e', [[TokenType.Dimension, '1e']]],
				['1e+', [[TokenType.Dimension, '1e'], [TokenType.Delim, '+']]],
				['1e-', [[TokenType.Dimension, '1e-']]],
			] as const) {
				const scanner = new ScannerClass();
				scanner.setSource(text);
				for (const [type, tokenText] of expected) {
					const token = scanner.scan();
					assert.strictEqual(token.type, type, text);
					assert.strictEqual(token.text, tokenText, text);
				}
				assert.strictEqual(scanner.scan().type, TokenType.EOF, text);
			}
		});

		for (const [value, decimal] of colors) {
			test(`extracts the color ${value}`, () => {
				const control = parse(decimal, 'color');
				const expected = service.findDocumentColors(control.document, control.stylesheet);
				assert.strictEqual(expected.length, 1, 'decimal control');
				const { document, stylesheet } = parse(value, 'color');
				assert.deepStrictEqual(service.doValidation(document, stylesheet), []);
				const actual = service.findDocumentColors(document, stylesheet);
				assert.strictEqual(actual.length, 1);
				assert.deepStrictEqual(actual[0].color, expected[0].color);
				assert.strictEqual(document.getText(actual[0].range), value);
			});
		}

		test('does not extract colors from invalid exponents or units', () => {
			for (const value of ['rgb(1e 0 0)', 'rgb(1e+ 0 0)', 'rgb(1e2px 0 0)', 'hsl(1e+deg 100% 50%)']) {
				const { document, stylesheet } = parse(value, 'color');
				assert.deepStrictEqual(service.findDocumentColors(document, stylesheet), [], value);
			}
		});

		test('recognizes zero-valued exponent dimensions for zeroUnits lint', () => {
			const { document, stylesheet } = parse('0e0px', 'padding');
			const diagnostics = service.doValidation(document, stylesheet, { lint: { zeroUnits: 'warning' } });
			assert.strictEqual(diagnostics.length, 1);
			assert.strictEqual(diagnostics[0].code, 'zeroUnits');
			assert.strictEqual(document.getText(diagnostics[0].range), '0e0px');
		});
	});
}
