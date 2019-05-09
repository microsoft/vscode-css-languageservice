/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as assert from 'assert';
import { TextDocument, FoldingRange, FoldingRangeKind, Hover } from 'vscode-languageserver-types';
import { CSSHover } from '../../services/cssHover';
import { SCSSParser } from '../../parser/scssParser';

function assertSCSSHover(value: string, expected: Hover): void {
	const languageId = 'scss'

	let offset = value.indexOf('|');
	value = value.substr(0, offset) + value.substr(offset + 1);

	const hover = new CSSHover()
	const document = TextDocument.create(`test://foo/bar.${languageId}`, languageId, 1, value);
	const hoverResult = hover.doHover(document, document.positionAt(offset), new SCSSParser().parseStylesheet(document));

	if (hoverResult.range && expected.range) {
		assert.equal(hoverResult.range, expected.range);
	}
	assert.deepEqual(hoverResult.contents, expected.contents);
}

suite('SCSS Hover', () => {
	test('@at-root', () => {

		assertSCSSHover('.test { @|at-root { }', {
			contents: []
		})
	});
});
