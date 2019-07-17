/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SCSSParser } from '../../parser/scssParser';
import * as nodes from '../../parser/cssNodes';
import { assertSymbolsInScope, assertScopesAndSymbols, assertHighlights, assertColorSymbols, assertLinks, newRange, getDocumentContext } from '../css/navigation.test';
import { getSCSSLanguageService, DocumentLink, TextDocument } from '../../cssLanguageService';
import * as assert from 'assert';
import { FileSystemProvider, FileType } from '../../cssLanguageTypes';
import { stat as fsStat } from 'fs';
import { SCSSNavigation } from '../../services/scssNavigation';
import * as path from 'path';
import { URI } from 'vscode-uri';
import { platform } from 'os';

async function assertDynamicLinks(docUri: string, input: string, expected: DocumentLink[]) {
	const p = new SCSSParser();
	const document = TextDocument.create(docUri, 'scss', 0, input);

	const stylesheet = p.parseStylesheet(document);

	const links = await new SCSSNavigation(getFsProvider()).findDocumentLinks2(
		document,
		stylesheet,
		getDocumentContext(document.uri)
	);
	assert.deepEqual(links, expected);
}

function getFsProvider(): FileSystemProvider {
	return {
		stat(documentUri: string) {
			const filePath = URI.parse(documentUri).fsPath;

			return new Promise((c, e) => {
				fsStat(filePath, (err, stats) => {
					if (err) {
						if (err.code === 'ENOENT') {
							return c({
								type: FileType.Unknown,
								ctime: -1,
								mtime: -1,
								size: -1
							});
						} else {
							return e(err);
						}
					}
	
					let type = FileType.Unknown;
					if (stats.isFile()) {
						type = FileType.File;
					} else if (stats.isDirectory) {
						type = FileType.Directory;
					} else if (stats.isSymbolicLink) {
						type = FileType.SymbolicLink;
					}
	
					c({
						type,
						ctime: stats.ctime.getTime(),
						mtime: stats.mtime.getTime(),
						size: stats.size
					});
				});
			});
		}
	};
}

