/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import * as languageFacts from './languageFacts';
import { TextDocument, Range, Position, Hover, MarkedString } from 'vscode-languageserver-types';
import { selectorToMarkedString, simpleSelectorToMarkedString } from './selectorPrinting';

export class CSSHover {

	constructor() {
	}
	
	public doHover(document: TextDocument, position: Position, stylesheet: nodes.Stylesheet): Hover {

		function getRange(node: nodes.Node) {
			return Range.create(document.positionAt(node.offset), document.positionAt(node.end));
		}

		let offset = document.offsetAt(position);
		let nodepath = nodes.getNodePath(stylesheet, offset);

		for (let i = 0; i < nodepath.length; i++) {
			let node = nodepath[i];
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
				let propertyName = node.getFullPropertyName();
				let entry = languageFacts.builtinCSSDataSet.properties[propertyName];
				if (entry) {
					let contents: MarkedString[] = [];
					if (entry.description) {
						contents.push(MarkedString.fromPlainText(entry.description));
					}
					let browserLabel = languageFacts.getBrowserLabel(entry.browsers);
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

		return null;
	}
}

