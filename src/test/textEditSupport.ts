/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {TextDocument, TextEdit} from 'vscode-languageserver-types';
import * as assert from 'assert';

export function applyEdits(document: TextDocument, edits: TextEdit[]): string {
	let text = document.getText();
	let sortedEdits = edits.sort((a, b) => {
		let diff = b.range.start.line - a.range.start.line;
		if (diff === 0) {
			diff = b.range.start.character - a.range.start.character;
			if (diff === 0 && b.newText.length + a.newText.length === 0) { // two inserts at the same location
				diff = edits.indexOf(b) - edits.indexOf(a);
			}
		}
		return diff;
	});
	let lastOffset = text.length;
	sortedEdits.forEach(e => {
		let startOffset = document.offsetAt(e.range.start);
		let endOffset = document.offsetAt(e.range.end);
		text = text.substring(0, startOffset) + e.newText + text.substring(endOffset, text.length);
		lastOffset = startOffset;
	});
	return text;
}