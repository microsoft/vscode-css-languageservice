
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as browsers from '../../data/browsers';
import { IEntry, EntryImpl } from './entry';

let atDirectives = browsers.data.css.atdirectives;
let atDirectiveList: IEntry[];
export function getAtDirectives(): IEntry[] {
	if (!atDirectiveList) {
		atDirectiveList = [];
		for (let i = 0; i < atDirectives.length; i++) {
			let rawEntry = atDirectives[i];
			atDirectiveList.push(new EntryImpl(rawEntry));
		}
	}
	return atDirectiveList;
}
