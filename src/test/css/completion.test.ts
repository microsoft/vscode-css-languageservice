/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as cssLanguageService from '../../cssLanguageService';

import {CompletionList, TextDocument, TextEdit, Position, CompletionItemKind} from 'vscode-languageserver-types';
import {applyEdits} from '../textEditSupport';

export interface ItemDescription {
	label: string;
	detail?: string;
	documentation?: string;
	kind?: CompletionItemKind;
	resultText?: string;
	notAvailable?: boolean
}

function asPromise<T>(result:T) : Promise<T> {
	return Promise.resolve(result);
}

export let assertCompletion = function (completions: CompletionList, expected: ItemDescription, document: TextDocument, offset: number) {
	let matches = completions.items.filter(completion => {
		return completion.label === expected.label;
	});
	if (expected.notAvailable) {
		assert.equal(matches.length, 0, expected.label + " should not be present");
	} else {
		assert.equal(matches.length, 1, expected.label + " should only existing once: Actual: " + completions.items.map(c => c.label).join(', '));
	}

	let match = matches[0];
	if (expected.detail) {
		assert.equal(match.detail, expected.detail);
	}
	if (expected.documentation) {
		assert.equal(match.documentation, expected.documentation);
	}
	if (expected.kind) {
		assert.equal(match.kind, expected.kind);
	}
	if (expected.resultText) {
		assert.equal(applyEdits(document, [ match.textEdit ]), expected.resultText);
	}
};

