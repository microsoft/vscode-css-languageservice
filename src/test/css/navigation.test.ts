/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as url from 'url';
import { join } from 'path';
import { Scope, GlobalScope, ScopeBuilder } from '../../parser/cssSymbolScope';
import * as nodes from '../../parser/cssNodes';
import { colorFrom256RGB, colorFromHSL } from '../../languageFacts/facts';

import {
	DocumentContext, TextDocument, DocumentHighlightKind, Range, Position, TextEdit, Color,
	ColorInformation, DocumentLink, SymbolKind, SymbolInformation, Location, LanguageService, Stylesheet, getCSSLanguageService,
} from '../../cssLanguageService';

import { URI } from 'vscode-uri';
import { startsWith } from '../../utils/strings';
import { getFsProvider } from '../testUtil/fsProvider';
import { joinPath } from '../../utils/resources';

export function assertScopesAndSymbols(ls: LanguageService, input: string, expected: string): void {
	let global = createScope(ls, input);
	assert.equal(scopeToString(global), expected);
}

export function assertHighlights(ls: LanguageService, input: string, marker: string, expectedMatches: number, expectedWrites: number, elementName?: string) {
	let document = TextDocument.create('test://test/test.css', 'css', 0, input);

	let stylesheet = ls.parseStylesheet(document);
	assertNoErrors(stylesheet);

	let index = input.indexOf(marker) + marker.length;
	let position = document.positionAt(index);

	let highlights = ls.findDocumentHighlights(document, position, stylesheet);
	assert.equal(highlights.length, expectedMatches, input);

	let nWrites = 0;
	for (let highlight of highlights) {
		if (highlight.kind === DocumentHighlightKind.Write) {
			nWrites++;
		}
		let range = highlight.range;
		let start = document.offsetAt(range.start), end = document.offsetAt(range.end);
		assert.equal(document.getText().substring(start, end), elementName || marker);
	}
	assert.equal(nWrites, expectedWrites, input);
}

export function getDocumentContext(documentUrl: string, workspaceFolder?: string): DocumentContext {
	return {
		resolveReference: (ref, base = documentUrl) => {
			if (startsWith(ref, '/') && workspaceFolder) {
				return joinPath(workspaceFolder, ref);
			}
			return url.resolve(base, ref);
		}
	};
}

export async function assertLinks(ls: LanguageService, input: string, expected: DocumentLink[], lang: string = 'css', testUri?: string, workspaceFolder?: string) {
	let document = TextDocument.create(testUri || `test://test/test.${lang}`, lang, 0, input);

	let stylesheet = ls.parseStylesheet(document);

	let links = await ls.findDocumentLinks2(document, stylesheet, getDocumentContext(document.uri, workspaceFolder || 'test://test'));
	assert.deepEqual(links, expected);
}

export function assertSymbols(ls: LanguageService, input: string, expected: SymbolInformation[], lang: string = 'css') {
	let document = TextDocument.create(`test://test/test.${lang}`, lang, 0, input);

	let stylesheet = ls.parseStylesheet(document);

	let symbols = ls.findDocumentSymbols(document, stylesheet);
	assert.deepEqual(symbols, expected);
}

export function assertColorSymbols(ls: LanguageService, input: string, ...expected: ColorInformation[]) {
	let document = TextDocument.create('test://test/test.css', 'css', 0, input);

	let stylesheet = ls.parseStylesheet(document);
	let result = ls.findDocumentColors(document, stylesheet);
	assert.deepEqual(result, expected);
}

export function assertColorPresentations(ls: LanguageService, color: Color, ...expected: string[]) {
	let document = TextDocument.create('test://test/test.css', 'css', 0, '');

	let stylesheet = ls.parseStylesheet(document);
	let range = newRange(1, 2);
	let result = ls.getColorPresentations(document, stylesheet, color, range);
	assert.deepEqual(result.map(r => r.label), expected);
	assert.deepEqual(result.map(r => r.textEdit), expected.map(l => TextEdit.replace(range, l)));
}

