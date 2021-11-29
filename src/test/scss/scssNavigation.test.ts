/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../../parser/cssNodes';
import { assertSymbolsInScope, assertScopesAndSymbols, assertHighlights, assertColorSymbols, assertLinks, newRange, getTestResource } from '../css/navigation.test';
import { getSCSSLanguageService, DocumentLink, TextDocument } from '../../cssLanguageService';
import * as assert from 'assert';
import * as path from 'path';
import { URI, Utils } from 'vscode-uri';
import { getFsProvider } from '../testUtil/fsProvider';
import { getDocumentContext } from '../testUtil/documentContext';

function getSCSSLS() {
	return getSCSSLanguageService({ fileSystemProvider: getFsProvider() });
}

async function assertDynamicLinks(docUri: string, input: string, expected: DocumentLink[]) {
	const ls = getSCSSLS();
	const document = TextDocument.create(docUri, 'scss', 0, input);

	const stylesheet = ls.parseStylesheet(document);

	const links = await ls.findDocumentLinks2(document, stylesheet, getDocumentContext(document.uri));
	assert.deepEqual(links, expected);
}

async function assertNoDynamicLinks(docUri: string, input: string, extecedTarget: string | undefined) {
	const ls = getSCSSLS();
	const document = TextDocument.create(docUri, 'scss', 0, input);

	const stylesheet = ls.parseStylesheet(document);

	const links = await ls.findDocumentLinks2(document, stylesheet, getDocumentContext(document.uri));
	if (extecedTarget) {
		assert.deepEqual(links.length, 1, `${docUri.toString()} should only return itself`);
		assert.deepEqual(links[0].target, extecedTarget, `${docUri.toString()} should only return itself`);
	} else {
		assert.deepEqual(links.length, 0, `${docUri.toString()} hould have no link`);
	}

}

