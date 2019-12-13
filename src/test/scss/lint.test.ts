/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Rule, Rules } from '../../services/lintRules';
import { assertEntries } from '../css/lint.test';
import { SCSSParser } from '../../parser/scssParser';
import { TextDocument } from '../../cssLanguageTypes';

function assertFontFace(input: string, ...rules: Rule[]): void {
	let p = new SCSSParser();
	let document = TextDocument.create('test://test/test.scss', 'scss', 0, input);
	let node = p.internalParse(input, p._parseFontFace)!;

	assertEntries(node, document, rules);
}

function assertRuleSet(input: string, ...rules: Rule[]): void {
	let p = new SCSSParser();
	let document = TextDocument.create('test://test/test.scss', 'scss', 0, input);
	let node = p.internalParse(input, p._parseRuleset)!;
	assertEntries(node, document, rules);
}

suite('SCSS - Lint', () => {

	test('empty ruleset', function () {
		assertRuleSet('selector { color: red; nested {} }', Rules.EmptyRuleSet);
	});

	test('font-face required properties', function () {
		assertFontFace('@font-face {  }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { src: url(test.tff) }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { font-family: \'name\' }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { font-#{family}: foo }'); // no error, ignore all unknown properties
		assertFontFace('@font-face { font: {family: foo } }'); // no error, ignore all nested properties
		assertFontFace('@font-face { @if true { } }'); // no error, ignore all nested properties
	});

	test('unknown properties', function () {
		assertRuleSet('selector { -ms-property: "rest is missing" }', Rules.UnknownVendorSpecificProperty);
		assertRuleSet('selector { -moz-box-shadow: "rest is missing" }', Rules.UnknownVendorSpecificProperty, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
		assertRuleSet('selector { box-shadow: none }'); // no error
		assertRuleSet('selector { -moz-#{box}-shadow: none }'); // no error if theres an interpolation
		assertRuleSet('selector { outer: { nested : blue }'); // no error for nested
		assertRuleSet(':export { prop: "some" }'); // no error for properties inside :export
	});

	test('vendor specific prefixes', function () {
		assertRuleSet('selector { -moz-animation: none }', Rules.AllVendorPrefixes, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
		assertRuleSet('selector { -moz-transform: none; transform: none }', Rules.AllVendorPrefixes);
		assertRuleSet('selector { -moz-transform: none; transform: none; -o-transform: none; -webkit-transform: none; -ms-transform: none; }');
	});
});
