
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IEntry, EntryImpl, IEntryData } from './entry';

const atDirectiveSet: { [key: string]: IEntry } = {};

export function addAtDirectives(atDirectives: IEntryData[]) {
	for (let i = 0; i < atDirectives.length; i++) {
		let rawEntry = atDirectives[i];
		atDirectiveSet[rawEntry.name] = new EntryImpl(rawEntry);
	}
}

export function getAtDirectives() {
	return atDirectiveSet;
}
