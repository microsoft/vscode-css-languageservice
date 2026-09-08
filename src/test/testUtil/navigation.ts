/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'node:assert';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	Color, ColorInformation, DocumentHighlightKind, DocumentLink, DocumentSymbol, LanguageService,
	Position, Range, Stylesheet, SymbolInformation, TextDocument, TextEdit
} from '../../cssLanguageService.js';
import * as nodes from '../../parser/cssNodes.js';
import { GlobalScope, Scope, ScopeBuilder } from '../../parser/cssSymbolScope.js';
import { URI } from 'vscode-uri';
import { getDocumentContext } from './documentContext.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function assertScopesAndSymbols(ls: LanguageService, input: string, expected: string): void {
	assert.equal(scopeToString(createScope(ls, input)), expected);
}

export function assertHighlights(ls: LanguageService, input: string, marker: string, expectedMatches: number, expectedWrites: number, elementName?: string): void {
	const document = TextDocument.create('test://test/test.css', 'css', 0, input);
	const stylesheet = ls.parseStylesheet(document);
	assertNoErrors(stylesheet);
	const position = document.positionAt(input.indexOf(marker) + marker.length);
	const highlights = ls.findDocumentHighlights(document, position, stylesheet);
	assert.equal(highlights.length, expectedMatches, input);
	let writes = 0;
	for (const highlight of highlights) {
		if (highlight.kind === DocumentHighlightKind.Write) {
			writes++;
		}
		const start = document.offsetAt(highlight.range.start);
		const end = document.offsetAt(highlight.range.end);
		assert.equal(document.getText().substring(start, end), elementName || marker);
	}
	assert.equal(writes, expectedWrites, input);
}

export async function assertLinks(ls: LanguageService, input: string, expected: DocumentLink[], lang = 'css', testUri?: string, workspaceFolder?: string): Promise<void> {
	const document = TextDocument.create(testUri || `test://test/test.${lang}`, lang, 0, input);
	const stylesheet = ls.parseStylesheet(document);
	const links = await ls.findDocumentLinks2(document, stylesheet, getDocumentContext(workspaceFolder || 'test://test'));
	assert.deepEqual(links, expected);
}

export function assertSymbolInfos(ls: LanguageService, input: string, expected: SymbolInformation[], lang = 'css'): void {
	const document = TextDocument.create(`test://test/test.${lang}`, lang, 0, input);
	assert.deepEqual(ls.findDocumentSymbols(document, ls.parseStylesheet(document)), expected);
}

export function assertDocumentSymbols(ls: LanguageService, input: string, expected: DocumentSymbol[], lang = 'css'): void {
	const document = TextDocument.create(`test://test/test.${lang}`, lang, 0, input);
	assert.deepEqual(ls.findDocumentSymbols2(document, ls.parseStylesheet(document)), expected);
}

export function assertColorSymbols(ls: LanguageService, input: string, ...expected: ColorInformation[]): void {
	const document = TextDocument.create('test://test/test.css', 'css', 0, input);
	assert.deepEqual(ls.findDocumentColors(document, ls.parseStylesheet(document)), expected);
}

export function assertColorPresentations(ls: LanguageService, color: Color, ...expected: string[]): void {
	const document = TextDocument.create('test://test/test.css', 'css', 0, '');
	const range = newRange(1, 2);
	const result = ls.getColorPresentations(document, ls.parseStylesheet(document), color, range);
	assert.deepEqual(result.map(item => item.label), expected);
	assert.deepEqual(result.map(item => item.textEdit), expected.map(label => TextEdit.replace(range, label)));
}

export function assertSymbolsInScope(ls: LanguageService, input: string, offset: number, ...selections: { name: string; type: nodes.ReferenceType }[]): void {
	const global = createScope(ls, input);
	const scope = global.findScope(offset)!;
	for (const selection of selections) {
		const symbol = scope.getSymbol(selection.name, selection.type) || global.getSymbol(selection.name, selection.type);
		assert.ok(symbol, `symbol ${selection.name} not found. In scope: ${scope.getSymbols().map(item => item.name).join(' ')}`);
	}
}

export function assertScopeBuilding(ls: LanguageService, input: string, ...scopes: { offset: number; length: number }[]): void {
	const global = createScope(ls, input);
	function assertChildren(scope: Scope): void {
		for (const child of scope.children) {
			const expected = scopes.shift()!;
			assert.equal(child.offset, expected.offset);
			assert.equal(child.length, expected.length);
			assertChildren(child);
		}
	}
	assertChildren(global);
	assert.equal(scopes.length, 0, 'remaining scopes: ' + scopes.join());
}

export function getTestResource(resourcePath: string): string {
	return URI.file(join(__dirname, '../../../../test/linksTestFixtures', resourcePath)).toString(true);
}

export function newRange(start: number, end: number): Range {
	return Range.create(Position.create(0, start), Position.create(0, end));
}

function scopeToString(scope: Scope): string {
	const sections = scope.getSymbols().map(symbol => symbol.name);
	sections.push(...scope.children.map(child => `[${scopeToString(child)}]`));
	return sections.join(',');
}

function assertNoErrors(stylesheet: Stylesheet): void {
	const markers = nodes.ParseErrorCollector.entries(<nodes.Stylesheet>stylesheet);
	if (markers.length > 0) {
		assert.fail('node has errors: ' + markers[0].getMessage() + ', offset: ' + markers[0].getNode().offset);
	}
}

function createScope(ls: LanguageService, input: string): Scope {
	const document = TextDocument.create('test://test/test.css', 'css', 0, input);
	const stylesheet = ls.parseStylesheet(document);
	const global = new GlobalScope();
	assertNoErrors(stylesheet);
	(<nodes.Stylesheet>stylesheet).acceptVisitor(new ScopeBuilder(global));
	return global;
}
