/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import {SCSSParser} from '../../parser/scssParser';
import {parseSelector, parseSelectorToMarkedString} from '../css/selectorPrinting.test';

suite('SCSS - Selector Printing', () => {

	test('nested selector', function () {
		let p = new SCSSParser();
		parseSelector(p, 'o1 { e1 { } }', 'e1', '{o1{…{e1}}}');
		parseSelector(p, 'o1 { e1.div { } }', 'e1', '{o1{…{e1[class=div]}}}');
		parseSelector(p, 'o1 o2 { e1 { } }', 'e1', '{o1{…{o2{…{e1}}}}}');
		parseSelector(p, 'o1, o2 { e1 { } }', 'e1', '{o1{…{e1}}}');
		parseSelector(p, 'o1 { @if $a { e1 { } } }', 'e1', '{o1{…{e1}}}');
		parseSelector(p, 'o1 { @mixin a { e1 { } } }', 'e1', '{e1}');
		parseSelector(p, 'o1 { @mixin a { e1 { } } }', 'e1', '{e1}');
	});

	test('referencing selector', function () {
		let p = new SCSSParser();
		parseSelector(p, 'o1 { &:hover { }}', '&', '{o1[:hover=]}');
		parseSelector(p, 'o1 { &:hover & { }}', '&', '{o1[:hover=]{…{o1}}}');
		parseSelector(p, 'o1 { &__bar {}}', '&', '{o1__bar}');
		parseSelector(p, '.c1 { &__bar {}}', '&', '{[class=c1__bar]}');
		parseSelector(p, 'o.c1 { &__bar {}}', '&', '{o[class=c1__bar]}');
	});

	test('placeholders', function () {
		let p = new SCSSParser();
		parseSelector(p, '%o1 { e1 { } }', 'e1', '{%o1{…{e1}}}');
	});
});

suite('CSS - MarkedStringPrinter selectors', () => {
	test('referencing selector', function() {
		let p = new SCSSParser();
		parseSelectorToMarkedString(p, 'o1 { &.c1 { e1 { }}}', 'e1', [
			{ language: 'html', value: '<o1 class="c1">\n  …\n    <e1>' },
			'[Selector Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity): (0, 1, 2)'
		]);
	});
});
