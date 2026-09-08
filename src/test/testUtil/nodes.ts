/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import * as nodes from '../../parser/cssNodes.js';

class PrintingVisitor implements nodes.IVisitor {
	public tree: string[] = [];

	public visitNode(node: nodes.Node): boolean {
		this.tree.push(nodes.NodeType[node.type].toLowerCase());
		return true;
	}
}

export function assertNodes(fn: (input: string) => nodes.Node, input: string, expected: string): void {
	const node = fn(input);
	const visitor = new PrintingVisitor();
	node.acceptVisitor(visitor);
	const actual = visitor.tree;
	const actualStr = actual.join(',');
	const segments = expected.split(',');
	while (segments.length > 0) {
		const expectedSegment = segments.shift()!;
		let actualSegment = actual.shift()!;
		if (expectedSegment === '...') {
			const nextExpectedSegment = segments[0];
			let nextActualSegment = actual[0];
			while (actual.length > 0) {
				if (nextExpectedSegment === nextActualSegment) {
					break;
				}
				actualSegment = actual.shift()!;
				nextActualSegment = actual[0];
			}
			continue;
		}
		assert.equal(actualSegment, expectedSegment, expectedSegment + ' NOT found in actual: "' + actualStr + '"');
	}
	assert.ok(actual.length === 0, actual.join(',') + ' Not found in expected: "' + expected + '"');
}
