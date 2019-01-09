/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IEntry, EntryImpl, IEntryData } from './entry';

interface IEntrySet {
	[k: string]: IEntry;
}

export interface CSSData {
	properties?: IEntryData[];
	atDirectives?: IEntryData[];
	pseudoClasses?: IEntryData[];
	pseudoElements?: IEntryData[];
}

export class CSSDataSet {
	private propertySet: IEntrySet = {};
	private atDirectiveSet: IEntrySet = {};
	private pseudoClassSet: IEntrySet = {};
	private pseudoElementSet: IEntrySet = {};

	constructor(data: CSSData) {
		this.addData(data);
	}

	get properties() { return this.propertySet; }
	get atDirectives() { return this.atDirectiveSet; }
	get pseudoClasses() { return this.pseudoClassSet; }
	get pseudoElements() { return this.pseudoElementSet; }
	
	addData(data: CSSData) {
		if (data.properties) {
			this.addProperties(data.properties);
		}
		if (data.atDirectives) {
			this.addAtDirectives(data.atDirectives);
		}
		if (data.pseudoClasses) {
			this.addPseudoClasses(data.pseudoClasses);
		}
		if (data.pseudoElements) {
			this.addPseudoElements(data.pseudoElements);
		}
	}

	private addProperties(properties: IEntryData[]) {
		properties.forEach(p => {
			this.propertySet[p.name] = new EntryImpl(p);
		});
	}
	private addAtDirectives(atDirectives: IEntryData[]) {
		atDirectives.forEach(a => {
			this.atDirectiveSet[a.name] = new EntryImpl(a);
		});
	}
	private addPseudoClasses(pseudoClasses: IEntryData[]) {
		pseudoClasses.forEach(p => {
			this.pseudoClassSet[p.name] = new EntryImpl(p);
		});
	}
	private addPseudoElements(pseudoElements: IEntryData[]) {
		pseudoElements.forEach(p => {
			this.pseudoElementSet[p.name] = new EntryImpl(p);
		});
	}
	
	isKnownProperty(name: string): boolean {
		if (!name) {
			return false;
		} else {
			name = name.toLowerCase();
			return this.properties.hasOwnProperty(name);
		}
	}
	
	isStandardProperty(name: string): boolean {
		if (!name) {
			return false;
		} else {
			name = name.toLowerCase();
			let property = this.properties[name];
			return property && property.status === 'standard';
		}
	}
}