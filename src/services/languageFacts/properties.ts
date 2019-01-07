/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as browsers from '../../data/browsers';
import { IEntry, EntryImpl } from './entry';

/**
 * Returns true if the given name is a known property.
 */
export function isKnownProperty(name: string): boolean {
	if (!name) {
		return false;
	} else {
		name = name.toLowerCase();
		return getProperties().hasOwnProperty(name);
	}
}

export function isStandardProperty(name: string): boolean {
	if (!name) {
		return false;
	} else {
		name = name.toLowerCase();
		let property = getProperties()[name];
		return property && property.status === 'standard';
	}
}

let propertySet: { [key: string]: IEntry };
let properties = browsers.data.css.properties;

export function getProperties(): { [name: string]: IEntry; } {
	if (!propertySet) {
		propertySet = {
		};
		for (let i = 0; i < properties.length; i++) {
			let rawEntry = properties[i];
			propertySet[rawEntry.name] = new EntryImpl(rawEntry);
		}

	}
	return propertySet;
}
