/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { join } from 'path';
import { Scope, GlobalScope, ScopeBuilder } from '../../parser/cssSymbolScope';
import * as nodes from '../../parser/cssNodes';
import { colorFrom256RGB, colorFromHSL, colorFromHWB } from '../../languageFacts/facts';

import {
	TextDocument, DocumentHighlightKind, Range, Position, TextEdit, Color,
	ColorInformation, DocumentLink, SymbolKind, SymbolInformation, Location, LanguageService, Stylesheet, getCSSLanguageService, DocumentSymbol, LanguageSettings,
} from '../../cssLanguageService';

import { URI } from 'vscode-uri';
import { getFsProvider } from '../testUtil/fsProvider';
import { getDocumentContext } from '../testUtil/documentContext';

export function assertScopesAndSymbols(ls: LanguageService, input: string, expected: string): void {
	const global = createScope(ls, input);
	assert.equal(scopeToString(global), expected);
}

export function assertHighlights(ls: LanguageService, input: string, marker: string, expectedMatches: number, expectedWrites: number, elementName?: string) {
	const document = TextDocument.create('test://test/test.css', 'css', 0, input);

	const stylesheet = ls.parseStylesheet(document);
	assertNoErrors(stylesheet);

	const index = input.indexOf(marker) + marker.length;
	const position = document.positionAt(index);

	const highlights = ls.findDocumentHighlights(document, position, stylesheet);
	assert.equal(highlights.length, expectedMatches, input);

	let nWrites = 0;
	for (const highlight of highlights) {
		if (highlight.kind === DocumentHighlightKind.Write) {
			nWrites++;
		}
		const range = highlight.range;
		const start = document.offsetAt(range.start), end = document.offsetAt(range.end);
		assert.equal(document.getText().substring(start, end), elementName || marker);
	}
	assert.equal(nWrites, expectedWrites, input);
}



export async function assertLinks(ls: LanguageService, input: string, expected: DocumentLink[], lang: string = 'css', testUri?: string, workspaceFolder?: string) {
	const document = TextDocument.create(testUri || `test://test/test.${lang}`, lang, 0, input);

	const stylesheet = ls.parseStylesheet(document);

	const links = await ls.findDocumentLinks2(document, stylesheet, getDocumentContext(workspaceFolder || 'test://test'));
	assert.deepEqual(links, expected);
}

export function assertSymbolInfos(ls: LanguageService, input: string, expected: SymbolInformation[], lang: string = 'css') {
	const document = TextDocument.create(`test://test/test.${lang}`, lang, 0, input);

	const stylesheet = ls.parseStylesheet(document);

	const symbols = ls.findDocumentSymbols(document, stylesheet);
	assert.deepEqual(symbols, expected);
}

export function assertDocumentSymbols(ls: LanguageService, input: string, expected: DocumentSymbol[], lang: string = 'css') {
	const document = TextDocument.create(`test://test/test.${lang}`, lang, 0, input);

	const stylesheet = ls.parseStylesheet(document);

	const symbols = ls.findDocumentSymbols2(document, stylesheet);
	assert.deepEqual(symbols, expected);
}

export function assertColorSymbols(ls: LanguageService, input: string, ...expected: ColorInformation[]) {
	const document = TextDocument.create('test://test/test.css', 'css', 0, input);

	const stylesheet = ls.parseStylesheet(document);
	const result = ls.findDocumentColors(document, stylesheet);
	assert.deepEqual(result, expected);
}

export function assertColorPresentations(ls: LanguageService, color: Color, ...expected: string[]) {
	const document = TextDocument.create('test://test/test.css', 'css', 0, '');

	const stylesheet = ls.parseStylesheet(document);
	const range = newRange(1, 2);
	const result = ls.getColorPresentations(document, stylesheet, color, range);
	assert.deepEqual(result.map(r => r.label), expected);
	assert.deepEqual(result.map(r => r.textEdit), expected.map(l => TextEdit.replace(range, l)));
}

