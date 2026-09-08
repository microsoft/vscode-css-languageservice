/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { TextDocument } from '../../cssLanguageTypes.js';
import { CSSDataManager } from '../../languageFacts/dataManager.js';
import { IRule, Level, Node } from '../../parser/cssNodes.js';
import { LintVisitor } from '../../services/lint.js';
import { LintConfigurationSettings } from '../../services/lintRules.js';

const cssDataManager = new CSSDataManager({ useDefaultDataProvider: true });

export function assertEntries(node: Node, document: TextDocument, expectedRules: IRule[], expectedMessages: string[] | undefined = undefined, settings = new LintConfigurationSettings()): void {
	const entries = LintVisitor.entries(node, document, settings, cssDataManager, Level.Error | Level.Warning | Level.Ignore);
	const message = `Did not find all linting error. expected: [${expectedRules.map(e => e.id).join(', ')}], actual: [${entries.map(e => e.getMessage()).join(', ')}]`;
	assert.equal(entries.length, expectedRules.length, message);
	for (const entry of entries) {
		const index = expectedRules.indexOf(entry.getRule());
		assert.ok(index !== -1, `${entry.getRule().id} found but not expected (${expectedRules.map(r => r.id).join(', ')})`);
		if (expectedMessages) {
			assert.equal(entry.getMessage(), expectedMessages[index]);
		}
	}
}
