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
	onProperty?: (context: PropertyCompletionContext) => void;
	onPropertyValue?: (context: PropertyValueCompletionContext) => void;
	onURILiteralValue?: (context: URILiteralCompletionContext) => void;
}

export interface FoldingRangeList {
	/**
	 * The folding ranges.
	 */
	ranges: FoldingRange[];
}
export declare const enum FoldingRangeType {
	/**
	 * Folding range for a comment
	 */
	Comment = "comment",
	/**
	 * Folding range for a imports or includes
	 */
	Imports = "imports",
	/**
	 * Folding range for a region (e.g. `#region`)
	 */
	Region = "region",
}
/**
* Represents a folding range.
*/
export interface FoldingRange {
	/**
	 * The start line number of the folding range.
	 */
	startLine: number;
	/**
	 * The start column of the folding range. If not set, this defaults to the length of the start line.
	 */
	startColumn?: number;
	/**
	 * The end line number. The last line will be hidden.
	 */
	endLine: number;
	/**
	 * The start column of the folding range. If not set, this defaults to the length of the end line.
	 */
	endColumn?: number;
	/**
	 * The type of folding range.
	 */
	type?: FoldingRangeType | string;
}