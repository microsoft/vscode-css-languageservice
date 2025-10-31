/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../../parser/cssNodes';
import { assertScopeBuilding, assertSymbolsInScope, assertScopesAndSymbols, assertHighlights, assertSymbolInfos, newRange, assertColorSymbols, assertDocumentSymbols } from '../css/navigation.test';
import { getLESSLanguageService, SymbolKind, Location } from '../../cssLanguageService';
import { colorFrom256RGB } from '../../languageFacts/facts';

suite('LESS - Symbols', () => {

	test('scope building', function () {
		let ls = getLESSLanguageService();
		assertScopeBuilding(ls, '@let: blue');
		assertScopeBuilding(ls, '.class { .nested {} }', { offset: 7, length: 14 }, { offset: 17, length: 2 });
	});

	test('symbols in scopes', function () {
		let ls = getLESSLanguageService();
		assertSymbolsInScope(ls, '@let: iable;', 0, { name: '@let', type: nodes.ReferenceType.Variable });
		assertSymbolsInScope(ls, '@let: iable;', 11, { name: '@let', type: nodes.ReferenceType.Variable });
		assertSymbolsInScope(ls, '@let: iable; .class { @color: blue; }', 11, { name: '@let', type: nodes.ReferenceType.Variable }, { name: '.class', type: nodes.ReferenceType.Rule });
		assertSymbolsInScope(ls, '@let: iable; .class { @color: blue; }', 21, { name: '@color', type: nodes.ReferenceType.Variable });
		assertSymbolsInScope(ls, '@let: iable; .class { @color: blue; }', 36, { name: '@color', type: nodes.ReferenceType.Variable });

		assertSymbolsInScope(ls, '@namespace "x"; .mixin() {}', 0, { name: '.mixin', type: nodes.ReferenceType.Mixin });
		assertSymbolsInScope(ls, '.mixin() { .nested() {} }', 10, { name: '.nested', type: nodes.ReferenceType.Mixin });
		assertSymbolsInScope(ls, '.mixin() { .nested() {} }', 11);

		assertSymbolsInScope(ls, '@keyframes animation {};', 0, { name: 'animation', type: nodes.ReferenceType.Keyframe });
		assertSymbolsInScope(ls, '.a(@gutter: @gutter-width) { &:extend(.b); }', 1);
	});

	test('scopes and symbols', function () {
		let ls = getLESSLanguageService();
		assertScopesAndSymbols(ls, '@var1: 1; @var2: 2; .foo { @var3: 3; }', '@var1,@var2,.foo,[@var3]');
		assertScopesAndSymbols(ls, '.mixin1 { @var0: 1} .mixin2(@var1) { @var3: 3 }', '.mixin1,.mixin2,[@var0],[@var1,@var3]');
		assertScopesAndSymbols(ls, 'a b { @var0: 1; c { d { } } }', '[@var0,c,[d,[]]]');
	});

	test('mark highlights', function () {
		let ls = getLESSLanguageService();
		assertHighlights(ls, '@var1: 1; @var2: /**/@var1;', '/**/', 2, 1, '@var1');
		assertHighlights(ls, '@var1: 1; ls { @var2: /**/@var1; }', '/**/', 2, 1, '@var1');
		assertHighlights(ls, 'r1 { @var1: 1; p1: @var1;} r2,r3 { @var1: 1; p1: /**/@var1 + @var1;}', '/**/', 3, 1, '@var1');
		assertHighlights(ls, '.r1 { r1: 1em; } r2 { r1: 2em; /**/.r1;}', '/**/', 2, 1, '.r1');
		assertHighlights(ls, '.r1(@p1) { r1: @p1; } r2 { r1: 2em; /**/.r1(2px); }', '/**/', 2, 1, '.r1');
		assertHighlights(ls, '/**/.r1(@p1) { r1: @p1; } r2 { r1: 2em; .r1(2px); }', '/**/', 2, 1, '.r1');
		assertHighlights(ls, '@p1 : 1; .r1(@p1) { r1: /**/@p1; }', '/**/', 2, 1, '@p1');
		assertHighlights(ls, '/**/@p1 : 1; .r1(@p1) { r1: @p1; }', '/**/', 1, 1, '@p1');
		assertHighlights(ls, '@p1 : 1; .r1(/**/@p1) { r1: @p1; }', '/**/', 2, 1, '@p1');
	});

	test('basic symbols', () => {
		let ls = getLESSLanguageService();
		assertSymbolInfos(ls, '.a(@gutter: @gutter-width) { &:extend(.b); }', [
			{ name: '.a', kind: SymbolKind.Method, location: Location.create('test://test/test.css', newRange(0, 44)) }
		]);
		assertDocumentSymbols(ls, '.a(@gutter: @gutter-width) { &:extend(.b); }', [
			{ name: '.a', kind: SymbolKind.Method, range: newRange(0, 44), selectionRange: newRange(0, 2) }
		]);

		assertSymbolInfos(ls, '.mixin() { .nested() {} }', [
			{ name: '.mixin', kind: SymbolKind.Method, location: Location.create('test://test/test.css', newRange(0, 25)) },
			{ name: '.nested', kind: SymbolKind.Method, location: Location.create('test://test/test.css', newRange(11, 23)) }
		]);

		assertDocumentSymbols(ls, '.mixin() { .nested() {} }', [
			{
				name: '.mixin', kind: SymbolKind.Method, range: newRange(0, 25), selectionRange: newRange(0, 6),
				children: [
					{ name: '.nested', kind: SymbolKind.Method, range: newRange(11, 23), selectionRange: newRange(11, 18) }
				]
			}
		]);
	});

});

suite('Color', () => {

	test('color symbols', function () {
		let ls = getLESSLanguageService();
		assertColorSymbols(ls, '@foo: #ff9977;',
			{ color: colorFrom256RGB(0xff, 0x99, 0x77), range: newRange(6, 13) }
		);
		assertColorSymbols(ls, 'body { @foo: hsl(0, 0%, 100%); }',
			{ color: colorFrom256RGB(255, 255, 255), range: newRange(13, 29) }
		);
		assertColorSymbols(ls, 'body { @foo: hsl(0, 1%, 100%); }',
			{ color: colorFrom256RGB(255, 255, 255), range: newRange(13, 29) }
		);
	});
});