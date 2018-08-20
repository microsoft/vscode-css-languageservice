/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Range, TextEdit, Position } from "vscode-languageserver-types";

export { Range, TextEdit, Position };

export type LintSettings = { [key: string]: string };

export interface LanguageSettings {
	validate?: boolean;
	lint?: LintSettings;
}

export interface PropertyCompletionContext {
	propertyName: string;
	range: Range;
}

export interface PropertyValueCompletionContext {
	propertyName: string;
	propertyValue?: string;
	range: Range;
}

export interface URILiteralCompletionContext {
	uriValue: string;
	position: Position;
	range: Range;
}

export interface ImportPathCompletionContext {
	pathValue: string;
	position: Position;
	range: Range;
}

export interface ICompletionParticipant {
	onCssProperty?: (context: PropertyCompletionContext) => void;
	onCssPropertyValue?: (context: PropertyValueCompletionContext) => void;
	onCssURILiteralValue?: (context: URILiteralCompletionContext) => void;
	onCssImportPath?: (context: ImportPathCompletionContext) => void;
}

export interface DocumentContext {
	resolveReference(ref: string, base?: string): string;
}