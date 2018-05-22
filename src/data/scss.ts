/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export const scssAtDirectives = [
	{
		name: "@extend",
		desc: "Inherits the styles of another selector."
	},
	{
		name: "@at-root",
		desc: "Causes one or more rules to be emitted at the root of the document."
	},
	{
		name: "@debug",
		desc:
			"Prints the value of an expression to the standard error output stream. Useful for debugging complicated Sass files."
	},
	{
		name: "@warn",
		desc:
			"Prints the value of an expression to the standard error output stream. Useful for libraries that need to warn users of deprecations or recovering from minor mixin usage mistakes. Warnings can be turned off with the `--quiet` command-line option or the `:quiet` Sass option."
	},
	{
		name: "@error",
		desc:
			"Throws the value of an expression as a fatal error with stack trace. Useful for validating arguments to mixins and functions."
	},
	{
		name: "@if",
		desc: "Includes the body if the expression does not evaluate to `false` or `null`."
	},
	{
		name: "@for",
		desc: "For loop that repeatedly outputs a set of styles for each `$var` in the `from/through` or `from/to` clause."
	},
	{
		name: "@each",
		desc:
			"Each loop that sets `$var` to each item in the list or map, then outputs the styles it contains using that value of `$var`."
	},
	{
		name: "@while",
		desc:
			"While loop that takes an expression and repeatedly outputs the nested styles until the statement evaluates to `false`."
	},
	{
		name: "@mixin",
		desc: "Defines styles that can be re-used throughout the stylesheet with `@include`."
	},
	{
		name: "@include",
		desc: "Includes the styles defined by another mixin into the current rule."
	}
];
