/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as cssLanguageService from '../../cssLanguageService';

import { CompletionList, TextDocument, Position, CompletionItemKind, InsertTextFormat, Range, Command, MarkupContent } from 'vscode-languageserver-types';
import { LanguageSettings, PropertyCompletionContext, PropertyValueCompletionContext, URILiteralCompletionContext, ImportPathCompletionContext } from '../../cssLanguageTypes';

export interface ItemDescription {
	label: string;
	detail?: string;
	documentation?: string | MarkupContent | null;
	kind?: CompletionItemKind;
	insertTextFormat?: InsertTextFormat;
	resultText?: string;
	notAvailable?: boolean;
	command?: Command;
	sortText?: string;
}

function asPromise<T>(result: T): Promise<T> {
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
		assert.deepEqual(match.documentation, expected.documentation);
	}
	if (expected.kind) {
		assert.equal(match.kind, expected.kind);
	}
	if (expected.resultText) {
		assert.equal(TextDocument.applyEdits(document, [match.textEdit!]), expected.resultText);
	}
	if (expected.insertTextFormat) {
		assert.equal(match.insertTextFormat, expected.insertTextFormat);
	}
	if (expected.command) {
		assert.deepEqual(match.command, expected.command);
	}
	if (expected.sortText) {
		assert.equal(match.sortText, expected.sortText);
	}
};

