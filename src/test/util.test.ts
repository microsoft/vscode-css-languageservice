/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { suite, test } from 'node:test';
import * as assert from 'node:assert';
import { difference, trim } from '../utils/strings.js';

suite('Util', () => {

	test('trim', function () {
		assert.equal(trim("test+-", /[ ]+$/), "test+-");
		assert.equal(trim("t est+-", /[ ]+$/), "t est+-");
		assert.equal(trim("test+- ", /[ ]+$/), "test+-");
		assert.equal(trim("test+- ", /[ \+]+$/), "test+-");
		assert.equal(trim("test+- ", /[ \+\-]+$/), "test");
		assert.equal(trim("test++- ", /[ \+\-]+$/), "test");
	});

	test('difference', function () {
		// The score is the longest common subsequence length minus the square
		// root of the length difference.
		assert.equal(difference('flot', 'float'), 4 - Math.sqrt(1));
		assert.equal(difference('flot', 'font'), 3 - Math.sqrt(0));
		// 'flot' and 'fill' share only 'fl'. A shared matrix row used to inflate
		// this to 3, tying it with 'font' and beating it on ordering.
		assert.equal(difference('flot', 'fill'), 2 - Math.sqrt(0));
		assert.equal(difference('clera', 'bleed'), 2 - Math.sqrt(0));

		// Identical and empty inputs.
		assert.equal(difference('float', 'float'), 5);
		assert.equal(difference('', ''), 0);
		// Beyond maxLenDelta the comparison is skipped entirely.
		assert.equal(difference('a', 'abcdefg'), 0);
	});
});