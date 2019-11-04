/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as cssLanguageService from '../../cssLanguageService';

import { TextEdit, Range, Command, CodeAction, TextDocumentEdit } from 'vscode-languageserver-types';
import { TextDocument } from 'vscode-languageserver-textdocument';

suite('CSS - Code Actions', () => {

	let testCodeActions = function (value: string, tokenBefore: string, expected: { title: string; content: string; }[]) {
		let ls = cssLanguageService.getCSSLanguageService();

		let document = TextDocument.create('test://test/test.css', 'css', 0, value);
		let styleSheet = ls.parseStylesheet(document);
		let offset = value.indexOf(tokenBefore);
		let startPosition = document.positionAt(offset);
		let endPosition = document.positionAt(offset + tokenBefore.length);
		let range = Range.create(startPosition, endPosition);

		ls.configure({ validate: true });

		let diagnostics = ls.doValidation(document, styleSheet);
		let commands = ls.doCodeActions(document, range, { diagnostics }, styleSheet);
		assertCodeAction(commands, document, expected);

		let codeActions = ls.doCodeActions2(document, range, { diagnostics }, styleSheet);
		assertCodeAction2(codeActions, document, expected);
	};

	let assertCodeAction = function (commands: Command[], document: TextDocument, expected: { title: string; content: string; }[]) {
		let labels = commands.map(command => command.title);

		for (let exp of expected) {
			let index = labels.indexOf(exp.title);
			assert.ok(index !== -1, 'Quick fix not found: ' + exp.title + ' , found:' + labels.join(','));
			let command = commands[index];
			assert.equal(TextDocument.applyEdits(document, <TextEdit[]>command.arguments![2]), exp.content);
			assert.equal(command.arguments![0], document.uri);
			assert.equal(command.arguments![1], document.version);
		}
	};

	let assertCodeAction2 = function (codeActions: CodeAction[], document: TextDocument, expected: { title: string; content: string; }[]) {
		let labels = codeActions.map(command => command.title);

		for (let exp of expected) {
			let index = labels.indexOf(exp.title);
			assert.ok(index !== -1, 'Quick fix not found: ' + exp.title + ' , found:' + labels.join(','));
			let codeAction = codeActions[index];
			for (let change of codeAction.edit!.documentChanges!) {
				if (TextDocumentEdit.is(change)) {
					assert.equal(document.uri, change.textDocument.uri);
					assert.equal(TextDocument.applyEdits(document, change.edits), exp.content);
				} else {
					assert.ok(false, 'not a TextDocumentEdit');
				}

			}
		}
	};

	test('Unknown Properties', async function () {
		testCodeActions('body { /*here*/displai: inline }', '/*here*/', [
			{ title: 'Rename to \'display\'', content: 'body { /*here*/display: inline }' }
		]);
		testCodeActions('body { /*here*/background-colar: red }', '/*here*/', [
			{ title: 'Rename to \'background-color\'', content: 'body { /*here*/background-color: red }' },
			{ title: 'Rename to \'background-clip\'', content: 'body { /*here*/background-clip: red }' },
			{ title: 'Rename to \'background-origin\'', content: 'body { /*here*/background-origin: red }' }
		]);
	});
});
