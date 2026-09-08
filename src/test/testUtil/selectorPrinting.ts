/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { TextDocument } from '../../cssLanguageTypes.js';
import * as nodes from '../../parser/cssNodes.js';
import { Parser } from '../../parser/cssParser.js';
import * as selectorPrinting from '../../services/selectorPrinting.js';

function elementToString(element: selectorPrinting.Element): string {
	let label = element.findAttribute('name') || '';
	const attributes = element.attributes?.filter(attribute => attribute.name !== 'name');
	if (attributes?.length) {
		label += '[';
		label += attributes.map(attribute => attribute.name + '=' + attribute.value).join('|');
		label += ']';
	}
	if (element.children) {
		label += '{' + element.children.map(elementToString).join('|') + '}';
	}
	return label;
}

export function doParse(parser: Parser, input: string, selectorName: string): nodes.Selector | null {
	const document = TextDocument.create('test://test/test.css', 'css', 0, input);
	const styleSheet = parser.parseStylesheet(document);
	const node = nodes.getNodeAtOffset(styleSheet, input.indexOf(selectorName));
	return node ? <nodes.Selector>node.findParent(nodes.NodeType.Selector) : null;
}

export function assertSelector(parser: Parser, input: string, selectorName: string, expected: string): void {
	const selector = doParse(parser, input, selectorName);
	assert.ok(selector);
	const element = selectorPrinting.selectorToElement(selector);
	assert.ok(element);
	assert.equal(elementToString(element), expected);
}
