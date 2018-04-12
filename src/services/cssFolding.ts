/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument, Position } from 'vscode-languageserver-types';
import { TokenType, Scanner, IToken } from '../parser/cssScanner';
import * as nodes from '../parser/cssNodes';
import { ParseError, CSSIssueType } from '../parser/cssErrors';
import * as languageFacts from './languageFacts';
import { FoldingRangeList, FoldingRange, FoldingRangeType } from '../protocol/foldingProvider.proposed';
import { SCSSScanner, InterpolationFunction } from '../parser/scssScanner';
import { LESSScanner } from '../parser/lessScanner';

export function getFoldingRegions(document: TextDocument): FoldingRangeList {
	function getStartLine(t: IToken) {
		return document.positionAt(t.offset).line;
	}
	function getEndLine(t: IToken) {
		return document.positionAt(t.offset + t.len).line;
	}
	function getScanner() {
		switch (document.languageId) {
			case 'scss':
				return new SCSSScanner();
			case 'less':
				return new LESSScanner();
			default:
				return new Scanner();
		}
	}
	function tokenToRange(t: IToken, type?: FoldingRangeType | string): FoldingRange | null {
		const startLine = getStartLine(t);
		const endLine = getEndLine(t);

		if (startLine !== endLine) {
			return {
				startLine,
				endLine,
				type
			};
		} else {
			return null;
		}
	}

	const ranges: FoldingRange[] = [];
	const braceStack: number[] = [];
	const regionCommentStack: number[] = [];

	const scanner = getScanner();
	scanner.ignoreComment = false;
	scanner.setSource(document.getText());

	let token = scanner.scan();
	let prevToken;
	while (token.type !== TokenType.EOF) {
		switch (token.type) {
			case TokenType.CurlyL:
			case InterpolationFunction:
				{
					braceStack.push(getStartLine(token));
					break;
				}
			case TokenType.CurlyR: {
				if (braceStack.length !== 0) {
					const startLine = braceStack.pop();
					let endLine = getEndLine(token);

					/**
					 * Other than the case when curly brace is not on a new line by itself, for example
					 * .foo {
					 *   color: red; }
					 * Use endLine minus one to show ending curly brace
					 */
					if (getEndLine(prevToken) !== endLine) {
						endLine--;
					}

					if (startLine !== endLine) {
						ranges.push({
							startLine,
							endLine,
							type: undefined
						});
					}
					break;
				}
			}
			/**
			 * In CSS, there is no single line comment prefixed with //
			 * All comments are marked as `Comment`
			 */
			case TokenType.Comment: {
				// CSS region folding
				if (token.text.match(/^\/\*\s+#region\s+\*\/$/)) {
					regionCommentStack.push(getStartLine(token));
				}
				if (token.text.match(/^\/\*\s+#endregion\s+\*\/$/)) {
					if (regionCommentStack.length !== 0) {
						const startLine = regionCommentStack.pop();
						const endLine = getEndLine(token);
						if (startLine !== endLine) {
							ranges.push({
								startLine,
								endLine,
								type: "region"
							});
						}
					}
				}

				// Scss / Less region folding
				if (document.languageId === 'scss' || document.languageId === 'less') {
					if (token.text.match(/^\/\/\s+#region\s*$/)) {
						regionCommentStack.push(getStartLine(token));
					}
					if (token.text.match(/^\/\/\s+#endregion\s*$/)) {
						if (regionCommentStack.length !== 0) {
							const startLine = regionCommentStack.pop();
							const endLine = getEndLine(token);
							if (startLine !== endLine) {
								ranges.push({
									startLine,
									endLine,
									type: "region"
								});
							}
						}
					}
				}

				const range = tokenToRange(token, 'comment');
				if (range) {
					ranges.push(range);
				}
				break;
			}

		}
		prevToken = token;
		token = scanner.scan();
	}

	return {
		ranges
	};
}