export function assertSymbolsInScope(ls: LanguageService, input: string, offset: number, ...selections: { name: string; type: nodes.ReferenceType }[]): void {

	const global = createScope(ls, input);

	const scope = global.findScope(offset)!;

	const getErrorMessage = function (name: string) {
		let all = 'symbol ' + name + ' not found. In scope: ';
		scope.getSymbols().forEach((sym) => { all += (sym.name + ' '); });
		return all;
	};

	for (let i = 0; i < selections.length; i++) {
		const selection = selections[i];
		const sym = scope.getSymbol(selection.name, selection.type) || global.getSymbol(selection.name, selection.type);
		assert.ok(!!sym, getErrorMessage(selection.name));
	}
}

export function assertScopeBuilding(ls: LanguageService, input: string, ...scopes: { offset: number; length: number; }[]): void {

	const global = createScope(ls, input);

	function assertChildren(scope: Scope): void {

		scope.children.forEach((scope) => {

			// check bounds
			const expected = scopes.shift()!;
			assert.equal(scope.offset, expected.offset);
			assert.equal(scope.length, expected.length);

			// recursive descent
			assertChildren(scope);
		});
	}

	assertChildren(global);

	assert.equal(scopes.length, 0, 'remaining scopes: ' + scopes.join());
}

export function getTestResource(path: string) {
	return URI.file(join(__dirname, '../../../../test/linksTestFixtures', path)).toString(true);
}

function scopeToString(scope: Scope): string {
	let str = '';
	const symbols = scope.getSymbols();
	for (let index = 0; index < symbols.length; index++) {
		if (str.length > 0) {
			str += ',';
		}
		str += symbols[index].name;
	}
	const scopes = scope.children;
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
	const document = TextDocument.create('test://test/test.css', 'css', 0, input);

	const styleSheet = ls.parseStylesheet(document),
		global = new GlobalScope(),
		builder = new ScopeBuilder(global);

	assertNoErrors(styleSheet);

	(<nodes.Stylesheet>styleSheet).acceptVisitor(builder);
	return global;
}

function getCSSLS() {
	return getCSSLanguageService({ fileSystemProvider: getFsProvider() });
}

function aliasSettings(): LanguageSettings {
	return {
		"importAliases": {
				"@SingleStylesheet": "/src/assets/styles.css",
				"@AssetsDir/": "/src/assets/",
		}
	};
}

