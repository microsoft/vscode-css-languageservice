/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
	TextDocument, Position, CompletionList, Hover, Range, SymbolInformation, Diagnostic, Location, DocumentHighlight,
	CodeActionContext, Command, WorkspaceEdit, Color, ColorInformation, ColorPresentation, FoldingRange
} from 'vscode-languageserver-types';

import { Parser } from './parser/cssParser';
import { CSSCompletion } from './services/cssCompletion';
import { CSSHover } from './services/cssHover';
import { CSSNavigation } from './services/cssNavigation';
import { CSSCodeActions } from './services/cssCodeActions';
import { CSSValidation } from './services/cssValidation';

import { SCSSParser } from './parser/scssParser';
import { SCSSCompletion } from './services/scssCompletion';
import { LESSParser } from './parser/lessParser';
import { LESSCompletion } from './services/lessCompletion';
import { getFoldingRanges } from './services/cssFolding';
import { LanguageSettings, ICompletionParticipant } from './cssLanguageTypes';

export type Stylesheet = {};
export * from './cssLanguageTypes';
export * from 'vscode-languageserver-types';

export interface LanguageService {
	configure(raw: LanguageSettings): void;
	doValidation(document: TextDocument, stylesheet: Stylesheet, documentSettings?: LanguageSettings): Diagnostic[];
	parseStylesheet(document: TextDocument): Stylesheet;
	doComplete(document: TextDocument, position: Position, stylesheet: Stylesheet): CompletionList;
	setCompletionParticipants(registeredCompletionParticipants: ICompletionParticipant[]): void;
	doHover(document: TextDocument, position: Position, stylesheet: Stylesheet): Hover | null;
	findDefinition(document: TextDocument, position: Position, stylesheet: Stylesheet): Location | null;
	findReferences(document: TextDocument, position: Position, stylesheet: Stylesheet): Location[];
	findDocumentHighlights(document: TextDocument, position: Position, stylesheet: Stylesheet): DocumentHighlight[];
	findDocumentSymbols(document: TextDocument, stylesheet: Stylesheet): SymbolInformation[];
	doCodeActions(document: TextDocument, range: Range, context: CodeActionContext, stylesheet: Stylesheet): Command[];
	/** deprecated, use findDocumentColors instead */
	findColorSymbols(document: TextDocument, stylesheet: Stylesheet): Range[];
	findDocumentColors(document: TextDocument, stylesheet: Stylesheet): ColorInformation[];
	getColorPresentations(document: TextDocument, stylesheet: Stylesheet, color: Color, range: Range): ColorPresentation[];
	doRename(document: TextDocument, position: Position, newName: string, stylesheet: Stylesheet): WorkspaceEdit;
	getFoldingRanges(document: TextDocument, context?: { rangeLimit?: number; }): FoldingRange[];
}

function createFacade(parser: Parser, completion: CSSCompletion, hover: CSSHover, navigation: CSSNavigation, codeActions: CSSCodeActions, validation: CSSValidation) {
	return {
		configure: validation.configure.bind(validation),
		doValidation: validation.doValidation.bind(validation),
		parseStylesheet: parser.parseStylesheet.bind(parser),
		doComplete: completion.doComplete.bind(completion),
		setCompletionParticipants: completion.setCompletionParticipants.bind(completion),
		doHover: hover.doHover.bind(hover),
		findDefinition: navigation.findDefinition.bind(navigation),
		findReferences: navigation.findReferences.bind(navigation),
		findDocumentHighlights: navigation.findDocumentHighlights.bind(navigation),
		findDocumentSymbols: navigation.findDocumentSymbols.bind(navigation),
		doCodeActions: codeActions.doCodeActions.bind(codeActions),
		findColorSymbols: (d, s) => navigation.findDocumentColors(d, s).map(s => s.range),
		findDocumentColors: navigation.findDocumentColors.bind(navigation),
		getColorPresentations: navigation.getColorPresentations.bind(navigation),
		doRename: navigation.doRename.bind(navigation),
		getFoldingRanges: getFoldingRanges
	};
}


export function getCSSLanguageService(): LanguageService {
	return createFacade(new Parser(), new CSSCompletion(), new CSSHover(), new CSSNavigation(), new CSSCodeActions(), new CSSValidation());
}

export function getSCSSLanguageService(): LanguageService {
	return createFacade(new SCSSParser(), new SCSSCompletion(), new CSSHover(), new CSSNavigation(), new CSSCodeActions(), new CSSValidation());
}

export function getLESSLanguageService(): LanguageService {
	return createFacade(new LESSParser(), new LESSCompletion(), new CSSHover(), new CSSNavigation(), new CSSCodeActions(), new CSSValidation());
}