export function assertSymbolsInScope(ls: LanguageService, input: string, offset: number, ...selections: { name: string; type: nodes.ReferenceType }[]): void {

	let global = createScope(ls, input);

	let scope = global.findScope(offset)!;

	let getErrorMessage = function (name: string) {
		let all = 'symbol ' + name + ' not found. In scope: ';
		scope.getSymbols().forEach((sym) => { all += (sym.name + ' '); });
		return all;
	};

	for (let i = 0; i < selections.length; i++) {
		let selection = selections[i];
		let sym = scope.getSymbol(selection.name, selection.type) || global.getSymbol(selection.name, selection.type);
		assert.ok(!!sym, getErrorMessage(selection.name));
	}
}

export function assertScopeBuilding(ls: LanguageService, input: string, ...scopes: { offset: number; length: number; }[]): void {

	let global = createScope(ls, input);

	function assertChildren(scope: Scope): void {

		scope.children.forEach((scope) => {

			// check bounds
			let expected = scopes.shift()!;
			assert.equal(scope.offset, expected.offset);
			assert.equal(scope.length, expected.length);

			// recursive descent
			assertChildren(scope);
		});
	}

	assertChildren(global);

	assert.equal(scopes.length, 0, 'remaining scopes: ' + scopes.join());
}

function scopeToString(scope: Scope): string {
	let str = '';
	let symbols = scope.getSymbols();
	for (let index = 0; index < symbols.length; index++) {
		if (str.length > 0) {
			str += ',';
		}
		str += symbols[index].name;
	}
	let scopes = scope.children;
	for (let index = 0; index < scopes.length; index++) {
		if (str.length > 0) {
			str += ',';
		}
		str += ('[' + scopeToString(scopes[index]) + ']');
	}
	return str;
}

function assertNoErrors(stylesheet: Stylesheet): void {
	const markers = nodes.ParseErrorCollector.entries(<nodes.Stylesheet>stylesheet);
	if (markers.length > 0) {
		assert.ok(false, 'node has errors: ' + markers[0].getMessage() + ', offset: ' + markers[0].getNode().offset);
	}
}

function createScope(ls: LanguageService, input: string): Scope {
	let document = TextDocument.create('test://test/test.css', 'css', 0, input);

	let styleSheet = ls.parseStylesheet(document),
		global = new GlobalScope(),
		builder = new ScopeBuilder(global);

	assertNoErrors(styleSheet);

	(<nodes.Stylesheet>styleSheet).acceptVisitor(builder);
	return global;
}

function getCSSLS() {
	return getCSSLanguageService({ fileSystemProvider: getFsProvider() });
}

