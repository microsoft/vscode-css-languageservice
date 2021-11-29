/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { EntryStatus, IPropertyData, IAtDirectiveData, IPseudoClassData, IPseudoElementData, IValueData, MarkupContent, MarkupKind, MarkedString, HoverSettings } from '../cssLanguageTypes';

export interface Browsers {
	E?: string;
	FF?: string;
	IE?: string;
	O?: string;
	C?: string;
	S?: string;
	count: number;
	all: boolean;
	onCodeComplete: boolean;
}

export const browserNames = {
	E: 'Edge',
	FF: 'Firefox',
	S: 'Safari',
	C: 'Chrome',
	IE: 'IE',
	O: 'Opera'
};

function getEntryStatus(status: EntryStatus) {
	switch (status) {
		case 'experimental':
			return '⚠️ Property is experimental. Be cautious when using it.️\n\n';
		case 'nonstandard':
			return '🚨️ Property is nonstandard. Avoid using it.\n\n';
		case 'obsolete':
			return '🚨️️️ Property is obsolete. Avoid using it.\n\n';
		default:
			return '';
	}
}

export function getEntryDescription(entry: IEntry2, doesSupportMarkdown: boolean, settings?: HoverSettings): MarkupContent | undefined {
	let result: MarkupContent;

	if (doesSupportMarkdown) {
		result = {
			kind: 'markdown',
			value: getEntryMarkdownDescription(entry, settings)
		};
	} else {
		result = {
			kind: 'plaintext',
			value: getEntryStringDescription(entry, settings)
		};
	}

	if (result.value === '') {
		return undefined;
	}

	return result;
}

export function textToMarkedString(text: string): MarkedString {
	text = text.replace(/[\\`*_{}[\]()#+\-.!]/g, '\\$&'); // escape markdown syntax tokens: http://daringfireball.net/projects/markdown/syntax#backslash
	return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function getEntryStringDescription(entry: IEntry2, settings?: HoverSettings): string {
	if (!entry.description || entry.description === '') {
		return '';
	}

	if (typeof entry.description !== 'string') {
		return entry.description.value;
	}

	let result: string = '';

	if (settings?.documentation !== false) {
		if (entry.status) {
			result += getEntryStatus(entry.status);
		}
		result += entry.description;

		const browserLabel = getBrowserLabel(entry.browsers);
		if (browserLabel) {
			result += '\n(' + browserLabel + ')';
		}
		if ('syntax' in entry) {
			result += `\n\nSyntax: ${entry.syntax}`;
		}
	}
	if (entry.references && entry.references.length > 0 && settings?.references !== false) {
		if (result.length > 0) {
			result += '\n\n';
		}
		result += entry.references.map(r => {
			return `${r.name}: ${r.url}`;
		}).join(' | ');
	}

	return result;
}

function getEntryMarkdownDescription(entry: IEntry2, settings?: HoverSettings): string {
	if (!entry.description || entry.description === '') {
		return '';
	}

	let result: string = '';
	if (settings?.documentation !== false) {
		if (entry.status) {
			result += getEntryStatus(entry.status);
		}
	
		if (typeof entry.description === 'string') {
			result += textToMarkedString(entry.description);
		} else {
			result += entry.description.kind === MarkupKind.Markdown ? entry.description.value : textToMarkedString(entry.description.value);
		}

		const browserLabel = getBrowserLabel(entry.browsers);
		if (browserLabel) {
			result += '\n\n(' + textToMarkedString(browserLabel) + ')';
		}
		if ('syntax' in entry && entry.syntax) {
			result += `\n\nSyntax: ${textToMarkedString(entry.syntax)}`;
		}
	}
	if (entry.references && entry.references.length > 0 && settings?.references !== false) {
		if (result.length > 0) {
			result += '\n\n';
		}
		result += entry.references.map(r => {
			return `[${r.name}](${r.url})`;
		}).join(' | ');
	}

	return result;
}

/**
 * Input is like `["E12","FF49","C47","IE","O"]`
 * Output is like `Edge 12, Firefox 49, Chrome 47, IE, Opera`
 */
export function getBrowserLabel(browsers: string[] = []): string | null {
	if (browsers.length === 0) {
		return null;
	}

	return browsers
		.map(b => {
			let result = '';
			const matches = b.match(/([A-Z]+)(\d+)?/)!;

			const name = matches[1];
			const version = matches[2];

			if (name in browserNames) {
				result += browserNames[name as keyof typeof browserNames];
			}
			if (version) {
				result += ' ' + version;
			}
			return result;
		})
		.join(', ');
}

export type IEntry2 = IPropertyData | IAtDirectiveData | IPseudoClassData | IPseudoElementData | IValueData;

/**
 * Todo@Pine: Drop these two types and use IEntry2
 */
export interface IEntry {
	name: string;
	description?: string | MarkupContent;
	browsers?: string[];
	restrictions?: string[];
	status?: EntryStatus;
	syntax?: string;
	values?: IValue[];
}

export interface IValue {
	name: string;
	description?: string | MarkupContent;
	browsers?: string[];
}
