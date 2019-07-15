/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CSSNavigation } from './cssNavigation';
import { FileSystemProvider, DocumentContext, FileType } from '../cssLanguageTypes';
import { TextDocument, DocumentLink } from '../cssLanguageService';
import * as nodes from '../parser/cssNodes';

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
		for (let i = 0; i < links.length; i++) {
			if (links[i].target.endsWith('.scss') && !(await fileExists(links[i].target))) {
				const { originalBasename, normalizedBasename, normalizedUri, withBasename } = toNormalizedUri(links[i].target);
				// a.scss case
				if (originalBasename === normalizedBasename && (await fileExists(withBasename('_' + originalBasename)))) {
					links[i].target = withBasename('_' + originalBasename);
					continue;
				}
				// _a.scss case
				else if (originalBasename === '_' + normalizedBasename && (await fileExists(normalizedUri))) {
					links[i].target = normalizedUri;
					continue;
				}

				// a/index.scss and a/_index.scss case
				const indexUri = withBasename(normalizedBasename.replace('.scss', '/index.scss'));
				const _indexUri = withBasename(normalizedBasename.replace('.scss', '/_index.scss'));

				if (await fileExists(indexUri)) {
					links[i].target = indexUri;
				} else if (await fileExists(_indexUri)) {
					links[i].target = _indexUri;
				}
			}
		}

		return links;

		function toNormalizedUri(uri: string) {
			const uriFragments = uri.split('/');
			let normalizedBasename = uriFragments[uriFragments.length - 1];
			if (normalizedBasename.startsWith('_')) {
				normalizedBasename = normalizedBasename.slice(1);
			}
			if (!normalizedBasename.endsWith('.scss')) {
				normalizedBasename += '.scss';
			}

			const normalizedUri = [...uriFragments.slice(0, -1), normalizedBasename].join('/');
			return {
				originalBasename: uriFragments[uriFragments.length - 1],
				normalizedUri,
				normalizedBasename,
				withBasename(newBaseName: string) {
					return [...uriFragments.slice(0, -1), newBaseName].join('/');
				}
			};
		}

		async function fileExists(uri: string) {
			if (!fsProvider) {
				return false;
			}

			try {
				const stat = await fsProvider.stat(uri);
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
