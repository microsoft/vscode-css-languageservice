/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SCSSParser } from '../../parser/scssParser';
import { assertSelector } from '../css/selectorPrinting.test';

suite('SCSS - Selector Printing', () => {

	test('nested selector', function () {
		let p = new SCSSParser();
		assertSelector(p, 'o1 { e1 { } }', 'e1', '{o1{…{e1}}}');
		assertSelector(p, 'o1 { e1.div { } }', 'e1', '{o1{…{e1[class=div]}}}');
		assertSelector(p, 'o1 o2 { e1 { } }', 'e1', '{o1{…{o2{…{e1}}}}}');
		assertSelector(p, 'o1, o2 { e1 { } }', 'e1', '{o1{…{e1}}}');
		assertSelector(p, 'o1 { @if $a { e1 { } } }', 'e1', '{o1{…{e1}}}');
		assertSelector(p, 'o1 { @mixin a { e1 { } } }', 'e1', '{e1}');
		assertSelector(p, 'o1 { @mixin a { e1 { } } }', 'e1', '{e1}');
	});

	test('referencing selector', function () {
		let p = new SCSSParser();
		assertSelector(p, 'o1 { &:hover { }}', '&', '{o1[:hover=]}');
		assertSelector(p, 'o1 { &:hover & { }}', '&', '{o1[:hover=]{…{o1}}}');
		assertSelector(p, 'o1 { &__bar {}}', '&', '{o1__bar}');
		assertSelector(p, '.c1 { &__bar {}}', '&', '{[class=c1__bar]}');
		assertSelector(p, 'o.c1 { &__bar {}}', '&', '{o[class=c1__bar]}');
	});

	test('placeholders', function () {
		let p = new SCSSParser();
		assertSelector(p, '%o1 { e1 { } }', 'e1', '{%o1{…{e1}}}');
	});
});