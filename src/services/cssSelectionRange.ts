/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Range, Position, TextDocument } from 'vscode-languageserver-types';
import { Stylesheet, NodeType } from '../parser/cssNodes';
import { SelectionRange, SelectionRangeKind } from '../cssLanguageTypes';

export function getSelectionRanges(document: TextDocument, positions: Position[], stylesheet: Stylesheet): SelectionRange[][] {
	function getSelectionRange(position: Position): SelectionRange[] {
		const applicableRanges = getApplicableRanges(position);
		const ranges = applicableRanges.map(pair => {
			return {
				range: Range.create(
					document.positionAt(pair[0]),
					document.positionAt(pair[1])
				),
				kind: SelectionRangeKind.Statement
			};
		});
		return ranges;
	}
	return positions.map(getSelectionRange);

	function getApplicableRanges(position: Position): number[][] {
		let currNode = stylesheet.findChildAtOffset(document.offsetAt(position), true);

		if (!currNode) {
			return [];
		}

		const result = [];

		while (currNode) {
			if (
				currNode.parent &&
				currNode.offset === currNode.parent.offset &&
				currNode.end === currNode.parent.end
			) {
				currNode = currNode.parent;
				continue;
			}

			if (currNode.type === NodeType.Declarations) {
				result.push([currNode.offset + 1, currNode.end - 1]);
			} else {
				result.push([currNode.offset, currNode.end]);
			}

			currNode = currNode.parent;
		}

		return result;
	}
}
