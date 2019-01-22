/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as browsers from '../../data/browsers';
import { IValueData, IEntryData } from '../../cssLanguageTypes';

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

export function expandEntryStatus(status: string): EntryStatus {
	switch (status) {
		case 'e':
			return 'experimental';
		case 'n':
			return 'nonstandard';
		case 'o':
			return 'obsolete';
		default:
			return 'standard';
	}
}
function getEntryStatus(status: string) {
	switch (status) {
		case 'e':
			return '⚠️ Property is experimental. Be cautious when using it.️\n\n';
		case 'n':
			return '🚨️ Property is nonstandard. Avoid using it.\n\n';
		case 'o':
			return '🚨️️️ Property is obsolete. Avoid using it.\n\n';
		default:
			return '';
	}
}

export function getEntryDescription(entry: { description: string; browsers: Browsers, data?: any }): string | null {
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

export function getBrowserLabel(b: Browsers): string {
	let result = '';
	if (!b || b.all || b.count === 0) {
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
	restrictions: string[];
	browsers: Browsers;
	description: string;
	values: IValue[];
	status: EntryStatus;
}

export class EntryImpl implements IEntry {
	private browserEntry: Browsers;

	constructor(public data: IEntryData) {
	}

	get name(): string {
		return this.data.name;
	}

	get description(): string {
		return this.data.desc || browsers.descriptions[this.data.name];
	}

	get browsers(): Browsers {
		if (!this.browserEntry) {
			this.browserEntry = evalBrowserEntry(this.data.browsers);
		}
		return this.browserEntry;
	}

	get restrictions(): string[] {
		if (this.data.restriction) {
			return this.data.restriction.split(',').map(function (s: string) { return s.trim(); });
		} else {
			return [];
		}
	}

	get status(): EntryStatus {
		return expandEntryStatus(this.data.status);
	}

	get values(): IValue[] {
		if (!this.data.values) {
			return [];
		}
		return this.data.values.map((v: IValueData) => {
			return new ValueImpl(v);
		});
	}
}

export interface IValue {
	name: string;
	description: string;
	browsers: Browsers;
}

class ValueImpl implements IValue {

	private browserEntry: Browsers;

	constructor(public data: IValueData) {
	}

	get name(): string {
		return this.data.name;
	}

	get description(): string {
		return this.data.desc || browsers.descriptions[this.data.name];
	}

	get browsers(): Browsers {
		if (!this.browserEntry) {
			this.browserEntry = evalBrowserEntry(this.data.browsers);
		}
		return this.browserEntry;
	}
}

function evalBrowserEntry(browsers: string) {
	let browserEntry: Browsers = { all: false, count: 0, onCodeComplete: false };
	let count = 0;
	if (browsers) {
		for (let s of browsers.split(',')) {
			s = s.trim();
			if (s === 'all') {
				browserEntry.all = true;
				count = Number.MAX_VALUE;
			} else if (s !== 'none') {
				for (let key in browserNames) {
					if (s.indexOf(key) === 0) {
						(<any>browserEntry)[key] = s.substring(key.length).trim();
						count++;
					}
				}
			}
		}
	} else {
		browserEntry.all = true;
		count = Number.MAX_VALUE;
	}
	browserEntry.count = count;
	browserEntry.onCodeComplete = count > 0; // to be refined
	return browserEntry;
}

export function isCommonValue(entry: IValue): boolean {
	return entry.browsers.count > 1;
}
