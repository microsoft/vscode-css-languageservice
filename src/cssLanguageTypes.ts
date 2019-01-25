/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Range, TextEdit, Position } from 'vscode-languageserver-types';

export { Range, TextEdit, Position };

export type LintSettings = { [key: string]: any };

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

export interface LanguageServiceOptions {
	customDataCollections?: CSSData[];
}

export type EntryStatus = 'standard' | 'experimental' | 'nonstandard' | 'obsolete';

export interface IEntryData {
	name: string;
	description?: string;
	browsers?: string[];
	restrictions?: string[];
	status?: EntryStatus;
	syntax?: string;
	values?: IValueData[];
}

export interface IValueData {
	name: string;
	description?: string;
	browsers?: string[];
}

export interface CSSData {
	properties?: IEntryData[];
	atDirectives?: IEntryData[];
	pseudoClasses?: IEntryData[];
	pseudoElements?: IEntryData[];
}

export interface IPropertyData {
	name: string;
	description?: string;
}
export interface IAtDirectiveData {
	name: string;
	description?: string;
}
export interface IPseudoClassData {
	name: string;
	description?: string;
}
export interface IPseudoElementData {
	name: string;
	description?: string;
}

export interface ICSSDataProvider {
	provideProperties(): Promise<IPropertyData[]>;
	provideAtDirectives(): Promise<IAtDirectiveData[]>;
	providePseudoClasses(): Promise<IPseudoClassData[]>;
	providePseudoElements(): Promise<IPseudoElementData[]>;
}