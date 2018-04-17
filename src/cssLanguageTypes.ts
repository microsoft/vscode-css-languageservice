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

export interface Color {
	red: number; blue: number; green: number; alpha: number;
}

export interface ColorInformation {
	range: Range;
	color: Color;
}

export interface ColorPresentation {
	/**
	 * The label of this color presentation. It will be shown on the color
	 * picker header. By default this is also the text that is inserted when selecting
	 * this color presentation.
	 */
	label: string;
	/**
	 * An [edit](#TextEdit) which is applied to a document when selecting
	 * this presentation for the color.  When `falsy` the [label](#ColorPresentation.label)
	 * is used.
	 */
	textEdit?: TextEdit;
	/**
	 * An optional array of additional [text edits](#TextEdit) that are applied when
	 * selecting this color presentation. Edits must not overlap with the main [edit](#ColorPresentation.textEdit) nor with themselves.
	 */
	additionalTextEdits?: TextEdit[];
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

export interface ICompletionParticipant {
	onCssProperty?: (context: PropertyCompletionContext) => void;
	onCssPropertyValue?: (context: PropertyValueCompletionContext) => void;
	onCssURILiteralValue?: (context: URILiteralCompletionContext) => void;
}

/**
 * Enum of known range kinds
 */
export enum FoldingRangeKind {
	/**
	 * Folding range for a comment
	 */
	Comment = 'comment',
	/**
	 * Folding range for a imports or includes
	 */
	Imports = 'imports',
	/**
	 * Folding range for a region (e.g. `#region`)
	 */
	Region = 'region'
}

/**
 * Represents a folding range.
 */
export interface FoldingRange {

	/**
	 * The zero-based line number from where the folded range starts.
	 */
	startLine: number;

	/**
	 * The zero-based character offset from where the folded range starts. If not defined, defaults to the length of the start line.
	 */
	startCharacter?: number;

	/**
	 * The zero-based line number where the folded range ends.
	 */
	endLine: number;

	/**
	 * The zero-based character offset before the folded range ends. If not defined, defaults to the length of the end line.
	 */
	endCharacter?: number;

	/**
	 * Describes the kind of the folding range such as `comment' or 'region'. The kind
	 * is used to categorize folding ranges and used by commands like 'Fold all comments'. See
	 * [FoldingRangeKind](#FoldingRangeKind) for an enumeration of standardized kinds.
	 */
	kind?: string;
}
