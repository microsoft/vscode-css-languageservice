/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from '../parser/cssNodes';
import { MarkedString, Location } from 'vscode-languageserver-types';
import { Scanner } from '../parser/cssScanner';

import * as nls from 'vscode-nls';
const localize = nls.loadMessageBundle();

export class Element {

	public parent: Element;
	public children: Element[];
	public attributes: { name: string, value: string; }[];

	public findAttribute(name: string): string {
		if (this.attributes) {
			for (let attribute of this.attributes) {
				if (attribute.name === name) {
					return attribute.value;
				}
			}
		}
		return null;
	}

	public addChild(child: Element): void {
		if (child instanceof Element) {
			(<Element>child).parent = this;
		}
		if (!this.children) {
			this.children = [];
		}
		this.children.push(child);
	}

	public append(text: string) {
		if (this.attributes) {
			let last = this.attributes[this.attributes.length - 1];
			last.value = last.value + text;
		}
	}

	public prepend(text: string) {
		if (this.attributes) {
			let first = this.attributes[0];
			first.value = text + first.value;
		}
	}

	public findRoot(): Element {
		let curr: Element = this;
		while (curr.parent && !(curr.parent instanceof RootElement)) {
			curr = curr.parent;
		}
		return curr;
	}

	public removeChild(child: Element): boolean {
		if (this.children) {
			let index = this.children.indexOf(child);
			if (index !== -1) {
				this.children.splice(index, 1);
				return true;
			}
		}
		return false;
	}

	public addAttr(name: string, value: string): void {
		if (!this.attributes) {
			this.attributes = [];
		}
		for (let attribute of this.attributes) {
			if (attribute.name === name) {
				attribute.value += ' ' + value;
				return;
			}
		}
		this.attributes.push({ name, value });
	}

	public clone(cloneChildren: boolean = true): Element {
		let elem = new Element();
		if (this.attributes) {
			elem.attributes = [];
			for (let attribute of this.attributes) {
				elem.addAttr(attribute.name, attribute.value);
			}
		}
		if (cloneChildren && this.children) {
			elem.children = [];
			for (let index = 0; index < this.children.length; index++) {
				elem.addChild(this.children[index].clone());
			}
		}
		return elem;
	}

	public cloneWithParent(): Element {
		let clone = this.clone(false);
		if (this.parent && !(this.parent instanceof RootElement)) {
			let parentClone = this.parent.cloneWithParent();
			parentClone.addChild(clone);
		}
		return clone;
	}
}

export class RootElement extends Element {

}

export class LabelElement extends Element {

	constructor(label: string) {
		super();
		this.addAttr('name', label);
	}
}

class MarkedStringPrinter {

	private result: string[];

	constructor(public quote: string) {
		// empty
	}

	public print(element: Element): MarkedString[] {
		this.result = [];
		if (element instanceof RootElement) {
			this.doPrint(element.children, 0);
		} else {
			this.doPrint([element], 0);
		}

		const value = this.result.join('\n');
		return [{ language: 'html', value }];
	}

	private doPrint(elements: Element[], indent: number) {
		for (let element of elements) {
			this.doPrintElement(element, indent);
			if (element.children) {
				this.doPrint(element.children, indent + 1);
			}
		}
	}

	private writeLine(level: number, content: string) {
		let indent = new Array(level + 1).join('  ');
		this.result.push(indent + content);
	}

	private doPrintElement(element: Element, indent: number) {
		let name = element.findAttribute('name');

		// special case: a simple label
		if (element instanceof LabelElement || name === '\u2026') {
			this.writeLine(indent, name);
			return;
		}

		// the real deal
		let content = ['<'];

		// element name
		if (name) {
			content.push(name);
		} else {
			content.push('element');
		}

		// attributes
		if (element.attributes) {
			for (let attr of element.attributes) {
				if (attr.name !== 'name') {
					content.push(' ');
					content.push(attr.name);
					let value = attr.value;
					if (value) {
						content.push('=');
						content.push(quotes.ensure(value, this.quote));
					}
				}
			}
		}
		content.push('>');

		this.writeLine(indent, content.join(''));
	}
}


namespace quotes {

