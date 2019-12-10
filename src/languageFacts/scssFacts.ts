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

// Color module: https://sass-lang.com/documentation/modules/color
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

// Selector module: https://sass-lang.com/documentation/modules/selector
const selectorFunctions: IFunctionInfo[] = [
	{
		func: 'selector-nest($selectors…)',
		desc: localize(
			'scss.builtin.selector-nest',
			'Combines `$selectors` as though they were nested within one another in the stylesheet.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#nest' }]
	},
	{
		func: 'selector-append($selectors…)',
		desc: localize(
			'scss.builtin.selector-append',
			'Combines `$selectors` without descendant combinators—that is, without whitespace between them.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#append' }]
	},
	{
		func: 'selector-extend($selector, $extendee, $extender)',
		desc: localize('scss.builtin.selector-extend', 'Extends `$selector` as with the `@extend` rule.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#extend' }]
	},
	{
		func: 'selector-replace($selector, $original, $replacement)',
		desc: localize(
			'scss.builtin.selector-replace',
			'Returns a copy of `$selector` with all instances of `$original` replaced by `$replacement`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#replace' }]
	},
	{
		func: 'selector-unify($selector1, $selector2)',
		desc: localize(
			'scss.builtin.selector-unify',
			'Returns a selector that matches only elements matched by both `$selector1` and `$selector2`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#unify' }]
	},
	{
		func: 'is-superselector($super, $sub)',
		desc: localize(
			'scss.builtin.is-superselector',
			'Returns whether the selector `$super` matches all the elements that the selector `$sub` matches.'
		),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#is-superselector' }
		]
	},
	{
		func: 'simple-selectors($selector)',
		desc: localize('scss.builtin.simple-selectors', 'Returns a list of simple selectors in `$selector`.'),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#simple-selectors' }
		]
	},
	{
		func: 'selector-parse($selector)',
		desc: localize('scss.builtin.selector-parse', 'Returns `$selector` in the selector value format.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/selector#parse' }]
	}
];

