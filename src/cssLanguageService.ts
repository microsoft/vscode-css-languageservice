/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {TextDocument, Position, CompletionList, Hover, Range, SymbolInformation, Diagnostic,
	Location, DocumentHighlight, CodeActionContext, Command, WorkspaceEdit} from 'vscode-languageserver-types';

import {Stylesheet} from './parser/cssNodes';
import {Parser} from './parser/cssParser';
import {CSSCompletion} from './services/cssCompletion';
import {CSSHover} from './services/cssHover';
import {CSSNavigation} from './services/cssNavigation';
import {CSSCodeActions} from './services/cssCodeActions';
import {CSSValidation} from './services/cssValidation';

import {SCSSParser} from './parser/scssParser';
import {SCSSCompletion} from './services/scssCompletion';
import {LESSParser} from './parser/lessParser';
import {LESSCompletion} from './services/lessCompletion';

export interface LanguageService {
	configure(raw: LanguageSettings): void;
	doValidation(document: TextDocument, stylesheet: Stylesheet): Diagnostic[];
	parseStylesheet(document: TextDocument): Stylesheet;
	doComplete(document: TextDocument, position: Position, stylesheet: Stylesheet): CompletionList;
	doHover(document: TextDocument, position: Position, stylesheet: Stylesheet): Hover;
	findDefinition(document: TextDocument, position: Position, stylesheet: Stylesheet): Location;
	findReferences(document: TextDocument, position: Position, stylesheet: Stylesheet): Location[];
	findDocumentHighlights(document: TextDocument, position: Position, stylesheet: Stylesheet): DocumentHighlight[];
	findDocumentSymbols(document: TextDocument, stylesheet: Stylesheet): SymbolInformation[];
	doCodeActions(document: TextDocument, range: Range, context: CodeActionContext, stylesheet: Stylesheet): Command[];
	findColorSymbols(document: TextDocument, stylesheet: Stylesheet): Range[];
	doRename(document: TextDocument, position: Position, newName: string, stylesheet: Stylesheet): WorkspaceEdit;
}

export interface LanguageSettings {
	validate?: boolean;
	lint?: any;
}


function createFacade(parser: Parser, completion: CSSCompletion, hover: CSSHover, navigation: CSSNavigation, codeActions: CSSCodeActions, validation: CSSValidation) {
	return {
		configure: validation.configure.bind(validation),
		doValidation: validation.doValidation.bind(validation),
		parseStylesheet: parser.parseStylesheet.bind(parser),
		doComplete: completion.doComplete.bind(completion),
		doHover: hover.doHover.bind(hover),
		findDefinition: navigation.findDefinition.bind(navigation),
		findReferences: navigation.findReferences.bind(navigation),
		findDocumentHighlights: navigation.findDocumentHighlights.bind(navigation),
		findDocumentSymbols: navigation.findDocumentSymbols.bind(navigation),
		doCodeActions: codeActions.doCodeActions.bind(codeActions),
		findColorSymbols: navigation.findColorSymbols.bind(navigation),
		doRename: navigation.doRename.bind(navigation),
	};
}


export function getCSSLanguageService() : LanguageService {
	return createFacade(new Parser(), new CSSCompletion(), new CSSHover(), new CSSNavigation(), new CSSCodeActions(), new CSSValidation);
}


export function getSCSSLanguageService() : LanguageService {
	return createFacade(new SCSSParser(), new SCSSCompletion(), new CSSHover(), new CSSNavigation(), new CSSCodeActions(), new CSSValidation);
}


export function getLESSLanguageService() : LanguageService {
	return createFacade(new LESSParser(), new LESSCompletion(), new CSSHover(), new CSSNavigation(), new CSSCodeActions(), new CSSValidation);
}