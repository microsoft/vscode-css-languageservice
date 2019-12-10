/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import { CompletionItemKind, InsertTextFormat, CompletionItem, MarkupContent } from 'vscode-languageserver-types';
const localize = nls.loadMessageBundle();
import { IReference } from '../cssLanguageTypes';

interface IFunctionInfo {
	func: string;
	desc?: string;
	type?: string;
	references?: IReference[];
}

const colorFunctions: IFunctionInfo[] = [
	{
		func: 'adjust-color($color, [$red], [$green], [$blue], [$hue], [$saturation], [$lightness], [$alpha])',
		desc: localize(
			'scss.builtin.adjust-color',
			'Increases or decreases one or more properties of `$color` by fixed amounts.'
		),
		references: [
			{
				name: 'SASS documentation',
				url: 'https://sass-lang.com/documentation/modules/color#adjust'
			}
		]
	},
	{
		func: 'adjust-hue($color, $degrees)',
		desc: localize('scss.builtin.adjust-hue', "Increases or decreases `$color`'s hue."),
		references: [
			{
				name: 'SASS documentation',
				url: 'https://sass-lang.com/documentation/modules/color#adjust-hue'
			}
		]
	},
	{
		func: 'alpha($color)',
		desc: localize('scss.builtin.alpha', 'Returns the alpha channel of `$color` as a number between 0 and 1.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#alpha' }]
	},
	{
		func: 'opacity($color)',
		desc: 'Returns the alpha channel of `$color` as a number between 0 and 1.',
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#alpha' }]
	},

	{
		func: 'blue($color)',
		desc: localize('scss.builtin.blue', 'Returns the blue channel of `$color` as a number between 0 and 255.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#blue' }]
	},
	{
		func: 'red($color)',
		desc: localize('scss.builtin.red', 'Returns the red channel of `$color` as a number between 0 and 255.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#red' }]
	},
	{
		func: 'green($color)',
		desc: localize('scss.builtin.green', 'Returns the green channel of `$color` as a number between 0 and 255.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#green' }]
	},
	{
		func: 'mix($color, $color, [$weight])',
		desc: localize('scss.builtin.mix', 'Returns a number that’s a mixture of `$color1` and `$color2`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#mix' }]
	},
	{
		func: 'hue($color)',
		desc: localize('scss.builtin.hue', 'Returns the hue of `$color` as a number between `0deg` and `255deg`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#hue' }]
	},
	{
		func: 'saturation($color)',
		desc: localize(
			'scss.builtin.saturation',
			'Returns the HSL saturation of `$color` as a number between `0%` and `100%`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#saturation' }]
	},
	{
		func: 'lightness($color)',
		desc: localize(
			'scss.builtin.lightness',
			'Returns the HSL lightness of `$color` as a number between `0%` and `100%`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#lightness' }]
	},
	{
		func: 'lighten($color, $amount)',
		desc: localize('scss.builtin.lighten', 'Makes `$color` lighter.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#lighten' }]
	},
	{
		func: 'darken($color, $amount)',
		desc: localize('scss.builtin.darken', 'Makes `$color` darker.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#darken' }]
	},
	{
		func: 'saturate($color, $amount)',
		desc: localize('scss.builtin.saturate', 'Makes `$color` more saturated.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#saturate' }]
	},
	{
		func: 'desaturate($color, $amount)',
		desc: localize('scss.builtin.desaturate', 'Makes `$color` less saturated.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#desaturate' }]
	},
	{
		func: 'grayscale($color)',
		desc: localize('scss.builtin.grayscale', 'Returns a gray color with the same lightness as `$color`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#grayscale' }]
	},
	{
		func: 'complement($color)',
		desc: localize(
			'scss.builtin.complement',
			'Returns the RGB [complement](https://en.wikipedia.org/wiki/Complementary_colors) of `$color`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#complement' }]
	},
	{
		func: 'invert($color)',
		desc: localize(
			'scss.builtin.invert',
			'Returns the inverse or [negative](https://en.wikipedia.org/wiki/Negative_(photography)) of $color.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#invert' }]
	},
	{
		func: 'rgba($color, $alpha)',
		desc: localize('scss.builtin.rgba', 'Changes the alpha component for a color.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#rgba' }]
	},
	{
		func: 'opacify($color, $amount)',
		desc: localize('scss.builtin.opacify', 'Makes `$color` more opaque.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#opacify' }]
	},
	{
		func: 'fade-in($color, $amount)',
		desc: localize('scss.builtin.fade-in', 'Makes a color more opaque.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#fade-in' }]
	},
	{
		func: 'transparentize($color, $amount)',
		desc: localize('scss.builtin.transparentize', 'Makes a color more transparent.'),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#transparentize' }
		]
	},
	{
		func: 'fade-out($color, $amount)',
		desc: localize('scss.builtin.fade-out', 'Makes `$color` more transparent.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#fade-out' }]
	},
	{
		func: 'scale-color($color, [$red], [$green], [$blue], [$saturation], [$lightness], [$alpha])',
		desc: localize('scss.builtin.scale-color', 'Fluidly scales one or more properties of `$color`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#scale-color' }]
	},
	{
		func: 'change-color($color, [$red], [$green], [$blue], [$hue], [$saturation], [$lightness], [$alpha])',
		desc: localize('scss.builtin.change-color', 'Sets one or more properties of a color to new values.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#change-color' }]
	},
	{
		func: 'ie-hex-str($color)',
		desc: localize(
			'scss.builtin.ie-hex-str',
			'Returns an unquoted string that represents `$color` in the `#AARRGGBB` format expected by Internet Explorer’s [-ms-filter](https://developer.mozilla.org/en-US/docs/Web/CSS/-ms-filter) property.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/color#ie-hex-str' }]
	}
];