	export function ensure(value: string, which: string): string {
		return which + remove(value) + which;
	}

	export function remove(value: string): string {
		let match = value.match(/^['"](.*)["']$/);
		if (match) {
			return match[1];
		}
		return value;
	}
}

export function toElement(node: nodes.SimpleSelector, parentElement?: Element): Element {

	let result = new Element();
	for (const child of node.getChildren()) {
		switch (child.type) {
			case nodes.NodeType.SelectorCombinator:
				if (parentElement) {
					let segments = child.getText().split('&');
					if (segments.length === 1) {
						// should not happen
						result.addAttr('name', segments[0]);
						break;
					}
					result = parentElement.cloneWithParent();
					if (segments[0]) {
						let root = result.findRoot();
						root.prepend(segments[0]);
					}
					for (let i = 1; i < segments.length; i++) {
						if (i > 1) {
							let clone = parentElement.cloneWithParent();
							result.addChild(clone.findRoot());
							result = clone;
						}
						result.append(segments[i]);
					}
				}
				break;
			case nodes.NodeType.SelectorPlaceholder:
				if (child.getText() === '@at-root') {
					return result;
				}
			// fall through
			case nodes.NodeType.ElementNameSelector:
				let text = child.getText();
				result.addAttr('name', text === '*' ? 'element' : unescape(text));
				break;
			case nodes.NodeType.ClassSelector:
				result.addAttr('class', unescape(child.getText().substring(1)));
				break;
			case nodes.NodeType.IdentifierSelector:
				result.addAttr('id', unescape(child.getText().substring(1)));
				break;
			case nodes.NodeType.MixinDeclaration:
				result.addAttr('class', (<nodes.MixinDeclaration>child).getName());
				break;
			case nodes.NodeType.PseudoSelector:
				result.addAttr(unescape(child.getText()), '');
				break;
			case nodes.NodeType.AttributeSelector:
				const selector = <nodes.AttributeSelector>child;
				let identifuer = selector.getIdentifier();
				if (identifuer) {
					let expression = selector.getValue();
					let operator = selector.getOperator();
					let value: string;
					if (expression) {
						switch (unescape(operator.getText())) {
							case '|=':
								// excatly or followed by -words
								value = `${quotes.remove(unescape(expression.getText()))}-\u2026`;
								break;
							case '^=':
								// prefix
								value = `${quotes.remove(unescape(expression.getText()))}\u2026`;
								break;
							case '$=':
								// suffix
								value = `\u2026${quotes.remove(unescape(expression.getText()))}`;
								break;
							case '~=':
								// one of a list of words
								value = ` \u2026 ${quotes.remove(unescape(expression.getText()))} \u2026 `;
								break;
							case '*=':
								// substring
								value = `\u2026${quotes.remove(unescape(expression.getText()))}\u2026`;
								break;
							default:
								value = quotes.remove(unescape(expression.getText()));
								break;
						}
					}
					result.addAttr(unescape(identifuer.getText()), value);
				}
				break;
		}
	}
	return result;
}

function unescape(content: string) {
	let scanner = new Scanner();
	scanner.setSource(content);
	let token = scanner.scanUnquotedString();
	if (token) {
		return token.text;
	}
	return content;
}

function selectorToSpecificityMarkedString(node: nodes.Node): MarkedString {
	//https://www.w3.org/TR/selectors-3/#specificity
	function calculateScore(node: nodes.Node) {
		node.getChildren().forEach(element => {
			switch (element.type) {
				case nodes.NodeType.IdentifierSelector:
					specificity[0] += 1;		//a
					break;
				case nodes.NodeType.ClassSelector:
				case nodes.NodeType.AttributeSelector:
					specificity[1] += 1;		//b
					break;
				case nodes.NodeType.ElementNameSelector:
					//ignore universal selector
					if (element.getText() === "*") {
						break;
					}
					specificity[2] += 1;		//c
					break;
				case nodes.NodeType.PseudoSelector:
					if (element.getText().match(/^::/)) {
						specificity[2] += 1;	//c (pseudo element)
					} else {
						//ignore psuedo class NOT
						if (element.getText().match(/^:not/i)) {
							break;
						}
						specificity[1] += 1;	//b (pseudo class)
					}
					break;
			}
			if (element.getChildren().length > 0) {
				calculateScore(element);
			}
		});
	}

	let specificity = [0, 0, 0]; //a,b,c
	calculateScore(node);
	return localize('specificity', "[Selector Specificity](https://developer.mozilla.org/en-US/docs/Web/CSS/Specificity): ({0}, {1}, {2})", ...specificity);
}

