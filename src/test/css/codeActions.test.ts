/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as cssLanguageService from '../../cssLanguageService';

import {CompletionList, TextDocument, TextEdit, Position, Range, Command} from 'vscode-languageserver-types';
import {applyEdits} from '../textEditSupport';

function asPromise<T>(result:T) : Promise<T> {
	return Promise.resolve(result);
}

suite('CSS - Code Actions', () => {
	
	let testCodeActions = function (value: string, tokenBefore: string): PromiseLike<{ commands: Command[]; document: TextDocument; }> {
		let ls = cssLanguageService.getCSSLanguageService();

		let document = TextDocument.create('test://test/test.css', 'css', 0, value);
		let styleSheet = ls.parseStylesheet(document);
		let offset = value.indexOf(tokenBefore);
		let startPosition = document.positionAt(offset);
		let endPosition = document.positionAt(offset + tokenBefore.length);
		let range = Range.create(startPosition, endPosition);

		ls.configure({ validate: true });

		return asPromise(ls.doValidation(document, styleSheet)).then(diagnostics => {
			return asPromise(ls.doCodeActions(document, range, { diagnostics }, styleSheet)).then(commands => {
				return { commands, document };
			});
		});
	};

	let assertCodeAction = function (commands: Command[], document: TextDocument, expected: { title: string; content: string; }[]) {
		let labels = commands.map(command => command.title);

		for (let exp of expected) {
			let index = labels.indexOf(exp.title);
			assert.ok(index !== -1, 'Quick fix not found: ' + exp.title + ' , found:' + labels.join(','));
			let command = commands[index];
			assert.equal(applyEdits(document, <TextEdit[]>command.arguments[2]), exp.content);
			assert.equal(command.arguments[0], document.uri);
			assert.equal(command.arguments[1], document.version);
		}
	};

	test('Unknown Properties', function (testDone): any {
		Promise.all([
			testCodeActions('body { /*here*/displai: inline }', '/*here*/').then((result) => {
				assertCodeAction(result.commands, result.document, [
					{ title: 'Rename to \'display\'', content: 'body { /*here*/display: inline }' }
				]);
			}),

			testCodeActions('body { /*here*/background-colar: red }', '/*here*/').then((result) => {
				assertCodeAction(result.commands, result.document, [
					{ title: 'Rename to \'background-color\'', content: 'body { /*here*/background-color: red }' },
					{ title: 'Rename to \'background-clip\'', content: 'body { /*here*/background-clip: red }' },
					{ title: 'Rename to \'background-image\'', content: 'body { /*here*/background-image: red }' }
				]);
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
});
