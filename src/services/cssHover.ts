/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import * as languageFacts from '../languageFacts/facts';
import { SelectorPrinting } from './selectorPrinting';
import { startsWith } from '../utils/strings';
import { TextDocument, Range, Position, Hover, MarkedString, MarkupContent, MarkupKind, ClientCapabilities, HoverSettings } from '../cssLanguageTypes';
import { isDefined } from '../utils/objects';
import { CSSDataManager } from '../languageFacts/dataManager';

export class CSSHover {
	private supportsMarkdown: boolean | undefined;
	private readonly selectorPrinting: SelectorPrinting;
	private defaultSettings?: HoverSettings;

	constructor(private readonly clientCapabilities: ClientCapabilities | undefined, private readonly cssDataManager: CSSDataManager) {
		this.selectorPrinting = new SelectorPrinting(cssDataManager);
	}

	public configure(settings: HoverSettings | undefined) {
		this.defaultSettings = settings;
	}


	public doHover(document: TextDocument, position: Position, stylesheet: nodes.Stylesheet, settings = this.defaultSettings): Hover | null {
		function getRange(node: nodes.Node) {
			return Range.create(document.positionAt(node.offset), document.positionAt(node.end));
		}
		const offset = document.offsetAt(position);
		const nodepath = nodes.getNodePath(stylesheet, offset);

		/**
		 * nodepath is top-down
		 * Build up the hover by appending inner node's information
		 */
		let hover: Hover | null = null;

		for (let i = 0; i < nodepath.length; i++) {
			const node = nodepath[i];

			if (node instanceof nodes.Selector) {
				hover = {
					contents: this.selectorPrinting.selectorToMarkedString(<nodes.Selector>node),
					range: getRange(node)
				};
				break;
			}

			if (node instanceof nodes.SimpleSelector) {
				/**
				 * Some sass specific at rules such as `@at-root` are parsed as `SimpleSelector`
				 */
				if (!startsWith(node.getText(), '@')) {
					hover = {
						contents: this.selectorPrinting.simpleSelectorToMarkedString(<nodes.SimpleSelector>node),
						range: getRange(node)
					};
				}
				break;
			}

			if (node instanceof nodes.Declaration) {
				const propertyName = node.getFullPropertyName();
				const entry = this.cssDataManager.getProperty(propertyName);
				if (entry) {
					const contents = languageFacts.getEntryDescription(entry, this.doesSupportMarkdown(), settings);
					if (contents) {
						hover = {
							contents,
							range: getRange(node)
						};
					} else {
						hover = null;
					}
				}
				continue;
			}

			if (node instanceof nodes.UnknownAtRule) {
				const atRuleName = node.getText();
				const entry = this.cssDataManager.getAtDirective(atRuleName);
				if (entry) {
					const contents = languageFacts.getEntryDescription(entry, this.doesSupportMarkdown(), settings);
					if (contents) {
						hover = {
							contents,
							range: getRange(node)
						};
					} else {
						hover = null;
					}
				}
				continue;
			}

			if (node instanceof nodes.Node && node.type === nodes.NodeType.PseudoSelector) {
				const selectorName = node.getText();
				const entry =
					selectorName.slice(0, 2) === '::'
						? this.cssDataManager.getPseudoElement(selectorName)
						: this.cssDataManager.getPseudoClass(selectorName);
				if (entry) {
					const contents = languageFacts.getEntryDescription(entry, this.doesSupportMarkdown(), settings);
					if (contents) {
						hover = {
							contents,
							range: getRange(node)
						};
					} else {
						hover = null;
					}
				}
				continue;
			}
		}


		if (hover) {
			hover.contents = this.convertContents(hover.contents);
		}

		return hover;
	}

	private convertContents(contents: MarkupContent | MarkedString | MarkedString[]): MarkupContent | MarkedString | MarkedString[] {
		if (!this.doesSupportMarkdown()) {
			if (typeof contents === 'string') {
				return contents;
			}
			// MarkupContent
			else if ('kind' in contents) {
				return {
					kind: 'plaintext',
					value: contents.value
				};
			}
			// MarkedString[]
			else if (Array.isArray(contents)) {
				return contents.map(c => {
					return typeof c === 'string' ? c : c.value;
				});
			}
			// MarkedString
			else {
				return contents.value;
			}
		}

		return contents;
	}

	private doesSupportMarkdown() {
		if (!isDefined(this.supportsMarkdown)) {
			if (!isDefined(this.clientCapabilities)) {
				this.supportsMarkdown = true;
				return this.supportsMarkdown;
			}

			const hover = this.clientCapabilities.textDocument && this.clientCapabilities.textDocument.hover;
			this.supportsMarkdown = hover && hover.contentFormat && Array.isArray(hover.contentFormat) && hover.contentFormat.indexOf(MarkupKind.Markdown) !== -1;
		}
		return <boolean>this.supportsMarkdown;
	}
}