suite('CSS - Navigation', () => {

	suite('Scope', () => {

		test('scope creation', function () {
			let global = new GlobalScope(),
				child1 = new Scope(10, 5),
				child2 = new Scope(15, 5);

			global.addChild(child1);
			global.addChild(child2);

			assert.equal(global.children.length, 2);
			assert.ok(child1.parent === global);
			assert.ok(child2.parent === global);

			// find children
			assert.ok(global.findScope(-1) === null);
			assert.ok(global.findScope(0) === global);
			assert.ok(global.findScope(10) === child1);
			assert.ok(global.findScope(14) === child1);
			assert.ok(global.findScope(15) === child2);
			assert.ok(global.findScope(19) === child2);
			assert.ok(global.findScope(19)!.parent === global);
		});

		test('scope building', function () {
			let ls = getCSSLS();
			assertScopeBuilding(ls, '.class {}', { offset: 7, length: 2 });
			assertScopeBuilding(ls, '.class {} .class {}', { offset: 7, length: 2 }, { offset: 17, length: 2 });
		});

		test('symbols in scopes', function () {
			let ls = getCSSLS();
			assertSymbolsInScope(ls, '@keyframes animation {};', 0, { name: 'animation', type: nodes.ReferenceType.Keyframe });
			assertSymbolsInScope(ls, ' .class1 {} .class2 {}', 0, { name: '.class1', type: nodes.ReferenceType.Rule }, { name: '.class2', type: nodes.ReferenceType.Rule });
		});

		test('scopes and symbols', function () {
			let ls = getCSSLS();
			assertScopesAndSymbols(ls, '.class {}', '.class,[]');
			assertScopesAndSymbols(ls, '@keyframes animation {}; .class {}', 'animation,.class,[],[]');
			assertScopesAndSymbols(ls, '@page :pseudo-class { margin:2in; }', '[]');
			assertScopesAndSymbols(ls, '@media print { body { font-size: 10pt } }', '[body,[]]');
			assertScopesAndSymbols(ls, '@-moz-keyframes identifier { 0% { top: 0; } 50% { top: 30px; left: 20px; }}', 'identifier,[[],[]]');
			assertScopesAndSymbols(ls, '@font-face { font-family: "Bitstream Vera Serif Bold"; }', '[]');
		});

		test('test variables in root scope', function () {
			let ls = getCSSLS();
			assertSymbolsInScope(ls, ':root{ --var1: abc; --var2: def; }', 0, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable });
		});

		test('test variables in local scope', function () {
			let ls = getCSSLS();
			assertSymbolsInScope(ls, '.a{ --var1: abc; --var2: def; }', 2, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable });
		});

		test('test variables in local scope get root variables too', function () {
			let ls = getCSSLS();
			assertSymbolsInScope(ls, '.a{ --var1: abc; } :root{ --var2: abc;}', 2, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable });
		});

		test('test variables in local scope get root variables and other local variables too', function () {
			let ls = getCSSLS();
			assertSymbolsInScope(ls, '.a{ --var1: abc; } .b{ --var2: abc; } :root{ --var3: abc;}', 2, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable }, { name: '--var3', type: nodes.ReferenceType.Variable });
		});
	});

	suite('Symbols', () => {
		test('basic symbols', () => {
			let ls = getCSSLS();
			assertSymbols(ls, '.foo {}', [{ name: '.foo', kind: SymbolKind.Class, location: Location.create('test://test/test.css', newRange(0, 7)) }]);
			assertSymbols(ls, '.foo:not(.selected) {}', [{ name: '.foo:not(.selected)', kind: SymbolKind.Class, location: Location.create('test://test/test.css', newRange(0, 22)) }]);

			// Media Query
			assertSymbols(ls, '@media screen, print {}', [{ name: '@media screen, print', kind: SymbolKind.Module, location: Location.create('test://test/test.css', newRange(0, 23)) }]);
		});
	});

	suite('Highlights', () => {

		test('mark highlights', function () {
			let ls = getCSSLS();
			assertHighlights(ls, '@keyframes id {}; #main { animation: id 4s linear 0s infinite alternate; }', 'id', 2, 1);
			assertHighlights(ls, '@keyframes id {}; #main { animation-name: id; foo: id;}', 'id', 2, 1);
		});

		test('mark occurrences for variable defined in root and used in a rule', function () {
			let ls = getCSSLS();
			assertHighlights(ls, '.a{ background: let(--var1); } :root{ --var1: abc;}', '--var1', 2, 1);
		});

		test('mark occurrences for variable defined in a rule and used in a different rule', function () {
			let ls = getCSSLS();
			assertHighlights(ls, '.a{ background: let(--var1); } :b{ --var1: abc;}', '--var1', 2, 1);
		});

		test('mark occurrences for property', function () {
			let ls = getCSSLS();
			assertHighlights(ls, 'body { display: inline } #foo { display: inline }', 'display', 2, 0);
		});

		test('mark occurrences for value', function () {
			let ls = getCSSLS();
			assertHighlights(ls, 'body { display: inline } #foo { display: inline }', 'inline', 2, 0);
		});

		test('mark occurrences for selector', function () {
			let ls = getCSSLS();
			assertHighlights(ls, 'body { display: inline } #foo { display: inline }', 'body', 1, 1);
		});

		test('mark occurrences for comment', function () {
			let ls = getCSSLS();
			assertHighlights(ls, '/* comment */body { display: inline } ', 'comment', 0, 0);
		});

		test('mark occurrences for whole classname instead of only class identifier', () => {
			let ls = getCSSLS();
			assertHighlights(ls, '.foo { }', '.foo', 1, 1);
			assertHighlights(ls, '.body { } body { }', '.body', 1, 1);
		});
	});

	suite('Links', () => {

		test('basic @import links', async () => {
			let ls = getCSSLS();
			await assertLinks(ls, `@import 'foo.css';`, [
				{ range: newRange(8, 17), target: 'test://test/foo.css' }
			]);

			await assertLinks(ls, `@import './foo.css';`, [
				{ range: newRange(8, 19), target: 'test://test/foo.css' }
			]);

			await assertLinks(ls, `@import '../foo.css';`, [
				{ range: newRange(8, 20), target: 'test://foo.css' }
			]);
		});

		test('complex @import links', async () => {
			let ls = getCSSLS();
			await assertLinks(ls, `@import url("foo.css") print;`, [
				{ range: newRange(12, 21), target: 'test://test/foo.css' }
			]);

			await assertLinks(ls, `@import url("chrome://downloads")`, [
				{ range: newRange(12, 32), target: 'chrome://downloads' }
			]);

			await assertLinks(ls, `@import url('landscape.css') screen and (orientation:landscape);`, [
				{ range: newRange(12, 27), target: 'test://test/landscape.css' }
			]);
		});

		test('links in rulesets', async () => {
			let ls = getCSSLS();
			await assertLinks(ls, `body { background-image: url(./foo.jpg)`, [
				{ range: newRange(29, 38), target: 'test://test/foo.jpg' }
			]);

			await assertLinks(ls, `body { background-image: url('./foo.jpg')`, [
				{ range: newRange(29, 40), target: 'test://test/foo.jpg' }
			]);
		});

		test('No links with empty range', async () => {
			let ls = getCSSLS();
			await assertLinks(ls, `body { background-image: url()`, []);
			await assertLinks(ls, `@import url();`, []);
		});

		function getTestResource(path: string) {
			return URI.file(join(__dirname, '../../../../test/linksTestFixtures', path)).toString();
		}

		test('url links', async function () {
			let ls = getCSSLS();
			let testUri = getTestResource('about.css');
			let workspaceFolder = getTestResource('');

			await assertLinks(ls, 'html { background-image: url("hello.html")',
				[{ range: newRange(29, 41), target: getTestResource('hello.html') }], 'css', testUri, workspaceFolder
			);
		});

		test('node module resolving', async function () {
			let ls = getCSSLS();
			let testUri = getTestResource('about.css');
			let workspaceFolder = getTestResource('');

			await assertLinks(ls, 'html { background-image: url("~foo/hello.html")',
				[{ range: newRange(29, 46), target: getTestResource('node_modules/foo/hello.html') }], 'css', testUri, workspaceFolder
			);
		});

		test('node module subfolder resolving', async function () {
			let ls = getCSSLS();
			let testUri = getTestResource('subdir/about.css');
			let workspaceFolder = getTestResource('');

			await assertLinks(ls, 'html { background-image: url("~foo/hello.html")',
				[{ range: newRange(29, 46), target: getTestResource('node_modules/foo/hello.html') }], 'css', testUri, workspaceFolder
			);
		});
	});

	suite('Color', () => {

		test('color symbols', function () {
			let ls = getCSSLS();
			assertColorSymbols(ls, 'body { backgroundColor: #ff9977; }',
				{ color: colorFrom256RGB(0xff, 0x99, 0x77), range: newRange(24, 31) }
			);
			assertColorSymbols(ls, 'body { backgroundColor: hsl(0, 0%, 100%); }',
				{ color: colorFrom256RGB(255, 255, 255), range: newRange(24, 40) }
			);
			assertColorSymbols(ls, 'body { backgroundColor: hsl(0, 1%, 100%); }',
				{ color: colorFrom256RGB(255, 255, 255), range: newRange(24, 40) }
			);
			assertColorSymbols(ls, '.oo { color: rgb(1,40,1); borderColor: hsl(120, 75%, 85%) }',
				{ color: colorFrom256RGB(1, 40, 1), range: newRange(13, 24) },
				{ color: colorFromHSL(120, 0.75, 0.85), range: newRange(39, 57) }
			);
			assertColorSymbols(ls, 'body { backgroundColor: rgba(1, 40, 1, 0.3); }',
				{ color: colorFrom256RGB(1, 40, 1, 0.3), range: newRange(24, 43) }
			);
		});

		test('color presentations', function () {
			let ls = getCSSLS();
			assertColorPresentations(ls, colorFrom256RGB(255, 0, 0), 'rgb(255, 0, 0)', '#ff0000', 'hsl(0, 100%, 50%)');
			assertColorPresentations(ls, colorFrom256RGB(77, 33, 111, 0.5), 'rgba(77, 33, 111, 0.5)', '#4d216f80', 'hsla(274, 54%, 28%, 0.5)');
		});
	});
});

export function newRange(start: number, end: number) {
	return Range.create(Position.create(0, start), Position.create(0, end));
}