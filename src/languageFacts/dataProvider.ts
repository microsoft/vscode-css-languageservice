/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CSSDataV1, ICSSDataProvider, IPropertyData, IAtDirectiveData, IPseudoClassData, IPseudoElementData } from '../cssLanguageTypes';

export class CSSDataProvider implements ICSSDataProvider {
	private _properties: IPropertyData[] = [];
	private _atDirectives: IAtDirectiveData[] = [];
	private _pseudoClasses: IPseudoClassData[] = [];
	private _pseudoElements: IPseudoElementData[] = [];

	/**
	 * Currently, unversioned data uses the V1 implementation
	 * In the future when the provider handles multiple versions of HTML custom data,
	 * use the latest implementation for unversioned data
	 */
	constructor(data: CSSDataV1) {
		this.addData(data);
	}

	provideProperties() {
		return this._properties;
	}
	provideAtDirectives() {
		return this._atDirectives;
	}
	providePseudoClasses() {
		return this._pseudoClasses;
	}
	providePseudoElements() {
		return this._pseudoElements;
	}

	private addData(data: CSSDataV1) {
		if (data.properties) {
			this._properties = this._properties.concat(data.properties);
		}
		if (data.atDirectives) {
			this._atDirectives = this._atDirectives.concat(data.atDirectives);
		}
		if (data.pseudoClasses) {
			this._pseudoClasses = this._pseudoClasses.concat(data.pseudoClasses);
		}
		if (data.pseudoElements) {
			this._pseudoElements = this._pseudoElements.concat(data.pseudoElements);
		}
	}
}