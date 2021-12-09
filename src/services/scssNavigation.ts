/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { CSSNavigation } from './cssNavigation';
import { FileSystemProvider, DocumentContext, FileType, DocumentUri } from '../cssLanguageTypes';
import * as nodes from '../parser/cssNodes';
import { URI } from 'vscode-uri';
import { startsWith } from '../utils/strings';

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

	protected async resolveRelativeReference(ref: string, documentUri: string, documentContext: DocumentContext, isRawLink?: boolean): Promise<string | undefined> {
		if (startsWith(ref, 'sass:')) {
			return undefined; // sass library
		}
		const target = await super.resolveRelativeReference(ref, documentUri, documentContext, isRawLink);
		if (this.fileSystemProvider && target && isRawLink) {
			const parsedUri = URI.parse(target);
			try {
				const pathVariations = toPathVariations(parsedUri);
				if (pathVariations) {
					for (let j = 0; j < pathVariations.length; j++) {
						if (await this.fileExists(pathVariations[j])) {
							return pathVariations[j];
						}
					}
				}
			} catch (e) {
				// ignore

			}
		}
		return target;

		function toPathVariations(uri: URI): DocumentUri[] | undefined {
			// No valid path
			if (uri.path === '') {
				return undefined;
			}

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
					return [uri.with({ path: uri.path + '.scss' }).toString()];
				}
			}

			const normalizedBasename = basename + '.scss';

			const documentUriWithBasename = (newBasename: string) => {
				return uri.with({ path: pathWithoutBasename + newBasename }).toString();
			};

			const normalizedPath = documentUriWithBasename(normalizedBasename);
			const underScorePath = documentUriWithBasename('_' + normalizedBasename);
			const indexPath = documentUriWithBasename(normalizedBasename.slice(0, -5) + '/index.scss');
			const indexUnderscoreUri = documentUriWithBasename(normalizedBasename.slice(0, -5) + '/_index.scss');
			const cssPath = documentUriWithBasename(normalizedBasename.slice(0, -5) + '.css');

			return [normalizedPath, underScorePath, indexPath, indexUnderscoreUri, cssPath];
		}
	}
}
