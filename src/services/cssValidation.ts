/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import { LintConfigurationSettings, Rules } from './lintRules';
import { LintVisitor } from './lint';
import { TextDocument, Range, Diagnostic, DiagnosticSeverity, LanguageSettings } from '../cssLanguageTypes';
import { CSSDataManager } from '../languageFacts/dataManager';

export class CSSValidation {

	private settings?: LanguageSettings;

	constructor(private cssDataManager: CSSDataManager) {
	}

	public configure(settings?: LanguageSettings) {
		this.settings = settings;
	}

	public doValidation(document: TextDocument, stylesheet: nodes.Stylesheet, settings: LanguageSettings | undefined = this.settings): Diagnostic[] {
		if (settings && settings.validate === false) {
			return [];
		}

		const entries: nodes.IMarker[] = [];
		entries.push.apply(entries, nodes.ParseErrorCollector.entries(stylesheet));
		entries.push.apply(entries, LintVisitor.entries(stylesheet, document, new LintConfigurationSettings(settings && settings.lint), this.cssDataManager));

		const ruleIds: string[] = [];
		for (const r in Rules) {
			ruleIds.push(Rules[r as keyof typeof Rules].id);
		}

		function toDiagnostic(marker: nodes.IMarker): Diagnostic {
			const range = Range.create(document.positionAt(marker.getOffset()), document.positionAt(marker.getOffset() + marker.getLength()));
			const source = document.languageId;

			return <Diagnostic>{
				code: marker.getRule().id,
				source: source,
				message: marker.getMessage(),
				severity: marker.getLevel() === nodes.Level.Warning ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error,
				range: range
			};
		}

		return entries.filter(entry => entry.getLevel() !== nodes.Level.Ignore).map(toDiagnostic);
	}
}
