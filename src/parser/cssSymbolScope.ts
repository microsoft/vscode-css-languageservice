/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from './cssNodes';
import { findFirst } from '../utils/arrays';

export class Scope {

	public parent: Scope | null;
	public children: Scope[];

	public offset: number;
	public length: number;

	private symbols: Symbol[];

	constructor(offset: number, length: number) {
		this.offset = offset;
		this.length = length;
		this.symbols = [];

		this.parent = null;
		this.children = [];
	}

	public addChild(scope: Scope): void {
		this.children.push(scope);
		scope.setParent(this);
	}

	public setParent(scope: Scope): void {
		this.parent = scope;
	}

	public findScope(offset: number, length: number = 0): Scope | null {
		if (this.offset <= offset && this.offset + this.length > offset + length || this.offset === offset && this.length === length) {
			return this.findInScope(offset, length);
		}
		return null;
	}

	private findInScope(offset: number, length: number = 0): Scope {
		// find the first scope child that has an offset larger than offset + length
		const end = offset + length;
		const idx = findFirst(this.children, s => s.offset > end);
		if (idx === 0) {
			// all scopes have offsets larger than our end
			return this;
		}

		const res = this.children[idx - 1];
		if (res.offset <= offset && res.offset + res.length >= offset + length) {
			return res.findInScope(offset, length);
		}
		return this;
	}

	public addSymbol(symbol: Symbol): void {
		this.symbols.push(symbol);
	}

	public getSymbol(name: string, type: nodes.ReferenceType): Symbol | null {
		for (let index = 0; index < this.symbols.length; index++) {
			const symbol = this.symbols[index];
			if (symbol.name === name && symbol.type === type) {
				return symbol;
			}
		}
		return null;
	}

	public getSymbols(): Symbol[] {
		return this.symbols;
	}
}

export class GlobalScope extends Scope {

	constructor() {
		super(0, Number.MAX_VALUE);
	}
}



export class Symbol {

	public name: string;
	public value: string | undefined;
	public type: nodes.ReferenceType;
	public node: nodes.Node;

	constructor(name: string, value: string | undefined, node: nodes.Node, type: nodes.ReferenceType) {
		this.name = name;
		this.value = value;
		this.node = node;
		this.type = type;
	}
}

export class ScopeBuilder implements nodes.IVisitor {

	public scope: Scope;

	constructor(scope: Scope) {
		this.scope = scope;
	}

	private addSymbol(node: nodes.Node, name: string, value: string | undefined, type: nodes.ReferenceType): void {
		if (node.offset !== -1) {
			const current = this.scope.findScope(node.offset, node.length);
			if (current) {
				current.addSymbol(new Symbol(name, value, node, type));
			}
		}
	}

	private addScope(node: nodes.Node): Scope | null {
		if (node.offset !== -1) {
			const current = this.scope.findScope(node.offset, node.length);
			if (current && (current.offset !== node.offset || current.length !== node.length)) { // scope already known?
				const newScope = new Scope(node.offset, node.length);
				current.addChild(newScope);
				return newScope;
			}
			return current;
		}
		return null;
	}

	private addSymbolToChildScope(scopeNode: nodes.Node, node: nodes.Node, name: string, value: string | undefined, type: nodes.ReferenceType): void {
		if (scopeNode && scopeNode.offset !== -1) {
			const current = this.addScope(scopeNode); // create the scope or gets the existing one
			if (current) {
				current.addSymbol(new Symbol(name, value, node, type));
			}
		}
	}

