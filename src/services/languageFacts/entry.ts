/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

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

export let browserNames = {
	E: 'Edge',
	FF: 'Firefox',
	S: 'Safari',
	C: 'Chrome',
	IE: 'IE',
	O: 'Opera'
};

export type EntryStatus = 'standard' | 'experimental' | 'nonstandard' | 'obsolete';

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

export function getEntryDescription(entry: { description?: string; browsers?: string[], data?: any }): string | null {
	if (!entry.description || entry.description === '') {
		return null;
	}

	let desc: string = '';

	if (entry.data && entry.data.status) {
		desc += getEntryStatus(entry.data.status);
	}

	desc += entry.description;

	let browserLabel = getBrowserLabel(entry.browsers);
	if (browserLabel) {
		desc += '\n(' + browserLabel + ')';
	}
	if (entry.data && entry.data.syntax) {
		desc += `\n\nSyntax: ${entry.data.syntax}`;
	}
	return desc;
}

export function getBrowserLabel(b: string[]): string {
	let result = '';
	if (!b || b.length === 0) {
		return null;
	}

	for (let curr in browserNames) {
		if (typeof (<any>b)[curr] === 'string') {
			if (result.length > 0) {
				result = result + ', ';
			}
			result = result + (<any>browserNames)[curr];
			let version = (<any>b)[curr];
			if (version.length > 0) {
				result = result + ' ' + version;
			}
		}
	}
	return result;
}

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