suite('SCSS - Navigation', () => {

	suite('Scopes and Symbols', () => {

		test('symbols in scopes', () => {
			const p = new SCSSParser();
			assertSymbolsInScope(p, '$var: iable;', 0, { name: '$var', type: nodes.ReferenceType.Variable });
			assertSymbolsInScope(p, '$var: iable;', 11, { name: '$var', type: nodes.ReferenceType.Variable });
			assertSymbolsInScope(p, '$var: iable; .class { $color: blue; }', 11, { name: '$var', type: nodes.ReferenceType.Variable }, { name: '.class', type: nodes.ReferenceType.Rule });
			assertSymbolsInScope(p, '$var: iable; .class { $color: blue; }', 22, { name: '$color', type: nodes.ReferenceType.Variable });
			assertSymbolsInScope(p, '$var: iable; .class { $color: blue; }', 36, { name: '$color', type: nodes.ReferenceType.Variable });

			assertSymbolsInScope(p, '@namespace "x"; @mixin mix() {}', 0, { name: 'mix', type: nodes.ReferenceType.Mixin });
			assertSymbolsInScope(p, '@mixin mix { @mixin nested() {} }', 12, { name: 'nested', type: nodes.ReferenceType.Mixin });
			assertSymbolsInScope(p, '@mixin mix () { @mixin nested() {} }', 13);
		});

		test('scopes and symbols', () => {
			const p = new SCSSParser();
			assertScopesAndSymbols(p, '$var1: 1; $var2: 2; .foo { $var3: 3; }', '$var1,$var2,.foo,[$var3]');
			assertScopesAndSymbols(p, '@mixin mixin1 { $var0: 1} @mixin mixin2($var1) { $var3: 3 }', 'mixin1,mixin2,[$var0],[$var1,$var3]');
			assertScopesAndSymbols(p, 'a b { $var0: 1; c { d { } } }', '[$var0,c,[d,[]]]');
			assertScopesAndSymbols(p, '@function a($p1: 1, $p2: 2) { $v1: 3; @return $v1; }', 'a,[$p1,$p2,$v1]');
			assertScopesAndSymbols(p, '$var1: 3; @if $var1 == 2 { $var2: 1; } @else { $var2: 2; $var3: 2;} ', '$var1,[$var2],[$var2,$var3]');
			assertScopesAndSymbols(p, '@if $var1 == 2 { $var2: 1; } @else if $var1 == 2 { $var3: 2; } @else { $var3: 2; } ', '[$var2],[$var3],[$var3]');
			assertScopesAndSymbols(p, '$var1: 3; @while $var1 < 2 { #rule { a: b; } }', '$var1,[#rule,[]]');
			assertScopesAndSymbols(p, '$i:0; @each $name in f1, f2, f3  { $i:$i+1; }', '$i,[$name,$i]');
			assertScopesAndSymbols(p, '$i:0; @for $x from $i to 5  { }', '$i,[$x]');
			assertScopesAndSymbols(p, '@each $i, $j, $k in f1, f2, f3  { }', '[$i,$j,$k]');
		});
	});

	suite('Highlight', () => {

		test('mark highlights', () => {
			const p = new SCSSParser();

			assertHighlights(p, '$var1: 1; $var2: /**/$var1;', '$var1', 2, 1);
			assertHighlights(p, '$var1: 1; p { $var2: /**/$var1; }', '/**/', 2, 1, '$var1');
			assertHighlights(p, 'r1 { $var1: 1; p1: $var1;} r2,r3 { $var1: 1; p1: /**/$var1 + $var1;}', '/**/', 3, 1, '$var1');
			assertHighlights(p, '.r1 { r1: 1em; } r2 { r1: 2em; @extend /**/.r1;}', '/**/', 2, 1, '.r1');
			assertHighlights(p, '/**/%r1 { r1: 1em; } r2 { r1: 2em; @extend %r1;}', '/**/', 2, 1, '%r1');
			assertHighlights(p, '@mixin r1 { r1: $p1; } r2 { r2: 2em; @include /**/r1; }', '/**/', 2, 1, 'r1');
			assertHighlights(p, '@mixin r1($p1) { r1: $p1; } r2 { r2: 2em; @include /**/r1(2px); }', '/**/', 2, 1, 'r1');
			assertHighlights(p, '$p1: 1; @mixin r1($p1: $p1) { r1: $p1; } r2 { r2: 2em; @include /**/r1; }', '/**/', 2, 1, 'r1');
			assertHighlights(p, '/**/$p1: 1; @mixin r1($p1: $p1) { r1: $p1; }', '/**/', 2, 1, '$p1');
			assertHighlights(p, '$p1 : 1; @mixin r1($p1) { r1: /**/$p1; }', '/**/', 2, 1, '$p1');
			assertHighlights(p, '/**/$p1 : 1; @mixin r1($p1) { r1: $p1; }', '/**/', 1, 1, '$p1');
			assertHighlights(p, '$p1 : 1; @mixin r1(/**/$p1) { r1: $p1; }', '/**/', 2, 1, '$p1');
			assertHighlights(p, '$p1 : 1; @function r1($p1, $p2: /**/$p1) { @return $p1 + $p1 + $p2; }', '/**/', 2, 1, '$p1');
			assertHighlights(p, '$p1 : 1; @function r1($p1, /**/$p2: $p1) { @return $p1 + $p2 + $p2; }', '/**/', 3, 1, '$p2');
			assertHighlights(p, '@function r1($p1, $p2) { @return $p1 + $p2; } @function r2() { @return /**/r1(1, 2); }', '/**/', 2, 1, 'r1');
			assertHighlights(p, '@function /**/r1($p1, $p2) { @return $p1 + $p2; } @function r2() { @return r1(1, 2); } p { x: r2(); }', '/**/', 2, 1, 'r1');
			assertHighlights(p, '@function r1($p1, $p2) { @return $p1 + $p2; } @function r2() { @return r1(/**/$p1 : 1, $p2 : 2); } p { x: r2(); }', '/**/', 3, 1, '$p1');

			assertHighlights(p, '@mixin /*here*/foo { display: inline } foo { @include foo; }', '/*here*/', 2, 1, 'foo');
			assertHighlights(p, '@mixin foo { display: inline } foo { @include /*here*/foo; }', '/*here*/', 2, 1, 'foo');
			assertHighlights(p, '@mixin foo { display: inline } /*here*/foo { @include foo; }', '/*here*/', 1, 1, 'foo');
			assertHighlights(p, '@function /*here*/foo($i) { @return $i*$i; } #foo { width: foo(2); }', '/*here*/', 2, 1, 'foo');
			assertHighlights(p, '@function foo($i) { @return $i*$i; } #foo { width: /*here*/foo(2); }', '/*here*/', 2, 1, 'foo');
		});
	});

	suite('Links', () => {

		test('SCSS partial file links', () => {
			const p = new SCSSParser();

			assertLinks(p, `@import 'foo'`, [
				{ range: newRange(8, 13), target: 'test://test/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import './foo'`, [
				{ range: newRange(8, 15), target: 'test://test/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import './_foo'`, [
				{ range: newRange(8, 16), target: 'test://test/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import './foo-baz'`, [
				{ range: newRange(8, 19), target: 'test://test/_foo-baz.scss' }
			], 'scss');

			assertLinks(p, `@import './foo-baz.quz'`, [
				{ range: newRange(8, 23), target: 'test://test/_foo-baz.quz.scss' }
			], 'scss');

			assertLinks(p, `@import './bar/foo'`, [
				{ range: newRange(8, 19), target: 'test://test/bar/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import './bar/_foo'`, [
				{ range: newRange(8, 20), target: 'test://test/bar/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import './bar/foo-baz.quz'`, [
				{ range: newRange(8, 27), target: 'test://test/bar/_foo-baz.quz.scss' }
			], 'scss');

			assertLinks(p, `@import 'foo.scss'`, [
				{ range: newRange(8, 18), target: 'test://test/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import 'foo-baz.scss'`, [
				{ range: newRange(8, 22), target: 'test://test/_foo-baz.scss' }
			], 'scss');

			assertLinks(p, `@import './foo-baz.quz.scss'`, [
				{ range: newRange(8, 28), target: 'test://test/_foo-baz.quz.scss' }
			], 'scss');

			assertLinks(p, `@import './bar/foo.scss'`, [
				{ range: newRange(8, 24), target: 'test://test/bar/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import './bar/_foo.scss'`, [
				{ range: newRange(8, 25), target: 'test://test/bar/_foo.scss' }
			], 'scss');

			assertLinks(p, `@import './bar/foo-baz.quz.scss'`, [
				{ range: newRange(8, 32), target: 'test://test/bar/_foo-baz.quz.scss' }
			], 'scss');

			assertLinks(p, `@import './bar/_foo-baz.quz.scss'`, [
				{ range: newRange(8, 33), target: 'test://test/bar/_foo-baz.quz.scss' }
			], 'scss');
		});

		test('SCSS partial file dynamic links', async () => {
			const fixtureRoot = path.resolve(__dirname, '../../../../src/test/scss/linkFixture');
			const getPath = (relativePath) => {
				return URI.file(path.resolve(fixtureRoot, relativePath)).toString();
			};

			await assertDynamicLinks(path.resolve(fixtureRoot, './noUnderscore/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getPath('./noUnderscore/foo.scss') }
			]);

			await assertDynamicLinks(path.resolve(fixtureRoot, './underscore/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getPath('./underscore/_foo.scss') }
			]);

			await assertDynamicLinks(path.resolve(fixtureRoot, './both/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getPath('./both/foo.scss') }
			]);

			await assertDynamicLinks(path.resolve(fixtureRoot, './both/index.scss'), `@import '_foo'`, [
				{ range: newRange(8, 14), target: getPath('./both/_foo.scss') }
			]);

			await assertDynamicLinks(path.resolve(fixtureRoot, './index/index.scss'), `@import 'foo'`, [
				{ range: newRange(8, 13), target: getPath('./index/foo/index.scss') }
			]);

			await assertDynamicLinks(path.resolve(fixtureRoot, './index/index.scss'), `@import 'bar'`, [
				{ range: newRange(8, 13), target: getPath('./index/bar/_index.scss') }
			]);
		});

		test('SCSS straight links', () => {
			const p = new SCSSParser();

			assertLinks(p, `@import 'foo.css'`, [
				{ range: newRange(8, 17), target: 'test://test/foo.css' }
			], 'scss');

			assertLinks(p, `@import 'foo' print;`, [
				{ range: newRange(8, 13), target: 'test://test/foo' }
			]);

			assertLinks(p, `@import 'http://foo.com/foo.css'`, [
				{ range: newRange(8, 32), target: 'http://foo.com/foo.css' }
			], 'scss');

			assertLinks(p, `@import url("foo.css") print;`, [
				{ range: newRange(12, 21), target: 'test://test/foo.css' }
			]);

		});
	});

	suite('Color', () => {

		test('color symbols', () => {
			const ls = getSCSSLanguageService();
			assertColorSymbols(ls, '$colors: (blue: $blue,indigo: $indigo)'); // issue #47209
		});	
	});

});