suite('CSS - Navigation', () => {

	suite('Scope', () => {

		test('scope creation', function () {
			const global = new GlobalScope(),
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
			const ls = getCSSLS();
			assertScopeBuilding(ls, '.class {}', { offset: 7, length: 2 });
			assertScopeBuilding(ls, '.class {} .class {}', { offset: 7, length: 2 }, { offset: 17, length: 2 });
		});

		test('symbols in scopes', function () {
			const ls = getCSSLS();
			assertSymbolsInScope(ls, '@keyframes animation {};', 0, { name: 'animation', type: nodes.ReferenceType.Keyframe });
			assertSymbolsInScope(ls, ' .class1 {} .class2 {}', 0, { name: '.class1', type: nodes.ReferenceType.Rule }, { name: '.class2', type: nodes.ReferenceType.Rule });
		});

		test('scopes and symbols', function () {
			const ls = getCSSLS();
			assertScopesAndSymbols(ls, '.class {}', '.class,[]');
			assertScopesAndSymbols(ls, '@keyframes animation {}; .class {}', 'animation,.class,[],[]');
			assertScopesAndSymbols(ls, '@page :pseudo-class { margin:2in; }', '[]');
			assertScopesAndSymbols(ls, '@media print { body { font-size: 10pt } }', '[body,[]]');
			assertScopesAndSymbols(ls, '@scope (.foo) to (.bar) { body { font-size: 10pt } }', '[body,[]]')
			assertScopesAndSymbols(ls, '@-moz-keyframes identifier { 0% { top: 0; } 50% { top: 30px; left: 20px; }}', 'identifier,[[],[]]');
			assertScopesAndSymbols(ls, '@font-face { font-family: "Bitstream Vera Serif Bold"; }', '[]');
		});

		test('test variables in root scope', function () {
			const ls = getCSSLS();
			assertSymbolsInScope(ls, ':root{ --var1: abc; --var2: def; }', 0, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable });
		});

		test('test variables in local scope', function () {
			const ls = getCSSLS();
			assertSymbolsInScope(ls, '.a{ --var1: abc; --var2: def; }', 2, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable });
		});

		test('test variables in local scope get root variables too', function () {
			const ls = getCSSLS();
			assertSymbolsInScope(ls, '.a{ --var1: abc; } :root{ --var2: abc;}', 2, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable });
		});

		test('test variables in local scope get root variables and other local variables too', function () {
			const ls = getCSSLS();
			assertSymbolsInScope(ls, '.a{ --var1: abc; } .b{ --var2: abc; } :root{ --var3: abc;}', 2, { name: '--var1', type: nodes.ReferenceType.Variable }, { name: '--var2', type: nodes.ReferenceType.Variable }, { name: '--var3', type: nodes.ReferenceType.Variable });
		});
	});

	suite('Symbols', () => {
		test('basic symbol infos', () => {
			const ls = getCSSLS();
			assertSymbolInfos(ls, '.foo {}', [{ name: '.foo', kind: SymbolKind.Class, location: Location.create('test://test/test.css', newRange(0, 7)) }]);
			assertSymbolInfos(ls, '.foo:not(.selected) {}', [{ name: '.foo:not(.selected)', kind: SymbolKind.Class, location: Location.create('test://test/test.css', newRange(0, 22)) }]);

			// multiple selectors, each range starts with the selector offset
			assertSymbolInfos(ls, '.voo.doo, .bar {}', [
				{ name: '.voo.doo', kind: SymbolKind.Class, location: Location.create('test://test/test.css', newRange(0, 17)) },
				{ name: '.bar', kind: SymbolKind.Class, location: Location.create('test://test/test.css', newRange(10, 17)) },
			]);

			// Media Query
			assertSymbolInfos(ls, '@media screen, print {}', [{ name: '@media screen, print', kind: SymbolKind.Module, location: Location.create('test://test/test.css', newRange(0, 23)) }]);
			
			// Scope
			assertSymbolInfos(ls, '@scope (.foo) to (.bar) {}', [{ name: '@scope .foo → .bar', kind: SymbolKind.Module, location: Location.create('test://test/test.css', newRange(0, 26)) }]);
		});

		test('basic document symbols', () => {
			const ls = getCSSLS();
			assertDocumentSymbols(ls, '.foo {}', [{ name: '.foo', kind: SymbolKind.Class, range: newRange(0, 7), selectionRange: newRange(0, 4) }]);
			assertDocumentSymbols(ls, '.foo:not(.selected) {}', [{ name: '.foo:not(.selected)', kind: SymbolKind.Class, range: newRange(0, 22), selectionRange: newRange(0, 19) }]);

			// multiple selectors, each range starts with the selector offset
			assertDocumentSymbols(ls, '.voo.doo, .bar {}', [
				{ name: '.voo.doo', kind: SymbolKind.Class, range: newRange(0, 17), selectionRange: newRange(0, 8) },
				{ name: '.bar', kind: SymbolKind.Class, range: newRange(10, 17), selectionRange: newRange(10, 14) },
			]);

			// Media Query
			assertDocumentSymbols(ls, '@media screen, print {}', [{ name: '@media screen, print', kind: SymbolKind.Module, range: newRange(0, 23), selectionRange: newRange(7, 20) }]);
			
			// Scope
			assertDocumentSymbols(ls, '@scope (.foo) to (.bar) {}', [{ name: '@scope .foo → .bar', kind: SymbolKind.Module, range: newRange(0, 26), selectionRange: newRange(7, 23) }]);
		});
	});

	suite('Highlights', () => {

		test('mark highlights', function () {
			const ls = getCSSLS();
			assertHighlights(ls, '@keyframes id {}; #main { animation: id 4s linear 0s infinite alternate; }', 'id', 2, 1);
			assertHighlights(ls, '@keyframes id {}; #main { animation-name: id; foo: id;}', 'id', 2, 1);
		});

		test('mark occurrences for variable defined in root and used in a rule', function () {
			const ls = getCSSLS();
			assertHighlights(ls, '.a{ background: const(--var1); } :root{ --var1: abc;}', '--var1', 2, 1);
		});

		test('mark occurrences for variable defined in a rule and used in a different rule', function () {
			const ls = getCSSLS();
			assertHighlights(ls, '.a{ background: const(--var1); } :b{ --var1: abc;}', '--var1', 2, 1);
		});

		test('mark occurrences for property', function () {
			const ls = getCSSLS();
			assertHighlights(ls, 'body { display: inline } #foo { display: inline }', 'display', 2, 0);
		});

		test('mark occurrences for value', function () {
			const ls = getCSSLS();
			assertHighlights(ls, 'body { display: inline } #foo { display: inline }', 'inline', 2, 0);
		});

		test('mark occurrences for selector', function () {
			const ls = getCSSLS();
			assertHighlights(ls, 'body { display: inline } #foo { display: inline }', 'body', 1, 1);
		});

		test('mark occurrences for comment', function () {
			const ls = getCSSLS();
			assertHighlights(ls, '/* comment */body { display: inline } ', 'comment', 0, 0);
		});

		test('mark occurrences for whole classname instead of only class identifier', () => {
			const ls = getCSSLS();
			assertHighlights(ls, '.foo { }', '.foo', 1, 1);
			assertHighlights(ls, '.body { } body { }', '.body', 1, 1);
		});
	});

	suite('Links', () => {

		test('basic @import links', async () => {
			const ls = getCSSLS();
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
			const ls = getCSSLS();
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

		test('aliased @import links (single-root)', async function () {
			const ls = getCSSLS();
			ls.configure({
				"importAliases": {
					"@SassFile": "scss/file1.scss",
					"@SassDir/": "scss/",
				}
			});

			const testUri = getTestResource('scss/file1.scss');
			const testUri2 = getTestResource('scss/file2.module.scss');
			const workspaceFolder = getTestResource('');

			await assertLinks(ls, '@import "@SassFile"', [{ range: newRange(8, 19), target: getTestResource('scss/file1.scss')}], 'scss', testUri, workspaceFolder);

			await assertLinks(ls, '@import "@SassDir/file2.module.scss"', [{ range: newRange(8, 36), target: getTestResource('scss/file2.module.scss')}], 'scss', testUri2, workspaceFolder);
		});

		test('aliased @import links (multi-root)', async function () {
			const lsRoot1 = getCSSLS();
			const lsRoot2 = getCSSLS();

			lsRoot1.configure({
				importAliases: {
					"@SassFile": "assets/sass/main.scss"
				}
			});

			lsRoot2.configure({
				importAliases: {
					"@SassFile": "assets/sass/main.scss"
				}
			});

			const testUriRoot1 = getTestResource('scss/root1/main.scss');
			const workspaceRoot1 = getTestResource('scss/root1');

			const testUriRoot2 = getTestResource('scss/root2/main.scss');
			const workspaceRoot2 = getTestResource('scss/root2');

			await assertLinks(
				lsRoot1,
				'@import "@SassFile"',
				[{ range: newRange(8, 19), target: getTestResource('scss/root1/assets/sass/main.scss') }],
				'scss',
				testUriRoot1,
				workspaceRoot1
			);

			await assertLinks(
				lsRoot2,
				'@import "@SassFile"',
				[{ range: newRange(8, 19), target: getTestResource('scss/root2/assets/sass/main.scss') }],
				'scss',
				testUriRoot2,
				workspaceRoot2
			);
		});

		test('aliased @import links (mono-repo)', async function () {
			const ls = getCSSLS();
			
			// pkgs have actual '.vscode/settings.json' in linksTestFixtures/scss/pkg folders
			ls.configure({
				importAliases: {
					"@Shared": "./file1.scss"
				}
			});

			const rootFolder = getTestResource('scss');

			const pkg1Uri = getTestResource('scss/pkg1/main.scss');
			const pkg2Uri = getTestResource('scss/pkg2/main.scss');

			// pkg1/2 should use their local alias and also resolve the shared one
			await assertLinks(
				ls,
				'@import "@Shared"; @import "@Styles";',
				[
					{ range: newRange(8, 17), target: getTestResource('scss/file1.scss') },
					{ range: newRange(27, 36), target: getTestResource('scss/pkg1/main.scss') }
				],
				'scss',
				pkg1Uri,
				rootFolder
			);

			await assertLinks(
				ls,
				'@import "@Shared"; @import "@Styles";',
				[
					{ range: newRange(8, 17), target: getTestResource('scss/file1.scss') },
					{ range: newRange(27, 36), target: getTestResource('scss/pkg2/main.scss') }
				],
				'scss',
				pkg2Uri,
				rootFolder
			);
		});

		test('links in rulesets', async () => {
			const ls = getCSSLS();
			await assertLinks(ls, `body { background-image: url(./foo.jpg)`, [
				{ range: newRange(29, 38), target: 'test://test/foo.jpg' }
			]);

			await assertLinks(ls, `body { background-image: url('./foo.jpg')`, [
				{ range: newRange(29, 40), target: 'test://test/foo.jpg' }
			]);
		});

		test('No links with empty range', async () => {
			const ls = getCSSLS();
			await assertLinks(ls, `body { background-image: url()`, []);
			await assertLinks(ls, `@import url();`, []);
		});

		test('No links for data:', async () => {
			const ls = getCSSLS();
			await assertLinks(ls, `body { background-image: url(data:image/gif;base64,R0lGODlhEAAQAMQAAORHHOVSKudfOul) }`, []);
		});


		test('url links', async function () {
			const ls = getCSSLS();
			const testUri = getTestResource('about.css');
			const workspaceFolder = getTestResource('');

			await assertLinks(ls, 'html { background-image: url("hello.html")',
				[{ range: newRange(29, 41), target: getTestResource('hello.html') }], 'css', testUri, workspaceFolder
			);

			await assertLinks(ls, '@import "a.css"',
				[{ range: newRange(8, 15), target: getTestResource('a.css') }], 'css', testUri, workspaceFolder
			);
			await assertLinks(ls, '@import "green/c.css"',
				[{ range: newRange(8, 21), target: getTestResource('green/c.css') }], 'css', testUri, workspaceFolder
			);
			await assertLinks(ls, '@import "./green/c.css"',
				[{ range: newRange(8, 23), target: getTestResource('green/c.css') }], 'css', testUri, workspaceFolder
			);
		});

		test('node module resolving', async function () {
			const ls = getCSSLS();
			const testUri = getTestResource('about.css');
			const workspaceFolder = getTestResource('');

			await assertLinks(ls, 'html { background-image: url("~foo/hello.html")',
				[{ range: newRange(29, 46), target: getTestResource('node_modules/foo/hello.html') }], 'css', testUri, workspaceFolder
			);
			await assertLinks(ls, '@import "~green/c.css"',
				[{ range: newRange(8, 22), target: getTestResource('node_modules/green/c.css') }], 'css', testUri, workspaceFolder
			);
		});

		test('node module subfolder resolving', async function () {
			const ls = getCSSLS();
			const testUri = getTestResource('subdir/about.css');
			const workspaceFolder = getTestResource('');

			await assertLinks(ls, 'html { background-image: url("~foo/hello.html")',
				[{ range: newRange(29, 46), target: getTestResource('node_modules/foo/hello.html') }], 'css', testUri, workspaceFolder
			);
			await assertLinks(ls, '@import "../green/c.css"',
				[{ range: newRange(8, 24), target: getTestResource('green/c.css') }], 'css', testUri, workspaceFolder
			);
		});
	});

	suite('Color', () => {

		test('color symbols', function () {
			const ls = getCSSLS();
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
			assertColorSymbols(ls, 'body { backgroundColor: hwb(194 0% 0% / .5); }',
				{ color: colorFromHWB(194, 0, 0, 0.5), range: newRange(24, 43) }
			);
		});

		test('color presentations', function () {
			const ls = getCSSLS();
			assertColorPresentations(
				ls,
				colorFrom256RGB(255, 0, 0),
				'rgb(255, 0, 0)',
				'#ff0000',
				'hsl(0, 100%, 50%)',
				'hwb(0 0% 0%)',
				'lab(53.23% 80.11 67.22)',
				'lch(53.23% 104.58 40)',
				'oklab(62.793% 0.22489 0.1258)',
				'oklch(62.793% 0.25768 29.223)',
			);
			assertColorPresentations(
				ls,
				colorFrom256RGB(77, 33, 111, 0.5),
				'rgba(77, 33, 111, 0.5)',
				'#4d216f80',
				'hsla(274, 54%, 28%, 0.5)',
				'hwb(274 13% 56% / 0.5)',
				'lab(23.04% 35.9 -36.96 / 0.5)',
				'lch(23.04% 51.53 314.16 / 0.5)',
				'oklab(35.231% 0.0782 -0.10478 / 0.5)',
				'oklch(35.231% 0.13074 306.734 / 0.5)',
			);
		});
	});
});

export function newRange(start: number, end: number) {
	return Range.create(Position.create(0, start), Position.create(0, end));
}
