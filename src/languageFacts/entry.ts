/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { EntryStatus, BaselineStatus, IPropertyData, IAtDirectiveData, IPseudoClassData, IPseudoElementData, IValueData, MarkupContent, MarkupKind, MarkedString, HoverSettings, BaselineSupport } from '../cssLanguageTypes';

export const browserNames = {
	'chrome': {
		name: 'Chrome',
		platform: 'desktop'
	},
	'chrome_android': {
		name: 'Chrome',
		platform: 'Android'
	},
	'edge': {
		name: 'Edge',
		platform: 'desktop'
	},
	'firefox': {
		name: 'Firefox',
		platform: 'desktop'
	},
	'firefox_android': {
		name: 'Firefox',
		platform: 'Android'
	},
	'safari': {
		name: 'Safari',
		platform: 'macOS'
	},
	'safari_ios': {
		name: 'Safari',
		platform: 'iOS'
	}
};

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

function getEntryBaselineStatus(baselineStatus: BaselineStatus): string {
	if (baselineStatus.baseline === false) {
		const missingBrowsers = getMissingBaselineBrowsers(baselineStatus.support);
		let status = `Limited availability across major browsers`;
		if (missingBrowsers) {
			status += ` (Not fully implemented in ${missingBrowsers})`;
		}
		return status;
	}

	const baselineYear = baselineStatus.baseline_low_date?.split('-')[0];
	return `${baselineStatus.baseline === 'low' ? 'Newly' : 'Widely'} available across major browsers (Baseline since ${baselineYear})`;
}

function getEntryBaselineImage(baselineStatus?: BaselineStatus) {
	if (!baselineStatus) {
		return '';
	}
	
	let baselineImg: string;
	switch (baselineStatus?.baseline) {
		case 'low':
			baselineImg = 'new-sq-14.png';
			break;
		case 'high':
			baselineImg = 'wide-sq-14.png';
			break;
		default:
			baselineImg = 'limited-sq-14.png';
	}
	return `![Baseline icon](https://rviscomi.github.io/web-features/gh-pages/src/assets/img/${baselineImg})`;
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
		if (entry.baselineStatus) {
			result += `_${getEntryBaselineStatus(entry.baselineStatus)}_\n\n`;
		}

		if (entry.status) {
			result += getEntryStatus(entry.status);
		}

		result += entry.description;

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
		result += `### `;
		if (entry.baselineStatus) {
			result += `${getEntryBaselineImage(entry.baselineStatus)} `;
		}
		result += `${entry.name}\n`;

		if (entry.baselineStatus) {
			result += `_${getEntryBaselineStatus(entry.baselineStatus)}_\n\n`;
		}

		if (entry.status) {
			result += getEntryStatus(entry.status);
		}
	
		if (typeof entry.description === 'string') {
			result += textToMarkedString(entry.description);
		} else {
			result += entry.description.kind === MarkupKind.Markdown ? entry.description.value : textToMarkedString(entry.description.value);
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

const missingBaselineBrowserFormatter = new Intl.ListFormat("en", {
	style: "long",
	type: "disjunction",
});

/**
 * Input is like {'chrome': '93', 'edge': '93', 'firefox': '92'}
 * Output is like `Safari`
 */
export function getMissingBaselineBrowsers(support?: BaselineSupport): string {
	if (!support) {
		return '';
	}
	const missingBrowsers = new Map(Object.entries(browserNames));
	for (const browser in support) {
		missingBrowsers.delete(browser);
	}

	return missingBaselineBrowserFormatter.format(Object.values(Array.from(missingBrowsers.entries()).reduce((browsers: Record<string, string>, [browserId, browser]) => {
		if (browser.name in browsers || browserId == 'edge') {
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
