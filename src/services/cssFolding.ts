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
import { FoldingRangeList, FoldingRange, FoldingRangeType } from 'vscode-languageserver-protocol-foldingprovider';

export function getFoldingRegions(document: TextDocument): FoldingRangeList {
	function getStartLine(t: IToken) {
		return document.positionAt(t.offset).line;
	}
	function getEndLine(t: IToken) {
		return document.positionAt(t.offset + t.len).line;
	}
	function tokenToRange(t: IToken, type: FoldingRangeType = FoldingRangeType.Region): FoldingRange | null {
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
	const stack: number[] = [];

	const scanner = new Scanner();
	scanner.ignoreComment = false;
	scanner.setSource(document.getText());

	let token = scanner.scan();
	while (token.type !== TokenType.EOF) {
		const tt = TokenType[token.type];
		switch(token.type) {
			case TokenType.CurlyL: {
				stack.push(getStartLine(token));
				break;
			}
			case TokenType.CurlyR: {
				if (stack.length !== 0) {
					const startLine = stack.pop();
					const endLine = getEndLine(token);
					if (startLine !== endLine) {
						ranges.push({
							startLine,
							endLine,
							type: FoldingRangeType.Region
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
				const range = tokenToRange(token, FoldingRangeType.Comment);
				if (range) {
					ranges.push(range);
				}
				break;
			}
		}
		token = scanner.scan();
	}

	return {
		ranges
	};
}
