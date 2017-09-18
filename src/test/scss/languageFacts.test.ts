/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { SCSSParser } from '../../parser/scssParser';
import { assertColor } from '../css/languageFacts.test';
import { colorFrom256RGB as newColor } from '../../services/languageFacts';

suite('SCSS - Language facts', () => {

	test('is color', function () {
		let parser = new SCSSParser();
		assertColor(parser, '#main { color: foo(red) }', 'red', newColor(0xff, 0, 0));
		assertColor(parser, '#main { color: red() }', 'red', null);
		assertColor(parser, '#main { red { nested: 1px } }', 'red', null);
		assertColor(parser, '#main { @include red; }', 'red', null);
		assertColor(parser, '#main { @include foo($f: red); }', 'red', newColor(0xff, 0, 0));
		assertColor(parser, '@function red($p) { @return 1px; }', 'red', null);
		assertColor(parser, '@function foo($p) { @return red; }', 'red', newColor(0xff, 0, 0));
		assertColor(parser, '@function foo($r: red) { @return $r; }', 'red', newColor(0xff, 0, 0));
		assertColor(parser, '#main { color: rgba($input-border, 0.7) }', 'rgba', null, true);
		assertColor(parser, '#main { color: rgba($input-border, 1, 1, 0.7) }', 'rgba', null, true);
	});

});

