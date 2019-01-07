/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as browsers from '../../data/browsers';
import { IEntry, EntryImpl } from './entry';

let pseudoElements = browsers.data.css.pseudoelements;
let pseudoElementList: IEntry[];
export function getPseudoElements(): IEntry[] {
	if (!pseudoElementList) {
		pseudoElementList = [];
		for (let i = 0; i < pseudoElements.length; i++) {
			let rawEntry = pseudoElements[i];
			pseudoElementList.push(new EntryImpl(rawEntry));
		}
	}
	return pseudoElementList;
}