export function selectorToMarkedString(node: nodes.Selector): MarkedString[] {
	let root = selectorToElement(node);
	let markedStrings = new MarkedStringPrinter('"').print(root);
	markedStrings.push(selectorToSpecificityMarkedString(node));
	return markedStrings;
}

export function simpleSelectorToMarkedString(node: nodes.SimpleSelector): MarkedString[] {
	let element = toElement(node);
	let markedStrings = new MarkedStringPrinter('"').print(element);
	markedStrings.push(selectorToSpecificityMarkedString(node));
	return markedStrings;
}

class SelectorElementBuilder {

	private prev: nodes.Node;
	private element: Element;

	public constructor(element: Element) {
		this.prev = null;
		this.element = element;
	}

	public processSelector(selector: nodes.Selector): void {
		let parentElement: Element = null;

		if (!(this.element instanceof RootElement)) {
			if (selector.getChildren().some((c) => c.hasChildren() && c.getChild(0).type === nodes.NodeType.SelectorCombinator)) {
				let curr = this.element.findRoot();
				if (curr.parent instanceof RootElement) {
					parentElement = this.element;

					this.element = curr.parent;
					this.element.removeChild(curr);
					this.prev = null;
				}
			}
		}

		for (let selectorChild of selector.getChildren()) {

			if (selectorChild instanceof nodes.SimpleSelector) {
				if (this.prev instanceof nodes.SimpleSelector) {
					let labelElement = new LabelElement('\u2026');
					this.element.addChild(labelElement);
					this.element = labelElement;
				} else if (this.prev && (this.prev.matches('+') || this.prev.matches('~')) && this.element.parent) {
					this.element = <Element>this.element.parent;
				}

				if (this.prev && this.prev.matches('~')) {
					this.element.addChild(toElement(<nodes.SimpleSelector>selectorChild));
					this.element.addChild(new LabelElement('\u22EE'));
				}

				let thisElement = toElement(<nodes.SimpleSelector>selectorChild, parentElement);
				let root = thisElement.findRoot();

				this.element.addChild(root);
				this.element = thisElement;
			}
			if (selectorChild instanceof nodes.SimpleSelector ||
				selectorChild.type === nodes.NodeType.SelectorCombinatorParent ||
				selectorChild.type === nodes.NodeType.SelectorCombinatorShadowPiercingDescendant ||
				selectorChild.type === nodes.NodeType.SelectorCombinatorSibling ||
				selectorChild.type === nodes.NodeType.SelectorCombinatorAllSiblings) {

				this.prev = selectorChild;
			}
		}
	}
}

function isNewSelectorContext(node: nodes.Node): boolean {
	switch (node.type) {
		case nodes.NodeType.MixinDeclaration:
		case nodes.NodeType.Stylesheet:
			return true;
	}
	return false;
}

export function selectorToElement(node: nodes.Selector): Element {
	if (node.matches('@at-root')) {
		return null;
	}
	let root: Element = new RootElement();
	let parentRuleSets: nodes.RuleSet[] = [];

	if (node.getParent() instanceof nodes.RuleSet) {
		let parent = node.getParent().getParent(); // parent of the selector's ruleset
		while (parent && !isNewSelectorContext(parent)) {
			if (parent instanceof nodes.RuleSet) {
				if (parent.getSelectors().matches('@at-root')) {
					break;
				}
				parentRuleSets.push(<nodes.RuleSet>parent);
			}
			parent = parent.getParent();
		}
	}

	let builder = new SelectorElementBuilder(root);

	for (let i = parentRuleSets.length - 1; i >= 0; i--) {
		let selector = <nodes.Selector>parentRuleSets[i].getSelectors().getChild(0);
		if (selector) {
			builder.processSelector(selector);
		}
	}

	builder.processSelector(node);
	return root;
}
