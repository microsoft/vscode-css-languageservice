/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CSSNavigation, getModuleNameFromPath } from './cssNavigation.js';
import { FileSystemProvider, DocumentContext, FileType, DocumentUri } from '../cssLanguageTypes.js';
import * as nodes from '../parser/cssNodes.js';
import { URI, Utils } from 'vscode-uri';
import { convertSimple2RegExpPattern, startsWith } from '../utils/strings.js';
import { dirname, joinPath } from '../utils/resources.js';

export class SCSSNavigation extends CSSNavigation {
	constructor(fileSystemProvider: FileSystemProvider | undefined) {
		super(fileSystemProvider, true);
	}

	protected isRawStringDocumentLinkNode(node: nodes.Node): boolean {
		return (
			super.isRawStringDocumentLinkNode(node) ||
			node.type === nodes.NodeType.Use ||
			node.type === nodes.NodeType.Forward
		);
	}

	protected async mapReference(target: string | undefined, isRawLink: boolean): Promise<string | undefined> {
		if (this.fileSystemProvider && target && isRawLink) {
			const pathVariations = toPathVariations(target);
			for (const variation of pathVariations) {
				if (await this.fileExists(variation)) {
					return variation;
				}
			}
		}
		return target;
	}

	protected async resolveReference(target: string, documentUri: string, documentContext: DocumentContext, isRawLink = false): Promise<string | undefined> {
		if (startsWith(target, 'sass:')) {
			return undefined; // sass library
		}
		// Following the [sass package importer](https://github.com/sass/sass/blob/f6832f974c61e35c42ff08b3640ff155071a02dd/js-api-doc/importer.d.ts#L349),
		// look for the `exports` field of the module and any `sass`, `style` or `default` that matches the import.
		// If it's only `pkg:module`, also look for `sass` and `style` on the root of package.json.
		if (target.startsWith('pkg:')) {
			return this.resolvePackageExports(target.replace('pkg:', ''), documentUri, documentContext);
		}
		// Bundlers such as Vite and webpack also apply the `exports` field to imports without the `pkg:` prefix.
		// With `"./styles/*": "./dist/styles/*"` the import string doesn't match the file system,
		// so look up `exports` before falling back to a plain `node_modules` path.
		// A relative file still takes precedence, like in the Sass compiler.
		if (this.fileSystemProvider && isBareModulePath(target)) {
			const relativeRef = await this.mapReference(documentContext.resolveReference(target, documentUri), isRawLink);
			if (relativeRef && await this.fileExists(relativeRef)) {
				return relativeRef;
			}
			const exportsRef = await this.resolvePackageExports(target, documentUri, documentContext);
			if (exportsRef && await this.fileExists(exportsRef)) {
				return exportsRef;
			}
		}
		return super.resolveReference(target, documentUri, documentContext, isRawLink);
	}

	private async resolvePackageExports(bareTarget: string, documentUri: string, documentContext: DocumentContext): Promise<string | undefined> {
		const moduleName = bareTarget.includes('/') ? getModuleNameFromPath(bareTarget) : bareTarget;
		if (!moduleName) {
			return undefined;
		}
		const rootFolderUri = documentContext.resolveReference('/', documentUri);
		const documentFolderUri = dirname(documentUri);
		const modulePath = await this.resolvePathToModule(moduleName, documentFolderUri, rootFolderUri);
		if (!modulePath) {
			return undefined;
		}
		// Since submodule exports import strings don't match the file system,
		// we need the contents of `package.json` to look up the correct path.
		let packageJsonContent = await this.getContent(joinPath(modulePath, 'package.json'));
		if (!packageJsonContent) {
			return undefined;
		}
		let packageJson: {
			style?: string;
			sass?: string;
			exports?: PackageExport
		};
		try {
			packageJson = JSON.parse(packageJsonContent);
		} catch (e) {
			// problems parsing package.json
			return undefined;
		}

		const subpath = bareTarget.substring(moduleName.length + 1);
		const exports = packageJson.exports;
		if (exports) {
			const exportsMap = typeof exports === 'object' && !Array.isArray(exports) ? exports : {};
			if (!subpath) {
				// exports may look like { "sass": "./_index.scss" } or { ".": { "sass": "./_index.scss" } }
				const rootExport = exportsMap['.'] ?? exports;
				return this.resolveExportEntry(modulePath, getStylesheetEntry(rootExport));
			}
			// The import string may be with or without .scss.
			// Likewise the exports entry. Look up both paths.
			// However, they need to be relative (start with ./).
			const lookupSubpath = subpath.endsWith('.scss') ? `./${subpath.replace('.scss', '')}` : `./${subpath}`;
			const lookupSubpathScss = subpath.endsWith('.scss') ? `./${subpath}` : `./${subpath}.scss`;
			const subpathExport = exportsMap[lookupSubpathScss] ?? exportsMap[lookupSubpath];
			if (subpathExport !== undefined) {
				return this.resolveExportEntry(modulePath, getStylesheetEntry(subpathExport));
			}
			// We have a subpath, but found no matches on direct lookup.
			// It may be a [subpath pattern](https://nodejs.org/api/packages.html#subpath-patterns).
			// Like Node, try the pattern with the longest prefix first.
			const patterns = Object.keys(exportsMap)
				.filter(key => key.includes('*'))
				.sort((a, b) => b.indexOf('*') - a.indexOf('*'));
			for (const pattern of patterns) {
				// Patterns may also be without `.scss` on the left side, so compare without on both sides
				const re = new RegExp(`^${convertSimple2RegExpPattern(pattern.replace('.scss', '')).replace(/\.\*/g, '(.*)')}$`);
				const match = re.exec(lookupSubpath);
				if (!match) {
					continue;
				}
				// The right-hand side of a subpath pattern is also a pattern.
				// Replace the pattern with the match from our regexp capture group above.
				const entry = getStylesheetEntry(exportsMap[pattern])?.replace('*', match[1]);
				const entryPath = await this.resolveExportEntry(modulePath, entry);
				if (entryPath) {
					return entryPath;
				}
			}
		} else if (!subpath && (packageJson.sass || packageJson.style)) {
			// Fall back to a direct lookup on `sass` and `style` on package root
			const entry = packageJson.sass || packageJson.style;
			if (entry) {
				const entryPath = joinPath(modulePath, entry);
				return entryPath;
			}
		}
		return undefined;

	}

