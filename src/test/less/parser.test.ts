/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { ParseError } from '../../parser/cssErrors';
import { LESSParser } from '../../parser/lessParser';

import { assertNode, assertNoNode, assertError } from '../css/parser.test';

suite('LESS - Parser', () => {

	test('Variable', function () {
		let parser = new LESSParser();
		assertNode('@color', parser, parser._parseVariable.bind(parser));
		assertNode('$color', parser, parser._parseVariable.bind(parser));
		assertNode('$$color', parser, parser._parseVariable.bind(parser));
		assertNode('@$color', parser, parser._parseVariable.bind(parser));
		assertNode('$@color', parser, parser._parseVariable.bind(parser));
		assertNode('@co42lor', parser, parser._parseVariable.bind(parser));
		assertNode('@-co42lor', parser, parser._parseVariable.bind(parser));
		assertNode('@@foo', parser, parser._parseVariable.bind(parser));
		assertNode('@@@foo', parser, parser._parseVariable.bind(parser));
		assertNode('@12ooo', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[]', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[bar]', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[@bar]', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[$bar]', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[@@bar]', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[100]', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[1prop]', parser, parser._parseVariable.bind(parser));
		assertNode('@foo[--prop]', parser, parser._parseVariable.bind(parser));
		assertNoNode('@ @foo', parser, parser._parseFunction.bind(parser));
		assertNoNode('@-@foo', parser, parser._parseFunction.bind(parser));
	});

	test('Media', function () {
		let parser = new LESSParser();
		assertNode('@media @phone {}', parser, parser._parseMedia.bind(parser));
		assertNode('@media(max-width: 767px) { .mixinRef() }', parser, parser._parseMedia.bind(parser));
		assertNode('@media(max-width: 767px) { .mixinDec() {} }', parser, parser._parseMedia.bind(parser));
		assertNode('.something { @media (max-width: 760px) { > div { display: block; } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media (@var) {}', parser, parser._parseMedia.bind(parser));
		assertNode('@media (@sizes[@large]) {}', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (@var) {}', parser, parser._parseMedia.bind(parser));
		assertNode('@media (max-width: 760px) { + div { display: block; } }', parser, parser._parseStylesheet.bind(parser));
	});

	test('VariableDeclaration', function () {
		let parser = new LESSParser();
		assertNode('@color: #F5F5F5', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@color: 0', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@color: 255', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@color: 25.5', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@color: 25px', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@color: 25.5px', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@primary-font: "wf_SegoeUI","Segoe UI","Segoe","Segoe WP"', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@greeting: `"hello".toUpperCase() + "!";`', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@greeting: { display: none; }', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@b: @a !important', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@rules: .mixin()', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@rules: .mixin()[]', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@rules: .mixin(@value)[@lookup][prop]', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@rules: .mixin[@lookup][prop]', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('@expr: .mixin(@value)[] .mixin(@value2)[]', parser, parser._parseVariableDeclaration.bind(parser));
	});

	test('MixinDeclaration', function () {
		let parser = new LESSParser();
		assertNode('.color (@color: 25.5px) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.color(@color: 25.5px) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.color(@color) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.color(@color; @border) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.color() { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.color( ) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.mixin (@a) when (@a > 10), (@a < -10) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.mixin (@a) when (isnumber(@a)) and (@a > 0) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.mixin (@b) when not (@rules[@b] >= 0) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.mixin (@b) when not (@b > 0) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.mixin (@a, @rest...) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.mixin (@a) when (lightness(@a) >= 50%) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.class(@color-list, @i: 1) when (@i <= @list-length) and (@list-length > 1) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('#color() { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('#truth (@a) when (@a = true) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.color (@color; @padding: 2;) { }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertNode('.font-face(@source, @target) { @font-face { font-family: @source; src: local(\'@{target}\');} }', parser, parser._tryParseMixinDeclaration.bind(parser));
		assertError('.color (@color; @padding: 2;;) { }', parser, parser._tryParseMixinDeclaration.bind(parser), ParseError.IdentifierExpected);
		assertNode('.mixin-definition(@a: {}; @b: {default: works;};) { @a(); @b(); }', parser, parser._tryParseMixinDeclaration.bind(parser));
	});

	test('MixinReference', function () {
		let parser = new LESSParser();
		assertNode('.box-shadow(0 0 5px, 30%)', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('.box-shadow', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('.mixin(10) !important', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('.mixin(@a: 2, @b: 1)', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('#mixin(@a: 2, @b: 1)', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('#bundle > .button', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('#bundle.button', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('#bundle #inner #button(1)', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('.mixin(#008000;)', parser, parser._tryParseMixinReference.bind(parser));
		assertNode('.mixin ()', parser, parser._tryParseMixinReference.bind(parser));
		assertError('.mixin(#008000;;)', parser, parser._tryParseMixinReference.bind(parser), ParseError.ExpressionExpected);
	});

	test('DetachedRuleSet', function () {
		let parser = new LESSParser();
		assertNode('.foo {  @greeting(); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.media-switch(@styles) { @media(orientation:landscape){ @styles(); @foo: 9; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.media-switch({ flex-direction: row; });', parser, parser._parseStylesheet.bind(parser));
		assertNode('.keyframes(@name; @arguments) { @-moz-keyframes @name { @arguments(); } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.keyframes(fade-in;{ 0%, 100% { opacity: 1; }});', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo({ .bar { color: red; }})', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo({ .bar { .baz { color: red; }}})', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo(10px; { .bar { .baz { color: red; }}})', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo(fade-in; { .bar { .baz { color: red; }}})', parser, parser._parseStylesheet.bind(parser));
		assertNode('.mixin1({a:b; .mixin2({c: d})})', parser, parser._parseStylesheet.bind(parser));

	});

	test('MixinParameter', function () {
		let parser = new LESSParser();
		assertNode('@_', parser, parser._parseMixinParameter.bind(parser));
		assertNode('@let: value', parser, parser._parseMixinParameter.bind(parser));
		assertNode('@let', parser, parser._parseMixinParameter.bind(parser));
		assertNode('@rest...', parser, parser._parseMixinParameter.bind(parser));
		assertNode('...', parser, parser._parseMixinParameter.bind(parser));
		assertNode('value', parser, parser._parseMixinParameter.bind(parser));
		assertNode('"string"', parser, parser._parseMixinParameter.bind(parser));
		assertNode('50%', parser, parser._parseMixinParameter.bind(parser));
	});

	test('Function', function () {
		let parser = new LESSParser();
		assertNode('%()', parser, parser._parseFunction.bind(parser));
		assertNoNode('% ()', parser, parser._parseFunction.bind(parser));

		assertNode('func(a, b; bar)', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('func({a: b();}, bar)', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('func(.(@val) {})', parser, parser._parseRuleSetDeclaration.bind(parser));

		assertNode('each(@list, .(@v) { prop: @v });', parser, parser._parseStylesheet.bind(parser));
		assertNode('each(@list, #(@v) { prop: @v });', parser, parser._parseStylesheet.bind(parser));
	});

	test('Expr', function () {
		let parser = new LESSParser();
		assertNode('(@let + 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(@let - 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(@let * 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(@let / 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 - @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 * @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 / @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 / 20 + @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + 20 + @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + 20 + 20 + @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + @let + 20 + 20 + @let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(@var1 + @var2)', parser, parser._parseExpr.bind(parser));
		assertNode('((@let + 5) * 2)', parser, parser._parseExpr.bind(parser));
		assertNode('((@let + (5 + 2)) * 2)', parser, parser._parseExpr.bind(parser));
		assertNode('(@let + ((5 + 2) * 2))', parser, parser._parseExpr.bind(parser));
		assertNode('@color', parser, parser._parseExpr.bind(parser));
		assertNode('@color, @color', parser, parser._parseExpr.bind(parser));
		assertNode('@color, 42%', parser, parser._parseExpr.bind(parser));
		assertNode('@color, 42%, @color', parser, parser._parseExpr.bind(parser));
		assertNode('@color - (@color + 10%)', parser, parser._parseExpr.bind(parser));
		assertNode('(@base + @filler)', parser, parser._parseExpr.bind(parser));
		assertNode('(100% / 2 + @filler)', parser, parser._parseExpr.bind(parser));
		assertNode('100% / 2 + @filler', parser, parser._parseExpr.bind(parser));
	});

	test('LessOperator', function () {
		let parser = new LESSParser();
		assertNode('>=', parser, parser._parseOperator.bind(parser));
		assertNode('>', parser, parser._parseOperator.bind(parser));
		assertNode('<', parser, parser._parseOperator.bind(parser));
		assertNode('=<', parser, parser._parseOperator.bind(parser));
	});

	test('Extend', function () {
		let parser = new LESSParser();
		assertNode('nav { &:extend(.inline); }', parser, parser._parseRuleset.bind(parser));
		assertNode('nav { &:extend(.test all); }', parser, parser._parseRuleset.bind(parser));
		assertNode('.big-bucket:extend(.bucket all) { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.some-class:extend(tr .bucket) {}', parser, parser._parseRuleset.bind(parser));
		assertNode('.c:extend(.a, .b) {}', parser, parser._parseRuleset.bind(parser));
		assertNode('.d { &:extend(.a, .b); }', parser, parser._parseRuleset.bind(parser));
	});

	test('Declaration', function () {
		let parser = new LESSParser();
		assertNode('border: thin solid 1px', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: @color', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: blue', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: (20 / @let)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: (20 / 20 + @let)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: func(@red)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: desaturate(@red, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: desaturate(16, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('100: 100', parser, parser._parseDeclaration.bind(parser));
		assertNode('1prop: 100', parser, parser._parseDeclaration.bind(parser));
		assertNode('1@{var}prop: 100', parser, parser._parseDeclaration.bind(parser));
		assertNode('--100: 100', parser, parser._parseDeclaration.bind(parser));
		assertNode('--1prop: 100', parser, parser._parseDeclaration.bind(parser));

		assertNode('color: @base-color + #111', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: 100% / 2 + @ref', parser, parser._parseDeclaration.bind(parser));
		assertNode('border: (@width * 2) solid black', parser, parser._parseDeclaration.bind(parser));
		assertNode('property: @class', parser, parser._parseDeclaration.bind(parser));
		assertNode('prop-erty: fnc(@t, 10%)', parser, parser._parseDeclaration.bind(parser));

		assertNode('background: url(//yourdomain/yourpath.png)', parser, parser._parseDeclaration.bind(parser));
	});

	test('Stylesheet', function () {
		let parser = new LESSParser();
		assertNode('.color (@radius: 5px){ -border-radius: #F5F5F5 }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.color (@radius: 5px){ -border-radius: @radius }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.color (@radius: 5px){ -border-radius: #F5F5F5 } .color (@radius: 5px) { -border-radius: #F5F5F5 }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.color (@radius: 5px) { -border-radius: #F5F5F5 } .color (@radius: 5px) { -border-radius: #F5F5F5 } .color (@radius: 5px) { -border-radius: #F5F5F5 }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.color (@radius: 5px) { -border-radius: #F5F5F5 } .color (@radius: 5px) { -border-radius: #F5F5F5 } .color (@radius: 5px) { -border-radius: #F5F5F5 }', parser, parser._parseStylesheet.bind(parser));

		assertNode('.mixin (@a, @rest...) {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('.mixin (@a) when (lightness(@a) >= 50%) {  background-color: black;}', parser, parser._parseStylesheet.bind(parser));
		assertNode('.some-mixin { font-weight:bold; } h1 { .some-mixin; font-size:40px; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('#namespace when (@mode=huge) { .mixin() { } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.generate-columns(1);', parser, parser._parseStylesheet.bind(parser));
		assertNode('@dr1: {f:b}\n@dr2: {f:b}', parser, parser._parseStylesheet.bind(parser));

		assertNode('@color: #F5F5F5;', parser, parser._parseStylesheet.bind(parser));
		assertNode('@color: #F5F5F5; @color: #F5F5F5;', parser, parser._parseStylesheet.bind(parser));
		assertNode('@color: #F5F5F5; @color: #F5F5F5; @color: #F5F5F5;', parser, parser._parseStylesheet.bind(parser));
		assertNode('@color: #F5F5F5; .color (@radius: 5px)  { -border-radius: #F5F5F5 } @color: #F5F5F5;', parser, parser._parseStylesheet.bind(parser));
		assertNode('@import-once "lib";', parser, parser._parseStylesheet.bind(parser));
		assertNode('@import-once (css) "hello";', parser, parser._parseStylesheet.bind(parser));
		assertError('@import-once () "hello";', parser, parser._parseStylesheet.bind(parser), ParseError.IdentifierExpected);
		assertError('@import-once (less);', parser, parser._parseStylesheet.bind(parser), ParseError.URIOrStringExpected);
		assertNode('@import (css) "lib";', parser, parser._parseStylesheet.bind(parser));
		assertNode('@import (optional, reference) "foo.less";', parser, parser._parseStylesheet.bind(parser));
		assertNode('@import (optional, reference,) "foo.less";', parser, parser._parseStylesheet.bind(parser));
		assertError('@import (optional, reference,,) "foo.less";', parser, parser._parseStylesheet.bind(parser), ParseError.RightParenthesisExpected);
	});

	test('Ruleset', function () {
		let parser = new LESSParser();
		assertNode('.selector { prop: erty @let 1px; }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { .mixin; }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { .mixin(1px); .mixin(blue, 1px, \'farboo\') }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { .mixin(blue; 1px;\'farboo\') }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector:active { property:value; nested:hover {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector {}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { property: declaration }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { @variable: declaration }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { nested {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { nested, a, b {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { property: value; property: value; }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { property: value; @keyframes foo {} @-moz-keyframes foo {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector {  @import "bar"; }', parser, parser._parseRuleset.bind(parser));
	});

	test('term', function () {
		let parser = new LESSParser();
		assertNode('%(\'repetitions: %S file: %S\', 1 + 2, "directory/file.less")', parser, parser._parseTerm.bind(parser));
		assertNode('~"ms:alwaysHasItsOwnSyntax.For.Stuff()"', parser, parser._parseTerm.bind(parser)); // less syntax
		assertNode('~`colorPalette("@{blue}", 1)`', parser, parser._parseTerm.bind(parser)); // less syntax
	});

	test('Nested Ruleset', function () {
		let parser = new LESSParser();
		assertNode('.class1 { @let: 1; .class { @let: 2; three: @let; let: 3; } one: @let; }', parser, parser._parseRuleset.bind(parser));
		assertNode('.class1 { @let: 1; > .class2 { display: none; } }', parser, parser._parseRuleset.bind(parser));
		assertNode('.foo { @supports(display: grid) { .bar { display: none; }}}', parser, parser._parseRuleset.bind(parser));
		assertNode('.foo { @supports(display: grid) { display: none; }}', parser, parser._parseRuleset.bind(parser));
		assertNode('.parent { color:green; @document url-prefix() { .child { color:red; }}}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@supports (property: value) { .outOfMedia & { @media (max-size: 2px) { @supports (whatever: something) { property: value;}}}}', parser, parser._parseStylesheet.bind(parser));
	});

	test('Interpolation', function () {
		let parser = new LESSParser();
		assertNode('.@{name} { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.${name} { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.my-element:not(.prefix-@{sub-element}) { }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.-@{color} { }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.--@{color} { }', parser, parser._parseStylesheet.bind(parser));
		assertNoNode('@', parser, parser._parseInterpolation.bind(parser));
		assertNode('.px2rem(@name, @px) { @{name}: @px / @basesize; }', parser, parser._parseStylesheet.bind(parser));
		assertError('@{', parser, parser._parseInterpolation.bind(parser), ParseError.IdentifierExpected);
		assertError('@{dd', parser, parser._parseInterpolation.bind(parser), ParseError.RightCurlyExpected);
	});

	test('Selector Combinator', function () {
		let parser = new LESSParser();
		assertNode('&:hover', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&.float', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-foo', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-1', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&1', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-foo-1', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-foo-1-2', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&--&', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-10-thing', parser, parser._parseSimpleSelector.bind(parser));
	});

	test('CSS Guards', function () {
		let parser = new LESSParser();
		assertNode('button when (@my-option = true) { color: white; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.something .other when (@my-option = true) { color: white; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('& when (@my-option = true) { button { color: white; } }', parser, parser._parseStylesheet.bind(parser));
	});

	test('Merge', function () {
		let parser = new LESSParser();
		assertNode('.mixin() { transform+_: scale(2); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.myclass { box-shadow+: inset 0 0 10px #555; }', parser, parser._parseStylesheet.bind(parser));
	});

	test('url', function () {
		let parser = new LESSParser();
		assertNode('url(//yourdomain/yourpath.png)', parser, parser._parseURILiteral.bind(parser));
		assertNode('url(\'http://msft.com\')', parser, parser._parseURILiteral.bind(parser));
		assertNode('url("http://msft.com")', parser, parser._parseURILiteral.bind(parser));
		assertNode('url( "http://msft.com")', parser, parser._parseURILiteral.bind(parser));
		assertNode('url(\t"http://msft.com")', parser, parser._parseURILiteral.bind(parser));
		assertNode('url(\n"http://msft.com")', parser, parser._parseURILiteral.bind(parser));
		assertNode('url("http://msft.com"\n)', parser, parser._parseURILiteral.bind(parser));
		assertNode('url("")', parser, parser._parseURILiteral.bind(parser));
		assertNode('uRL("")', parser, parser._parseURILiteral.bind(parser));
		assertNode('URL("")', parser, parser._parseURILiteral.bind(parser));
		assertNode('url(http://msft.com)', parser, parser._parseURILiteral.bind(parser));
		assertNode('url()', parser, parser._parseURILiteral.bind(parser));
		assertNode('url(\'http://msft.com\n)', parser, parser._parseURILiteral.bind(parser));
		assertError('url("http://msft.com"', parser, parser._parseURILiteral.bind(parser), ParseError.RightParenthesisExpected);
		assertError('url(http://msft.com\')', parser, parser._parseURILiteral.bind(parser), ParseError.RightParenthesisExpected);
	});

	test('@plugin', function () {
		let parser = new LESSParser();
		assertNode('@plugin "my-plugin";', parser, parser._parseStylesheet.bind(parser));
	});
});