const builtInFunctions: IFunctionInfo[] = [
	// String module: https://sass-lang.com/documentation/modules/string
	{
		func: 'unquote($string)',
		desc: localize(
			'scss.builtin.unquote',
			'Returns `$string` as an unquoted string. This can produce strings that aren’t valid CSS, so use with caution.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#unquote' }]
	},
	{
		func: 'quote($string)',
		desc: localize('scss.builtin.quote', 'Returns `$string` as a quoted string.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#quote' }]
	},
	{
		func: 'str-length($string)',
		desc: localize('scss.builtin.str-length', 'Returns the number of characters in `$string`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#str-length' }]
	},
	{
		func: 'str-insert($string, $insert, $index)',
		desc: localize('scss.builtin.str-insert', 'Inserts $insert into $string at $index.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#str-insert' }]
	},
	{
		func: 'str-index($string, $substring)',
		desc: localize('scss.builtin.str-index', 'Returns the index of the first occurance of $substring in $string.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#str-index' }]
	},
	{
		func: 'str-slice($string, $start-at, [$end-at])',
		desc: localize(
			'scss.builtin.str-slice',
			'Returns the slice of `$string` starting at index `$start-at` and ending at index `$end-at` (both inclusive).'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#str-slice' }]
	},
	{
		func: 'to-upper-case($string)',
		desc: localize(
			'scss.builtin.to-upper-case',
			'Returns a copy of `$string` with the ASCII letters converted to upper case.'
		),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#to-upper-case' }
		]
	},
	{
		func: 'to-lower-case($string)',
		desc: localize(
			'scss.builtin.to-lower-case',
			'Returns a copy of `$string` with the ASCII letters converted to lower case.'
		),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/string#to-lower-case' }
		]
	},
	// Math module: https://sass-lang.com/documentation/modules/math
	{
		func: 'abs($number)',
		desc: localize(
			'scss.builtin.abs',
			'Returns the absolute value of `$number`. If `$number` is negative, this returns `-$number`, and if `$number` is positive, it returns `$number` as-is.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#abs' }]
	},
	{
		func: 'percentage($number)',
		desc: localize(
			'scss.builtin.percentage',
			'Converts a unitless `$number` (usually a decimal between 0 and 1) to a percentage.'
		),
		type: 'percentage',
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#percentage' }]
	},
	{
		func: 'round($number)',
		desc: localize('scss.builtin.round', 'Rounds `$number` to the nearest whole number.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#round' }]
	},
	{
		func: 'ceil($number)',
		desc: localize('scss.builtin.ceil', 'Rounds `$number` up to the next highest whole number.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#ceil' }]
	},
	{
		func: 'floor($number)',
		desc: localize('scss.builtin.floor', 'Rounds `$number` down to the next lowest whole number.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#floor' }]
	},
	{
		func: 'min($numbers)',
		desc: localize(
			'scss.builtin.min',
			'Returns the lowest of one or more numbers. A list of numbers can be passed using ...'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#min' }]
	},
	{
		func: 'max($numbers)',
		desc: localize(
			'scss.builtin.max',
			'Returns the highest of one or more numbers. A list of numbers can be passed using ...'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#max' }]
	},
	{
		func: 'random([$limit])',
		desc: localize(
			'scss.builtin.random',
			'If `$limit` is null, returns a random decimal number between 0 and 1.\n\nIf `$limit` is a number greater than or equal to 1, returns a random whole number between 1 and `$limit`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#random' }]
	},
	{
		func: 'comparable($number1, $number2)',
		desc: localize('scss.builtin.comparable', 'Returns whether `$number1` and `$number2` have compatible units.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#compatible' }]
	},
	{
		func: 'unit($number)',
		desc: localize('scss.builtin.unit', "Returns a string representation of `$number`'s units."),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#unit' }]
	},
	{
		func: 'unitless($number)',
		desc: localize('scss.builtin.unitless', 'Returns whether `$number` has no units.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/math#unitless' }]
	},

	// List module: https://sass-lang.com/documentation/modules/list
	{
		func: 'length($list)',
		desc: localize('scss.builtin.length', 'Returns the length of `$list`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#length' }]
	},
	{
		func: 'nth($list, $n)',
		desc: localize('scss.builtin.nth', 'Returns the element of `$list` at index `$n`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#nth' }]
	},
	{
		func: 'set-nth($list, $n, $value)',
		desc: localize('scss.builtin.set-nth', 'Combines every list in `$lists` into a single list of sub-lists.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#set-nth' }]
	},
	{
		func: 'join($list1, $list2, [$separator])',
		desc: localize(
			'scss.builtin.join',
			'Returns a new list containing the elements of `$list1` followed by the elements of `$list2`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#join' }]
	},
	{
		func: 'append($list1, $val, [$separator])',
		desc: localize('scss.builtin.append', 'Returns a copy of `$list` with `$val` added to the end.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#append' }]
	},
	{
		func: 'zip($lists)',
		desc: localize('scss.builtin.zip', 'Combines every list in `$lists` into a single list of sub-lists.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#zip' }]
	},
	{
		func: 'index($list, $value)',
		desc: localize('scss.builtin.index', 'Returns the index of `$value` in `$list`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#index' }]
	},
	{
		func: 'list-separator(#list)',
		desc: localize(
			'scss.builtin.list-separator',
			'Returns the name of the separator used by `$list`, either space or comma.\n\nIf `$list` doesn’t have a separator, returns space.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#separator' }]
	},
	{
		func: 'is-bracketed($list)',
		desc: localize('scss.builtin.is-bracketed', 'Returns whether `$list` has square brackets.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/list#is-bracketed' }]
	},

	// Map module: https://sass-lang.com/documentation/modules/map
	{
		func: 'map-get($map, $key)',
		desc: localize('scss.builtin.map-get', 'Returns the value in `$map` associated with `$key`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/map#get' }]
	},
	{
		func: 'map-merge($map1, $map2)',
		desc: localize(
			'scss.builtin.map-merge',
			'Returns a new map with all the keys and values from both `$map1` and `$map2`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/map#merge' }]
	},
	{
		func: 'map-remove($map, $keys)',
		desc: localize('scss.builtin.map-remove', 'Returns a copy of `$map` without any values associated with `$keys`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/map#remove' }]
	},
	{
		func: 'map-keys($map)',
		desc: localize('scss.builtin.map-keys', 'Returns a comma-separated list of all the keys in `$map`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/map#keys' }]
	},
	{
		func: 'map-values($map)',
		desc: localize('scss.builtin.map-values', 'Returns a comma-separated list of all the values in `$map`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/map#values' }]
	},
	{
		func: 'map-has-key($map, $key)',
		desc: localize('scss.builtin.map-has-key', 'Returns whether `$map` contains a value associated with `$key`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/map#has-key' }]
	},

	// Meta module: https://sass-lang.com/documentation/modules/meta
	/**
	 * Not handled yet; only usable through module support
	 * meta.load-css
	 * meta.module-functions
	 * meta.module-variables
	 */
	{
		func: 'call($function, $args…)',
		desc: localize('scss.builtin.call', 'Invokes `$function` with `$args` and returns the result.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#call' }]
	},
	{
		func: 'content-exists()',
		desc: localize(
			'scss.builtin.content-exists',
			'Returns whether the current mixin was passed a [@content block](https://sass-lang.com/documentation/at-rules/mixin#content-blocks).\n\nThrows an error if called outside of a mixin.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#content-exists' }]
	},
	{
		func: 'feature-exists($feature)',
		desc: localize(
			'scss.builtin.feature-exists',
			'Returns whether the current Sass implementation supports `$feature`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#feature-exists' }]
	},
	{
		func: 'function-exists($name)',
		desc: localize(
			'scss.builtin.function-exists',
			'Returns whether a function named `$name` is defined, either as a built-in function or a user-defined function.'
		),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#function-exists' }
		]
	},
	{
		func: 'get-function($name, $css, $module)',
		desc: localize(
			'scss.builtin.get-function',
			'Returns the [function](https://sass-lang.com/documentation/values/functions) named `$name`.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#get-function' }]
	},
	{
		func: 'global-variable-exists($name)',
		desc: localize(
			'scss.builtin.global-variable-exists',
			'Returns whether a [global variable](https://sass-lang.com/documentation/variables#scope) named `$name` (without the `$`) exists.'
		),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#global-variable-exists' }
		]
	},
	{
		func: 'inspect($value)',
		desc: localize('scss.builtin.inspect', 'Returns a string representation of `$value`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#inspect' }]
	},
	{
		func: 'keywords($args)',
		desc: localize(
			'scss.builtin.keywords',
			'Returns the keywords passed to a mixin or function that takes [arbitrary arguments](https://sass-lang.com/documentation/at-rules/mixin#taking-arbitrary-arguments). The `$args` argument must be an [argument list](https://sass-lang.com/documentation/values/lists#argument-lists).'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#keywords' }]
	},
	{
		func: 'mixin-exists($name)',
		desc: localize(
			'scss.builtin.mixin-exists',
			'Returns whether a [mixin](https://sass-lang.com/documentation/at-rules/mixin) named `$name` exists.'
		),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#mixin-exists' }]
	},
	{
		func: 'type-of($value)',
		desc: localize('scss.builtin.type-of', 'Returns the type of `$value`.'),
		references: [{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#type-of' }]
	},
	{
		func: 'variable-exists($name)',
		desc: localize(
			'scss.builtin.variable-exists',
			'Returns whether a variable named `$name` (without the `$`) exists in the current scope.'
		),
		references: [
			{ name: 'SASS documentation', url: 'https://sass-lang.com/documentation/modules/meta#variable-exists' }
		]
	}
];

interface CompletionItemWithReferences extends CompletionItem {
	references?: IReference[];
}

const atDirectives: CompletionItemWithReferences[] = [
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

export function getColorFunctions(): CompletionItem[] {
	return colorFunctions.map(functionToCompletionItem);
}

export function getSelectorFunctions(): CompletionItem[] {
	return selectorFunctions.map(functionToCompletionItem);
}

export function getBuiltInFunctions(restrictions?: string[]): CompletionItem[] {
	if (!restrictions) {
		return builtInFunctions.map(functionToCompletionItem);
	}

	return builtInFunctions.filter(f => !f.type || restrictions.indexOf(f.type) !== -1).map(functionToCompletionItem);
}

export function getAtDirectives(): CompletionItem[] {
	return atDirectives.map(i => {
		return {
			...i,
			documentation: computeReferenceDocumentation(i)
		};
	});
}

export function getModuleAtDirectives(): CompletionItem[] {
	return moduleAtDirectives.map(i => {
		return {
			...i,
			documentation: computeReferenceDocumentation(i)
		};
	});
}

export function getBuiltinModules(): CompletionItem[] {
	return builtinModules.map(i => {
		return {
			...i,
			documentation: computeReferenceDocumentation(i)
		};
	});
}

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
