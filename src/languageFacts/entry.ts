/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { EntryStatus, BaselineStatus, IPropertyData, IAtDirectiveData, IPseudoClassData, IPseudoElementData, IValueData, MarkupContent, MarkupKind, MarkedString, HoverSettings } from '../cssLanguageTypes';

export const browserNames = {
	'C': {
		name: 'Chrome',
		platform: 'desktop'
	},
	'CA': {
		name: 'Chrome',
		platform: 'Android'
	},
	'E': {
		name: 'Edge',
		platform: 'desktop'
	},
	'FF': {
		name: 'Firefox',
		platform: 'desktop'
	},
	'FFA': {
		name: 'Firefox',
		platform: 'Android'
	},
	'S': {
		name: 'Safari',
		platform: 'macOS'
	},
	'SM': {
		name: 'Safari',
		platform: 'iOS'
	}
};

const shortCompatPattern = /(E|FFA|FF|SM|S|CA|C|IE|O)([\d|\.]+)?/;

export const BaselineImages = {
	BASELINE_LIMITED: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCA1NDAgMzAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzdHlsZT4KICAgIC5ncmF5LXNoYXBlIHsKICAgICAgZmlsbDogI0M2QzZDNjsgLyogTGlnaHQgbW9kZSAqLwogICAgfQoKICAgIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspIHsKICAgICAgLmdyYXktc2hhcGUgewogICAgICAgIGZpbGw6ICM1NjU2NTY7IC8qIERhcmsgbW9kZSAqLwogICAgICB9CiAgICB9CiAgPC9zdHlsZT4KICA8cGF0aCBkPSJNMTUwIDBMMjQwIDkwTDIxMCAxMjBMMTIwIDMwTDE1MCAwWiIgZmlsbD0iI0YwOTQwOSIvPgogIDxwYXRoIGQ9Ik00MjAgMzBMNTQwIDE1MEw0MjAgMjcwTDM5MCAyNDBMNDgwIDE1MEwzOTAgNjBMNDIwIDMwWiIgY2xhc3M9ImdyYXktc2hhcGUiLz4KICA8cGF0aCBkPSJNMzMwIDE4MEwzMDAgMjEwTDM5MCAzMDBMNDIwIDI3MEwzMzAgMTgwWiIgZmlsbD0iI0YwOTQwOSIvPgogIDxwYXRoIGQ9Ik0xMjAgMzBMMTUwIDYwTDYwIDE1MEwxNTAgMjQwTDEyMCAyNzBMMCAxNTBMMTIwIDMwWiIgY2xhc3M9ImdyYXktc2hhcGUiLz4KICA8cGF0aCBkPSJNMzkwIDBMNDIwIDMwTDE1MCAzMDBMMTIwIDI3MEwzOTAgMFoiIGZpbGw9IiNGMDk0MDkiLz4KPC9zdmc+',
	BASELINE_LOW: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCA1NDAgMzAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzdHlsZT4KICAgIC5ibHVlLXNoYXBlIHsKICAgICAgZmlsbDogI0E4QzdGQTsgLyogTGlnaHQgbW9kZSAqLwogICAgfQoKICAgIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspIHsKICAgICAgLmJsdWUtc2hhcGUgewogICAgICAgIGZpbGw6ICMyRDUwOUU7IC8qIERhcmsgbW9kZSAqLwogICAgICB9CiAgICB9CgogICAgLmRhcmtlci1ibHVlLXNoYXBlIHsKICAgICAgICBmaWxsOiAjMUI2RUYzOwogICAgfQoKICAgIEBtZWRpYSAocHJlZmVycy1jb2xvci1zY2hlbWU6IGRhcmspIHsKICAgICAgICAuZGFya2VyLWJsdWUtc2hhcGUgewogICAgICAgICAgICBmaWxsOiAjNDE4NUZGOwogICAgICAgIH0KICAgIH0KCiAgPC9zdHlsZT4KICA8cGF0aCBkPSJNMTUwIDBMMTgwIDMwTDE1MCA2MEwxMjAgMzBMMTUwIDBaIiBjbGFzcz0iYmx1ZS1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0yMTAgNjBMMjQwIDkwTDIxMCAxMjBMMTgwIDkwTDIxMCA2MFoiIGNsYXNzPSJibHVlLXNoYXBlIi8+CiAgPHBhdGggZD0iTTQ1MCA2MEw0ODAgOTBMNDUwIDEyMEw0MjAgOTBMNDUwIDYwWiIgY2xhc3M9ImJsdWUtc2hhcGUiLz4KICA8cGF0aCBkPSJNNTEwIDEyMEw1NDAgMTUwTDUxMCAxODBMNDgwIDE1MEw1MTAgMTIwWiIgY2xhc3M9ImJsdWUtc2hhcGUiLz4KICA8cGF0aCBkPSJNNDUwIDE4MEw0ODAgMjEwTDQ1MCAyNDBMNDIwIDIxMEw0NTAgMTgwWiIgY2xhc3M9ImJsdWUtc2hhcGUiLz4KICA8cGF0aCBkPSJNMzkwIDI0MEw0MjAgMjcwTDM5MCAzMDBMMzYwIDI3MEwzOTAgMjQwWiIgY2xhc3M9ImJsdWUtc2hhcGUiLz4KICA8cGF0aCBkPSJNMzMwIDE4MEwzNjAgMjEwTDMzMCAyNDBMMzAwIDIxMEwzMzAgMTgwWiIgY2xhc3M9ImJsdWUtc2hhcGUiLz4KICA8cGF0aCBkPSJNOTAgNjBMMTIwIDkwTDkwIDEyMEw2MCA5MEw5MCA2MFoiIGNsYXNzPSJibHVlLXNoYXBlIi8+CiAgPHBhdGggZD0iTTM5MCAwTDQyMCAzMEwxNTAgMzAwTDAgMTUwTDMwIDEyMEwxNTAgMjQwTDM5MCAwWiIgY2xhc3M9ImRhcmtlci1ibHVlLXNoYXBlIi8+Cjwvc3ZnPg==',
	BASELINE_HIGH: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTgiIGhlaWdodD0iMTAiIHZpZXdCb3g9IjAgMCA1NDAgMzAwIiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPgogIDxzdHlsZT4KICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgIGZpbGw6ICNDNEVFRDA7IC8qIExpZ2h0IG1vZGUgKi8KICAgIH0KCiAgICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKSB7CiAgICAgIC5ncmVlbi1zaGFwZSB7CiAgICAgICAgZmlsbDogIzEyNTIyNTsgLyogRGFyayBtb2RlICovCiAgICAgIH0KICAgIH0KICA8L3N0eWxlPgogIDxwYXRoIGQ9Ik00MjAgMzBMMzkwIDYwTDQ4MCAxNTBMMzkwIDI0MEwzMzAgMTgwTDMwMCAyMTBMMzkwIDMwMEw1NDAgMTUwTDQyMCAzMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0xNTAgMEwzMCAxMjBMNjAgMTUwTDE1MCA2MEwyMTAgMTIwTDI0MCA5MEwxNTAgMFoiIGNsYXNzPSJncmVlbi1zaGFwZSIvPgogIDxwYXRoIGQ9Ik0zOTAgMEw0MjAgMzBMMTUwIDMwMEwwIDE1MEwzMCAxMjBMMTUwIDI0MEwzOTAgMFoiIGZpbGw9IiMxRUE0NDYiLz4KPC9zdmc+'
}

