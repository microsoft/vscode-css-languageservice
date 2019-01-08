/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export * from './entry';
export * from './colors';
export * from './properties';
export * from './builtinData';

export * from './properties';
export * from './atDirectives';
export * from './pseudoClasses';
export * from './pseudoElements';

import * as browsers from '../../data/browsers';
import { addProperties } from './properties';
import { addAtDirectives } from './atDirectives';
import { addPseudoClasses } from './pseudoClasses';
import { addPseudoElements } from './pseudoElements';

let { properties, atdirectives, pseudoclasses, pseudoelements } = browsers.data.css;

addProperties(properties);
addAtDirectives(atdirectives);
addPseudoClasses(pseudoclasses);
addPseudoElements(pseudoelements);