const selectorFunctions: IFunctionInfo[] = [
	{
		func: 'selector-nest($selectors…)',
		desc: localize(
			'scss.builtin.selector-nest',
			'Nests selector beneath one another like they would be nested in the stylesheet.'
		)
	},
	{
		func: 'selector-append($selectors…)',
		desc: localize('scss.builtin.selector-append', 'Appends selectors to one another without spaces in between.')
	},
	{
		func: 'selector-extend($selector, $extendee, $extender)',
		desc: localize('scss.builtin.selector-extend', 'Extends $extendee with $extender within $selector.')
	},
	{
		func: 'selector-replace($selector, $original, $replacement)',
		desc: localize('scss.builtin.selector-replace', 'Replaces $original with $replacement within $selector.')
	},
	{
		func: 'selector-unify($selector1, $selector2)',
		desc: localize(
			'scss.builtin.selector-unify',
			'Unifies two selectors to produce a selector that matches elements matched by both.'
		)
	},
	{
		func: 'is-superselector($super, $sub)',
		desc: localize(
			'scss.builtin.is-superselector',
			'Returns whether $super matches all the elements $sub does, and possibly more.'
		)
	},
	{
		func: 'simple-selectors($selector)',
		desc: localize('scss.builtin.simple-selectors', 'Returns the simple selectors that comprise a compound selector.')
	},
	{
		func: 'selector-parse($selector)',
		desc: localize('scss.builtin.selector-parse', 'Parses a selector into the format returned by &.')
	}
];