	public visitNode(node: nodes.Node): boolean {
		switch (node.type) {
			case nodes.NodeType.Keyframe:
				this.addSymbol(node, (<nodes.Keyframe>node).getName(), void 0, nodes.ReferenceType.Keyframe);
				return true;
			case nodes.NodeType.CustomPropertyDeclaration:
				return this.visitCustomPropertyDeclarationNode(<nodes.CustomPropertyDeclaration>node);
			case nodes.NodeType.VariableDeclaration:
				return this.visitVariableDeclarationNode(<nodes.VariableDeclaration>node);
			case nodes.NodeType.Ruleset:
				return this.visitRuleSet(<nodes.RuleSet>node);
			case nodes.NodeType.MixinDeclaration:
				this.addSymbol(node, (<nodes.MixinDeclaration>node).getName(), void 0, nodes.ReferenceType.Mixin);
				return true;
			case nodes.NodeType.FunctionDeclaration:
				this.addSymbol(node, (<nodes.FunctionDeclaration>node).getName(), void 0, nodes.ReferenceType.Function);
				return true;
			case nodes.NodeType.FunctionParameter: {
				return this.visitFunctionParameterNode(<nodes.FunctionParameter>node);
			}
			case nodes.NodeType.Declarations:
				this.addScope(node);
				return true;
			case nodes.NodeType.For:
				const forNode = <nodes.ForStatement>node;
				const scopeNode = forNode.getDeclarations();
				if (scopeNode && forNode.variable) {
					this.addSymbolToChildScope(scopeNode, forNode.variable, forNode.variable.getName(), void 0, nodes.ReferenceType.Variable);
				}
				return true;
			case nodes.NodeType.Each: {
				const eachNode = <nodes.EachStatement>node;
				const scopeNode = eachNode.getDeclarations();
				if (scopeNode) {
					const variables = <nodes.Variable[]>eachNode.getVariables().getChildren();
					for (const variable of variables) {
						this.addSymbolToChildScope(scopeNode, variable, variable.getName(), void 0, nodes.ReferenceType.Variable);
					}
				}
				return true;
			}
		}
		return true;
	}

	public visitRuleSet(node: nodes.RuleSet): boolean {
		const current = this.scope.findScope(node.offset, node.length);
		if (current) {
			for (const child of node.getSelectors().getChildren()) {
				if (child instanceof nodes.Selector) {
					if (child.getChildren().length === 1) { // only selectors with a single element can be extended
						current.addSymbol(new Symbol(child.getChild(0)!.getText(), void 0, child, nodes.ReferenceType.Rule));
					}
				}
			}
		}
		return true;
	}

	public visitVariableDeclarationNode(node: nodes.VariableDeclaration): boolean {
		const value = node.getValue() ? node.getValue()!.getText() : void 0;
		this.addSymbol(node, node.getName(), value, nodes.ReferenceType.Variable);
		return true;
	}

	public visitFunctionParameterNode(node: nodes.FunctionParameter): boolean {
		// parameters are part of the body scope
		const scopeNode = (<nodes.BodyDeclaration>node.getParent()).getDeclarations();
		if (scopeNode) {
			const valueNode = (<nodes.FunctionParameter>node).getDefaultValue();
			const value = valueNode ? valueNode.getText() : void 0;
			this.addSymbolToChildScope(scopeNode, node, node.getName(), value, nodes.ReferenceType.Variable);
		}
		return true;
	}

	public visitCustomPropertyDeclarationNode(node: nodes.CustomPropertyDeclaration): boolean {
		const value = node.getValue() ? node.getValue()!.getText() : '';
		this.addCSSVariable(node.getProperty()!, node.getProperty()!.getName(), value, nodes.ReferenceType.Variable);
		return true;
	}

	private addCSSVariable(node: nodes.Node, name: string, value: string, type: nodes.ReferenceType): void {
		if (node.offset !== -1) {
			this.scope.addSymbol(new Symbol(name, value, node, type));
		}
	}
}

export class Symbols {

	private global: Scope;

	constructor(node: nodes.Node) {
		this.global = new GlobalScope();
		node.acceptVisitor(new ScopeBuilder(this.global));
	}

	public findSymbolsAtOffset(offset: number, referenceType: nodes.ReferenceType): Symbol[] {
		let scope = this.global.findScope(offset, 0);
		const result: Symbol[] = [];
		const names: { [name: string]: boolean } = {};
		while (scope) {
			const symbols = scope.getSymbols();
			for (let i = 0; i < symbols.length; i++) {
				const symbol = symbols[i];
				if (symbol.type === referenceType && !names[symbol.name]) {
					result.push(symbol);
					names[symbol.name] = true;
				}
			}
			scope = scope.parent;
		}
		return result;
	}