suite('SCSS - Navigation', () => {

	suite('Scopes and Symbols', () => {

		test('symbols in scopes', () => {
			const ls = getSCSSLS();
			assertSymbolsInScope(ls, '$var: iable;', 0, { name: '$var', type: nodes.ReferenceType.Variable });
			assertSymbolsInScope(ls, '$var: iable;', 11, { name: '$var', type: nodes.ReferenceType.Variable });
			assertSymbolsInScope(ls, '$var: iable; .class { $color: blue; }', 11, { name: '$var', type: nodes.ReferenceType.Variable }, { name: '.class', type: nodes.ReferenceType.Rule });
			assertSymbolsInScope(ls, '$var: iable; .class { $color: blue; }', 22, { name: '$color', type: nodes.ReferenceType.Variable });
			assertSymbolsInScope(ls, '$var: iable; .class { $color: blue; }', 36, { name: '$color', type: nodes.ReferenceType.Variable });

			assertSymbolsInScope(ls, '@namespace "x"; @mixin mix() {}', 0, { name: 'mix', type: nodes.ReferenceType.Mixin });
			assertSymbolsInScope(ls, '@mixin mix { @mixin nested() {} }', 12, { name: 'nested', type: nodes.ReferenceType.Mixin });
			assertSymbolsInScope(ls, '@mixin mix () { @mixin nested() {} }', 13);
		});

		test('scopes and symbols', () => {
			const ls = getSCSSLS();
			assertScopesAndSymbols(ls, '$var1: 1; $var2: 2; .foo { $var3: 3; }', '$var1,$var2,.foo,[$var3]');
			assertScopesAndSymbols(ls, '@mixin mixin1 { $var0: 1} @mixin mixin2($var1) { $var3: 3 }', 'mixin1,mixin2,[$var0],[$var1,$var3]');
			assertScopesAndSymbols(ls, 'a b { $var0: 1; c { d { } } }', '[$var0,c,[d,[]]]');
			assertScopesAndSymbols(ls, '@function a($p1: 1, $p2: 2) { $v1: 3; @return $v1; }', 'a,[$p1,$p2,$v1]');
			assertScopesAndSymbols(ls, '$var1: 3; @if $var1 == 2 { $var2: 1; } @else { $var2: 2; $var3: 2;} ', '$var1,[$var2],[$var2,$var3]');
			assertScopesAndSymbols(ls, '@if $var1 == 2 { $var2: 1; } @else if $var1 == 2 { $var3: 2; } @else { $var3: 2; } ', '[$var2],[$var3],[$var3]');
			assertScopesAndSymbols(ls, '$var1: 3; @while $var1 < 2 { #rule { a: b; } }', '$var1,[#rule,[]]');
			assertScopesAndSymbols(ls, '$i:0; @each $name in f1, f2, f3  { $i:$i+1; }', '$i,[$name,$i]');
			assertScopesAndSymbols(ls, '$i:0; @for $x from $i to 5  { }', '$i,[$x]');
			assertScopesAndSymbols(ls, '@each $i, $j, $k in f1, f2, f3  { }', '[$i,$j,$k]');
		});
	});

	suite('Highlight', () => {

		test('mark highlights', () => {
			const ls = getSCSSLS();

			assertHighlights(ls, '$var1: 1; $var2: /**/$var1;', '$var1', 2, 1);
			assertHighlights(ls, '$var1: 1; ls { $var2: /**/$var1; }', '/**/', 2, 1, '$var1');
			assertHighlights(ls, 'r1 { $var1: 1; p1: $var1;} r2,r3 { $var1: 1; p1: /**/$var1 + $var1;}', '/**/', 3, 1, '$var1');
			assertHighlights(ls, '.r1 { r1: 1em; } r2 { r1: 2em; @extend /**/.r1;}', '/**/', 2, 1, '.r1');
			assertHighlights(ls, '/**/%r1 { r1: 1em; } r2 { r1: 2em; @extend %r1;}', '/**/', 2, 1, '%r1');
			assertHighlights(ls, '@mixin r1 { r1: $p1; } r2 { r2: 2em; @include /**/r1; }', '/**/', 2, 1, 'r1');
			assertHighlights(ls, '@mixin r1($p1) { r1: $p1; } r2 { r2: 2em; @include /**/r1(2px); }', '/**/', 2, 1, 'r1');
			assertHighlights(ls, '$p1: 1; @mixin r1($p1: $p1) { r1: $p1; } r2 { r2: 2em; @include /**/r1; }', '/**/', 2, 1, 'r1');
			assertHighlights(ls, '/**/$p1: 1; @mixin r1($p1: $p1) { r1: $p1; }', '/**/', 2, 1, '$p1');
			assertHighlights(ls, '$p1 : 1; @mixin r1($p1) { r1: /**/$p1; }', '/**/', 2, 1, '$p1');
			assertHighlights(ls, '/**/$p1 : 1; @mixin r1($p1) { r1: $p1; }', '/**/', 1, 1, '$p1');
			assertHighlights(ls, '$p1 : 1; @mixin r1(/**/$p1) { r1: $p1; }', '/**/', 2, 1, '$p1');
			assertHighlights(ls, '$p1 : 1; @function r1($p1, $p2: /**/$p1) { @return $p1 + $p1 + $p2; }', '/**/', 2, 1, '$p1');
			assertHighlights(ls, '$p1 : 1; @function r1($p1, /**/$p2: $p1) { @return $p1 + $p2 + $p2; }', '/**/', 3, 1, '$p2');
			assertHighlights(ls, '@function r1($p1, $p2) { @return $p1 + $p2; } @function r2() { @return /**/r1(1, 2); }', '/**/', 2, 1, 'r1');
			assertHighlights(ls, '@function /**/r1($p1, $p2) { @return $p1 + $p2; } @function r2() { @return r1(1, 2); } ls { x: r2(); }', '/**/', 2, 1, 'r1');
			assertHighlights(ls, '@function r1($p1, $p2) { @return $p1 + $p2; } @function r2() { @return r1(/**/$p1 : 1, $p2 : 2); } ls { x: r2(); }', '/**/', 3, 1, '$p1');

			assertHighlights(ls, '@mixin /*here*/foo { display: inline } foo { @include foo; }', '/*here*/', 2, 1, 'foo');
			assertHighlights(ls, '@mixin foo { display: inline } foo { @include /*here*/foo; }', '/*here*/', 2, 1, 'foo');
			assertHighlights(ls, '@mixin foo { display: inline } /*here*/foo { @include foo; }', '/*here*/', 1, 1, 'foo');
			assertHighlights(ls, '@function /*here*/foo($i) { @return $i*$i; } #foo { width: foo(2); }', '/*here*/', 2, 1, 'foo');
			assertHighlights(ls, '@function foo($i) { @return $i*$i; } #foo { width: /*here*/foo(2); }', '/*here*/', 2, 1, 'foo');

			assertHighlights(ls, '.text { @include mixins.responsive using ($multiplier) { font-size: /*here*/$multiplier * 10px; } }', '/*here*/$', 2, 1, '$multiplier');
		});
	});

	suite('Links', () => {

		// For invalid links that have no corresponding file on disk, return no link
		test('Invalid SCSS partial file links', async () => {
			const fixtureRoot = path.resolve(__dirname, '../../../../src/test/scss/linkFixture/non-existent');
			const getDocumentUri = (relativePath: string) => {
				return URI.file(path.resolve(fixtureRoot, relativePath)).toString();
			};

			await assertNoDynamicLinks(getDocumentUri('./index.scss'), `@import 'foo'`, getDocumentUri('foo'));

			await assertNoDynamicLinks(getDocumentUri('./index.scss'), `@import './foo'`, getDocumentUri('foo'));

			await assertNoDynamicLinks(getDocumentUri('./index.scss'), `@import './_foo'`, getDocumentUri('_foo'));

			await assertNoDynamicLinks(getDocumentUri('./index.scss'), `@import './foo-baz'`, getDocumentUri('foo-baz'));
		});

		test('SCSS partial file dynamic links', async () => {
			const fixtureRoot = path.resolve(__dirname, '../../../../src/test/scss/linkFixture');
			const getDocumentUri = (relativePath: string) => {
				return URI.file(path.resolve(fixtureRoot, relativePath)).toString();
			};

			await assertDynamicLinks(getDocumentUri('./noUnderscore/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getDocumentUri('./noUnderscore/foo.scss') }
			]);

			await assertDynamicLinks(getDocumentUri('./underscore/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getDocumentUri('./underscore/_foo.scss') }
			]);

			await assertDynamicLinks(getDocumentUri('./both/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getDocumentUri('./both/foo.scss') }
			]);

			await assertDynamicLinks(getDocumentUri('./both/index.scss'), `@import '_foo'`, [
				{ range: newRange(8, 14), target: getDocumentUri('./both/_foo.scss') }
			]);

			await assertDynamicLinks(getDocumentUri('./index/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getDocumentUri('./index/foo/index.scss') }
			]);

			await assertDynamicLinks(getDocumentUri('./index/index.scss'), `@import 'bar'`, [
				{ range: newRange(8, 13), target: getDocumentUri('./index/bar/_index.scss') }
			]);
		});

		test('SCSS straight links', async () => {
			const ls = getSCSSLS();

			await assertLinks(ls, `@import 'foo.css'`, [
				{ range: newRange(8, 17), target: 'test://test/foo.css' }
			], 'scss');

			await assertLinks(ls, `@import 'foo.scss' print;`, [
				{ range: newRange(8, 18), target: 'test://test/foo.scss' }
			]);
			await assertLinks(ls, `@import 'http://foo.com/foo.css'`, [
				{ range: newRange(8, 32), target: 'http://foo.com/foo.css' }
			], 'scss');

			await assertLinks(ls, `@import url("foo.css") print;`, [
				{ range: newRange(12, 21), target: 'test://test/foo.css' }
			]);

		});

		test('SCSS module file links', async () => {
			const fixtureRoot = path.resolve(__dirname, '../../../../src/test/scss/linkFixture/module');
			const getDocumentUri = (relativePath: string) => {
				return URI.file(path.resolve(fixtureRoot, relativePath)).toString();
			};

			await assertDynamicLinks(getDocumentUri('./index.scss'), `@use './foo' as f`, [
				{ range: newRange(5, 12), target: getDocumentUri('./foo.scss') }
			]);

			await assertDynamicLinks(getDocumentUri('./index.scss'), `@forward './foo' hide $private`, [
				{ range: newRange(9, 16), target: getDocumentUri('./foo.scss') }
			]);

			await assertNoDynamicLinks(getDocumentUri('./index.scss'), `@use 'sass:math'`, undefined);
			await assertNoDynamicLinks(getDocumentUri('./index.scss'), `@use './non-existent'`, getDocumentUri('non-existent'));
		});

		test('SCSS empty path', async () => {
			const ls = getSCSSLS();

			/**
			 * https://github.com/microsoft/vscode/issues/79215
			 * No valid path — gradient-verlay.png is authority and path is ''
			 */
			await assertLinks(ls, `#navigation { background: #3d3d3d url(gantry-media://gradient-overlay.png); }`, [
				{ range: newRange(38, 73), target: 'gantry-media://gradient-overlay.png' }
			], 'scss');

		});

		test('SCSS node module resolving', async function () {
			let ls = getSCSSLS();
			let testUri = getTestResource('about.scss');
			let workspaceFolder = getTestResource('');

			await assertLinks(ls, 'html { background-image: url("~foo/hello.html")',
				[{ range: newRange(29, 46), target: getTestResource('node_modules/foo/hello.html') }], 'scss', testUri, workspaceFolder
			);

			await assertLinks(ls, 'html { background-image: url("foo/hello.html")',
				[{ range: newRange(28, 45), target: getTestResource('node_modules/foo/hello.html') }], 'scss', testUri, workspaceFolder
			);
		});

	});

	suite('Color', () => {

		test('color symbols', () => {
			const ls = getSCSSLS();
			assertColorSymbols(ls, '$colors: (blue: $blue,indigo: $indigo)'); // issue #47209
		});
	});

});