suite('CSS - Completion', () => {

	let testCompletionFor = function (value: string, expected: { count?: number, items?: ItemDescription[], participant?: { onProperty?: PropertyCompletionContext[], onPropertyValue?: PropertyValueCompletionContext[], onURILiteralValue?: URILiteralCompletionContext[], onImportPath?: ImportPathCompletionContext[] } }, settings?: LanguageSettings) {
		let offset = value.indexOf('|');
		value = value.substr(0, offset) + value.substr(offset + 1);

		let actualPropertyContexts: PropertyCompletionContext[] = [];
		let actualPropertyValueContexts: PropertyValueCompletionContext[] = [];
		let actualURILiteralValueContexts: URILiteralCompletionContext[] = [];
		let actualImportPathContexts: ImportPathCompletionContext[] = [];

		let ls = cssLanguageService.getCSSLanguageService();
		ls.configure(settings);

		if (expected.participant) {
			ls.setCompletionParticipants([{
				onCssProperty: context => actualPropertyContexts.push(context),
				onCssPropertyValue: context => actualPropertyValueContexts.push(context),
				onCssURILiteralValue: context => actualURILiteralValueContexts.push(context),
				onCssImportPath: context => actualImportPathContexts.push(context)
			}]);
		}

		let document = TextDocument.create('test://test/test.css', 'css', 0, value);
		let position = Position.create(0, offset);
		let jsonDoc = ls.parseStylesheet(document);
		let list = ls.doComplete(document, position, jsonDoc);
		if (typeof expected.count === 'number') {
			assert.equal(list.items, expected.count);
		}
		if (expected.items) {
			for (let item of expected.items) {
				assertCompletion(list, item, document, offset);
			}
		}
		if (expected.participant) {
			if (expected.participant.onProperty) {
				assert.deepEqual(actualPropertyContexts, expected.participant.onProperty);
			}
			if (expected.participant.onPropertyValue) {
				assert.deepEqual(actualPropertyValueContexts, expected.participant.onPropertyValue);
			}
			if (expected.participant.onURILiteralValue) {
				assert.deepEqual(actualURILiteralValueContexts, expected.participant.onURILiteralValue);
			}
			if (expected.participant.onImportPath) {
				assert.deepEqual(actualImportPathContexts, expected.participant.onImportPath);
			}
		}
	};

	test('stylesheet', function (): any {
		testCompletionFor('| ', {
			items: [
				{ label: '@import', resultText: '@import ' },
				{ label: '@keyframes', resultText: '@keyframes ' },
				{ label: 'div', resultText: 'div ' }
			]
		});
		testCompletionFor('| body {', {
			items: [
				{ label: '@import', resultText: '@import body {' },
				{ label: '@keyframes', resultText: '@keyframes body {' },
				{ label: 'html', resultText: 'html body {' }
			]
		});
		testCompletionFor('h| {', {
			items: [
				{ label: 'html', resultText: 'html {' }
			]
		});
		testCompletionFor('.foo |{ ', {
			items: [
				{ label: 'html', resultText: '.foo html{ ' },
				{ notAvailable: true, label: 'display' }
			]
		});
	});
	test('selectors', function (): any {
		testCompletionFor('a:h| ', {
			items: [
				{ label: ':hover', resultText: 'a:hover ' },
				{ label: '::after', resultText: 'a::after ' }
			]
		});
		testCompletionFor('a::h| ', {
			items: [
				{ label: ':hover', resultText: 'a:hover ' },
				{ label: '::after', resultText: 'a::after ' }
			]
		});
		testCompletionFor('a::| ', {
			items: [
				{ label: ':hover', resultText: 'a:hover ' },
				{ label: '::after', resultText: 'a::after ' }
			]
		});
		testCompletionFor('a:| ', {
			items: [
				{ label: ':hover', resultText: 'a:hover ' },
				{ label: '::after', resultText: 'a::after ' }
			]
		});
		testCompletionFor('a:|hover ', {
			items: [
				{ label: ':hover', resultText: 'a:hover ' },
				{ label: '::after', resultText: 'a::after ' }
			]
		});
		testCompletionFor('a#| ', {
			items: [
				{ label: ':hover', resultText: 'a:hover ' },
				{ label: '::after', resultText: 'a::after ' }
			]
		});
		testCompletionFor('a.| ', {
			items: [
				{ label: ':hover', resultText: 'a:hover ' },
				{ label: '::after', resultText: 'a::after ' }
			]
		});
		testCompletionFor('.a:| ', {
			items: [
				{ label: ':hover', resultText: '.a:hover ' },
				{ label: '::after', resultText: '.a::after ' }
			]
		});
	});
	test('properties', function (): any {
		testCompletionFor('body {|', {
			items: [
				{ label: 'display', resultText: 'body {display: ' },
				{ label: 'background', resultText: 'body {background: ' }
			]
		});
		testCompletionFor('body { ver|', {
			items: [
				{ label: 'vertical-align', resultText: 'body { vertical-align: ' }
			]
		});
		testCompletionFor('body { vertical-ali|gn', {
			items: [
				{ label: 'vertical-align', resultText: 'body { vertical-align: ' }
			]
		});
		testCompletionFor('body { vertical-align|', {
			items: [
				{ label: 'vertical-align', resultText: 'body { vertical-align: ' }
			]
		});
		testCompletionFor('body { vertical-align|: bottom;}', {
			items: [
				{ label: 'vertical-align', resultText: 'body { vertical-align: bottom;}' }
			]
		});
		testCompletionFor('body { trans| ', {
			items: [
				{ label: 'transition', resultText: 'body { transition:  ' }
			]
		});
	});
	test('MDN properties', function (): any {
		testCompletionFor('body { m|', {
			items: [
				{ label: 'mask', resultText: 'body { mask: ' },
				{ label: 'mask-border', resultText: 'body { mask-border: ' },
				{ label: '-webkit-mask', resultText: 'body { -webkit-mask: ' }
			]
		});
	});
	test('values', function (): any {
		testCompletionFor('body { vertical-align:| bottom;}', {
			items: [
				{ label: 'bottom', resultText: 'body { vertical-align:bottom bottom;}' },
				{ label: '0cm', resultText: 'body { vertical-align:0cm bottom;}' }
			]
		});
		testCompletionFor('body { vertical-align: |bottom;}', {
			items: [
				{ label: 'bottom', resultText: 'body { vertical-align: bottom;}' },
				{ label: '0cm', resultText: 'body { vertical-align: 0cm;}' }
			]
		});
		testCompletionFor('body { vertical-align: bott|', {
			items: [
				{ label: 'bottom', resultText: 'body { vertical-align: bottom' }
			]
		});
		testCompletionFor('body { vertical-align: bott|om }', {
			items: [
				{ label: 'bottom', resultText: 'body { vertical-align: bottom }' }
			]
		});
		testCompletionFor('body { vertical-align: bottom| }', {
			items: [
				{ label: 'bottom', resultText: 'body { vertical-align: bottom }' }
			]
		});
		testCompletionFor('body { vertical-align:bott|', {
			items: [
				{ label: 'bottom', resultText: 'body { vertical-align:bottom' }
			]
		});
		testCompletionFor('body { vertical-align: bottom|; }', {
			items: [
				{ label: 'bottom', resultText: 'body { vertical-align: bottom; }' }
			]
		});
		testCompletionFor('body { vertical-align: bottom;| }', {
			count: 0
		});
		testCompletionFor('body { vertical-align: bottom; |}', {
			items: [
				{ label: 'display', resultText: 'body { vertical-align: bottom; display: }' }
			]
		});
		testCompletionFor('.head { background-image: |}', {
			items: [
				{ label: 'url()', resultText: '.head { background-image: url($1)}' }
			]
		});
		testCompletionFor('#id { justify-content: |', {
			items: [
				{ label: 'center', resultText: '#id { justify-content: center' },
				{ label: 'start', resultText: '#id { justify-content: start' },
				{ label: 'end', resultText: '#id { justify-content: end' },
				{ label: 'left', resultText: '#id { justify-content: left' },
				{ label: 'right', resultText: '#id { justify-content: right' },
				{ label: 'space-evenly', resultText: '#id { justify-content: space-evenly' }
			]
		});
		testCompletionFor('.foo { te:n| }', {
			items: [
				{ label: 'n', notAvailable: true }
			]
		});
	});
	test('functions', function (): any {
		testCompletionFor('@keyframes fadeIn { 0% { transform: s|', {
			items: [
				{ label: 'scaleX()', resultText: '@keyframes fadeIn { 0% { transform: scaleX($1)', insertTextFormat: InsertTextFormat.Snippet }
			]
		});
	});
	test('positions', function (): any {
		testCompletionFor('html { background-position: t|', {
			items: [
				{ label: 'top', resultText: 'html { background-position: top' },
				{ label: 'right', resultText: 'html { background-position: right' }
			]
		});
	});
	test('units', function (): any {
		testCompletionFor('body { vertical-align: 9| }', {
			items: [
				{ label: '9cm', resultText: 'body { vertical-align: 9cm }' }
			]
		});
		testCompletionFor('body { vertical-align: 1.2| }', {
			items: [
				{ label: '1.2em', resultText: 'body { vertical-align: 1.2em }' }
			]
		});
		testCompletionFor('body { vertical-align: 1|0 }', {
			items: [
				{ label: '1cm', resultText: 'body { vertical-align: 1cm }' }
			]
		});
		testCompletionFor('body { vertical-align: 10c| }', {
			items: [
				{ label: '10cm', resultText: 'body { vertical-align: 10cm }' }
			]
		});
		testCompletionFor('body { top: -2px| }', {
			items: [
				{ label: '-2px', resultText: 'body { top: -2px }' }
			]
		});
	});
	test('unknown', function (): any {
		testCompletionFor('body { notexisting: |;}', {
			count: 0
		});
		testCompletionFor('.foo { unknown: foo; } .bar { unknown:| }', {
			items: [
				{ label: 'foo', kind: CompletionItemKind.Value, resultText: '.foo { unknown: foo; } .bar { unknown:foo }' }
			]
		});
	});
	test('colors', function (): any {
		testCompletionFor('body { border-right: |', {
			items: [
				{ label: 'cyan', resultText: 'body { border-right: cyan' },
				{ label: 'dotted', resultText: 'body { border-right: dotted' },
				{ label: '0em', resultText: 'body { border-right: 0em' }
			]
		});
		testCompletionFor('body { border-right: cyan| dotted 2em ', {
			items: [
				{ label: 'cyan', resultText: 'body { border-right: cyan dotted 2em ' },
				{ label: 'darkcyan', resultText: 'body { border-right: darkcyan dotted 2em ' }
			]
		});
		testCompletionFor('body { border-right: dotted 2em |', {
			items: [
				{ label: 'cyan', resultText: 'body { border-right: dotted 2em cyan' }
			]
		});
		testCompletionFor('.foo { background-color: #123456; } .bar { background-color:| }', {
			items: [
				{ label: '#123456', kind: CompletionItemKind.Color, resultText: '.foo { background-color: #123456; } .bar { background-color:#123456 }' }
			]
		});
		testCompletionFor('.bar { background-color: #123| }', {
			items: [
				{ label: '#123', notAvailable: true }
			]
		});
		testCompletionFor('.foo { background-color: r|', {
			items: [
				{ label: 'rgb', kind: CompletionItemKind.Function, resultText: '.foo { background-color: rgb(${1:red}, ${2:green}, ${3:blue})' },
				{ label: 'rgba', kind: CompletionItemKind.Function, resultText: '.foo { background-color: rgba(${1:red}, ${2:green}, ${3:blue}, ${4:alpha})' },
				{ label: 'red', kind: CompletionItemKind.Color, resultText: '.foo { background-color: red' }
			]
		});
	});
	test('variables', function (): any {
		testCompletionFor(':root { --myvar: red; } body { color: |', {
			items: [
				{ label: '--myvar', documentation: 'red', resultText: ':root { --myvar: red; } body { color: var(--myvar)' },
			]
		});
		testCompletionFor('body { --myvar: 0px; border-right: var| ', {
			items: [
				{ label: '--myvar', documentation: '0px', resultText: 'body { --myvar: 0px; border-right: var(--myvar) ' },
			]
		});
		testCompletionFor('body { --myvar: 0px; border-right: var(| ', {
			items: [
				{ label: '--myvar', documentation: '0px', resultText: 'body { --myvar: 0px; border-right: var(--myvar ' },
			]
		});
		testCompletionFor('a { color: | } :root { --bg-color: red; } ', {
			items: [
				{ label: '--bg-color', documentation: 'red', resultText: 'a { color: var(--bg-color) } :root { --bg-color: red; } ' },
			]
		});
	});
	test('support', function (): any {
		testCompletionFor('@supports (display: flex) { |', {
			items: [
				{ label: 'html', resultText: '@supports (display: flex) { html' },
				{ label: 'display', notAvailable: true }
			]
		});
		testCompletionFor('@supports (| ) { }', {
			items: [
				{ label: 'display', resultText: '@supports (display:  ) { }' },
			]
		});
		testCompletionFor('@supports (di| ) { }', {
			items: [
				{ label: 'display', resultText: '@supports (display:  ) { }' },
			]
		});
		testCompletionFor('@supports (display: | ) { }', {
			items: [
				{ label: 'flex', resultText: '@supports (display: flex ) { }' },
			]
		});
		testCompletionFor('@supports (display: flex ) | { }', {
			items: [
				{ label: 'display', notAvailable: true },
			]
		});
		testCompletionFor('@supports |(display: flex ) { }', {
			items: [
				{ label: 'display', notAvailable: true },
			]
		});
	});

	test('suggestParticipants', function (): any {
		testCompletionFor('html { bac|', {
			participant: {
				onProperty: [{ propertyName: 'bac', range: newRange(7, 10) }],
				onPropertyValue: []
			}
		});
		testCompletionFor('html { disp|lay: none', {
			participant: {
				onProperty: [{ propertyName: 'disp', range: newRange(7, 11) }],
				onPropertyValue: []
			}
		});
		testCompletionFor('html { background-position: t|', {
			items: [
				{ label: 'center' },
			],
			participant: {
				onProperty: [],
				onPropertyValue: [{ propertyName: 'background-position', propertyValue: 't', range: newRange(28, 29) }]
			}
		});

		testCompletionFor(`html { background-image: url(|)`, {
			count: 0,
			participant: {
				onURILiteralValue: [{ uriValue: '', position: Position.create(0, 29), range: newRange(29, 29) }]
			}
		});
		testCompletionFor(`html { background-image: url('|')`, {
			count: 0,
			participant: {
				onURILiteralValue: [{ uriValue: `''`, position: Position.create(0, 30), range: newRange(29, 31) }]
			}
		});
		testCompletionFor(`html { background-image: url("b|")`, {
			count: 0,
			participant: {
				onURILiteralValue: [{ uriValue: `"b"`, position: Position.create(0, 31), range: newRange(29, 32) }]
			}
		});
		testCompletionFor(`html { background: url("b|"`, {
			count: 0,
			participant: {
				onURILiteralValue: [{ uriValue: `"b"`, position: Position.create(0, 25), range: newRange(23, 26) }]
			}
		});

		testCompletionFor(`@import './|'`, {
			count: 0,
			participant: {
				onImportPath: [{ pathValue: `'./'`, position: Position.create(0, 11), range: newRange(8, 12)}]
			}
		});
		testCompletionFor(`@import "./|";`, {
			count: 0,
			participant: {
				onImportPath: [{ pathValue: `"./"`, position: Position.create(0, 11), range: newRange(8, 12)}]
			}
		});
		testCompletionFor(`@import "./|foo";`, {
			count: 0,
			participant: {
				onImportPath: [{ pathValue: `"./foo"`, position: Position.create(0, 11), range: newRange(8, 15)}]
			}
		});
	});

	test('Property completeness', () => {
		testCompletionFor('html { text-decoration:|', {
			items: [
				{ label: 'none' }
			]
		});
		testCompletionFor('body { disp| ', {
			items: [
				{ label: 'display', resultText: 'body { display:  ', command: { title: 'Suggest', command: 'editor.action.triggerSuggest' } }
			]
		});
		testCompletionFor('body { disp| ', {
			items: [
				{ label: 'display', resultText: 'body { display:  ', command: { title: 'Suggest', command: 'editor.action.triggerSuggest' } }
			]
		}, {});
		testCompletionFor('body { disp| ', {
			items: [
				{ label: 'display', resultText: 'body { display:  ', command: { title: 'Suggest', command: 'editor.action.triggerSuggest' } }
			]
		}, { completion: undefined });
		testCompletionFor('body { disp| ', {
			items: [
				{ label: 'display', resultText: 'body { display:  ', command: { title: 'Suggest', command: 'editor.action.triggerSuggest' } }
			]
		}, { completion: { triggerPropertyValueCompletion: true } });
		testCompletionFor('body { disp| ', {
			items: [
				{ label: 'display', resultText: 'body { display:  ', command: undefined }
			]
		}, { completion: { triggerPropertyValueCompletion: false } });
	});

	test('Completion description should include status, browser compat and references', () => {
		testCompletionFor('.foo { | }', {
			items: [
				{
					label: 'contain',
					documentation: {
						kind: 'markdown',
						value:
							'⚠️ Property is experimental. Be cautious when using it.️\n\nIndicates that an element and its contents are, as much as possible, independent of the rest of the document tree.\n(Firefox 41, Chrome 52, Opera 40)\n\nSyntax: none | strict | content | [ size || layout || style || paint ]\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/contain)'
					}
				},
				{
					label: 'user-select',
					documentation: {
						kind: 'markdown',
						value:
							'🚨️ Property is nonstandard. Avoid using it.\n\nControls the appearance of selection.\n\nSyntax: auto | text | none | contain | all\n\n[MDN Reference](https://developer.mozilla.org/docs/Web/CSS/user-select)'
					}
				}
			]
		});
	});
	
	test(`Color swatch for variables that's color`, () => {
		testCompletionFor('.foo { --foo: #bbb; color: --| }', {
			items: [
				{
					label: '--foo',
					documentation: '#bbb',
					kind: CompletionItemKind.Color
				}
			]
		});
		
		testCompletionFor('.foo { --foo: #bbbbbb; color: --| }', {
			items: [
				{
					label: '--foo',
					documentation: '#bbbbbb',
					kind: CompletionItemKind.Color
				}
			]
		});
		
		testCompletionFor('.foo { --foo: red; color: --| }', {
			items: [
				{
					label: '--foo',
					documentation: 'red',
					kind: CompletionItemKind.Color
				}
			]
		});
		
		testCompletionFor('.foo { --foo: RED; color: --| }', {
			items: [
				{
					label: '--foo',
					documentation: 'RED',
					kind: CompletionItemKind.Color
				}
			]
		});
	});


	// https://github.com/Microsoft/vscode/issues/71791
	test('Items that start with `-` are sorted lower than normal attribute values', () => {
		testCompletionFor('.foo { display: | }', {
			items: [
				{ label: 'grid', sortText: 'd' },
				{ label: '-moz-grid', sortText: 'x' },
				{ label: '-ms-grid', sortText: 'x' }
			]
		});
	});

});

function newRange(start: number, end: number) {
	return Range.create(Position.create(0, start), Position.create(0, end));
}
