/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IEntry, EntryImpl } from './entry';

const pseudoClassSet: { [key: string]: IEntry } = {};

export function addPseudoClasses(pseudoClasses: IEntry[]) {
	for (let i = 0; i < pseudoClasses.length; i++) {
		let rawEntry = pseudoClasses[i];
		pseudoClassSet[rawEntry.name] = new EntryImpl(rawEntry);
	}
}

export function getPseudoClasses() {
	return pseudoClassSet;
}
