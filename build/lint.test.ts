/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import path from 'node:path';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

type LintRule = 'naming-convention' | 'curly' | 'eqeqeq' | 'no-throw-literal';

interface LintDiagnostic {
	sourceFile: ts.SourceFile;
	node: ts.Node;
	message: string;
	rule: LintRule;
}

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const configPath = path.join(root, 'src', 'tsconfig.json');

test('source files pass lint checks', () => {
	const diagnostics = lintProject(configPath);
	assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics));
});

test('type-like names use PascalCase', () => {
	assert.deepEqual(lintSource('type invalid_name = string;').map(diagnostic => diagnostic.rule), ['naming-convention']);
});

test('PascalCase supports Unicode and $ identifiers', () => {
	assert.deepEqual(lintSource('type $type = string; type Ätype = string;'), []);
});

test('declaration files are checked', () => {
	assert.deepEqual(lintSource('type invalid_name = string;', 'fixture.d.ts').map(diagnostic => diagnostic.rule), ['naming-convention']);
});

test('control flow statements use curly braces', () => {
	assert.deepEqual(lintSource('if (true) console.log();').map(diagnostic => diagnostic.rule), ['curly']);
});

test('equality comparisons use strict operators', () => {
	assert.deepEqual(lintSource('const equal = 1 == 1;').map(diagnostic => diagnostic.rule), ['eqeqeq']);
});

test('only error objects are thrown', () => {
	assert.deepEqual(lintSource("throw 'invalid';").map(diagnostic => diagnostic.rule), ['no-throw-literal']);
});

function lintProject(configPath: string): LintDiagnostic[] {
	const config = ts.readConfigFile(configPath, ts.sys.readFile);
	if (config.error) {
		throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
	}

	const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
	if (parsedConfig.errors.length > 0) {
		throw new Error(ts.flattenDiagnosticMessageText(parsedConfig.errors[0].messageText, '\n'));
	}

	const diagnostics: LintDiagnostic[] = [];
	for (const fileName of parsedConfig.fileNames) {
		if (!fileName.endsWith('.ts')) {
			continue;
		}

		diagnostics.push(...lintSource(ts.sys.readFile(fileName) ?? '', fileName, parsedConfig.options.target));
	}
	return diagnostics;
}

function lintSource(text: string, fileName = 'fixture.ts', target = ts.ScriptTarget.Latest): LintDiagnostic[] {
	const sourceFile = ts.createSourceFile(fileName, text, target, true);
	const diagnostics: LintDiagnostic[] = [];
	checkNode(sourceFile, sourceFile, diagnostics);
	return diagnostics;
}

function checkNode(node: ts.Node, sourceFile: ts.SourceFile, diagnostics: LintDiagnostic[]): void {
	checkTypeName(node, sourceFile, diagnostics);
	checkCurly(node, sourceFile, diagnostics);
	checkEquality(node, sourceFile, diagnostics);
	checkThrow(node, sourceFile, diagnostics);
	ts.forEachChild(node, child => checkNode(child, sourceFile, diagnostics));
}

function checkTypeName(node: ts.Node, sourceFile: ts.SourceFile, diagnostics: LintDiagnostic[]): void {
	let name: ts.Identifier | undefined;
	if (
		ts.isClassDeclaration(node) ||
		ts.isClassExpression(node) ||
		ts.isInterfaceDeclaration(node) ||
		ts.isTypeAliasDeclaration(node) ||
		ts.isEnumDeclaration(node) ||
		ts.isTypeParameterDeclaration(node)
	) {
		name = node.name;
	}

	if (name && ts.isIdentifier(name) && (name.text[0] !== name.text[0].toUpperCase() || name.text.includes('_'))) {
		addDiagnostic(diagnostics, sourceFile, name, 'Type-like names must match PascalCase', 'naming-convention');
	}
}

