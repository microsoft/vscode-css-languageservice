/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as browsers from '../../data/browsers';
import { IEntry, EntryImpl } from './entry';

let pseudoClasses = browsers.data.css.pseudoclasses;
let pseudoClassesList: IEntry[];
export function getPseudoClasses(): IEntry[] {
	if (!pseudoClassesList) {
		pseudoClassesList = [];
		for (let i = 0; i < pseudoClasses.length; i++) {
			let rawEntry = pseudoClasses[i];
			pseudoClassesList.push(new EntryImpl(rawEntry));
		}
	}
	return pseudoClassesList;
}