suite('CSS - Completion', () => {

	let testCompletionFor = function (value: string, expected: { count?: number, items?: ItemDescription[] }): PromiseLike<void> {
		let offset = value.indexOf('|');
		value = value.substr(0, offset) + value.substr(offset + 1);

		let ls = cssLanguageService.getCSSLanguageService();

		let document = TextDocument.create('test://test/test.css', 'css', 0, value);
		let position = Position.create(0, offset);
		let jsonDoc = ls.parseStylesheet(document);
		return asPromise(ls.doComplete(document, position, jsonDoc)).then(list => {
			if (expected.count) {
				assert.equal(list.items, expected.count);
			}
			if (expected.items) {
				for (let item of expected.items) {
					assertCompletion(list, item, document, offset);
				}
			}
		});
	};

	test('sylesheet', function (testDone): any {
		Promise.all([
			testCompletionFor('| ', {
				items: [
					{ label: '@import', resultText: '@import ' },
					{ label: '@keyframes', resultText: '@keyframes ' },
					{ label: 'div', resultText: 'div ' }
				]
			}),
			testCompletionFor('| body {', {
				items: [
					{ label: '@import', resultText: '@import body {' },
					{ label: '@keyframes', resultText: '@keyframes body {' },
					{ label: 'html', resultText: 'html body {' }
				]
			}),
			testCompletionFor('h| {', {
				items: [
					{ label: 'html', resultText: 'html {' }
				]
			}),
			testCompletionFor('@|import url("something.css");', {
				count: 0
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
	test('selectors', function (testDone): any {
		Promise.all([
			testCompletionFor('a:h| ', {
				items: [
					{ label: ':hover', resultText: 'a:hover ' },
					{ label: '::after', resultText: 'a::after ' }
				]
			}),
			testCompletionFor('a::h| ', {
				items: [
					{ label: ':hover', resultText: 'a:hover ' },
					{ label: '::after', resultText: 'a::after ' }
				]
			}),
			testCompletionFor('a::| ', {
				items: [
					{ label: ':hover', resultText: 'a:hover ' },
					{ label: '::after', resultText: 'a::after ' }
				]
			}),
			testCompletionFor('a:| ', {
				items: [
					{ label: ':hover', resultText: 'a:hover ' },
					{ label: '::after', resultText: 'a::after ' }
				]
			}),
			testCompletionFor('a:|hover ', {
				items: [
					{ label: ':hover', resultText: 'a:hover ' },
					{ label: '::after', resultText: 'a::after ' }
				]
			}),
			testCompletionFor('a#| ', {
				items: [
					{ label: ':hover', resultText: 'a:hover ' },
					{ label: '::after', resultText: 'a::after ' }
				]
			}),
			testCompletionFor('a.| ', {
				items: [
					{ label: ':hover', resultText: 'a:hover ' },
					{ label: '::after', resultText: 'a::after ' }
				]
			}),
			testCompletionFor('.a:| ', {
				items: [
					{ label: ':hover', resultText: '.a:hover ' },
					{ label: '::after', resultText: '.a::after ' }
				]
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
	test('properties', function (testDone): any {
		Promise.all([
			testCompletionFor('body {|', {
				items: [
					{ label: 'display', resultText: 'body {display: ' },
					{ label: 'background', resultText: 'body {background: ' }
				]
			}),
			testCompletionFor('body { ver|', {
				items: [
					{ label: 'vertical-align', resultText: 'body { vertical-align: ' }
				]
			}),
			testCompletionFor('body { vertical-ali|gn', {
				items: [
					{ label: 'vertical-align', resultText: 'body { vertical-align: ' }
				]
			}),
			testCompletionFor('body { vertical-align|', {
				items: [
					{ label: 'vertical-align', resultText: 'body { vertical-align: ' }
				]
			}),
			testCompletionFor('body { vertical-align|: bottom;}',{
				items: [
					{ label: 'vertical-align', resultText: 'body { vertical-align: bottom;}' }
				]
			}),
			testCompletionFor('body { trans| ', {
				items: [
					{ label: 'transition', resultText: 'body { transition:  ' }
				]
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
	test('values', function (testDone): any {
		Promise.all([
			testCompletionFor('body { vertical-align:| bottom;}', {
				items: [
					{ label: 'bottom', resultText: 'body { vertical-align:bottom bottom;}' },
					{ label: '0cm', resultText: 'body { vertical-align:0cm bottom;}' }
				]
			}),
			testCompletionFor('body { vertical-align: |bottom;}', {
				items: [
					{ label: 'bottom', resultText: 'body { vertical-align: bottom;}' },
					{ label: '0cm', resultText: 'body { vertical-align: 0cm;}' }
				]
			}),
			testCompletionFor('body { vertical-align: bott|', {
				items: [
					{ label: 'bottom', resultText: 'body { vertical-align: bottom' }
				]
			}),
			testCompletionFor('body { vertical-align: bott|om }', {
				items: [
					{ label: 'bottom', resultText: 'body { vertical-align: bottom }' }
				]
			}),
			testCompletionFor('body { vertical-align: bottom| }', {
				items: [
					{ label: 'bottom', resultText: 'body { vertical-align: bottom }' }
				]
			}),
			testCompletionFor('body { vertical-align:bott|', {
				items: [
					{ label: 'bottom', resultText: 'body { vertical-align:bottom' }
				]
			}),
			testCompletionFor('body { vertical-align: bottom|; }', {
				items: [
					{ label: 'bottom', resultText: 'body { vertical-align: bottom; }' }
				]
			}),
			testCompletionFor('body { vertical-align: bottom;| }', {
				count: 0
			}),
			testCompletionFor('body { vertical-align: bottom; |}', {
				items: [
					{ label: 'display', resultText: 'body { vertical-align: bottom; display: }' }
				]
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
	test('units', function (testDone): any {
		Promise.all([
			testCompletionFor('body { vertical-align: 9| }', {
				items: [
					{ label: '9cm', resultText: 'body { vertical-align: 9cm }' }
				]
			}),
			testCompletionFor('body { vertical-align: 1.2| }', {
				items: [
					{ label: '1.2em', resultText: 'body { vertical-align: 1.2em }' } 
				]
			}),
			testCompletionFor('body { vertical-align: 1|0 }', {
				items: [
					{ label: '1cm', resultText: 'body { vertical-align: 1cm }' }
				]
			}),
			testCompletionFor('body { vertical-align: 10c| }', {
				items: [
					{ label: '10cm', resultText: 'body { vertical-align: 10cm }' }
				]
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
	test('unknown', function (testDone): any {
		Promise.all([
			testCompletionFor('body { notexisting: |;}', {
				count: 0
			}),
			testCompletionFor('.foo { unknown: foo; } .bar { unknown:| }', {
				items: [
					{ label: 'foo', kind: CompletionItemKind.Value, resultText: '.foo { unknown: foo; } .bar { unknown:foo }' }
				]
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
	test('colors', function (testDone): any {
		Promise.all([
			testCompletionFor('body { border-right: |', {
				items: [
					{ label: 'cyan', resultText: 'body { border-right: cyan' },
					{ label: 'dotted', resultText: 'body { border-right: dotted' },
					{ label: '0em', resultText: 'body { border-right: 0em' }
				]
			}),
			testCompletionFor('body { border-right: cyan| dotted 2em ', {
				items: [
					{ label: 'cyan', resultText: 'body { border-right: cyan dotted 2em ' },
					{ label: 'darkcyan', resultText: 'body { border-right: darkcyan dotted 2em ' }
				]
			}),
			testCompletionFor('body { border-right: dotted 2em |', {
				items: [
					{ label: 'cyan', resultText: 'body { border-right: dotted 2em cyan'  }
				]
			}),
			testCompletionFor('.foo { background-color: #123456; } .bar { background-color:| }', {
				items: [
					{ label: '#123456', kind: CompletionItemKind.Color, resultText: '.foo { background-color: #123456; } .bar { background-color:#123456 }' }
				]
			}),
			testCompletionFor('.foo { background-color: r|', {
				items: [
					{ label: 'rgb', kind: CompletionItemKind.Function, resultText: '.foo { background-color: rgb(${1:red}, ${2:green}, ${3:blue})' },
					{ label: 'rgba', kind: CompletionItemKind.Function, resultText: '.foo { background-color: rgba(${1:red}, ${2:green}, ${3:blue}, ${4:alpha})' },
					{ label: 'red', kind: CompletionItemKind.Color, resultText: '.foo { background-color: red' }
				]
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
	test('variables', function (testDone): any {
		Promise.all([
			testCompletionFor(':root { --myvar: red; } body { color: |', {
				items: [
					{ label: '--myvar', documentation: 'red', resultText: ':root { --myvar: red; } body { color: var(--myvar)' },
				]
			}),
			testCompletionFor('body { --myvar: 0px; border-right: var| ', {
				items: [
					{ label: '--myvar', documentation: '0px', resultText: 'body { --myvar: 0px; border-right: var(--myvar) ' },
				]
			}),
			testCompletionFor('body { --myvar: 0px; border-right: var(| ', {
				items: [
					{ label: '--myvar', documentation: '0px', resultText: 'body { --myvar: 0px; border-right: var(--myvar ' },
				]
			}),
			testCompletionFor('a { color: | } :root { --bg-color: red; } ', {
				items: [
					{ label: '--bg-color', documentation: 'red', resultText: 'a { color: var(--bg-color) } :root { --bg-color: red; } ' },
				]
			})
		]).then(() => testDone(), (error) => testDone(error));
	});
});

