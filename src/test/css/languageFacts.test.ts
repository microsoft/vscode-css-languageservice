/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { isColorValue, getColorValue, getBrowserLabel, colorFrom256RGB, colorFromHex, hexDigit, hslFromColor, HSLA, XYZ, LAB, xyzToRGB, xyzFromLAB, hwbFromColor, HWBA, colorFromHWB, colorFromHSL, colorFromLAB, labFromLCH, colorFromLCH, labFromColor, RGBtoXYZ, lchFromColor, LCH } from '../../languageFacts/facts';
import { Parser } from '../../parser/cssParser';
import * as nodes from '../../parser/cssNodes';
import { TextDocument, Color } from '../../cssLanguageTypes';
import { CSSDataManager } from '../../languageFacts/dataManager';

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
		let hDiff = Math.abs(actual.h - expected.h);
		let sDiff = Math.abs((actual.s - expected.s) * 100);
		let lDiff = Math.abs((actual.l - expected.l) * 100);
		let aDiff = Math.abs((actual.a - expected.a) * 100);
		if (hDiff < 1 && sDiff < 1 && lDiff < 1 && aDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected);
}

function assertHWBValue(actual: HWBA, expected: HWBA) {
	if (actual && expected) {
		let hDiff = Math.abs(actual.h - expected.h);
		let wDiff = Math.abs((actual.w - expected.w) * 100);
		let bDiff = Math.abs((actual.b - expected.b) * 100);
		let aDiff = Math.abs((actual.a - expected.a) * 100);
		if (hDiff < 1 && wDiff < 1 && bDiff < 1 && aDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected);
}

function assertXYZValue(actual: XYZ, expected: XYZ) {
	if (actual && expected) {
		const xDiff = Math.abs(actual.x - expected.x);
		const yDiff = Math.abs(actual.y - expected.y);
		const zDiff = Math.abs(actual.z - expected.z);
		const aDiff = Math.abs((actual.alpha - expected.alpha) * 100);
		if (xDiff < 1 && yDiff < 1 && zDiff < 1 && aDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected);
}

function assertLABValue(actual: LAB, expected: LAB) {
	if (actual && expected) {
		const lDiff = Math.abs(actual.l - expected.l);
		const aDiff = Math.abs(actual.a - expected.a);
		const bDiff = Math.abs(actual.b - expected.b);
		let alphaDiff = 0;
		if (actual.alpha && expected.alpha) {
			alphaDiff = Math.abs((actual.alpha - expected.alpha) * 100);
		}
		if (lDiff < 1 && aDiff < 1 && bDiff < 1 && alphaDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected);
}

function assertLCHValue(actual: LCH, expected: LCH) {
	if (actual && expected) {
		const lDiff = Math.abs(actual.l - expected.l);
		const cDiff = Math.abs(actual.c - expected.c);
		const hDiff = Math.abs(actual.h - expected.h);
		let alphaDiff = 0;
		if (actual.alpha && expected.alpha) {
			alphaDiff = Math.abs((actual.alpha - expected.alpha) * 100);
		}
		if (lDiff < 1 && cDiff < 1 && hDiff < 1 && alphaDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected);
}
suite('CSS - Language Facts', () => {

	const cssDataManager = new CSSDataManager({ useDefaultDataProvider: true });

	test('properties', function () {
		let alignLast = cssDataManager.getProperty('text-decoration-color');
		if (!alignLast) {
			assert.ok(alignLast);
			return;
		}
		assert.equal(alignLast.name, 'text-decoration-color');

		assert.ok(alignLast.browsers!.indexOf("E79") !== -1);
		assert.ok(alignLast.browsers!.indexOf("FF36") !== -1);
		assert.ok(alignLast.browsers!.indexOf("C57") !== -1);
		assert.ok(alignLast.browsers!.indexOf("S12.1") !== -1);
		assert.ok(alignLast.browsers!.indexOf("O44") !== -1);

		assert.equal(getBrowserLabel(alignLast.browsers!), 'Edge 79, Firefox 36, Safari 12, Chrome 57, Opera 44');

		let r = alignLast.restrictions;

		assert.equal(r!.length, 1);
		assert.equal(r![0], 'color');
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
		assertColor(parser, '#main { color: hsl(0.5turn, 100%, 50%) }', 'hsl', colorFrom256RGB(0, 255, 255, 1));
		assertColor(parser, '#main { color: hsl(1.5turn, 100%, 50%) }', 'hsl', colorFrom256RGB(0, 255, 255, 1));
		assertColor(parser, '#main { color: hsl(200grad, 100%, 50%) }', 'hsl', colorFrom256RGB(0, 255, 255, 1));
		assertColor(parser, '#main { color: hsl(3.14159rad, 100%, 50%) }', 'hsl', colorFrom256RGB(0, 255, 255, 1));
		assertColor(parser, '#main { color: hsl(0.13turn, 97%, 32%) }', 'hsl', colorFrom256RGB(161, 126, 2, 1));
		assertColor(parser, '#main { color: hsl(124grad, 71%, 45%) }', 'hsl', colorFrom256RGB(56, 196, 33, 1));
		assertColor(parser, '#main { color: hsl(2.35112rad, 76%, 63%) }', 'hsl', colorFrom256RGB(89, 232, 124, 1));
		assertColor(parser, '#main { color: rgba(0.7) }', 'rgba', null, true);
		assertColor(parser, '[green] {}', 'green', null);
		assertColor(parser, '[data-color=green] {}', 'green', null);
		assertColor(parser, '#main { color: rgb(34 89 234) }', 'rgb', colorFrom256RGB(34, 89, 234));
		assertColor(parser, '#main { color: rgb(34 89 234 / 0.5) }', 'rgb', colorFrom256RGB(34, 89, 234, 0.5));
		assertColor(parser, '#main { color: rgb(34 89 234 / 100%) }', 'rgb', colorFrom256RGB(34, 89, 234));
		assertColor(parser, '#main { color: hsla(240 100% 50% / .05) }', 'hsl', colorFrom256RGB(0, 0, 255, 0.05));
		assertColor(parser, '#main { color: hwb(120 0% 0% / .05) }', 'hwb', colorFrom256RGB(0, 255, 0, 0.05));
		assertColor(parser, '#main { color: hwb(36 33% 35%) }', 'hwb', colorFrom256RGB(166, 133, 84));
		assertColor(parser, '#main { color: lab(90 100 100) }', 'lab', colorFrom256RGB(255, 112, 0));
		assertColor(parser, '#main { color: lab(46.41 39.24 33.51) }', 'lab', colorFrom256RGB(180, 79, 56));
		assertColor(parser, '#main { color: lab(46.41 -39.24 33.51) }', 'lab', colorFrom256RGB(50, 125, 50));
		assertColor(parser, '#main { color: lch(46.41, 51.60, 139.50) }', 'lch', colorFrom256RGB(50, 125, 50));
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

		// some random colors, validating against https://www.w3docs.com/tools/color-rgb
		assertHSLValue(hslFromColor(colorFrom256RGB(0, 195, 255)), { h: 194, s: 1, l: 0.5, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(40, 50, 60)), { h: 210, s: 0.2, l: 0.2, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(40, 255, 60)), { h: 126, s: 1.0, l: 0.58, a: 1 });
		assertHSLValue(hslFromColor(colorFrom256RGB(231, 135, 19)), { h: 33, s: 0.85, l: 0.49, a: 1 });
	});

	test('hwbFromColor', function () {
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 0, 0, 0)), { h: 0, w: 0, b: 1, a: 0 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 0, 0, 1)), { h: 0, w: 0, b: 1, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(255, 255, 255, 1)), { h: 0, w: 1, b: 0, a: 1 });

		assertHWBValue(hwbFromColor(colorFrom256RGB(255, 0, 0, 1)), { h: 0, w: 0, b: 0, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 255, 0, 1)), { h: 120, w: 0, b: 0, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 0, 255, 1)), { h: 240, w: 0, b: 0, a: 1 });

		assertHWBValue(hwbFromColor(colorFrom256RGB(255, 255, 0, 1)), { h: 60, w: 0, b: 0, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 255, 255, 1)), { h: 180, w: 0, b: 0, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(255, 0, 255, 1)), { h: 300, w: 0, b: 0, a: 1 });

		assertHWBValue(hwbFromColor(colorFrom256RGB(192, 192, 192, 1)), { h: 0, w: 0.752, b: 0.247, a: 1 });

		assertHWBValue(hwbFromColor(colorFrom256RGB(128, 128, 128, 1)), { h: 0, w: 0.5, b: 0.5, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(128, 0, 0, 1)), { h: 0, w: 0, b: 0.5, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(128, 128, 0, 1)), { h: 60, w: 0, b: 0.5, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 128, 0, 1)), { h: 120, w: 0, b: 0.5, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(128, 0, 128, 1)), { h: 300, w: 0, b: 0.5, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 128, 128, 1)), { h: 180, w: 0, b: 0.5, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 0, 128, 1)), { h: 240, w: 0, b: 0.5, a: 1 });

		// some random colors, validating against https://htmlcolors.com/color-converter
		assertHWBValue(hwbFromColor(colorFrom256RGB(0, 195, 255)), { h: 194, w: 0, b: 0, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(40, 50, 60)), { h: 210, w: 0.16, b: 0.76, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(40, 255, 60)), { h: 126, w: 0.16, b: 0, a: 1 });
		assertHWBValue(hwbFromColor(colorFrom256RGB(231, 135, 19)), { h: 33, w: 0.07, b: 0.09, a: 1 });
	});

	test('hwbToColor', function () {
		// some random numbers verified with https://www.w3docs.com/tools/color-hwb
		assertColorValue(colorFromHWB(0, 0.5, 0.5), colorFrom256RGB(128, 128, 128), 'hwb(0, 50%, 50%)');
		assertColorValue(colorFromHWB(350, 0.09, 0.5), colorFrom256RGB(128, 23, 41), 'hwb(350, 9%, 50%)');
		assertColorValue(colorFromHWB(118, 0.02, 0.01), colorFrom256RGB(13, 253, 5), 'hwb(118, 2%, 1%)');
		assertColorValue(colorFromHWB(120, 0.92, 0.01), colorFrom256RGB(235, 252, 235), 'hwb(120, 92%, 1%)');
	});

	test('hslToColor', function () {
		// some random numbers verified with https://www.w3docs.com/tools/color-hsl
		assertColorValue(colorFromHSL(0, 0, 0.5), colorFrom256RGB(128, 128, 128), 'hsl(0, 0%, 50%)');
		assertColorValue(colorFromHSL(350, 0.7, 0.3), colorFrom256RGB(130, 23, 41), 'hsl(350, 70%, 30%)');
		assertColorValue(colorFromHSL(118, 0.98, 0.5), colorFrom256RGB(11, 252, 3), 'hsl(118, 98%, 50%)');
		assertColorValue(colorFromHSL(120, 0.83, 0.95), colorFrom256RGB(232, 253, 232), 'hsl(120, 83%, 95%)');
	});

	test('xyzFromLAB', function () {
		assertXYZValue(xyzFromLAB({ l: 46.41, a: -39.24, b: 33.51 }), { x: 9.22, y: 15.58, z: 5.54, alpha: 1 });
	});

	test('xyzToRGB', function () {
		assertColorValue(xyzToRGB({ x: 9.22, y: 15.58, z: 5.54, alpha: 1 }), { red: 50, green: 125, blue: 50, alpha: 1 }, 'xyz(9.22, 15.58, 5.54)');
	});
	test('LABToRGB', function () {
		assertColorValue(colorFromLAB(46.41, -39.24, 33.51), colorFrom256RGB(50, 125, 50), 'lab(46.41, -39.24, 33.51)');
	});
	test('labFromLCH', function () {
		assertLABValue(labFromLCH(46.41, 51.60, 139.50), { l: 46.41, a: -39.24, b: 33.51, alpha: 1 });
	});
	test('LCHtoRGB', function () {
		assertColorValue(colorFromLCH(46.41, 51.60, 139.50), colorFrom256RGB(50, 125, 50), 'lch(46.41, 51.60, 139.50)');
	});
	test('labFromColor', function () {
		assertLABValue(labFromColor(colorFrom256RGB(50, 125, 50)), { l: 46.41, a: -39.24, b: 33.51, alpha: 1 });
	});
	test('RGBToXYZ', function () {
		assertXYZValue(RGBtoXYZ(colorFrom256RGB(50, 125, 50)), { x: 9.22, y: 15.58, z: 5.54, alpha: 1 });
	});
	test('RGBToLCH', function () {
		assertLCHValue(lchFromColor(colorFrom256RGB(50, 125, 50)), { l: 46.41, c: 51.60, h: 139.50 });
	});
});
