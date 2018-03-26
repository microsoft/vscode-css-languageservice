/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface FoldingRangeList {
	/**
	 * The folding ranges.
	 */
	ranges: FoldingRange[];
}
export declare enum FoldingRangeType {
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