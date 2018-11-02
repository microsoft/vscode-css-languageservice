/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import { TextDocument, Range, Diagnostic, DiagnosticSeverity } from 'vscode-languageserver-types';
import { LintConfigurationSettings, Rules } from './lintRules';
import { LintVisitor } from './lint';
import { LanguageSettings } from '../cssLanguageTypes';

export class CSSValidation {

	private settings: LanguageSettings;

	constructor() {
	}

	public configure(settings: LanguageSettings) {
		this.settings = settings;
	}

	public doValidation(document: TextDocument, stylesheet: nodes.Stylesheet, settings: LanguageSettings = this.settings): Diagnostic[] {
		if (settings && settings.validate === false) {
			return [];
		}

		let entries: nodes.IMarker[] = [];
		entries.push.apply(entries, nodes.ParseErrorCollector.entries(stylesheet));
		entries.push.apply(entries, LintVisitor.entries(stylesheet, document, new LintConfigurationSettings(settings && settings.lint)));

		const ruleIds: string[] = [];
		for (let r in Rules) {
			ruleIds.push(Rules[r].id);
		}

		function toDiagnostic(marker: nodes.IMarker): Diagnostic {
			let range = Range.create(document.positionAt(marker.getOffset()), document.positionAt(marker.getOffset() + marker.getLength()));
			let source = document.languageId;

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
