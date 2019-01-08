/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IEntry, EntryImpl, IEntryData } from './entry';

const pseudoElementSet : { [key: string]: IEntry } = {};

export function addPseudoElements(pseudoElements: IEntryData[]) {
	for (let i = 0; i < pseudoElements.length; i++) {
		let rawEntry = pseudoElements[i];
		pseudoElementSet[rawEntry.name] = new EntryImpl(rawEntry);
	}
}

export function getPseudoElements() {
	return pseudoElementSet;
}