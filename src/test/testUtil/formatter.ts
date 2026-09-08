/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { getCSSLanguageService, LanguageService, Range, TextDocument } from '../../cssLanguageService.js';
import { CSSFormatConfiguration } from '../../cssLanguageTypes.js';

export function assertFormat(unformatted: string, expected: string, options: CSSFormatConfiguration = { tabSize: 2, insertSpaces: true }, ls: LanguageService = getCSSLanguageService()) {
	let range: Range | undefined;
	const uri = 'test://test.html';
	const rangeStart = unformatted.indexOf('|');
	const rangeEnd = unformatted.lastIndexOf('|');
	if (rangeStart !== -1 && rangeEnd !== -1) {
		unformatted = unformatted.substring(0, rangeStart) + unformatted.substring(rangeStart + 1, rangeEnd) + unformatted.substring(rangeEnd + 1);
		const unformattedDoc = TextDocument.create(uri, 'html', 0, unformatted);
		range = Range.create(unformattedDoc.positionAt(rangeStart), unformattedDoc.positionAt(rangeEnd - 1));
	}

	const document = TextDocument.create(uri, 'html', 0, unformatted);
	const formatted = TextDocument.applyEdits(document, ls.format(document, range, options));
	assert.strictEqual(formatted, expected);
}
