/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Rule } from '../../services/lintRules';
import { assertEntries } from '../css/lint.test';
import { SCSSParser } from '../../parser/scssParser';
import { TextDocument } from '../../cssLanguageTypes';

function assertRuleSet(input: string, ...rules: Rule[]): void {
	let p = new SCSSParser();
	let document = TextDocument.create('test://test/test.scss', 'scss', 0, input);
	let node = p.internalParse(input, p._parseRuleset)!;
	assertEntries(node, document, rules);
}

suite('LESS - Lint', () => {

	test('unknown properties', function () {
		assertRuleSet('selector { box-shadow+: 0 0 20px black; }');
		assertRuleSet('selector { transform+_: rotate(15deg); }');
	});

});
