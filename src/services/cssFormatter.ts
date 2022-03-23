/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { CSSFormatConfiguration, Range, TextEdit, Position, TextDocument } from '../cssLanguageTypes';
import { css_beautify, IBeautifyCSSOptions } from '../beautify/beautify-css';
import { repeat } from '../utils/strings';

export function format(document: TextDocument, range: Range | undefined, options: CSSFormatConfiguration): TextEdit[] {
	let value = document.getText();
	let includesEnd = true;
	let initialIndentLevel = 0;
	const tabSize = options.tabSize || 4;
	if (range) {
		let startOffset = document.offsetAt(range.start);

		// include all leading whitespace iff at the beginning of the line
		let extendedStart = startOffset;
		while (extendedStart > 0 && isWhitespace(value, extendedStart - 1)) {
			extendedStart--;
		}
		if (extendedStart === 0 || isEOL(value, extendedStart - 1)) {
			startOffset = extendedStart;
		} else {
			// else keep at least one whitespace
			if (extendedStart < startOffset) {
				startOffset = extendedStart + 1;
			}
		}

		// include all following whitespace until the end of the line
		let endOffset = document.offsetAt(range.end);
		let extendedEnd = endOffset;
		while (extendedEnd < value.length && isWhitespace(value, extendedEnd)) {
			extendedEnd++;
		}
		if (extendedEnd === value.length || isEOL(value, extendedEnd)) {
			endOffset = extendedEnd;
		}
		range = Range.create(document.positionAt(startOffset), document.positionAt(endOffset));

		// Do not modify if substring starts in inside an element
		// Ending inside an element is fine as it doesn't cause formatting errors
		const firstHalf = value.substring(0, startOffset);
		if (new RegExp(/.*[<][^>]*$/).test(firstHalf)) {
			//return without modification
			value = value.substring(startOffset, endOffset);
			return [{
				range: range,
				newText: value
			}];
		}

		includesEnd = endOffset === value.length;
		value = value.substring(startOffset, endOffset);

		if (startOffset !== 0) {
			const startOfLineOffset = document.offsetAt(Position.create(range.start.line, 0));
			initialIndentLevel = computeIndentLevel(document.getText(), startOfLineOffset, options);
		}
	} else {
		range = Range.create(Position.create(0, 0), document.positionAt(value.length));
	}
	const cssOptions: IBeautifyCSSOptions = {
		indent_size: tabSize,
		indent_char: options.insertSpaces ? ' ' : '\t',
		end_with_newline: includesEnd && getFormatOption(options, 'insertFinalNewline', false),
		selector_separator_newline: getFormatOption(options, 'newlineBetweenSelectors', true),
		newline_between_rules: getFormatOption(options, 'newlineBetweenRules', true),
		space_around_selector_separator: getFormatOption(options, 'spaceAroundSelectorSeparator', false)
	};

	let result = css_beautify(trimLeft(value), cssOptions);
	if (initialIndentLevel > 0) {
		const indent = options.insertSpaces ? repeat(' ', tabSize * initialIndentLevel) : repeat('\t', initialIndentLevel);
		result = result.split('\n').join('\n' + indent);
		if (range.start.character === 0) {
			result = indent + result; // keep the indent
		}
	}
	return [{
		range: range,
		newText: result
	}];
}

function trimLeft(str: string) {
	return str.replace(/^\s+/, '');
}

function getFormatOption(options: CSSFormatConfiguration, key: keyof CSSFormatConfiguration, dflt: any): any {
	if (options && options.hasOwnProperty(key)) {
		const value = options[key];
		if (value !== null) {
			return value;
		}
	}
	return dflt;
}

function computeIndentLevel(content: string, offset: number, options: CSSFormatConfiguration): number {
	let i = offset;
	let nChars = 0;
	const tabSize = options.tabSize || 4;
	while (i < content.length) {
		const ch = content.charAt(i);
		if (ch === ' ') {
			nChars++;
		} else if (ch === '\t') {
			nChars += tabSize;
		} else {
			break;
		}
		i++;
	}
	return Math.floor(nChars / tabSize);
}

function isEOL(text: string, offset: number) {
	return '\r\n'.indexOf(text.charAt(offset)) !== -1;
}

function isWhitespace(text: string, offset: number) {
	return ' \t'.indexOf(text.charAt(offset)) !== -1;
}