const builtInFunctions: IFunctionInfo[] = [
	{ func: 'unquote($string)', desc: localize('scss.builtin.unquote', 'Removes quotes from a string.') },
	{ func: 'quote($string)', desc: localize('scss.builtin.quote', 'Adds quotes to a string.') },
	{
		func: 'str-length($string)',
		desc: localize('scss.builtin.str-length', 'Returns the number of characters in a string.')
	},
	{
		func: 'str-insert($string, $insert, $index)',
		desc: localize('scss.builtin.str-insert', 'Inserts $insert into $string at $index.')
	},
	{
		func: 'str-index($string, $substring)',
		desc: localize('scss.builtin.str-index', 'Returns the index of the first occurance of $substring in $string.')
	},
	{
		func: 'str-slice($string, $start-at, [$end-at])',
		desc: localize('scss.builtin.str-slice', 'Extracts a substring from $string.')
	},
	{ func: 'to-upper-case($string)', desc: localize('scss.builtin.to-upper-case', 'Converts a string to upper case.') },
	{ func: 'to-lower-case($string)', desc: localize('scss.builtin.to-lower-case', 'Converts a string to lower case.') },
	{
		func: 'percentage($number)',
		desc: localize('scss.builtin.percentage', 'Converts a unitless number to a percentage.'),
		type: 'percentage'
	},
	{ func: 'round($number)', desc: localize('scss.builtin.round', 'Rounds a number to the nearest whole number.') },
	{ func: 'ceil($number)', desc: localize('scss.builtin.ceil', 'Rounds a number up to the next whole number.') },
	{
		func: 'floor($number)',
		desc: localize('scss.builtin.floor', 'Rounds a number down to the previous whole number.')
	},
	{ func: 'abs($number)', desc: localize('scss.builtin.abs', 'Returns the absolute value of a number.') },
	{ func: 'min($numbers)', desc: localize('scss.builtin.min', 'Finds the minimum of several numbers.') },
	{ func: 'max($numbers)', desc: localize('scss.builtin.max', 'Finds the maximum of several numbers.') },
	{ func: 'random([$limit])', desc: localize('scss.builtin.random', 'Returns a random number.') },
	{ func: 'length($list)', desc: localize('scss.builtin.length', 'Returns the length of a list.') },
	{ func: 'nth($list, $n)', desc: localize('scss.builtin.nth', 'Returns a specific item in a list.') },
	{ func: 'set-nth($list, $n, $value)', desc: localize('scss.builtin.set-nth', 'Replaces the nth item in a list.') },
	{
		func: 'join($list1, $list2, [$separator])',
		desc: localize('scss.builtin.join', 'Joins together two lists into one.')
	},
	{
		func: 'append($list1, $val, [$separator])',
		desc: localize('scss.builtin.append', 'Appends a single value onto the end of a list.')
	},
	{
		func: 'zip($lists)',
		desc: localize('scss.builtin.zip', 'Combines several lists into a single multidimensional list.')
	},
	{
		func: 'index($list, $value)',
		desc: localize('scss.builtin.index', 'Returns the position of a value within a list.')
	},
	{ func: 'list-separator(#list)', desc: localize('scss.builtin.list-separator', 'Returns the separator of a list.') },
	{
		func: 'map-get($map, $key)',
		desc: localize('scss.builtin.map-get', 'Returns the value in a map associated with a given key.')
	},
	{
		func: 'map-merge($map1, $map2)',
		desc: localize('scss.builtin.map-merge', 'Merges two maps together into a new map.')
	},
	{
		func: 'map-remove($map, $keys)',
		desc: localize('scss.builtin.map-remove', 'Returns a new map with keys removed.')
	},
	{ func: 'map-keys($map)', desc: localize('scss.builtin.map-keys', 'Returns a list of all keys in a map.') },
	{ func: 'map-values($map)', desc: localize('scss.builtin.map-values', 'Returns a list of all values in a map.') },
	{
		func: 'map-has-key($map, $key)',
		desc: localize('scss.builtin.map-has-key', 'Returns whether a map has a value associated with a given key.')
	},
	{
		func: 'keywords($args)',
		desc: localize('scss.builtin.keywords', 'Returns the keywords passed to a function that takes variable arguments.')
	},
	{
		func: 'feature-exists($feature)',
		desc: localize('scss.builtin.feature-exists', 'Returns whether a feature exists in the current Sass runtime.')
	},
	{
		func: 'variable-exists($name)',
		desc: localize(
			'scss.builtin.variable-exists',
			'Returns whether a variable with the given name exists in the current scope.'
		)
	},
	{
		func: 'global-variable-exists($name)',
		desc: localize(
			'scss.builtin.global-variable-exists',
			'Returns whether a variable with the given name exists in the global scope.'
		)
	},
	{
		func: 'function-exists($name)',
		desc: localize('scss.builtin.function-exists', 'Returns whether a function with the given name exists.')
	},
	{
		func: 'mixin-exists($name)',
		desc: localize('scss.builtin.mixin-exists', 'Returns whether a mixin with the given name exists.')
	},
	{
		func: 'inspect($value)',
		desc: localize(
			'scss.builtin.inspect',
			'Returns the string representation of a value as it would be represented in Sass.'
		)
	},
	{ func: 'type-of($value)', desc: localize('scss.builtin.type-of', 'Returns the type of a value.') },
	{ func: 'unit($number)', desc: localize('scss.builtin.unit', 'Returns the unit(s) associated with a number.') },
	{ func: 'unitless($number)', desc: localize('scss.builtin.unitless', 'Returns whether a number has units.') },
	{
		func: 'comparable($number1, $number2)',
		desc: localize('scss.builtin.comparable', 'Returns whether two numbers can be added, subtracted, or compared.')
	},
	{ func: 'call($name, $args…)', desc: localize('scss.builtin.call', 'Dynamically calls a Sass function.') }
];

