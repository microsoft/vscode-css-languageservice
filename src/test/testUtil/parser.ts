/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import * as nodes from '../../parser/cssNodes.js';
import { Parser } from '../../parser/cssParser.js';
import { TokenType } from '../../parser/cssScanner.js';

export function assertNode(text: string, parser: Parser, f: (...args: any[]) => nodes.Node | null): nodes.Node {
	const node = parser.internalParse(text, f)!;
	assert.ok(node !== null, 'no node returned');
	const markers = nodes.ParseErrorCollector.entries(node);
	if (markers.length > 0) {
		assert.ok(false, 'node has errors: ' + markers[0].getMessage() + ', offset: ' + markers[0].getNode().offset + ' when parsing ' + text);
	}
	assert.ok(parser.accept(TokenType.EOF), 'Expect scanner at EOF');
	return node;
}

export function assertFunction(text: string, parser: Parser, f: () => nodes.Node | null): void {
	assertNode(text, parser, f);
}

export function assertNoNode(text: string, parser: Parser, f: () => nodes.Node | null): void {
	const node = parser.internalParse(text, f)!;
	assert.ok(node === null || !parser.accept(TokenType.EOF));
}

export function assertError(text: string, parser: Parser, f: () => nodes.Node | null, error: nodes.IRule): void {
	const node = parser.internalParse(text, f)!;
	assert.ok(node !== null, 'no node returned');
	let markers = nodes.ParseErrorCollector.entries(node);
	if (markers.length === 0) {
		assert.ok(false, 'no errors but error expected: ' + error.message);
	} else {
		markers = markers.sort((a, b) => a.getOffset() - b.getOffset());
		assert.equal(markers[0].getRule().id, error.id, 'incorrect error returned from parsing: ' + text);
	}
}

export function assertType(text: string, parser: Parser, nodeType: nodes.NodeType, f: () => nodes.Node | null): void {
	const node = parser.internalParse(text, f)!;
	assert.ok(node !== null, 'no node returned');
	const targetNode = node.findChildAtOffset(text.indexOf('--x') + 1, true)!;
	assert.equal(nodes.NodeType[targetNode.type], nodes.NodeType[nodes.NodeType.Identifier]);
}
