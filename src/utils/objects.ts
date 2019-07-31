/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export function values<T extends {}>(obj: T): Array<T[keyof T]> {
	return Object.values(obj);
}

export function isDefined<T>(obj: T | undefined): obj is T {
	return typeof obj !== 'undefined';
}
