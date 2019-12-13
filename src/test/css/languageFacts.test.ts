/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { isColorValue, getColorValue, getBrowserLabel, colorFrom256RGB, colorFromHex, hexDigit, hslFromColor, HSLA, cssDataManager } from '../../languageFacts/facts';
import { Parser } from '../../parser/cssParser';
import * as nodes from '../../parser/cssNodes';
import { TextDocument, Color } from '../../cssLanguageTypes';

export function assertColor(parser: Parser, text: string, selection: string, expected: Color | null, isColor = expected !== null): void {
	let document = TextDocument.create('test://test/test.css', 'css', 0, text);
	let stylesheet = parser.parseStylesheet(document);
	assert.equal(nodes.ParseErrorCollector.entries(stylesheet).length, 0, 'compile errors');

	let node = nodes.getNodeAtOffset(stylesheet, text.indexOf(selection));
	assert(node);
	if (node!.parent && node!.parent.type === nodes.NodeType.Function) {
		node = node!.parent;
	}

	assert.equal(isColorValue(node!), isColor);
	assertColorValue(getColorValue(node!), expected, text);
}

function assertColorFromHex(s: string, expected: Color | null) {
	assertColorValue(colorFromHex(s), expected, s);
}

function assertColorValue(actual: Color | null, expected: Color | null, message: string) {
	if (actual && expected) {
		let rDiff = Math.abs((actual.red - expected.red) * 255);
		let gDiff = Math.abs((actual.green - expected.green) * 255);
		let bDiff = Math.abs((actual.blue - expected.blue) * 255);
		let aDiff = Math.abs((actual.alpha - expected.alpha) * 100);
		if (rDiff < 1 && gDiff < 1 && bDiff < 1 && aDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected, message);
}

function assertHSLValue(actual: HSLA, expected: HSLA) {
	if (actual && expected) {
		let hDiff = actual.h - expected.h;
		let sDiff = Math.abs((actual.s - expected.s) * 100);
		let lDiff = Math.abs((actual.l - expected.l) * 100);
		let aDiff = Math.abs((actual.a - expected.a) * 100);
		if (hDiff < 1 && sDiff < 1 && lDiff < 1 && aDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected);
}


suite('CSS - Language Facts', () => {

	test('properties', function () {
		let alignLast = cssDataManager.getProperty('text-align-last');

		assert.ok(alignLast !== null);
		assert.equal(alignLast.name, 'text-align-last');

		assert.ok(alignLast.browsers!.indexOf("E12") !== -1);
		assert.ok(alignLast.browsers!.indexOf("FF49") !== -1);
		assert.ok(alignLast.browsers!.indexOf("C47") !== -1);
		assert.ok(alignLast.browsers!.indexOf("IE5.5") !== -1);
		assert.ok(alignLast.browsers!.indexOf("O") !== -1);

		assert.equal(getBrowserLabel(alignLast.browsers!), 'Edge 12, Firefox 49, Chrome 47, IE 5, Opera');

		let r = alignLast.restrictions;

		assert.equal(r!.length, 1);
		assert.equal(r![0], 'enum');

		let v = alignLast.values;
		assert.equal(v!.length, 5);
		assert.equal(v![0].name, 'auto');
	});

	test('is color', function () {
		let parser = new Parser();
		assertColor(parser, '#main { color: red }', 'red', colorFrom256RGB(0xFF, 0, 0));
		assertColor(parser, '#main { color: slateblue }', 'slateblue', colorFrom256RGB(106, 90, 205));
		assertColor(parser, '#main { color: #231 }', '#231', colorFrom256RGB(0x22, 0x33, 0x11));
		assertColor(parser, '#main { red: 1 }', 'red', null);
		assertColor(parser, '#red { foo: 1 }', 'red', null);
		assertColor(parser, '#main { color: #1836f6 }', '1836f6', colorFrom256RGB(0x18, 0x36, 0xf6));
		assertColor(parser, '#main { color: #0F0E024E }', '0F0E024E', colorFrom256RGB(0x0f, 0x0e, 0x02, 0x4e / 0xff));
		assertColor(parser, '#main { color: rgb(34, 89, 234) }', 'rgb', colorFrom256RGB(34, 89, 234));
		assertColor(parser, '#main { color: rgb(100%, 34%, 10%, 50%) }', 'rgb', colorFrom256RGB(255, 255 * 0.34, 255 * 0.1, 0.5));
		assertColor(parser, '#main { color: rgba(+78, 40.6, 99%, 1% ) }', 'rgb', colorFrom256RGB(78, 40.6, 255 * 0.99, 0.01));
		assertColor(parser, '#main { color: hsl(120deg, 100%, 50%) }', 'hsl', colorFrom256RGB(0, 255, 0));
		assertColor(parser, '#main { color: hsl(180,100%,25%, 0.33) }', 'hsl', colorFrom256RGB(0, 0.5 * 255, 0.5 * 255, 0.33));
		assertColor(parser, '#main { color: hsl(30,20%,30%, 0) }', 'hsl', colorFrom256RGB(92, 77, 61, 0));
		assertColor(parser, '#main { color: hsla(38deg,89%,89%, 0) }', 'hsl', colorFrom256RGB(252, 234, 202, 0));
		assertColor(parser, '#main { color: rgba(0.7) }', 'rgba', null, true);
		assertColor(parser, '[green] {}', 'green', null);
		assertColor(parser, '[data-color=green] {}', 'green', null);
	});

	test('hexDigit', function () {
		const input1 = "0123456789ABCDEF", input2 = "0123456789abcdef";
		for (let i = 0; i < input1.length; i++) {
			assert.equal(hexDigit(input1.charCodeAt(i)), i, input1.charAt(i));
			assert.equal(hexDigit(input2.charCodeAt(i)), i, input2.charAt(i));
		}
	});

	test('colorFromHex', function () {
		assertColorFromHex('#000', colorFrom256RGB(0x00, 0x00, 0x00));
		assertColorFromHex('#fff', colorFrom256RGB(0xff, 0xff, 0xff));
		assertColorFromHex('#15a', colorFrom256RGB(0x11, 0x55, 0xaa));
		assertColorFromHex('#09f', colorFrom256RGB(0x00, 0x99, 0xff));
		assertColorFromHex('#ABC', colorFrom256RGB(0xaa, 0xbb, 0xcc));
		assertColorFromHex('#DEF', colorFrom256RGB(0xdd, 0xee, 0xff));
		assertColorFromHex('#96af', colorFrom256RGB(0x99, 0x66, 0xaa, 1));
		assertColorFromHex('#90AF', colorFrom256RGB(0x99, 0x00, 0xaa, 1));
		assertColorFromHex('#96a3', colorFrom256RGB(0x99, 0x66, 0xaa, 0x33 / 255));
		assertColorFromHex('#132435', colorFrom256RGB(0x13, 0x24, 0x35));
		assertColorFromHex('#cafebabe', colorFrom256RGB(0xca, 0xfe, 0xba, 0xbe / 255));
		assertColorFromHex('123', null);
		assertColorFromHex('#12Y', colorFrom256RGB(0x11, 0x22, 0x00));
	});

	test('hslFromColor', function () {
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 0, 0, 0)), { h: 0, s: 0, l: 0, a: 0 });
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 0, 0, 1)), { h: 0, s: 0, l: 0, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(255, 255, 255, 1)), { h: 0, s: 0, l: 1, a: 1 });

		assertHSLValue(hslFromColor(colorFrom256RGB(255, 0, 0, 1)), { h: 0, s: 1, l: 0.5, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 255, 0, 1)), { h: 120, s: 1, l: 0.5, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 0, 255, 1)), { h: 240, s: 1, l: 0.5, a: 1 });

		assertHSLValue(hslFromColor(colorFrom256RGB(255, 255, 0, 1)), { h: 60, s: 1, l: 0.5, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 255, 255, 1)), { h: 180, s: 1, l: 0.5, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(255, 0, 255, 1)), { h: 300, s: 1, l: 0.5, a: 1 });

		assertHSLValue(hslFromColor(colorFrom256RGB(192, 192, 192, 1)), { h: 0, s: 0, l: 0.753, a: 1 });

		assertHSLValue(hslFromColor(colorFrom256RGB(128, 128, 128, 1)), { h: 0, s: 0, l: 0.502, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(128, 0, 0, 1)), { h: 0, s: 1, l: 0.251, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(128, 128, 0, 1)), { h: 60, s: 1, l: 0.251, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 128, 0, 1)), { h: 120, s: 1, l: 0.251, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(128, 0, 128, 1)), { h: 300, s: 1, l: 0.251, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 128, 128, 1)), { h: 180, s: 1, l: 0.251, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 0, 128, 1)), { h: 240, s: 1, l: 0.251, a: 1 });
	});
});