function getEntryStatus(status: EntryStatus) {
	switch (status) {
		case 'nonstandard':
			return '🚨️ Property is nonstandard. Avoid using it.\n\n';
		case 'obsolete':
			return '🚨️️️ Property is obsolete. Avoid using it.\n\n';
		default:
			return '';
	}
}

function getEntryBaselineStatus(baseline: BaselineStatus, browsers?: string[]): string {
	if (baseline.status === "false") {
		const missingBrowsers = getMissingBaselineBrowsers(browsers);
		let status = `Limited availability across major browsers`;
		if (missingBrowsers) {
			status += ` (Not fully implemented in ${missingBrowsers})`;
		}
		return status;
	}

	const baselineYear = baseline.baseline_low_date?.split('-')[0];
	return `${baseline.status === 'low' ? 'Newly' : 'Widely'} available across major browsers (Baseline since ${baselineYear})`;
}

function getEntryBaselineImage(baseline?: BaselineStatus) {
	if (!baseline) {
		return '';
	}
	
	let baselineImg: string;
	switch (baseline?.status) {
		case 'low':
			baselineImg = BaselineImages.BASELINE_LOW;
			break;
		case 'high':
			baselineImg = BaselineImages.BASELINE_HIGH;
			break;
		default:
			baselineImg = BaselineImages.BASELINE_LIMITED;
	}
	return `![Baseline icon](${baselineImg})`;
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
		let status = '';
		if (entry.status) {
			status = getEntryStatus(entry.status);
			result += status;
		}

		result += entry.description;

		if (entry.baseline && !status) { 
			result += `\n\n${getEntryBaselineStatus(entry.baseline, entry.browsers)}`;
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
		let status = '';
		if (entry.status) {
			status = getEntryStatus(entry.status);
			result += status;
		}
	
		if (typeof entry.description === 'string') {
			result += textToMarkedString(entry.description);
		} else {
			result += entry.description.kind === MarkupKind.Markdown ? entry.description.value : textToMarkedString(entry.description.value);
		}

		if (entry.baseline && !status) {
			result += `\n\n${getEntryBaselineImage(entry.baseline)} _${getEntryBaselineStatus(entry.baseline, entry.browsers)}_`;
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

// TODO: Remove "as any" when tsconfig supports es2021+
const missingBaselineBrowserFormatter = new (Intl as any).ListFormat("en", {
	style: "long",
	type: "disjunction",
});

/**
 * Input is like [E12, FF28, FM28, C29, CM29, IE11, O16]
 * Output is like `Safari`
 */
export function getMissingBaselineBrowsers(browsers?: string[]): string {
	if (!browsers) {
		return '';
	}
	const missingBrowsers = new Map(Object.entries(browserNames));
	for (const shortCompatString of browsers) {
		const match = shortCompatPattern.exec(shortCompatString);
		if (!match) {
			continue;
		}
		const browser = match[1];
		missingBrowsers.delete(browser);
	}

	return missingBaselineBrowserFormatter.format(Object.values(Array.from(missingBrowsers.entries()).reduce((browsers: Record<string, string>, [browserId, browser]) => {
		if (browser.name in browsers || browserId === 'E') {
			browsers[browser.name] = browser.name;
			return browsers;
		}
		// distinguish between platforms when applicable 
		browsers[browser.name] = `${browser.name} on ${browser.platform}`;
		return browsers;
	}, {})));
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
