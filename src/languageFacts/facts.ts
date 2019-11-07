/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as webCustomData from '../data/webCustomData';
import { CSSDataManager } from './dataManager';
import { CSSDataProvider } from './dataProvider';

export * from './entry';
export * from './colors';
export * from './builtinData';
export * from './dataProvider';
export * from './dataManager';

export const cssDataManager = new CSSDataManager([
	new CSSDataProvider(webCustomData.cssData)
]);