	private internalFindSymbol(node: nodes.Node, referenceTypes: nodes.ReferenceType[]): Symbol | null {
		let scopeNode: nodes.Node | undefined = node;
		if (node.parent instanceof nodes.FunctionParameter && node.parent.getParent() instanceof nodes.BodyDeclaration) {
			scopeNode = (<nodes.BodyDeclaration>node.parent.getParent()).getDeclarations();
		}
		if (node.parent instanceof nodes.FunctionArgument && node.parent.getParent() instanceof nodes.Function) {
			const funcId = (<nodes.Function>node.parent.getParent()).getIdentifier();
			if (funcId) {
				const functionSymbol = this.internalFindSymbol(funcId, [nodes.ReferenceType.Function]);
				if (functionSymbol) {
					scopeNode = (<nodes.FunctionDeclaration>functionSymbol.node).getDeclarations();
				}
			}
		}
		if (!scopeNode) {
			return null;
		}
		const name = node.getText();
		let scope = this.global.findScope(scopeNode.offset, scopeNode.length);
		while (scope) {
			for (let index = 0; index < referenceTypes.length; index++) {
				const type = referenceTypes[index];
				const symbol = scope.getSymbol(name, type);
				if (symbol) {
					return symbol;
				}
			}
			scope = scope.parent;
		}
		return null;
	}

	private evaluateReferenceTypes(node: nodes.Node): nodes.ReferenceType[] | null {
		if (node instanceof nodes.Identifier) {
			const referenceTypes = (<nodes.Identifier>node).referenceTypes;
			if (referenceTypes) {
				return referenceTypes;
			} else {
				if (node.isCustomProperty) {
					return [nodes.ReferenceType.Variable];
				}
				// are a reference to a keyframe?
				const decl = nodes.getParentDeclaration(node);
				if (decl) {
					const propertyName = decl.getNonPrefixedPropertyName();
					if ((propertyName === 'animation' || propertyName === 'animation-name')
						&& decl.getValue() && decl.getValue()!.offset === node.offset) {
						return [nodes.ReferenceType.Keyframe];
					}
				}
			}
		} else if (node instanceof nodes.Variable) {
			return [nodes.ReferenceType.Variable];
		}
		const selector = node.findAParent(nodes.NodeType.Selector, nodes.NodeType.ExtendsReference);
		if (selector) {
			return [nodes.ReferenceType.Rule];
		}
		return null;
	}

	public findSymbolFromNode(node: nodes.Node): Symbol | null {
		if (!node) {
			return null;
		}
		while (node.type === nodes.NodeType.Interpolation) {
			node = node.getParent()!;
		}

		const referenceTypes = this.evaluateReferenceTypes(node);
		if (referenceTypes) {
			return this.internalFindSymbol(node, referenceTypes);
		}
		return null;
	}

	public matchesSymbol(node: nodes.Node, symbol: Symbol): boolean {
		if (!node) {
			return false;
		}
		while (node.type === nodes.NodeType.Interpolation) {
			node = node.getParent()!;
		}
		if (!node.matches(symbol.name)) {
			return false;
		}

		const referenceTypes = this.evaluateReferenceTypes(node);
		if (!referenceTypes || referenceTypes.indexOf(symbol.type) === -1) {
			return false;
		}

		const nodeSymbol = this.internalFindSymbol(node, referenceTypes);
		return nodeSymbol === symbol;
	}


	public findSymbol(name: string, type: nodes.ReferenceType, offset: number): Symbol | null {
		let scope = this.global.findScope(offset);
		while (scope) {
			const symbol = scope.getSymbol(name, type);
			if (symbol) {
				return symbol;
			}
			scope = scope.parent;
		}
		return null;
	}
}