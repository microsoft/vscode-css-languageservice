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

export enum FoldingRangeType {
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

export interface FoldingRange {

	/**
	 * The start line number
	 */
	startLine: number;

	/**
	 * The end line number
	 */
	endLine: number;

	/**
	 * The actual color value for this folding range.
	 */
	type?: FoldingRangeType | string;
}
