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
	BASELINE_LIMITED: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMTMuODg5IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzdHlsZT4uZ3JheS1zaGFwZSB7CiAgICAgIGZpbGw6ICNDNkM2QzY7IC8qIExpZ2h0IG1vZGUgKi8KICAgIH0KCiAgICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKSB7CiAgICAgIC5ncmF5LXNoYXBlIHsKICAgICAgICBmaWxsOiAjNTY1NjU2OyAvKiBEYXJrIG1vZGUgKi8KICAgICAgfQogICAgfTwvc3R5bGU+PHBhdGggZD0ibTYuOTQ0IDAgNC4xNjcgNC4xNjctMS4zODkgMS4zODktNC4xNjctNC4xNjd6IiBmaWxsPSIjRjA5NDA5Ii8+PHBhdGggZD0iTTE5LjQ0NCAxLjM4OSAyNSA2Ljk0NWwtNS41NTYgNS41NTYtMS4zODktMS4zODkgNC4xNjctNC4xNjctNC4xNjctNC4xNjd6IiBjbGFzcz0iZ3JheS1zaGFwZSIvPjxwYXRoIGQ9Im0xNS4yNzggOC4zMzMtMS4zODkgMS4zODkgNC4xNjcgNC4xNjcgMS4zODktMS4zODl6IiBmaWxsPSIjRjA5NDA5Ii8+PHBhdGggZD0ibTUuNTU2IDEuMzg5IDEuMzg5IDEuMzg5LTQuMTY3IDQuMTY3IDQuMTY3IDQuMTY3LTEuMzg5IDEuMzg5TDAgNi45NDR6IiBjbGFzcz0iZ3JheS1zaGFwZSIvPjxwYXRoIGQ9Im0xOC4wNTYgMCAxLjM4OSAxLjM4OS0xMi41IDEyLjVMNS41NTYgMTIuNXoiIGZpbGw9IiNGMDk0MDkiLz48L3N2Zz4=',
	BASELINE_LOW: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMTMuODg5IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzdHlsZT4uYmx1ZS1zaGFwZSB7CiAgICAgIGZpbGw6ICNBOEM3RkE7IC8qIExpZ2h0IG1vZGUgKi8KICAgIH0KCiAgICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKSB7CiAgICAgIC5ibHVlLXNoYXBlIHsKICAgICAgICBmaWxsOiAjMkQ1MDlFOyAvKiBEYXJrIG1vZGUgKi8KICAgICAgfQogICAgfQoKICAgIC5kYXJrZXItYmx1ZS1zaGFwZSB7CiAgICAgICAgZmlsbDogIzFCNkVGMzsKICAgIH0KCiAgICBAbWVkaWEgKHByZWZlcnMtY29sb3Itc2NoZW1lOiBkYXJrKSB7CiAgICAgICAgLmRhcmtlci1ibHVlLXNoYXBlIHsKICAgICAgICAgICAgZmlsbDogIzQxODVGRjsKICAgICAgICB9CiAgICB9PC9zdHlsZT48cGF0aCBkPSJtNi45NDQgMCAxLjM4OSAxLjM4OS0xLjM4OSAxLjM4OS0xLjM4OS0xLjM4OXpNOS43MjIgMi43NzhsMS4zODkgMS4zODktMS4zODkgMS4zODktMS4zODktMS4zODl6TTIwLjgzMyAyLjc3OGwxLjM4OSAxLjM4OS0xLjM4OSAxLjM4OS0xLjM4OS0xLjM4OXpNMjMuNjExIDUuNTU2IDI1IDYuOTQ1bC0xLjM4OSAxLjM4OS0xLjM4OS0xLjM4OXpNMjAuODMzIDguMzMzbDEuMzg5IDEuMzg5LTEuMzg5IDEuMzg5LTEuMzg5LTEuMzg5ek0xOC4wNTYgMTEuMTExbDEuMzg5IDEuMzg5LTEuMzg5IDEuMzg5LTEuMzg5LTEuMzg5ek0xNS4yNzggOC4zMzNsMS4zODkgMS4zODktMS4zODkgMS4zODktMS4zODktMS4zODl6TTQuMTY3IDIuNzc4bDEuMzg5IDEuMzg5LTEuMzg5IDEuMzg5LTEuMzg5LTEuMzg5eiIgY2xhc3M9ImJsdWUtc2hhcGUiLz48cGF0aCBkPSJtMTguMDU2IDAgMS4zODkgMS4zODktMTIuNSAxMi41TDAgNi45NDRsMS4zODktMS4zODkgNS41NTYgNS41NTZ6IiBjbGFzcz0iZGFya2VyLWJsdWUtc2hhcGUiLz48L3N2Zz4=',
	BASELINE_HIGH: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjUiIGhlaWdodD0iMTMuODg5IiBmaWxsPSJub25lIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxzdHlsZT4uZ3JlZW4tc2hhcGUgewogICAgICBmaWxsOiAjQzRFRUQwOyAvKiBMaWdodCBtb2RlICovCiAgICB9CgogICAgQG1lZGlhIChwcmVmZXJzLWNvbG9yLXNjaGVtZTogZGFyaykgewogICAgICAuZ3JlZW4tc2hhcGUgewogICAgICAgIGZpbGw6ICMxMjUyMjU7IC8qIERhcmsgbW9kZSAqLwogICAgICB9CiAgICB9PC9zdHlsZT48cGF0aCBkPSJtMTkuNDQ0IDEuMzg5LTEuMzg5IDEuMzg5IDQuMTY3IDQuMTY3LTQuMTY3IDQuMTY3LTIuNzc4LTIuNzc4LTEuMzg5IDEuMzg5IDQuMTY3IDQuMTY3IDYuOTQ0LTYuOTQ0ek02Ljk0NCAwIDEuMzg5IDUuNTU2bDEuMzg5IDEuMzg5IDQuMTY3LTQuMTY3IDIuNzc4IDIuNzc4IDEuMzg5LTEuMzg5eiIgY2xhc3M9ImdyZWVuLXNoYXBlIi8+PHBhdGggZD0ibTE4LjA1NiAwIDEuMzg5IDEuMzg5LTEyLjUgMTIuNUwwIDYuOTQ0bDEuMzg5LTEuMzg5IDUuNTU2IDUuNTU2eiIgZmlsbD0iIzFFQTQ0NiIvPjwvc3ZnPg=='
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
		if (entry.baseline) { 
			result += `_${getEntryBaselineStatus(entry.baseline, entry.browsers)}_\n\n`;
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
		if (entry.baseline) {
			result += `${getEntryBaselineImage(entry.baseline)} `;
		}
		result += `${entry.name}\n`;

		if (entry.baseline) {
			result += `_${getEntryBaselineStatus(entry.baseline, entry.browsers)}_\n\n`;
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
