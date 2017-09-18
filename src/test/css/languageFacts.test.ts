/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { isColorValue, getColorValue, getBrowserLabel, getProperties, colorFrom256RGB, colorFromHex, hexDigit } from '../../services/languageFacts';
import { Parser } from '../../parser/cssParser';
import * as nodes from '../../parser/cssNodes';
import { TextDocument } from 'vscode-languageserver-types';
import { Color } from '../../cssLanguageService';

export function assertColor(parser: Parser, text: string, selection: string, expected: Color, isColor = expected !== null): void {
	let document = TextDocument.create('test://test/test.css', 'css', 0, text);
	let stylesheet = parser.parseStylesheet(document);
	assert.equal(nodes.ParseErrorCollector.entries(stylesheet).length, 0, 'compile errors');

	let node = nodes.getNodeAtOffset(stylesheet, text.indexOf(selection));
	assert(node);
	if (node.parent && node.parent.type === nodes.NodeType.Function) {
		node = node.parent;
	}

	assert.equal(isColorValue(node), isColor);
	assertColorValue(getColorValue(node), expected, text);
}

function assertColorFromHex(s: string, expected: Color) {
	assertColorValue(colorFromHex(s), expected, s);
}

function assertColorValue(actual: Color, expected: Color, message: string) {
	if (actual && expected) {
		let rDiff = Math.abs((actual.red - expected.red) * 255);
		let gDiff = Math.abs((actual.green - expected.green) * 255);
		let bDiff = Math.abs((actual.blue - expected.blue) * 255);
		if (rDiff < 1 || gDiff < 1 || bDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected, message);
}


suite('CSS - Language Facts', () => {

	test('properties', function () {
		let properties = getProperties();
		let alignLast = properties['text-align-last'];

		assert.ok(alignLast !== null);
		assert.equal(alignLast.name, 'text-align-last');
		let b = alignLast.browsers;
		assert.equal(b['FF'], '12');
		assert.equal(b['IE'], '5');
		assert.equal(b['E'], '');
		assert.equal(b['C'], void 0);
		assert.equal(b['count'], 3);

		assert.equal(getBrowserLabel(alignLast.browsers), 'Edge, Firefox 12, IE 5');

		let r = alignLast.restrictions;

		assert.equal(r.length, 1);
		assert.equal(r[0], 'enum');

		let v = alignLast.values;
		assert.equal(v.length, 5);
		assert.equal(v[0].name, 'auto');
		assert.equal(v[0].browsers.all, true);
		assert.equal(v[0].browsers.count, Number.MAX_VALUE);
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
		assertColor(parser, '#main { color: hsla(38deg,89%,89%, 0) }', 'hsl', colorFrom256RGB(252, 334, 202, 0));
		assertColor(parser, '#main { color: rgba(0.7) }', 'rgba', null, true);
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
});

