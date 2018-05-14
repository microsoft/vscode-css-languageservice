/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { Node, IRule, Level } from '../../parser/cssNodes';
import { Parser } from '../../parser/cssParser';
import { LintVisitor } from '../../services/lint';
import { Rule, Rules, LintConfigurationSettings } from '../../services/lintRules';
import { TextDocument } from 'vscode-languageserver-types';
import { SCSSParser } from '../../parser/scssParser';
import { LESSParser } from '../../parser/lessParser';

export function assertEntries(node: Node, document: TextDocument, rules: IRule[]): void {

	let entries = LintVisitor.entries(node, document, new LintConfigurationSettings(), Level.Error | Level.Warning | Level.Ignore);
	assert.equal(entries.length, rules.length, entries.map(e => e.getRule().id).join(', '));

	for (let entry of entries) {
		assert.ok(rules.indexOf(entry.getRule()) !== -1, `${entry.getRule().id} found but not expected (${rules.map(r => r.id).join(', ')})`);
	}
}
let parsers = [new Parser(), new LESSParser(), new SCSSParser()];

function assertStyleSheet(input: string, ...rules: Rule[]): void {
	for (let p of parsers) {
		let document = TextDocument.create('test://test/test.css', 'css', 0, input);
		let node = p.parseStylesheet(document);

		assertEntries(node, document, rules);
	}
}

function assertRuleSet(input: string, ...rules: Rule[]): void {
	for (let p of parsers) {
		let document = TextDocument.create('test://test/test.css', 'css', 0, input);
		let node = p.internalParse(input, p._parseRuleset);
		assertEntries(node, document, rules);
	}
}


function assertFontFace(input: string, ...rules: Rule[]): void {
	for (let p of parsers) {
		let document = TextDocument.create('test://test/test.css', 'css', 0, input);
		let node = p.internalParse(input, p._parseFontFace);
		assertEntries(node, document, rules);
	}
}

suite('CSS - Lint', () => {

	test('universal selector, empty rule', function () {
		assertRuleSet('* { color: perty }', Rules.UniversalSelector);
		assertRuleSet('*, div { color: perty }', Rules.UniversalSelector);
		assertRuleSet('div, * { color: perty }', Rules.UniversalSelector);
		assertRuleSet('div > * { color: perty }', Rules.UniversalSelector);
		assertRuleSet('div + * { color: perty }', Rules.UniversalSelector);
	});

	test('empty ruleset', function () {
		assertRuleSet('selector {}', Rules.EmptyRuleSet);
	});

	test('properies ignored due to inline ', function () {
		assertRuleSet('selector { display: inline; height: 100px; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; width: 100px; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; margin-top: 1em; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; margin-bottom: 1em; }', Rules.PropertyIgnoredDueToDisplay);
		assertRuleSet('selector { display: inline; float: right; }', Rules.PropertyIgnoredDueToDisplay, Rules.AvoidFloat);
		assertRuleSet('selector { display: inline; float: none; }', Rules.AvoidFloat);
		assertRuleSet('selector { display: inline-block; float: right; }', Rules.PropertyIgnoredDueToDisplay, Rules.AvoidFloat);
		assertRuleSet('selector { display: inline-block; float: none; }', Rules.AvoidFloat);
		assertRuleSet('selector { display: block; vertical-align: center; }', Rules.PropertyIgnoredDueToDisplay);
	});

	test('avoid !important', function () {
		assertRuleSet('selector { display: inline !important; }', Rules.AvoidImportant);
	});

	test('avoid float', function () {
		assertRuleSet('selector { float: right; }', Rules.AvoidFloat);
	});

	test('avoid id selectors', function () {
		assertRuleSet('#selector {  display: inline; }', Rules.AvoidIdSelector);
	});

	test('zero with unit', function () {
		assertRuleSet('selector { width: 0px }', Rules.ZeroWithUnit);
		assertRuleSet('selector { width: 0Px }', Rules.ZeroWithUnit);
		assertRuleSet('selector { line-height: 0EM }', Rules.ZeroWithUnit);
		assertRuleSet('selector { line-height: 0pc }', Rules.ZeroWithUnit);
		assertRuleSet('selector { min-height: 0% }');
	});

	test('duplicate declarations', function () {
		assertRuleSet('selector { color: perty; color: perty }', Rules.DuplicateDeclarations, Rules.DuplicateDeclarations);
		assertRuleSet('selector { color: -o-perty; color: perty }');
	});

	test('unknown properties', function () {
		assertRuleSet('selector { -ms-property: "rest is missing" }', Rules.UnknownVendorSpecificProperty);
		assertRuleSet('selector { -moz-box-shadow: "rest is missing" }', Rules.UnknownVendorSpecificProperty, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
		assertRuleSet('selector { box-shadow: none }'); // no error
		assertRuleSet('selector { box-property: "rest is missing" }', Rules.UnknownProperty);
	});

	test('box model', function () {
		assertRuleSet('.mybox { border: 1px solid black; width: 100px; }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { height: 100px; padding: 10px; }', Rules.BewareOfBoxModelSize, Rules.BewareOfBoxModelSize);
		assertRuleSet('.mybox { box-sizing: border-box; border: 1px solid black; width: 100px; }'); // no error
		assertRuleSet('.mybox { border-top: 1px solid black; width: 100px; }'); // no error
		assertRuleSet('.mybox { border-top: none; height: 100px; }'); // no error		
	});

	test('IE hacks', function () {
		assertRuleSet('selector { display: inline-block; *display: inline; }', Rules.IEStarHack);
		assertRuleSet('selector { background: #00f; /* all browsers including Mac IE */ *background: #f00; /* IE 7 and below */ _background: #f60; /* IE 6 and below */  }', Rules.IEStarHack, Rules.IEStarHack);
	});

	test('vendor specific prefixes', function () {
		assertRuleSet('selector { -moz-animation: none }', Rules.AllVendorPrefixes, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
		assertRuleSet('selector { -moz-transform: none; transform: none }', Rules.AllVendorPrefixes);
		assertRuleSet('selector { transform: none; }');
		assertRuleSet('selector { -moz-transform: none; transform: none; -o-transform: none; -webkit-transform: none; -ms-transform: none; }');
		assertRuleSet('selector { --transform: none; }');
		assertRuleSet('selector { -webkit-appearance: none }');
	});

	test('font-face required properties', function () {
		assertFontFace('@font-face {  }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { src: url(test.tff) }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { font-family: \'name\' }', Rules.RequiredPropertiesForFontFace);
		assertFontFace('@font-face { src: url(test.tff); font-family: \'name\' }'); // no error
	});

	test('keyframes', function () {
		assertStyleSheet('@keyframes foo { }');
		assertStyleSheet('@keyframes foo { } @-moz-keyframes foo { }', Rules.AllVendorPrefixes);
		assertStyleSheet('@-moz-keyframes foo { }', Rules.AllVendorPrefixes, Rules.IncludeStandardPropertyWhenUsingVendorPrefix);
	});
});
