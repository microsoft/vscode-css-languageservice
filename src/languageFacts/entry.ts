/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { EntryStatus, IPropertyData, IAtDirectiveData, IPseudoClassData, IPseudoElementData, IValueData } from '../cssLanguageTypes';

export interface Browsers {
	E?: string;
	FF?: string;
	IE?: string;
	O?: string;
	C?: string;
	S?: string;
	count: number;
	all: boolean;
	onCodeComplete: boolean;
}

export const browserNames = {
	E: 'Edge',
	FF: 'Firefox',
	S: 'Safari',
	C: 'Chrome',
	IE: 'IE',
	O: 'Opera'
};

function getEntryStatus(status: EntryStatus) {
	switch (status) {
		case 'experimental':
			return '⚠️ Property is experimental. Be cautious when using it.️\n\n';
		case 'nonstandard':
			return '🚨️ Property is nonstandard. Avoid using it.\n\n';
		case 'obsolete':
			return '🚨️️️ Property is obsolete. Avoid using it.\n\n';
		default:
			return '';
	}
}

export function getEntryDescription(entry: IEntry2): string | null {
	if (!entry.description || entry.description === '') {
		return null;
	}

	let result: string = '';

	if (entry.status) {
		result += getEntryStatus(entry.status);
	}

	result += entry.description;

	const browserLabel = getBrowserLabel(entry.browsers);
	if (browserLabel) {
		result += '\n(' + browserLabel + ')';
	}
	if ('syntax' in entry) {
		result += `\n\nSyntax: ${entry.syntax}`;
	}
	return result;
}

/**
 * Input is like `["E12","FF49","C47","IE","O"]`
 * Output is like `Edge 12, Firefox 49, Chrome 47, IE, Opera`
 */
export function getBrowserLabel(browsers: string[]): string {
	if (!browsers || browsers.length === 0) {
		return null;
	}

	return browsers
		.map(b => {
			let result = '';
			const matches = b.match(/([A-Z]+)(\d+)?/);
			const name = matches[1];
			const version = matches[2];

			if (name in browserNames) {
				result += browserNames[name];
			}
			if (version) {
				result += ' ' + version;
			}
			return result;
		})
		.join(', ');
}

export type IEntry2 = IPropertyData | IAtDirectiveData | IPseudoClassData | IPseudoElementData | IValueData;

/**
 * Todo@Pine: Drop these two types and use IEntry2
 */
export interface IEntry {
	name: string;
	description?: string;
	browsers?: string[];
	restrictions?: string[];
	status?: EntryStatus;
	syntax?: string;
	values?: IValue[];
}

export interface IValue {
	name: string;
	description?: string;
	browsers?: string[];
}