	private async resolveExportEntry(modulePath: string, entry: string | undefined): Promise<string | undefined> {
		if (!entry) {
			return undefined;
		}
		const entryPath = joinPath(modulePath, entry);
		// the 'default' entry can be whatever, typically .js – confirm it looks like `scss`
		if (entry.endsWith('.scss')) {
			return entryPath;
		}
		// Entries such as `./dist/styles/*` have no file extension once expanded.
		// Look for partials, index files and extensions the same way Sass does.
		// Anything else, like the `.js` file of a `default` entry, won't match a stylesheet.
		for (const variation of toPathVariations(entryPath)) {
			if (await this.fileExists(variation)) {
				return variation;
			}
		}
		return undefined;
	}

}

type PackageExport = string | null | PackageExport[] | { [conditionOrSubpath: string]: PackageExport };

const stylesheetConditions = ['sass', 'style', 'styles', 'default'];

/**
 * Picks the target of an `exports` entry. A string entry is used as is,
 * conditional entries are checked for `sass`, `style` and `default`.
 */
function getStylesheetEntry(packageExport: PackageExport | undefined): string | undefined {
	if (typeof packageExport === 'string') {
		return packageExport;
	}
	if (Array.isArray(packageExport)) {
		for (const fallback of packageExport) {
			const entry = getStylesheetEntry(fallback);
			if (entry) {
				return entry;
			}
		}
		return undefined;
	}
	if (packageExport) {
		for (const condition of stylesheetConditions) {
			const entry = getStylesheetEntry(packageExport[condition]);
			if (entry) {
				return entry;
			}
		}
	}
	return undefined;
}

/**
 * A module path like `bootstrap/scss/variables` or `@scope/package/styles`,
 * as opposed to a relative path, an absolute path or a URL with a scheme.
 */
function isBareModulePath(target: string): boolean {
	return !/^[./~]/.test(target) && !/^[a-z][a-z0-9+.-]*:/i.test(target);
}

function toPathVariations(target: string): DocumentUri[] {
	// No variation for links that ends with .css suffix
	if (target.endsWith('.css')) {
		return [target];
	}

	// If a link is like a/, try resolving a/index.scss and a/_index.scss
	if (target.endsWith('/')) {
		return [target + 'index.scss', target + '_index.scss'];
	}

	const targetUri = URI.parse(target.replace(/\.scss$/, ''));
	const basename = Utils.basename(targetUri);
	const dirname = Utils.dirname(targetUri);
	if (basename.startsWith('_')) {
		// No variation for links such as _a
		return [Utils.joinPath(dirname, basename + '.scss').toString(true)];
	}

	return [
		Utils.joinPath(dirname, basename + '.scss').toString(true),
		Utils.joinPath(dirname, '_' + basename + '.scss').toString(true),
		target + '/index.scss',
		target + '/_index.scss',
		Utils.joinPath(dirname, basename + '.css').toString(true)
	];
}