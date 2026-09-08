/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { Color, TextDocument } from '../../cssLanguageTypes.js';
import { getColorValue, isColorValue } from '../../languageFacts/facts.js';
import * as nodes from '../../parser/cssNodes.js';
import { Parser } from '../../parser/cssParser.js';

export function assertColor(parser: Parser, text: string, selection: string, expected: Color | null, isColor = expected !== null): void {
	const document = TextDocument.create('test://test/test.css', 'css', 0, text);
	const stylesheet = parser.parseStylesheet(document);
	assert.equal(nodes.ParseErrorCollector.entries(stylesheet).length, 0, 'compile errors');
	let node = nodes.getNodeAtOffset(stylesheet, text.indexOf(selection));
	assert.ok(node);
	if (node!.parent?.type === nodes.NodeType.Function) {
		node = node!.parent;
	}
	assert.equal(isColorValue(node!), isColor);
	assertColorValue(getColorValue(node!), expected, text);
}

export function assertColorValue(actual: Color | null, expected: Color | null, message: string): void {
	if (actual && expected) {
		const rDiff = Math.abs((actual.red - expected.red) * 255);
		const gDiff = Math.abs((actual.green - expected.green) * 255);
		const bDiff = Math.abs((actual.blue - expected.blue) * 255);
		const aDiff = Math.abs((actual.alpha - expected.alpha) * 100);
		if (rDiff < 1 && gDiff < 1 && bDiff < 1 && aDiff < 1) {
			return;
		}
	}
	assert.deepEqual(actual, expected, message);
}