function checkCurly(node: ts.Node, sourceFile: ts.SourceFile, diagnostics: LintDiagnostic[]): void {
	if (ts.isIfStatement(node)) {
		requireBlock(node.thenStatement, sourceFile, diagnostics);
		if (node.elseStatement && !ts.isIfStatement(node.elseStatement)) {
			requireBlock(node.elseStatement, sourceFile, diagnostics);
		}
	} else if (
		ts.isForStatement(node) ||
		ts.isForInStatement(node) ||
		ts.isForOfStatement(node) ||
		ts.isWhileStatement(node) ||
		ts.isDoStatement(node) ||
		ts.isWithStatement(node)
	) {
		requireBlock(node.statement, sourceFile, diagnostics);
	}
}

function requireBlock(statement: ts.Statement, sourceFile: ts.SourceFile, diagnostics: LintDiagnostic[]): void {
	if (!ts.isBlock(statement)) {
		addDiagnostic(diagnostics, sourceFile, statement, 'Expected { } around this statement', 'curly');
	}
}

function checkEquality(node: ts.Node, sourceFile: ts.SourceFile, diagnostics: LintDiagnostic[]): void {
	if (!ts.isBinaryExpression(node)) {
		return;
	}

	if (node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken) {
		addDiagnostic(diagnostics, sourceFile, node.operatorToken, "Expected '===' and instead saw '=='", 'eqeqeq');
	} else if (node.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsToken) {
		addDiagnostic(diagnostics, sourceFile, node.operatorToken, "Expected '!==' and instead saw '!='", 'eqeqeq');
	}
}

function checkThrow(node: ts.Node, sourceFile: ts.SourceFile, diagnostics: LintDiagnostic[]): void {
	if (ts.isThrowStatement(node) && node.expression && !couldBeError(node.expression)) {
		addDiagnostic(diagnostics, sourceFile, node, 'Expected an error object to be thrown', 'no-throw-literal');
	}
}

function couldBeError(expression: ts.Expression): boolean {
	while (
		ts.isParenthesizedExpression(expression) ||
		ts.isAsExpression(expression) ||
		ts.isTypeAssertionExpression(expression) ||
		ts.isNonNullExpression(expression) ||
		ts.isSatisfiesExpression(expression)
	) {
		expression = expression.expression;
	}

	if (
		ts.isIdentifier(expression) ||
		ts.isCallExpression(expression) ||
		ts.isNewExpression(expression) ||
		ts.isPropertyAccessExpression(expression) ||
		ts.isElementAccessExpression(expression) ||
		ts.isTaggedTemplateExpression(expression) ||
		ts.isYieldExpression(expression) ||
		ts.isAwaitExpression(expression)
	) {
		return !ts.isIdentifier(expression) || expression.text !== 'undefined';
	}

	if (ts.isBinaryExpression(expression)) {
		switch (expression.operatorToken.kind) {
			case ts.SyntaxKind.EqualsToken:
			case ts.SyntaxKind.AmpersandAmpersandEqualsToken:
			case ts.SyntaxKind.AmpersandAmpersandToken:
				return couldBeError(expression.right);
			case ts.SyntaxKind.BarBarEqualsToken:
			case ts.SyntaxKind.QuestionQuestionEqualsToken:
			case ts.SyntaxKind.BarBarToken:
			case ts.SyntaxKind.QuestionQuestionToken:
				return couldBeError(expression.left) || couldBeError(expression.right);
			case ts.SyntaxKind.CommaToken:
				return couldBeError(expression.right);
		}
	}

	if (ts.isConditionalExpression(expression)) {
		return couldBeError(expression.whenTrue) || couldBeError(expression.whenFalse);
	}

	return false;
}

function addDiagnostic(diagnostics: LintDiagnostic[], sourceFile: ts.SourceFile, node: ts.Node, message: string, rule: LintRule): void {
	diagnostics.push({ sourceFile, node, message, rule });
}

function formatDiagnostics(diagnostics: LintDiagnostic[]): string {
	if (diagnostics.length === 0) {
		return '';
	}

	return diagnostics.map(diagnostic => {
		const position = diagnostic.sourceFile.getLineAndCharacterOfPosition(diagnostic.node.getStart());
		const fileName = path.relative(root, diagnostic.sourceFile.fileName);
		return `${fileName}:${position.line + 1}:${position.character + 1} ${diagnostic.message} (${diagnostic.rule})`;
	}).join('\n');
}
