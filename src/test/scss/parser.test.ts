/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import { SCSSParser } from '../../parser/scssParser';
import { ParseError } from '../../parser/cssErrors';
import { SCSSParseError } from '../../parser/scssErrors';

import { assertNode, assertError } from '../css/parser.test';

suite('SCSS - Parser', () => {

	test('Comments', function () {
		let parser = new SCSSParser();
		assertNode(' a { b:  /* comment */ c }', parser, parser._parseStylesheet.bind(parser));
		assertNode(' a { b: /* comment \n * is several\n * lines long\n */ c }', parser, parser._parseStylesheet.bind(parser));
		assertNode(' a { b: // single line comment\n  c }', parser, parser._parseStylesheet.bind(parser));
	});

	test('Variable', function () {
		let parser = new SCSSParser();
		assertNode('$color', parser, parser._parseVariable.bind(parser));
		assertNode('$co42lor', parser, parser._parseVariable.bind(parser));
		assertNode('$-co42lor', parser, parser._parseVariable.bind(parser));
	});

	test('Module variable', function () {
		let parser = new SCSSParser();
		assertNode('module.$color', parser, parser._parseModuleMember.bind(parser));
		assertNode('module.$co42lor', parser, parser._parseModuleMember.bind(parser));
		assertNode('module.$-co42lor', parser, parser._parseModuleMember.bind(parser));
		assertNode('module.function()', parser, parser._parseModuleMember.bind(parser));

		assertError('module.', parser, parser._parseModuleMember.bind(parser), ParseError.IdentifierOrVariableExpected);
	});

	test('VariableDeclaration', function () {
		let parser = new SCSSParser();
		assertNode('$color: #F5F5F5', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$color: 0', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$color: 255', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$color: 25.5', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$color: 25px', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$color: 25.5px !default', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$text-color: green !global', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$_RESOURCES: append($_RESOURCES, "clean") !global', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$footer-height: 40px !default !global', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$primary-font: "wf_SegoeUI","Segoe UI","Segoe","Segoe WP"', parser, parser._parseVariableDeclaration.bind(parser));
		assertNode('$color: red !important', parser, parser._parseVariableDeclaration.bind(parser));

		assertError('$color: red !def', parser, parser._parseVariableDeclaration.bind(parser), ParseError.UnknownKeyword);
		assertError('$color : !default', parser, parser._parseVariableDeclaration.bind(parser), ParseError.VariableValueExpected);
		assertError('$color !default', parser, parser._parseVariableDeclaration.bind(parser), ParseError.ColonExpected);
	});

	test('Expr', function () {
		let parser = new SCSSParser();
		assertNode('($let + 20)', parser, parser._parseExpr.bind(parser));
		assertNode('($let - 20)', parser, parser._parseExpr.bind(parser));
		assertNode('($let * 20)', parser, parser._parseExpr.bind(parser));
		assertNode('($let / 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 - $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 * $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 / $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 / 20 + $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + 20 + $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + 20 + 20 + $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + $let + 20 + 20 + $let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20)', parser, parser._parseExpr.bind(parser));
		assertNode('($var1 + $var2)', parser, parser._parseExpr.bind(parser));
		assertNode('(($let + 5) * 2)', parser, parser._parseExpr.bind(parser));
		assertNode('(($let + (5 + 2)) * 2)', parser, parser._parseExpr.bind(parser));
		assertNode('($let + ((5 + 2) * 2))', parser, parser._parseExpr.bind(parser));
		assertNode('$color', parser, parser._parseExpr.bind(parser));
		assertNode('$color, $color', parser, parser._parseExpr.bind(parser));
		assertNode('$color, 42%', parser, parser._parseExpr.bind(parser));
		assertNode('$color, 42%, $color', parser, parser._parseExpr.bind(parser));
		assertNode('$color - ($color + 10%)', parser, parser._parseExpr.bind(parser));
		assertNode('($base + $filler)', parser, parser._parseExpr.bind(parser));
		assertNode('(100% / 2 + $filler)', parser, parser._parseExpr.bind(parser));
		assertNode('100% / 2 + $filler', parser, parser._parseExpr.bind(parser));
		assertNode('not ($v and $b) or $c', parser, parser._parseExpr.bind(parser));

		assertNode('(module.$let + 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$let - 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$let * 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$let / 20)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 - module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 * module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 / module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + 20 + module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + 20 + 20 + module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('(20 + 20 + module.$let + 20 + 20 + module.$let)', parser, parser._parseExpr.bind(parser));
		assertNode('($var1 + module.$var2)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$var1 + $var2)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$var1 + module.$var2)', parser, parser._parseExpr.bind(parser));
		assertNode('((module.$let + 5) * 2)', parser, parser._parseExpr.bind(parser));
		assertNode('((module.$let + (5 + 2)) * 2)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$let + ((5 + 2) * 2))', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color, $color', parser, parser._parseExpr.bind(parser));
		assertNode('$color, module.$color', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color, module.$color', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color, 42%', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color, 42%, $color', parser, parser._parseExpr.bind(parser));
		assertNode('$color, 42%, module.$color', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color, 42%, module.$color', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color - ($color + 10%)', parser, parser._parseExpr.bind(parser));
		assertNode('$color - (module.$color + 10%)', parser, parser._parseExpr.bind(parser));
		assertNode('module.$color - (module.$color + 10%)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$base + $filler)', parser, parser._parseExpr.bind(parser));
		assertNode('($base + module.$filler)', parser, parser._parseExpr.bind(parser));
		assertNode('(module.$base + module.$filler)', parser, parser._parseExpr.bind(parser));
		assertNode('(100% / 2 + module.$filler)', parser, parser._parseExpr.bind(parser));
		assertNode('100% / 2 + module.$filler', parser, parser._parseExpr.bind(parser));
		assertNode('not (module.$v and $b) or $c', parser, parser._parseExpr.bind(parser));
		assertNode('not ($v and module.$b) or $c', parser, parser._parseExpr.bind(parser));
		assertNode('not ($v and $b) or module.$c', parser, parser._parseExpr.bind(parser));
		assertNode('not (module.$v and module.$b) or $c', parser, parser._parseExpr.bind(parser));
		assertNode('not (module.$v and $b) or module.$c', parser, parser._parseExpr.bind(parser));
		assertNode('not ($v and module.$b) or module.$c', parser, parser._parseExpr.bind(parser));
		assertNode('not (module.$v and module.$b) or module.$c', parser, parser._parseExpr.bind(parser));
		assertNode('not module.$v', parser, parser._parseExpr.bind(parser));

		assertError('(20 + 20', parser, parser._parseExpr.bind(parser), ParseError.RightParenthesisExpected);
	});

	test('SCSSOperator', function () {
		let parser = new SCSSParser();
		assertNode('>=', parser, parser._parseOperator.bind(parser));
		assertNode('>', parser, parser._parseOperator.bind(parser));
		assertNode('<', parser, parser._parseOperator.bind(parser));
		assertNode('<=', parser, parser._parseOperator.bind(parser));
		assertNode('==', parser, parser._parseOperator.bind(parser));
		assertNode('!=', parser, parser._parseOperator.bind(parser));
		assertNode('and', parser, parser._parseOperator.bind(parser));
		assertNode('+', parser, parser._parseOperator.bind(parser));
		assertNode('-', parser, parser._parseOperator.bind(parser));
		assertNode('*', parser, parser._parseOperator.bind(parser));
		assertNode('/', parser, parser._parseOperator.bind(parser));
		assertNode('%', parser, parser._parseOperator.bind(parser));
		assertNode('not', parser, parser._parseUnaryOperator.bind(parser));
	});

	test('Interpolation', function () {
		let parser = new SCSSParser();
		assertNode('#{red}', parser, parser._parseIdent.bind(parser));
		assertNode('#{$color}', parser, parser._parseIdent.bind(parser));
		assertNode('#{3 + 4}', parser, parser._parseIdent.bind(parser));
		assertNode('#{3 + #{3 + 4}}', parser, parser._parseIdent.bind(parser));
		assertNode('#{$d}-style: 0', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo-#{$d}: 1', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{$d}-bar-#{$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo-#{$d}-bar: 1', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{$d}-#{$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('&:nth-child(#{$query}+1) { clear: $opposite-direction; }', parser, parser._parseRuleset.bind(parser));
		assertNode('--#{$propname}: some-value', parser, parser._parseDeclaration.bind(parser));
		assertNode('some-property: var(--#{$propname})', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{}', parser, parser._parseIdent.bind(parser));
		assertError('#{1 + 2', parser, parser._parseIdent.bind(parser), ParseError.RightCurlyExpected);

		assertNode('#{module.$color}', parser, parser._parseIdent.bind(parser));
		assertNode('#{module.$d}-style: 0', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo-#{module.$d}: 1', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{module.$d}-bar-#{$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{$d}-bar-#{module.$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{module.$d}-bar-#{module.$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo-#{module.$d}-bar: 1', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{$d}-#{$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{module.$d}-#{$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{$d}-#{module.$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('#{module.$d}-#{module.$d}: 2', parser, parser._parseDeclaration.bind(parser));
		assertNode('&:nth-child(#{module.$query}+1) { clear: $opposite-direction; }', parser, parser._parseRuleset.bind(parser));
		assertNode('&:nth-child(#{$query}+1) { clear: module.$opposite-direction; }', parser, parser._parseRuleset.bind(parser));
		assertNode('&:nth-child(#{module.$query}+1) { clear: module.$opposite-direction; }', parser, parser._parseRuleset.bind(parser));
		assertNode('--#{module.$propname}: some-value', parser, parser._parseDeclaration.bind(parser));
		assertNode('some-property: var(--#{module.$propname})', parser, parser._parseDeclaration.bind(parser));
		assertNode('@supports #{$val} { }', parser, parser._parseStylesheet.bind(parser)); // #88283
		assertNode('.mb-#{$i}0np {} .push-up-#{$i}0 {} .mt-#{$i}0vh {}', parser, parser._parseStylesheet.bind(parser));
	});

	test('Declaration', function () {
		let parser = new SCSSParser();
		assertNode('border: thin solid 1px', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: $color', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: blue', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: (20 / $let)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: (20 / 20 + $let)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: func($red)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: func($red) !important', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: desaturate($red, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: desaturate(16, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: $base-color + #111', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: 100% / 2 + $ref', parser, parser._parseDeclaration.bind(parser));
		assertNode('border: ($width * 2) solid black', parser, parser._parseDeclaration.bind(parser));
		assertNode('property: $class', parser, parser._parseDeclaration.bind(parser));
		assertNode('prop-erty: fnc($t, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('width: (1em + 2em) * 3', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: #010203 + #040506', parser, parser._parseDeclaration.bind(parser));
		assertNode('font-family: sans- + "serif"', parser, parser._parseDeclaration.bind(parser));
		assertNode('margin: 3px + 4px auto', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: hsl(0, 100%, 50%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: hsl($hue: 0, $saturation: 100%, $lightness: 50%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if($value == \'default\', flex-gutter(), $value)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if(true, !important, null)', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: selector-replace(&, 1)', parser, parser._parseDeclaration.bind(parser));

		assertNode('dummy: module.$color', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: (20 / module.$let)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: (20 / 20 + module.$let)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: module.func($red)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: module.func($red) !important', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: module.desaturate($red, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: desaturate(module.$red, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: module.desaturate(module.$red, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('dummy: module.desaturate(16, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: module.$base-color + #111', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: 100% / 2 + module.$ref', parser, parser._parseDeclaration.bind(parser));
		assertNode('border: (module.$width * 2) solid black', parser, parser._parseDeclaration.bind(parser));
		assertNode('property: module.$class', parser, parser._parseDeclaration.bind(parser));
		assertNode('prop-erty: module.fnc($t, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('prop-erty: fnc(module.$t, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('prop-erty: module.fnc(module.$t, 10%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('width: (1em + 2em) * 3', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: #010203 + #040506', parser, parser._parseDeclaration.bind(parser));
		assertNode('font-family: sans- + "serif"', parser, parser._parseDeclaration.bind(parser));
		assertNode('margin: 3px + 4px auto', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: color.hsl(0, 100%, 50%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: color.hsl($hue: 0, $saturation: 100%, $lightness: 50%)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if(module.$value == \'default\', flex-gutter(), $value)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if($value == \'default\', module.flex-gutter(), $value)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if($value == \'default\', flex-gutter(), module.$value)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if(module.$value == \'default\', module.flex-gutter(), $value)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if($value == \'default\', module.flex-gutter(), module.$value)', parser, parser._parseDeclaration.bind(parser));
		assertNode('foo: if(module.$value == \'default\', module.flex-gutter(), module.$value)', parser, parser._parseDeclaration.bind(parser));
		assertNode('color: selector.replace(&, 1)', parser, parser._parseDeclaration.bind(parser));

		assertError('fo = 8', parser, parser._parseDeclaration.bind(parser), ParseError.ColonExpected);
		assertError('fo:', parser, parser._parseDeclaration.bind(parser), ParseError.PropertyValueExpected);
		assertError('color: hsl($hue: 0,', parser, parser._parseDeclaration.bind(parser), ParseError.ExpressionExpected);
		assertError('color: hsl($hue: 0', parser, parser._parseDeclaration.bind(parser), ParseError.RightParenthesisExpected);
	});

	test('Stylesheet', function () {
		let parser = new SCSSParser();
		assertNode('$color: #F5F5F5;', parser, parser._parseStylesheet.bind(parser));
		assertNode('$color: #F5F5F5; $color: #F5F5F5;', parser, parser._parseStylesheet.bind(parser));
		assertNode('$color: #F5F5F5; $color: #F5F5F5; $color: #F5F5F5;', parser, parser._parseStylesheet.bind(parser));
		assertNode('$color: #F5F5F5 !important;', parser, parser._parseStylesheet.bind(parser));
		assertNode('#main { width: 97%; p, div { a { font-weight: bold; } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('a { &:hover { color: red; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('fo { font: 2px/3px { family: fantasy; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo { bar: { yoo: fantasy; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('selector { propsuffix: { nested: 1px; } rule: 1px; nested.selector { foo: 1; } nested:selector { foo: 2 }}', parser, parser._parseStylesheet.bind(parser));
		assertNode('legend {foo{a:s}margin-top:0;margin-bottom:#123;margin-top:s(1)}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin keyframe { @keyframes name { @content; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@include keyframe { 10% { top: 3px; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.class{&--sub-class-with-ampersand{color: red;}}', parser, parser._parseStylesheet.bind(parser));
		assertError('fo { font: 2px/3px { family } }', parser, parser._parseStylesheet.bind(parser), ParseError.ColonExpected);

		assertNode('legend {foo{a:s}margin-top:0;margin-bottom:#123;margin-top:m.s(1)}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@include module.keyframe { 10% { top: 3px; } }', parser, parser._parseStylesheet.bind(parser));
	});

	test('@import', function () {
		let parser = new SCSSParser();
		assertNode('@import "test.css"', parser, parser._parseImport.bind(parser));
		assertNode('@import url("test.css")', parser, parser._parseImport.bind(parser));
		assertNode('@import "test.css", "bar.css"', parser, parser._parseImport.bind(parser));
		assertNode('@import "test.css", "bar.css" screen, projection', parser, parser._parseImport.bind(parser));
		assertNode('foo { @import "test.css"; }', parser, parser._parseStylesheet.bind(parser));

		assertError('@import "test.css" "bar.css"', parser, parser._parseStylesheet.bind(parser), ParseError.MediaQueryExpected);
		assertError('@import "test.css", screen', parser, parser._parseImport.bind(parser), ParseError.URIOrStringExpected);
		assertError('@import', parser, parser._parseImport.bind(parser), ParseError.URIOrStringExpected);
	});

	test('@use', function () {
		let parser = new SCSSParser();
		assertNode('@use "test"', parser, parser._parseUse.bind(parser));
		assertNode('@use "test" as foo', parser, parser._parseUse.bind(parser));
		assertNode('@use "test" as *', parser, parser._parseUse.bind(parser));
		assertNode('@use "test" with ($foo: "test", $bar: 1)', parser, parser._parseUse.bind(parser));
		assertNode('@use "test" as foo with ($foo: "test", $bar: 1)', parser, parser._parseUse.bind(parser));

		assertError('@use', parser, parser._parseUse.bind(parser), ParseError.StringLiteralExpected);
		assertError('@use "test" foo', parser, parser._parseUse.bind(parser), ParseError.UnknownKeyword);
		assertError('@use "test" as', parser, parser._parseUse.bind(parser), ParseError.IdentifierOrWildcardExpected);
		assertError('@use "test" with', parser, parser._parseUse.bind(parser), ParseError.LeftParenthesisExpected);
		assertError('@use "test" with ($foo)', parser, parser._parseUse.bind(parser), ParseError.VariableValueExpected);
		assertError('@use "test" with ("bar")', parser, parser._parseUse.bind(parser), ParseError.VariableNameExpected);
		assertError('@use "test" with ($foo: 1, "bar")', parser, parser._parseUse.bind(parser), ParseError.VariableNameExpected);
		assertError('@use "test" with ($foo: "bar"', parser, parser._parseUse.bind(parser), ParseError.RightParenthesisExpected);

		assertNode('@forward "test"; @use "lib"', parser, parser._parseStylesheet.bind(parser));
		assertNode('@use "test"; @use "lib"', parser, parser._parseStylesheet.bind(parser));
		assertNode('$test: "test"; @use "lib"', parser, parser._parseStylesheet.bind(parser));
	});

	test('@forward', function () {
		let parser = new SCSSParser();
		assertNode('@forward "test"', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" as foo-*', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" hide this', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" hide $that', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" hide this $that', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" show this', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" show $that', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" show this $that', parser, parser._parseForward.bind(parser));
		assertNode('@forward "test" as foo-* show this $that', parser, parser._parseForward.bind(parser));

		assertError('@forward', parser, parser._parseForward.bind(parser), ParseError.StringLiteralExpected);
		assertError('@forward "test" foo', parser, parser._parseForward.bind(parser), ParseError.UnknownKeyword);
		assertError('@forward "test" as', parser, parser._parseForward.bind(parser), ParseError.IdentifierExpected);
		assertError('@forward "test" as foo-', parser, parser._parseForward.bind(parser), ParseError.WildcardExpected);
		assertError('@forward "test" as foo- *', parser, parser._parseForward.bind(parser), ParseError.WildcardExpected);
		assertError('@forward "test" show', parser, parser._parseForward.bind(parser), ParseError.IdentifierOrVariableExpected);
		assertError('@forward "test" hide', parser, parser._parseForward.bind(parser), ParseError.IdentifierOrVariableExpected);

		assertNode('@use "lib"; @forward "test"', parser, parser._parseStylesheet.bind(parser));
		assertNode('@forward "test"; @forward "lib"', parser, parser._parseStylesheet.bind(parser));
		assertNode('$test: "test"; @forward "test"', parser, parser._parseStylesheet.bind(parser));
	});

	test('@media', function () {
		let parser = new SCSSParser();
		assertNode('@media screen { .sidebar { @media (orientation: landscape) { width: 500px; } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media #{$media} and ($feature: $value)  {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media only screen and #{$query} {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('foo { bar { @media screen and (orientation: landscape) {}} }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media screen and (nth($query, 1): nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('.something { @media (max-width: 760px) { > .test { color: blue; } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.something { @media (max-width: 760px) { ~ div { display: block; } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.something { @media (max-width: 760px) { + div { display: block; } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media (max-width: 760px) { + div { display: block; } }', parser, parser._parseStylesheet.bind(parser));

		assertNode('@media #{layout.$media} and ($feature: $value)  {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media #{$media} and (layout.$feature: $value)  {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media #{$media} and ($feature: layout.$value)  {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media #{layout.$media} and (layout.$feature: $value)  {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media #{$media} and (layout.$feature: layout.$value)  {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media #{layout.$media} and (layout.$feature: layout.$value)  {}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media screen and (list.nth($query, 1): nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (nth(list.$query, 1): nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (nth($query, 1): list.nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (nth($query, 1): nth(list.$query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (list.nth(list.$query, 1): nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (list.nth($query, 1): list.nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (list.nth($query, 1): nth(list.$query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (nth(list.$query, 1): list.nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (nth(list.$query, 1): nth(list.$query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (nth($query, 1): list.nth(list.$query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (list.nth(list.$query, 1): list.nth($query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (nth(list.$query, 1): list.nth(list.$query, 2)) { }', parser, parser._parseMedia.bind(parser));
		assertNode('@media screen and (list.nth(list.$query, 1): list.nth(list.$query, 2)) { }', parser, parser._parseMedia.bind(parser));
	});

	test('@keyframe', function () {
		let parser = new SCSSParser();
		assertNode('@keyframes name { @content; }', parser, parser._parseKeyframe.bind(parser));
		assertNode('@keyframes name { @for $i from 0 through $steps { #{$i * (100%/$steps)} { transform: $rotate $translate; } } }', parser, parser._parseKeyframe.bind(parser)); // issue 42086
		assertNode('@keyframes test-keyframe { @for $i from 1 through 60 { $s: ($i * 100) / 60 + "%"; } }', parser, parser._parseKeyframe.bind(parser));

		assertNode('@keyframes name { @for $i from 0 through m.$steps { #{$i * (100%/$steps)} { transform: $rotate $translate; } } }', parser, parser._parseKeyframe.bind(parser));
	});

	test('@extend', function () {
		let parser = new SCSSParser();
		assertNode('foo { @extend .error; border-width: 3px; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('a.important { @extend .notice !optional; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.hoverlink { @extend a:hover; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.seriousError {  @extend .error; @extend .attention; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('#context a%extreme { color: blue; }  .notice { @extend %extreme }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@media print { .error {  } .seriousError { @extend .error; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin error($a: false) { @extend .#{$a}; @extend ##{$a}; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo { @extend .text-center, .uppercase; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo { @extend .text-center, .uppercase, ; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.foo { @extend .text-center, .uppercase !optional ; }', parser, parser._parseStylesheet.bind(parser));
		assertError('.hoverlink { @extend }', parser, parser._parseStylesheet.bind(parser), ParseError.SelectorExpected);
		assertError('.hoverlink { @extend %extreme !default }', parser, parser._parseStylesheet.bind(parser), ParseError.UnknownKeyword);
	});

	test('@debug', function () {
		let parser = new SCSSParser();
		assertNode('@debug test;', parser, parser._parseStylesheet.bind(parser));
		assertNode('foo { @debug 1 + 4; nested { @warn 1 4; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@if $foo == 1 { @debug 1 + 4 }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@function setStyle($map, $object, $style) { @warn "The key ´#{$object} is not available in the map."; @return null; }', parser, parser._parseStylesheet.bind(parser));
	});

	test('@if', function () {
		let parser = new SCSSParser();
		assertNode('@if 1 + 1 == 2 { border: 1px solid;  }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@if 5 < 3      { border: 2px dotted; }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@if null       { border: 3px double; }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@if 1 <= $let { border: 3px; } @else { border: 4px; }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@if 1 >= (1 + $foo) { border: 3px; } @else if 1 + 1 == 2 { border: 4px; }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('p { @if $i == 1 { x: 3px; } @else if $i == 1 { x: 4px; } @else { x: 4px; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@if (index($_RESOURCES, "clean") != null) { @error "sdssd"; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@if $i == 1 { p { x: 3px; } }', parser, parser._parseStylesheet.bind(parser));
		assertError('@if { border: 1px solid;  }', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.ExpressionExpected);
		assertError('@if 1 }', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.LeftCurlyExpected);

		assertNode('@if 1 <= m.$let { border: 3px; } @else { border: 4px; }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@if 1 >= (1 + m.$foo) { border: 3px; } @else if 1 + 1 == 2 { border: 4px; }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('p { @if m.$i == 1 { x: 3px; } @else if $i == 1 { x: 4px; } @else { x: 4px; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p { @if $i == 1 { x: 3px; } @else if m.$i == 1 { x: 4px; } @else { x: 4px; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p { @if m.$i == 1 { x: 3px; } @else if m.$i == 1 { x: 4px; } @else { x: 4px; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@if (list.index($_RESOURCES, "clean") != null) { @error "sdssd"; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@if (index(m.$_RESOURCES, "clean") != null) { @error "sdssd"; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@if (list.index(m.$_RESOURCES, "clean") != null) { @error "sdssd"; }', parser, parser._parseStylesheet.bind(parser));
	});

	test('@for', function () {
		let parser = new SCSSParser();
		assertNode('@for $i from 1 to 5 { .item-#{$i} { width: 2em * $i; }  }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@for $k from 1 + $x through 5 + $x {  }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertError('@for i from 0 to 4 {}', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.VariableNameExpected);
		assertError('@for $i to 4 {}', parser, parser._parseRuleSetDeclaration.bind(parser), SCSSParseError.FromExpected);
		assertError('@for $i from 0 by 4 {}', parser, parser._parseRuleSetDeclaration.bind(parser), SCSSParseError.ThroughOrToExpected);
		assertError('@for $i from {}', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.ExpressionExpected);
		assertError('@for $i from 0 to {}', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.ExpressionExpected);
		assertNode('@for $i from 1 through 60 { $s: $i + "%"; }', parser, parser._parseRuleSetDeclaration.bind(parser));

		assertNode('@for $k from 1 + m.$x through 5 + $x {  }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@for $k from 1 + $x through 5 + m.$x {  }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@for $k from 1 + m.$x through 5 + m.$x {  }', parser, parser._parseRuleSetDeclaration.bind(parser));
	});

	test('@each', function () {
		let parser = new SCSSParser();
		assertNode('@each $i in 1, 2, 3 { }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@each $i in 1 2 3 { }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertNode('@each $animal, $color, $cursor in (puma, black, default), (egret, white, move) {}', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertError('@each i in 4 {}', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.VariableNameExpected);
		assertError('@each $i from 4 {}', parser, parser._parseRuleSetDeclaration.bind(parser), SCSSParseError.InExpected);
		assertError('@each $i in {}', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.ExpressionExpected);
		assertError('@each $animal,  in (1, 1, 1), (2, 2, 2) {}', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.VariableNameExpected);
	});

	test('@while', function () {
		let parser = new SCSSParser();
		assertNode('@while $i < 0 { .item-#{$i} { width: 2em * $i; } $i: $i - 2; }', parser, parser._parseRuleSetDeclaration.bind(parser));
		assertError('@while {}', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.ExpressionExpected);
		assertError('@while $i != 4', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.LeftCurlyExpected);
		assertError('@while ($i >= 4) {', parser, parser._parseRuleSetDeclaration.bind(parser), ParseError.RightCurlyExpected);
	});

	test('@mixin', function () {
		let parser = new SCSSParser();
		assertNode('@mixin large-text { font: { family: Arial; size: 20px; } color: #ff0000; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin sexy-border($color, $width: 1in) { color: black; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin box-shadow($shadows...) { -moz-box-shadow: $shadows; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin apply-to-ie6-only {  * html { @content; } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin #{foo}($color){}', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin foo ($i:4) { size: $i; @include wee ($i - 1); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@mixin foo ($i,) { }', parser, parser._parseStylesheet.bind(parser));

		assertError('@mixin $1 {}', parser, parser._parseStylesheet.bind(parser), ParseError.IdentifierExpected);
		assertError('@mixin foo() i {}', parser, parser._parseStylesheet.bind(parser), ParseError.LeftCurlyExpected);
		assertError('@mixin foo(1) {}', parser, parser._parseStylesheet.bind(parser), ParseError.RightParenthesisExpected);
		assertError('@mixin foo($color = 9) {}', parser, parser._parseStylesheet.bind(parser), ParseError.RightParenthesisExpected);
		assertError('@mixin foo($color)', parser, parser._parseStylesheet.bind(parser), ParseError.LeftCurlyExpected);
		assertError('@mixin foo($color){', parser, parser._parseStylesheet.bind(parser), ParseError.RightCurlyExpected);
		assertError('@mixin foo($color,){', parser, parser._parseStylesheet.bind(parser), ParseError.RightCurlyExpected);
	});

	test('@content', function () {
		let parser = new SCSSParser();
		assertNode('@content', parser, parser._parseMixinContent.bind(parser));
		assertNode('@content($type)', parser, parser._parseMixinContent.bind(parser));
	});

	test('@include', function () {
		let parser = new SCSSParser();
		assertNode('p { @include sexy-border(blue); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.shadows { @include box-shadow(0px 4px 5px #666, 2px 6px 10px #999); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('$values: #ff0000, #00ff00, #0000ff; .primary { @include colors($values...); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@include colors(this("styles")...);', parser, parser._parseStylesheet.bind(parser));
		assertNode('.test { @include fontsize(16px, 21px !important); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p {  @include apply-to-ie6-only { #logo { background-image: url(/logo.gif); } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p { @include foo($values,) }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p { @include foo($values,); }', parser, parser._parseStylesheet.bind(parser));

		assertError('p { @include sexy-border blue', parser, parser._parseStylesheet.bind(parser), ParseError.SemiColonExpected);
		assertError('p { @include sexy-border($values blue', parser, parser._parseStylesheet.bind(parser), ParseError.RightParenthesisExpected);
		assertError('p { @include }', parser, parser._parseStylesheet.bind(parser), ParseError.IdentifierExpected);
		assertError('p { @include foo($values }', parser, parser._parseStylesheet.bind(parser), ParseError.RightParenthesisExpected);
		assertError('p { @include foo($values, }', parser, parser._parseStylesheet.bind(parser), ParseError.ExpressionExpected);

		assertNode('p { @include lib.sexy-border(blue); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.shadows { @include lib.box-shadow(0px 4px 5px #666, 2px 6px 10px #999); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('$values: #ff0000, #00ff00, #0000ff; .primary { @include lib.colors($values...); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.primary { @include colors(lib.$values...); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('.primary { @include lib.colors(lib.$values...); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@include lib.colors(this("styles")...);', parser, parser._parseStylesheet.bind(parser));
		assertNode('@include colors(lib.this("styles")...);', parser, parser._parseStylesheet.bind(parser));
		assertNode('@include lib.colors(lib.this("styles")...);', parser, parser._parseStylesheet.bind(parser));
		assertNode('.test { @include lib.fontsize(16px, 21px !important); }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p {  @include lib.apply-to-ie6-only { #logo { background-image: url(/logo.gif); } } }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p { @include lib.foo($values,) }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p { @include foo(lib.$values,) }', parser, parser._parseStylesheet.bind(parser));
		assertNode('p { @include lib.foo(m.$values,); }', parser, parser._parseStylesheet.bind(parser));

		assertError('p { @include foo.($values) }', parser, parser._parseStylesheet.bind(parser), ParseError.IdentifierExpected);

		assertNode('@include rtl("left") using ($dir) { margin-#{$dir}: 10px; }', parser, parser._parseStylesheet.bind(parser));
	});

	test('@function', function () {
		let parser = new SCSSParser();
		assertNode('@function grid-width($n) { @return $n * $grid-width + ($n - 1) * $gutter-width; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@function grid-width($n: 1, $e) { @return 0; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@function foo($total, $a) { @for $i from 0 to $total { } @return $grid; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@function foo() { @if (unit($a) == "%") and ($i == ($total - 1)) { @return 0; } @return 1; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@function is-even($int) { @if $int%2 == 0 { @return true; } @return false }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@function bar ($i) { @if $i > 0 { @return $i * bar($i - 1); } @return 1; }', parser, parser._parseStylesheet.bind(parser));
		assertNode('@function foo($a,) {} ', parser, parser._parseStylesheet.bind(parser));

		assertError('@function foo {} ', parser, parser._parseStylesheet.bind(parser), ParseError.LeftParenthesisExpected);
		assertError('@function {} ', parser, parser._parseStylesheet.bind(parser), ParseError.IdentifierExpected);
		assertError('@function foo($a $b) {} ', parser, parser._parseStylesheet.bind(parser), ParseError.RightParenthesisExpected);
		assertError('@function foo($a {} ', parser, parser._parseStylesheet.bind(parser), ParseError.RightParenthesisExpected);
		assertError('@function foo($a...) { @return; }', parser, parser._parseStylesheet.bind(parser), ParseError.ExpressionExpected);
		assertError('@function foo($a:) {} ', parser, parser._parseStylesheet.bind(parser), ParseError.VariableValueExpected);

	});

	test('Ruleset', function () {
		let parser = new SCSSParser();
		assertNode('.selector { prop: erty $let 1px; }', parser, parser._parseRuleset.bind(parser));
		assertNode('.selector { prop: erty $let 1px m.$foo; }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector:active { property:value; nested:hover {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector {}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { property: declaration }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { $variable: declaration }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { nested {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { nested, a, b {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { property: value; property: $value; }', parser, parser._parseRuleset.bind(parser));
		assertNode('selector { property: value; @keyframes foo {} @-moz-keyframes foo {}}', parser, parser._parseRuleset.bind(parser));
		assertNode('foo|bar { }', parser, parser._parseRuleset.bind(parser));
		assertNode('boo { @apply --custom-prop; }', parser, parser._parseRuleset.bind(parser));
		assertNode('boo { @apply --custom-prop }', parser, parser._parseRuleset.bind(parser));
		assertNode('boo { @apply --custom-prop; background-color: red }', parser, parser._parseRuleset.bind(parser));
	});

	test('Nested Ruleset', function () {
		let parser = new SCSSParser();
		assertNode('.class1 { $let: 1; .class { $let: 2; three: $let; let: 3; } one: $let; }', parser, parser._parseRuleset.bind(parser));
		assertNode('.class1 { $let: 1; .class { $let: m.$foo; } one: $let; }', parser, parser._parseRuleset.bind(parser));
		assertNode('.class1 { > .class2 { & > .class4 { rule1: v1; } } }', parser, parser._parseRuleset.bind(parser));
		assertNode('foo { @at-root { display: none; } }', parser, parser._parseRuleset.bind(parser));
		assertNode('th, tr { @at-root #{selector-replace(&, "tr")} { border-bottom: 0; } }', parser, parser._parseRuleset.bind(parser));
		assertNode('.foo { @supports(display: grid) { .bar { display: none; }}}', parser, parser._parseRuleset.bind(parser));
		assertNode('.foo { @supports(display: grid) { display: none; }}', parser, parser._parseRuleset.bind(parser));
		assertNode('.foo { @supports (position: sticky) { @media (min-width: map-get($grid-breakpoints, md)) { position: sticky; } }}', parser, parser._parseRuleset.bind(parser)); // issue #152
	});

	test('Selector Interpolation', function () {
		let parser = new SCSSParser();
		assertNode('.#{$name} { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.#{$name}-foo { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.#{$name}-foo-3 { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.#{$name}-1 { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.sc-col#{$postfix}-2-1 { }', parser, parser._parseRuleset.bind(parser));
		assertNode('p.#{$name} { #{$attr}-color: blue; }', parser, parser._parseRuleset.bind(parser));
		assertNode('sans-#{serif} { a-#{1 + 2}-color-#{$attr}: blue; }', parser, parser._parseRuleset.bind(parser));
		assertNode('##{f} .#{f} #{f}:#{f} { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.foo-#{&} .foo-#{&-sub} { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.-#{$variable} { }', parser, parser._parseRuleset.bind(parser));
		assertNode('#{&}([foo=bar][bar=foo]) { }', parser, parser._parseRuleset.bind(parser)); // #49589

		assertNode('.#{module.$name} { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.#{module.$name}-foo { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.#{module.$name}-foo-3 { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.#{module.$name}-1 { }', parser, parser._parseRuleset.bind(parser));
		assertNode('.sc-col#{module.$postfix}-2-1 { }', parser, parser._parseRuleset.bind(parser));
		assertNode('p.#{module.$name} { #{$attr}-color: blue; }', parser, parser._parseRuleset.bind(parser));
		assertNode('p.#{$name} { #{module.$attr}-color: blue; }', parser, parser._parseRuleset.bind(parser));
		assertNode('p.#{module.$name} { #{module.$attr}-color: blue; }', parser, parser._parseRuleset.bind(parser));
		assertNode('sans-#{serif} { a-#{1 + 2}-color-#{module.$attr}: blue; }', parser, parser._parseRuleset.bind(parser));
		assertNode('.-#{module.$variable} { }', parser, parser._parseRuleset.bind(parser));
	});

	test('Parent Selector', function () {
		let parser = new SCSSParser();
		assertNode('&:hover', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&.float', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-bar', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-1', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&1', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-foo-1', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&&', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('&-10-thing', parser, parser._parseSimpleSelector.bind(parser));
	});

	test('Selector Placeholder', function () {
		let parser = new SCSSParser();
		assertNode('%hover', parser, parser._parseSimpleSelector.bind(parser));
		assertNode('a%float', parser, parser._parseSimpleSelector.bind(parser));
	});

	test('Map', function () {
		let parser = new SCSSParser();
		assertNode('(key1: 1px, key2: solid + px, key3: (2+3))', parser, parser._parseExpr.bind(parser));
		assertNode('($key1 + 3: 1px)', parser, parser._parseExpr.bind(parser));
	});

	test('Url', function () {
		let parser = new SCSSParser();
		assertNode('url(foo())', parser, parser._parseURILiteral.bind(parser));
		assertNode('url(\'data:image/svg+xml;utf8,%3Csvg%20fill%3D%22%23\' + $color + \'foo\')', parser, parser._parseURILiteral.bind(parser));
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
});
