/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CSSDataSet } from './dataSet';
import * as browsers from '../../data/browsers';

export * from './entry';
export * from './colors';
export * from './builtinData';
export * from './dataSet';

export const builtinCSSDataSet = new CSSDataSet(browsers.cssData);
