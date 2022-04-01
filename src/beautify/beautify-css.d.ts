/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface IBeautifyCSSOptions {
    indent_size?: number; // (4) — indentation size,
    indent_char?: string; // (space) — character to indent with,
    selector_separator_newline?: boolean; // (true) - separate selectors with newline or not (e.g. "a,\nbr" or "a, br")
    end_with_newline?: boolean; // (false) - end with a newline
    newline_between_rules?: boolean; // (true) - add a new line after every css rule
    space_around_selector_separator?: boolean // (false) - ensure space around selector separators:  '>', '+', '~' (e.g. "a>b" -> "a > b")
    brace_style?: 'collapse' | 'expand'; // (collapse) - place braces on the same line (collapse) or on a new line (expand)
    preserve_newlines?: boolean; // (true) - whether existing line breaks before elements should be preserved
    max_preserve_newlines?: number; // (32786) - maximum number of line breaks to be preserved in one chunk
    wrap_line_length?: number; // (undefined) - warp lines after a line offset
    indent_empty_lines?: number; // (false) - indent empty lines

}

export interface IBeautifyCSS {
	(value:string, options:IBeautifyCSSOptions): string;
}

export declare var css_beautify:IBeautifyCSS;