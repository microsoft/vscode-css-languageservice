/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import { difference } from '../utils/strings';
import { Rules } from '../services/lintRules';
import {
	Range, CodeActionContext, Diagnostic, Command, TextEdit, CodeAction, WorkspaceEdit, CodeActionKind,
	TextDocumentEdit, VersionedTextDocumentIdentifier, TextDocument, ICSSDataProvider
} from '../cssLanguageTypes';
import * as nls from 'vscode-nls';
import { CSSDataManager } from '../languageFacts/dataManager';

const localize = nls.loadMessageBundle();

export class CSSCodeActions {

	constructor(private readonly cssDataManager: CSSDataManager) {
	}

	public doCodeActions(document: TextDocument, range: Range, context: CodeActionContext, stylesheet: nodes.Stylesheet): Command[] {
		return this.doCodeActions2(document, range, context, stylesheet).map(ca => {
			const textDocumentEdit: TextDocumentEdit | undefined = ca.edit && ca.edit.documentChanges && ca.edit.documentChanges[0] as TextDocumentEdit;
			return Command.create(ca.title, '_css.applyCodeAction', document.uri, document.version, textDocumentEdit && textDocumentEdit.edits);
		});
	}

	public doCodeActions2(document: TextDocument, range: Range, context: CodeActionContext, stylesheet: nodes.Stylesheet): CodeAction[] {
		const result: CodeAction[] = [];
		if (context.diagnostics) {
			for (const diagnostic of context.diagnostics) {
				this.appendFixesForMarker(document, stylesheet, diagnostic, result);
			}
		}
		return result;
	}

	private getFixesForUnknownProperty(document: TextDocument, property: nodes.Property, marker: Diagnostic, result: CodeAction[]): void {

		interface RankedProperty {
			property: string;
			score: number;
		}

		const propertyName = property.getName();
		const candidates: RankedProperty[] = [];

		this.cssDataManager.getProperties().forEach(p => {
			const score = difference(propertyName, p.name);
			if (score >= propertyName.length / 2 /*score_lim*/) {
				candidates.push({ property: p.name, score });
			}
		});

		// Sort in descending order.
		candidates.sort((a: RankedProperty, b: RankedProperty) => {
			return b.score - a.score || a.property.localeCompare(b.property);
		});

		let maxActions = 3;
		for (const candidate of candidates) {
			const propertyName = candidate.property;
			const title = localize('css.codeaction.rename', "Rename to '{0}'", propertyName);
			const edit = TextEdit.replace(marker.range, propertyName);
			const documentIdentifier = VersionedTextDocumentIdentifier.create(document.uri, document.version);
			const workspaceEdit: WorkspaceEdit = { documentChanges: [TextDocumentEdit.create(documentIdentifier, [edit])] };
			const codeAction = CodeAction.create(title, workspaceEdit, CodeActionKind.QuickFix);
			codeAction.diagnostics = [marker];
			result.push(codeAction);
			if (--maxActions <= 0) {
				return;
			}
		}
	}

	private appendFixesForMarker(document: TextDocument, stylesheet: nodes.Stylesheet, marker: Diagnostic, result: CodeAction[]): void {

		if (marker.code !== Rules.UnknownProperty.id) {
			return;
		}
		const offset = document.offsetAt(marker.range.start);
		const end = document.offsetAt(marker.range.end);
		const nodepath = nodes.getNodePath(stylesheet, offset);

		for (let i = nodepath.length - 1; i >= 0; i--) {
			const node = nodepath[i];
			if (node instanceof nodes.Declaration) {
				const property = (<nodes.Declaration>node).getProperty();
				if (property && property.offset === offset && property.end === end) {
					this.getFixesForUnknownProperty(document, property, marker, result);
					return;
				}
			}
		}
	}

}
