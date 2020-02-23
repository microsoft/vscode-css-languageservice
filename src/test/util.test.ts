/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as assert from 'assert';
import { trim } from '../utils/strings';

suite('Util', () => {

	test('trim', function () {
		assert.equal(trim("test+-", /[ ]+$/), "test+-");
		assert.equal(trim("t est+-", /[ ]+$/), "t est+-");
		assert.equal(trim("test+- ", /[ ]+$/), "test+-");
		assert.equal(trim("test+- ", /[ \+]+$/), "test+-");
		assert.equal(trim("test+- ", /[ \+\-]+$/), "test");
		assert.equal(trim("test++- ", /[ \+\-]+$/), "test");
	});
});