/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import * as languageFacts from '../languageFacts/facts';
import { TextDocument, Range, Position, Hover, MarkedString, MarkupContent } from 'vscode-languageserver-types';
import { selectorToMarkedString, simpleSelectorToMarkedString } from './selectorPrinting';

export class CSSHover {
	constructor() {}

	public doHover(document: TextDocument, position: Position, stylesheet: nodes.Stylesheet): Hover {
		function getRange(node: nodes.Node) {
			return Range.create(document.positionAt(node.offset), document.positionAt(node.end));
		}

		const offset = document.offsetAt(position);
		const nodepath = nodes.getNodePath(stylesheet, offset);

		for (let i = 0; i < nodepath.length; i++) {
			const node = nodepath[i];
			if (node instanceof nodes.UnknownAtRule) {
				const atRuleName = node.getText();
				const entry = languageFacts.cssDataManager.getAtDirective(atRuleName);
				if (entry) {
					return {
						contents: entry.description,
						range: getRange(node)
					};
				} else {
					return null;
				}
			}
			if (node instanceof nodes.Node && node.type === nodes.NodeType.PseudoSelector) {
				const selectorName = node.getText();
				const entry =
					selectorName[0] === ':'
						? languageFacts.cssDataManager.getPseudoClass(selectorName)
						: languageFacts.cssDataManager.getPseudoElement(selectorName);
				if (entry) {
					return {
						contents: entry.description,
						range: getRange(node)
					};
				} else {
					return null;
				}
			}
			if (node instanceof nodes.Selector) {
				return {
					contents: selectorToMarkedString(<nodes.Selector>node),
					range: getRange(node)
				};
			}
			if (node instanceof nodes.SimpleSelector) {
				return {
					contents: simpleSelectorToMarkedString(<nodes.SimpleSelector>node),
					range: getRange(node)
				};
			}
			if (node instanceof nodes.Declaration) {
				const propertyName = node.getFullPropertyName();
				const entry = languageFacts.cssDataManager.getProperty(propertyName);
				if (entry) {
					if (typeof entry.description !== 'string') {
						return {
							contents: entry.description,
							range: getRange(node)
						};
					} else {
						const contents: MarkedString[] = [];
						if (entry.description) {
							contents.push(MarkedString.fromPlainText(entry.description));
						}
						const browserLabel = languageFacts.getBrowserLabel(entry.browsers);
						if (browserLabel) {
							contents.push(MarkedString.fromPlainText(browserLabel));
						}
						if (contents.length) {
							return {
								contents: contents,
								range: getRange(node)
							};
						}
					}
				}
			}
		}

		return null;
	}
}
