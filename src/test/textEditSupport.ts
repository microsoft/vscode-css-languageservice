/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { TextDocument, TextEdit } from 'vscode-languageserver-types';
import * as assert from 'assert';

export function applyEdits(document: TextDocument, edits: TextEdit[]): string {
	let text = document.getText();
	let sortedEdits = mergeSort(edits, (a, b) => {
		let diff = a.range.start.line - b.range.start.line;
		if (diff === 0) {
			return a.range.start.character - b.range.start.character;
		}
		return 0;
	});
	let lastModifiedOffset = text.length;
	for (let i = sortedEdits.length - 1; i >= 0; i--) {
		let e = sortedEdits[i];
		let startOffset = document.offsetAt(e.range.start);
		let endOffset = document.offsetAt(e.range.end);
		if (endOffset <= lastModifiedOffset) {
			text = text.substring(0, startOffset) + e.newText + text.substring(endOffset, text.length);
		} else {
			throw new Error('Ovelapping edit');
		}
		lastModifiedOffset = startOffset;
	}
	return text;
}

function mergeSort<T>(data: T[], compare: (a: T, b: T) => number): T[] {
	_divideAndMerge(data, compare);
	return data;
}

function _divideAndMerge<T>(data: T[], compare: (a: T, b: T) => number): void {
	if (data.length <= 1) {
		// sorted
		return;
	}
	const p = (data.length / 2) | 0;
	const left = data.slice(0, p);
	const right = data.slice(p);

	_divideAndMerge(left, compare);
	_divideAndMerge(right, compare);

	let leftIdx = 0;
	let rightIdx = 0;
	let i = 0;
	while (leftIdx < left.length && rightIdx < right.length) {
		let ret = compare(left[leftIdx], right[rightIdx]);
		if (ret <= 0) {
			// smaller_equal -> take left to preserve order
			data[i++] = left[leftIdx++];
		} else {
			// greater -> take right
			data[i++] = right[rightIdx++];
		}
	}
	while (leftIdx < left.length) {
		data[i++] = left[leftIdx++];
	}
	while (rightIdx < right.length) {
		data[i++] = right[rightIdx++];
	}
}