const atDirectives = [
	{
		label: '@extend',
		documentation: localize('scss.builtin.@extend', 'Inherits the styles of another selector.'),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@at-root',
		documentation: localize(
			'scss.builtin.@at-root',
			'Causes one or more rules to be emitted at the root of the document.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@debug',
		documentation: localize(
			'scss.builtin.@debug',
			'Prints the value of an expression to the standard error output stream. Useful for debugging complicated Sass files.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@warn',
		documentation: localize(
			'scss.builtin.@warn',
			'Prints the value of an expression to the standard error output stream. Useful for libraries that need to warn users of deprecations or recovering from minor mixin usage mistakes. Warnings can be turned off with the `--quiet` command-line option or the `:quiet` Sass option.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@error',
		documentation: localize(
			'scss.builtin.@error',
			'Throws the value of an expression as a fatal error with stack trace. Useful for validating arguments to mixins and functions.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@if',
		documentation: localize(
			'scss.builtin.@if',
			'Includes the body if the expression does not evaluate to `false` or `null`.'
		),
		insertText: '@if ${1:expr} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@for',
		documentation: localize(
			'scss.builtin.@for',
			'For loop that repeatedly outputs a set of styles for each `$var` in the `from/through` or `from/to` clause.'
		),
		insertText: '@for \\$${1:var} from ${2:start} ${3|to,through|} ${4:end} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@each',
		documentation: localize(
			'scss.builtin.@each',
			'Each loop that sets `$var` to each item in the list or map, then outputs the styles it contains using that value of `$var`.'
		),
		insertText: '@each \\$${1:var} in ${2:list} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@while',
		documentation: localize(
			'scss.builtin.@while',
			'While loop that takes an expression and repeatedly outputs the nested styles until the statement evaluates to `false`.'
		),
		insertText: '@while ${1:condition} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@mixin',
		documentation: localize(
			'scss.builtin.@mixin',
			'Defines styles that can be re-used throughout the stylesheet with `@include`.'
		),
		insertText: '@mixin ${1:name} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@include',
		documentation: localize(
			'scss.builtin.@include',
			'Includes the styles defined by another mixin into the current rule.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@function',
		documentation: localize(
			'scss.builtin.@function',
			'Defines complex operations that can be re-used throughout stylesheets.'
		),
		kind: CompletionItemKind.Keyword
	}
];

interface CompletionItemWithReferences extends CompletionItem {
	references?: IReference[];
}

const scssAtDirectives: CompletionItemWithReferences[] = [
	{
		label: '@extend',
		documentation: localize('scss.builtin.@extend', 'Inherits the styles of another selector.'),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@at-root',
		documentation: localize(
			'scss.builtin.@at-root',
			'Causes one or more rules to be emitted at the root of the document.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@debug',
		documentation: localize(
			'scss.builtin.@debug',
			'Prints the value of an expression to the standard error output stream. Useful for debugging complicated Sass files.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@warn',
		documentation: localize(
			'scss.builtin.@warn',
			'Prints the value of an expression to the standard error output stream. Useful for libraries that need to warn users of deprecations or recovering from minor mixin usage mistakes. Warnings can be turned off with the `--quiet` command-line option or the `:quiet` Sass option.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@error',
		documentation: localize(
			'scss.builtin.@error',
			'Throws the value of an expression as a fatal error with stack trace. Useful for validating arguments to mixins and functions.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@if',
		documentation: localize(
			'scss.builtin.@if',
			'Includes the body if the expression does not evaluate to `false` or `null`.'
		),
		insertText: '@if ${1:expr} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@for',
		documentation: localize(
			'scss.builtin.@for',
			'For loop that repeatedly outputs a set of styles for each `$var` in the `from/through` or `from/to` clause.'
		),
		insertText: '@for \\$${1:var} from ${2:start} ${3|to,through|} ${4:end} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@each',
		documentation: localize(
			'scss.builtin.@each',
			'Each loop that sets `$var` to each item in the list or map, then outputs the styles it contains using that value of `$var`.'
		),
		insertText: '@each \\$${1:var} in ${2:list} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@while',
		documentation: localize(
			'scss.builtin.@while',
			'While loop that takes an expression and repeatedly outputs the nested styles until the statement evaluates to `false`.'
		),
		insertText: '@while ${1:condition} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@mixin',
		documentation: localize(
			'scss.builtin.@mixin',
			'Defines styles that can be re-used throughout the stylesheet with `@include`.'
		),
		insertText: '@mixin ${1:name} {\n\t$0\n}',
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@include',
		documentation: localize(
			'scss.builtin.@include',
			'Includes the styles defined by another mixin into the current rule.'
		),
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@function',
		documentation: localize(
			'scss.builtin.@function',
			'Defines complex operations that can be re-used throughout stylesheets.'
		),
		kind: CompletionItemKind.Keyword
	}
];

const moduleAtDirectives: CompletionItemWithReferences[] = [
	{
		label: '@use',
		documentation: localize(
			'scss.builtin.@use',
			"Loads mixins, functions, and variables from other Sass stylesheets as 'modules', and combines CSS from multiple stylesheets together."
		),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/at-rules/use' }],
		insertText: "@use '$0';",
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	},
	{
		label: '@forward',
		documentation: localize(
			'scss.builtin.@forward',
			'Loads a Sass stylesheet and makes its mixins, functions, and variables available when this stylesheet is loaded with the @use rule.'
		),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/at-rules/forward' }],
		insertText: "@forward '$0';",
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Keyword
	}
];

const builtinModules: CompletionItemWithReferences[] = [
	{
		label: 'sass:math',
		documentation: localize('scss.builtin.sass:math', 'Provides functions that operate on numbers.'),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/modules/math' }],
		kind: CompletionItemKind.Module
	},
	{
		label: 'sass:string',
		documentation: localize('scss.builtin.sass:string', 'Makes it easy to combine, search, or split apart strings.'),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/modules/string' }],
		kind: CompletionItemKind.Module
	},
	{
		label: 'sass:color',
		documentation: localize(
			'scss.builtin.sass:color',
			'Generates new colors based on existing ones, making it easy to build color themes.'
		),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/modules/color' }],
		kind: CompletionItemKind.Module
	},
	{
		label: 'sass:list',
		documentation: localize('scss.builtin.sass:list', 'Lets you access and modify values in lists.'),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/modules/list' }],
		kind: CompletionItemKind.Module
	},
	{
		label: 'sass:map',
		documentation: localize(
			'scss.builtin.sass:map',
			'Makes it possible to look up the value associated with a key in a map, and much more.'
		),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/modules/map' }],
		kind: CompletionItemKind.Module
	},
	{
		label: 'sass:selector',
		documentation: localize('scss.builtin.sass:selector', 'Provides access to Sass’s powerful selector engine.'),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/modules/selector' }],
		kind: CompletionItemKind.Module
	},
	{
		label: 'sass:meta',
		documentation: localize('scss.builtin.sass:meta', 'Exposes the details of Sass’s inner workings.'),
		references: [{ name: 'Sass documentation', url: 'https://sass-lang.com/documentation/modules/meta' }],
		kind: CompletionItemKind.Module
	}
];

const variableDefaults: { [key: string]: string } = {
	$red: '1',
	$green: '2',
	$blue: '3',
	$alpha: '1.0',
	$color: '#000000',
	$weight: '0.5',
	$hue: '0',
	$saturation: '0%',
	$lightness: '0%',
	$degrees: '0',
	$amount: '0',
	$string: '""',
	$substring: '"s"',
	$number: '0',
	$limit: '1'
};

function createReplaceFunction() {
	let tabStopCounter = 1;
	return (_match: string, p1: string) => {
		return '\\' + p1 + ': ${' + tabStopCounter++ + ':' + (variableDefaults[p1] || '') + '}';
	};
}

function functionToCompletionItem(proposal: IFunctionInfo): CompletionItem {
	const label = proposal.func.substr(0, proposal.func.indexOf('('));
	const insertText = proposal.func.replace(/\[?(\$\w+)\]?/g, createReplaceFunction());

	const item: CompletionItem = {
		label: label,
		detail: proposal.func,
		documentation: proposal.desc,
		insertText,
		insertTextFormat: InsertTextFormat.Snippet,
		kind: CompletionItemKind.Function
	};

	return item;
}

class SCSSDataManager {
	private _atDirectives: CompletionItem[];
	private _moduleAtDirectives: CompletionItem[];
	private _builtinModules: CompletionItem[];

	constructor() {
		this._atDirectives = atDirectives.map(i => {
			return {
				...i,
				documentation: computeReferenceDocumentation(i)
			};
		});

		this._moduleAtDirectives = moduleAtDirectives.map(i => {
			return {
				...i,
				documentation: computeReferenceDocumentation(i)
			};
		});

		this._builtinModules = builtinModules.map(i => {
			return {
				...i,
				documentation: computeReferenceDocumentation(i)
			};
		});
	}

	getColorFunctions(): CompletionItem[] {
		return colorFunctions.map(functionToCompletionItem);
	}

	getSelectorFunctions(): CompletionItem[] {
		return selectorFunctions.map(functionToCompletionItem);
	}

	getBuiltInFunctions(restrictions?: string[]): CompletionItem[] {
		if (!restrictions) {
			return builtInFunctions.map(functionToCompletionItem);
		}

		return builtInFunctions.filter(f => !f.type || restrictions.indexOf(f.type) !== -1).map(functionToCompletionItem);
	}

	getAtDirectives(): CompletionItem[] {
		return this._atDirectives;
	}

	getModuleAtDirectives(): CompletionItem[] {
		return this._moduleAtDirectives;
	}

	getBuiltinModules(): CompletionItem[] {
		return this._builtinModules;
	}
}

export const scssDataManager = new SCSSDataManager();

function computeReferenceDocumentation(i: CompletionItemWithReferences) {
	let markdownDoc: MarkupContent = { kind: 'markdown', value: '' };

	if (i.documentation) {
		markdownDoc =
			typeof i.documentation === 'string'
				? { kind: 'markdown', value: i.documentation }
				: { kind: 'markdown', value: i.documentation.value };
	}

	if (i.references && i.references.length > 0) {
		markdownDoc.value += '\n\n';
		markdownDoc.value += i.references
			.map(r => {
				return `[${r.name}](${r.url})`;
			})
			.join(' | ');
	}

	return markdownDoc;
}
