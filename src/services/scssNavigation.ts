/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CSSNavigation } from './cssNavigation';
import { FileSystemProvider, DocumentContext, FileType, DocumentUri } from '../cssLanguageTypes';
import { TextDocument, DocumentLink } from '../cssLanguageService';
import * as nodes from '../parser/cssNodes';
import { URI } from 'vscode-uri';

export class SCSSNavigation extends CSSNavigation {
	constructor(private fileSystemProvider?: FileSystemProvider) {
		super();
	}

	public findDocumentLinks(
		document: TextDocument,
		stylesheet: nodes.Stylesheet,
		documentContext: DocumentContext
	): DocumentLink[] {
		return super.findDocumentLinks(document, stylesheet, documentContext);
	}

	public async findDocumentLinks2(
		document: TextDocument,
		stylesheet: nodes.Stylesheet,
		documentContext: DocumentContext
	): Promise<DocumentLink[]> {
		const links = this.findDocumentLinks(document, stylesheet, documentContext);
		const fsProvider = this.fileSystemProvider;

		/**
		 * Validate and correct links
		 */
		if (fsProvider) {
			for (let i = 0; i < links.length; i++) {
				const parsedUri = URI.parse(links[i].target);
				
				const pathVariations = toPathVariations(parsedUri);
				if (!pathVariations) {
					continue;
				}
				
				for (let j = 0; j < pathVariations.length; j++) {
					if (await fileExists(pathVariations[j])) {
						links[i].target = pathVariations[j];
						break;
					}
				}
			}
		}

		return links;

		function toPathVariations(uri: URI): DocumentUri[] | undefined {
			// No variation for links that ends with suffix
			if (uri.path.endsWith('.scss') || uri.path.endsWith('.css')) {
				return undefined;
			}

			// If a link is like a/, try resolving a/index.scss and a/_index.scss
			if (uri.path.endsWith('/')) {
				return [
					uri.with({ path: uri.path + 'index.scss' }).toString(),
					uri.with({ path: uri.path + '_index.scss' }).toString()
				];
			}

			// Use `uri.path` since it's normalized to use `/` in all platforms
			const pathFragments = uri.path.split('/');
			const basename = pathFragments[pathFragments.length - 1];
			const pathWithoutBasename = uri.path.slice(0, -basename.length);

			// No variation for links such as _a
			if (basename.startsWith('_')) {
				if (uri.path.endsWith('.scss')) {
					return undefined;
				} else {
					return [
						uri.with({ path: uri.path + '.scss' }).toString(),
					];
				}
			}

			const normalizedBasename = basename + '.scss';
			
			const documentUriWithBasename = (newBasename) => {
				return uri.with({ path: pathWithoutBasename + newBasename }).toString();
			};

			const normalizedPath = documentUriWithBasename(normalizedBasename);
			const underScorePath = documentUriWithBasename('_' + normalizedBasename);
			const indexPath = documentUriWithBasename(normalizedBasename.slice(0, -5) + '/index.scss');
			const indexUnderscoreUri = documentUriWithBasename(normalizedBasename.slice(0, -5) + '/_index.scss');
			const cssPath = documentUriWithBasename(normalizedBasename.slice(0, -5) + '.css');
			
			return [
				normalizedPath,
				underScorePath,
				indexPath,
				indexUnderscoreUri,
				cssPath
			];
		}

		async function fileExists(documentUri: DocumentUri) {
			if (!fsProvider) {
				return false;
			}

			try {
				const stat = await fsProvider.stat(documentUri);
				if (stat.type === FileType.Unknown && stat.size === -1) {
					return false;
				}

				return true;
			} catch (err) {
				return false;
			}
		}
	}
}
