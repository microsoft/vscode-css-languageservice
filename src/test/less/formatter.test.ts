/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { getLESSLanguageService } from '../../cssLanguageService';
import { assertFormat } from '../css/formatter.test';

suite('LESS - Formatter', () => {

	const lessLS = getLESSLanguageService();

	test('full document', () => {
		var content = [
			'@leftwrap:200px;',
			'.box-shadow(@x:0, @y:0, @blur:1px, @color:#000){',
			'-webkit-box-shadow: @arguments;',
			'}'
		].join('\n');

		var expected = [
			'@leftwrap: 200px;',
			'',
			'.box-shadow(@x: 0, @y: 0, @blur: 1px, @color: #000) {',
			'  -webkit-box-shadow: @arguments;',
			'}'
		].join('\n');

		assertFormat(content, expected, undefined, lessLS);
	});


});
