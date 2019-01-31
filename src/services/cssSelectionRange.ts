/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Range, Position, TextDocument } from 'vscode-languageserver-types';
import { Stylesheet, NodeType } from '../parser/cssNodes';

export function getSelectionRanges(document: TextDocument, position: Position, stylesheet: Stylesheet): Range[] {
	const applicableRanges = getApplicableRanges(document, position, stylesheet);
	const ranges = applicableRanges.map(pair => {
		return Range.create(
			document.positionAt(pair[0]),
			document.positionAt(pair[1])
		);
	});
	return ranges;
}

export function getApplicableRanges(document: TextDocument, position: Position, stylesheet: Stylesheet): number[][] {
	let currNode = stylesheet.findChildAtOffset(document.offsetAt(position), true);
	
	if (!currNode) {
		return [];
	}
	
	let result = [];
	
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
