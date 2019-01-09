/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import * as languageFacts from './languageFacts';
import { difference } from '../utils/strings';
import { Rules } from '../services/lintRules';
import { TextDocument, Range, CodeActionContext, Diagnostic, Command, TextEdit, CodeAction, WorkspaceEdit, CodeActionKind, TextDocumentEdit, VersionedTextDocumentIdentifier } from 'vscode-languageserver-types';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class CSSCodeActions {

	constructor() {
	}

	public doCodeActions(document: TextDocument, range: Range, context: CodeActionContext, stylesheet: nodes.Stylesheet): Command[] {
		return this.doCodeActions2(document, range, context, stylesheet).map(ca => {
			return Command.create(ca.title, '_css.applyCodeAction', document.uri, document.version, (<TextDocumentEdit> ca.edit.documentChanges[0]).edits);
		});
	}

	public doCodeActions2(document: TextDocument, range: Range, context: CodeActionContext, stylesheet: nodes.Stylesheet): CodeAction[] {
		let result: CodeAction[] = [];
		if (context.diagnostics) {
			for (let diagnostic of context.diagnostics) {
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

		let propertyName = property.getName();
		let candidates: RankedProperty[] = [];
		for (let p in languageFacts.builtinCSSDataSet.properties) {
			let score = difference(propertyName, p);
			if (score >= propertyName.length / 2 /*score_lim*/) {
				candidates.push({ property: p, score });
			}
		}

		// Sort in descending order.
		candidates.sort((a, b) => {
			return b.score - a.score;
		});

		let maxActions = 3;
		for (let candidate of candidates) {
			let propertyName = candidate.property;
			let title = localize('css.codeaction.rename', "Rename to '{0}'", propertyName);
			let edit = TextEdit.replace(marker.range, propertyName);
			let documentIdentifier = VersionedTextDocumentIdentifier.create(document.uri, document.version);
			let workspaceEdit: WorkspaceEdit = { documentChanges: [TextDocumentEdit.create(documentIdentifier, [edit])] };
			let codeAction = CodeAction.create(title, workspaceEdit, CodeActionKind.QuickFix);
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
		let offset = document.offsetAt(marker.range.start);
		let end = document.offsetAt(marker.range.end);
		let nodepath = nodes.getNodePath(stylesheet, offset);

		for (let i = nodepath.length - 1; i >= 0; i--) {
			let node = nodepath[i];
			if (node instanceof nodes.Declaration) {
				let property = (<nodes.Declaration>node).getProperty();
				if (property && property.offset === offset && property.end === end) {
					this.getFixesForUnknownProperty(document, property, marker, result);
					return;
				}
			}
		}
	}

}

