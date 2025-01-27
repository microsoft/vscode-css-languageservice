/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as nodes from '../../parser/cssNodes';
import { Parser } from '../../parser/cssParser';

export class PrintingVisitor implements nodes.IVisitor {

	public tree: string[] = [];

	public visitNode(node: nodes.Node): boolean {
		this.tree.push(nodes.NodeType[node.type].toLowerCase());
		return true;
	}
}

export function assertNodes(fn: (input: string) => nodes.Node, input: string, expected: string): void {
	let node = fn(input);
	let visitor = new PrintingVisitor();

	node.acceptVisitor(visitor);

	let actual = visitor.tree;
	let actualStr = actual.join(',');
	let segments = expected.split(',');

	while (segments.length > 0) {
		let expectedSegment = segments.shift()!;
		let actualSegment = actual.shift()!;

		if (expectedSegment === '...') {
			let nextExpectedSegment = segments[0];
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

	assert.ok(true);
}

suite('CSS - Nodes', () => {

	test('Test Node', function () {

		let node = new nodes.Node();
		assert.equal(node.offset, -1);
		assert.equal(node.length, -1);
		assert.equal(node.parent, null);
		assert.equal(node.getChildren().length, 0);

		let c = 0;
		node.accept((n: nodes.Node) => {
			assert.ok(n === node);
			c += 1;
			return true;
		});
		assert.equal(c, 1);

		let child = new nodes.Node();
		node.adoptChild(child);

		c = 0;
		let expects = [node, child];
		node.accept((n: nodes.Node) => {
			assert.ok(n === expects[c]);
			c += 1;
			return true;
		});
		assert.equal(c, 2);
	});

	test('Test Adopting', function () {

		let child = new nodes.Node();
		let p1 = new nodes.Node();
		let p2 = new nodes.Node();

		assert.ok(child.parent === null);
		assert.equal(p1.getChildren().length, 0);
		assert.equal(p2.getChildren().length, 0);

		child = p1.adoptChild(child);
		assert.ok(child.parent === p1);
		assert.equal(p1.getChildren().length, 1);
		assert.equal(p2.getChildren().length, 0);

		child = p2.adoptChild(child);
		assert.ok(child.parent === p2);
		assert.equal(p1.getChildren().length, 0);
		assert.equal(p2.getChildren().length, 1);
	});

	function ruleset(input: string): nodes.RuleSet {
		let parser = new Parser();
		let node = parser.internalParse(input, parser._parseRuleset)!;
		return node;
	}

	function stylesheet(input: string): nodes.Stylesheet {
		let parser = new Parser();
		let node = parser.internalParse(input, parser._parseStylesheet)!;
		return node;
	}

	test('RuleSet', function () {
		assertNodes(ruleset, 'selector{prop:value}', 'ruleset,...,selector,simpleselector,elementnameselector,identifier,declarations,declaration,property,...');
		assertNodes(ruleset, 'selector { prop: value }', 'ruleset,...,selector,...,declaration,property,...,expression,...');
		assertNodes(ruleset, 'selector { prop; }', 'ruleset,...,selector,...');
	});

	test('Keyframe', function () {
		function fn(input: string): nodes.Node {
			let parser = new Parser();
			let node = parser.internalParse(input, parser._parseKeyframe)!;
			return node;
		}
		assertNodes(fn, '@keyframes name { from { top: 0px} to { top: 100px } }', 'keyframe,identifier,...,keyframeselector,...,declaration,...,keyframeselector,...,declaration,...');
	});

	test('Starting-style', function () {
		function fn(input: string): nodes.Node {
			let parser = new Parser();
			let node = parser.internalParse(input, parser._parseStartingStyleAtRule)!;
			return node;
		}
		assertNodes(fn, '@starting-style { p { opacity: 0; } }', 'startingstyleatrule,declarations,ruleset,...,selector,...,elementnameselector,...,...,...,...,...,...,...,...,...');
	});

	test('UnicodeRange', function () {
		function fn(input: string): nodes.Node {
			let parser = new Parser();
			let node = parser.internalParse(input, parser._parseFontFace)!;
			return node;
		}
		assertNodes(fn, '@font-face { unicode-range: U+0020-01ff, U+1?? }', 'fontface,declarations,declaration,property,identifier,expression,binaryexpression,term,unicoderange,...');
	});

	test('Stylesheet', function () {
		// Nesting
		assertNodes(stylesheet, 'selector { .foo {} }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,ruleset,...,selector,...,classselector,...');
		assertNodes(stylesheet, 'selector { :hover {} }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,ruleset,...,selector,...,pseudoselector,...');
		assertNodes(stylesheet, 'selector { :hover {}; }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,ruleset,...,selector,...,pseudoselector,...');
		assertNodes(stylesheet, 'selector { [value] {} }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,ruleset,...,selector,...,attributeselector,...');
		assertNodes(stylesheet, 'selector { & div {} }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,ruleset,...,selector,...,selectorcombinator,...,elementnameselector,...');
		assertNodes(stylesheet, 'selector { .foo { color: blue; } }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,ruleset,...,selector,...,classselector,...,declaration,property,identifier,...');
		assertNodes(stylesheet, 'selector { @media screen { color: blue; } }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,media,...,mediaquery,...,declaration,property,identifier,...');
		assertNodes(stylesheet, 'selector { @supports (width: 20rx) { color: blue; } }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,supports,...,declarations,declaration,property,...');
		assertNodes(stylesheet, 'selector { @layer foo { color: blue; } }', 'stylesheet,ruleset,...,selector,...,elementnameselector,...,layer,...,declarations,declaration,property,...');
	});
});
