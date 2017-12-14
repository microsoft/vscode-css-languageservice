/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nodes from './cssNodes';
import { findFirst } from '../utils/arrays';

export class Scope {

	public parent: Scope;
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

	public findScope(offset: number, length: number = 0): Scope {
		if (this.offset <= offset && this.offset + this.length > offset + length || this.offset === offset && this.length === length) {
			return this.findInScope(offset, length);
		}
		return null;
	}

	private findInScope(offset: number, length: number = 0): Scope {
		// find the first scope child that has an offset larger than offset + length
		let end = offset + length;
		let idx = findFirst(this.children, s => s.offset > end);
		if (idx === 0) {
			// all scopes have offsets larger than our end
			return this;
		}

		let res = this.children[idx - 1];
		if (res.offset <= offset && res.offset + res.length >= offset + length) {
			return res.findInScope(offset, length);
		}
		return this;
	}

	public addSymbol(symbol: Symbol): void {
		this.symbols.push(symbol);
	}

	public getSymbol(name: string, type: nodes.ReferenceType): Symbol {
		for (let index = 0; index < this.symbols.length; index++) {
			let symbol = this.symbols[index];
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
	public value: string;
	public type: nodes.ReferenceType;
	public node: nodes.Node;

	constructor(name: string, value: string, node: nodes.Node, type: nodes.ReferenceType) {
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

	private addSymbol(node: nodes.Node, name: string, value: string, type: nodes.ReferenceType): void {
		if (node.offset !== -1) {
			let current = this.scope.findScope(node.offset, node.length);
			current.addSymbol(new Symbol(name, value, node, type));
		}
	}

	private addScope(node: nodes.Node): Scope {
		if (node.offset !== -1) {
			let current = this.scope.findScope(node.offset, node.length);
			if (current.offset !== node.offset || current.length !== node.length) { // scope already known?
				let newScope = new Scope(node.offset, node.length);
				current.addChild(newScope);
				return newScope;
			}
			return current;
		}
		return null;
	}

	private addSymbolToChildScope(scopeNode: nodes.Node, node: nodes.Node, name: string, value: string, type: nodes.ReferenceType): void {
		if (scopeNode && scopeNode.offset !== -1) {
			let current = this.addScope(scopeNode); // create the scope or gets the existing one
			current.addSymbol(new Symbol(name, value, node, type));
		}
	}

	public visitNode(node: nodes.Node): boolean {
		switch (node.type) {
			case nodes.NodeType.Keyframe:
				this.addSymbol(node, (<nodes.Keyframe>node).getName(), null, nodes.ReferenceType.Keyframe);
				return true;
			case nodes.NodeType.CustomPropertyDeclaration:
				return this.visitCustomPropertyDeclarationNode(<nodes.CustomPropertyDeclaration>node);
			case nodes.NodeType.VariableDeclaration:
				return this.visitVariableDeclarationNode(<nodes.VariableDeclaration>node);
			case nodes.NodeType.Ruleset:
				return this.visitRuleSet(<nodes.RuleSet>node);
			case nodes.NodeType.MixinDeclaration:
				this.addSymbol(node, (<nodes.MixinDeclaration>node).getName(), null, nodes.ReferenceType.Mixin);
				return true;
			case nodes.NodeType.FunctionDeclaration:
				this.addSymbol(node, (<nodes.FunctionDeclaration>node).getName(), null, nodes.ReferenceType.Function);
				return true;
			case nodes.NodeType.FunctionParameter: {
				return this.visitFunctionParameterNode(<nodes.FunctionParameter>node);
			}
			case nodes.NodeType.Declarations:
				this.addScope(node);
				return true;
			case nodes.NodeType.For:
				let forNode = <nodes.ForStatement>node;
				let scopeNode = forNode.getDeclarations();
				if (scopeNode) {
					this.addSymbolToChildScope(scopeNode, forNode.variable, forNode.variable.getName(), null, nodes.ReferenceType.Variable);
				}
				return true;
			case nodes.NodeType.Each: {
				let eachNode = <nodes.EachStatement>node;
				let scopeNode = eachNode.getDeclarations();
				if (scopeNode) {
					let variables = <nodes.Variable[]>eachNode.getVariables().getChildren();
					for (let variable of variables) {
						this.addSymbolToChildScope(scopeNode, variable, variable.getName(), null, nodes.ReferenceType.Variable);
					}
				}
				return true;
			}
		}
		return true;
	}

	public visitRuleSet(node: nodes.RuleSet): boolean {
		let current = this.scope.findScope(node.offset, node.length);
		for (let child of node.getSelectors().getChildren()) {
			if (child instanceof nodes.Selector) {
				if (child.getChildren().length === 1) { // only selectors with a single element can be extended
					current.addSymbol(new Symbol(child.getChild(0).getText(), null, child, nodes.ReferenceType.Rule));
				}
			}
		}
		return true;
	}

	public visitVariableDeclarationNode(node: nodes.VariableDeclaration): boolean {
		const value = node.getValue() ? node.getValue().getText() : null;
		this.addSymbol(node, node.getName(), value, nodes.ReferenceType.Variable);
		return true;
	}

	public visitFunctionParameterNode(node: nodes.FunctionParameter): boolean {
		// parameters are part of the body scope
		let scopeNode = (<nodes.BodyDeclaration>node.getParent()).getDeclarations();
		if (scopeNode) {
			const valueNode = (<nodes.FunctionParameter>node).getDefaultValue();
			const value = valueNode ? valueNode.getText() : null;
			this.addSymbolToChildScope(scopeNode, node, node.getName(), value, nodes.ReferenceType.Variable);
		}
		return true;
	}

	public visitCustomPropertyDeclarationNode(node: nodes.CustomPropertyDeclaration): boolean {
		let value = node.getValue() ? node.getValue().getText() : '';
		this.addCSSVariable(node.getProperty(), node.getProperty().getName(), value, nodes.ReferenceType.Variable);
		return true;
	}

	private addCSSVariable(node: nodes.Node, name: string, value: string, type: nodes.ReferenceType): void {
		if (node.offset !== -1) {
			let globalScope = this.getGlobalScope(node, name, type);
			globalScope.addSymbol(new Symbol(name, value, node, type));
		}
	}

	private getGlobalScope(node: nodes.Node, name: string, type: nodes.ReferenceType): Scope {
		let current = this.scope.findScope(node.offset, node.length);
		while (current.parent !== null) {
			current = current.parent;
		}
		return current;
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
		let result: Symbol[] = [];
		let names: { [name: string]: boolean } = {};
		while (scope) {
			let symbols = scope.getSymbols();
			for (let i = 0; i < symbols.length; i++) {
				let symbol = symbols[i];
				if (symbol.type === referenceType && !names[symbol.name]) {
					result.push(symbol);
					names[symbol.name] = true;
				}
			}
			scope = scope.parent;
		}
		return result;
	}

	private internalFindSymbol(node: nodes.Node, referenceTypes: nodes.ReferenceType[]): Symbol {
		let scopeNode = node;
		if (node.parent instanceof nodes.FunctionParameter && node.parent.getParent() instanceof nodes.BodyDeclaration) {
			scopeNode = (<nodes.BodyDeclaration>node.parent.getParent()).getDeclarations();
		}
		if (node.parent instanceof nodes.FunctionArgument && node.parent.getParent() instanceof nodes.Function) {
			let funcId = (<nodes.Function>node.parent.getParent()).getIdentifier();
			if (funcId) {
				let functionSymbol = this.internalFindSymbol(funcId, [nodes.ReferenceType.Function]);
				if (functionSymbol) {
					scopeNode = (<nodes.FunctionDeclaration>functionSymbol.node).getDeclarations();
				}
			}
		}
		if (!scopeNode) {
			return null;
		}
		let name = node.getText();
		let scope = this.global.findScope(scopeNode.offset, scopeNode.length);
		while (scope) {
			for (let index = 0; index < referenceTypes.length; index++) {
				let type = referenceTypes[index];
				let symbol = scope.getSymbol(name, type);
				if (symbol) {
					return symbol;
				}
			}
			scope = scope.parent;
		}
		return null;
	}

	private evaluateReferenceTypes(node: nodes.Node): nodes.ReferenceType[] {
		if (node instanceof nodes.Identifier) {
			let referenceTypes = (<nodes.Identifier>node).referenceTypes;
			if (referenceTypes) {
				return referenceTypes;
			} else {
				if (node.isCustomProperty) {
					return [nodes.ReferenceType.Variable];
				}
				// are a reference to a keyframe?
				let decl = nodes.getParentDeclaration(node);
				if (decl) {
					let propertyName = decl.getNonPrefixedPropertyName();
					if ((propertyName === 'animation' || propertyName === 'animation-name')
						&& decl.getValue() && decl.getValue().offset === node.offset) {
						return [nodes.ReferenceType.Keyframe];
					}
				}
			}
		} else if (node instanceof nodes.Variable) {
			return [nodes.ReferenceType.Variable];
		}
		let selector = node.findParent(nodes.NodeType.Selector);
		if (selector) {
			return [nodes.ReferenceType.Rule];
		}
		let extendsRef = <nodes.ExtendsReference>node.findParent(nodes.NodeType.ExtendsReference);
		if (extendsRef) {
			return [nodes.ReferenceType.Rule];
		}
		return null;
	}

	public findSymbolFromNode(node: nodes.Node): Symbol {
		if (!node) {
			return null;
		}
		while (node.type === nodes.NodeType.Interpolation) {
			node = node.getParent();
		}

		let referenceTypes = this.evaluateReferenceTypes(node);
		if (referenceTypes) {
			return this.internalFindSymbol(node, referenceTypes);
		}
		return null;
	}

	public matchesSymbol(node: nodes.Node, symbol: Symbol): boolean {
		if (!node) {
			return null;
		}
		while (node.type === nodes.NodeType.Interpolation) {
			node = node.getParent();
		}
		if (symbol.name.length !== node.length || symbol.name !== node.getText()) {
			return false;
		}

		let referenceTypes = this.evaluateReferenceTypes(node);
		if (!referenceTypes || referenceTypes.indexOf(symbol.type) === -1) {
			return false;
		}

		let nodeSymbol = this.internalFindSymbol(node, referenceTypes);
		return nodeSymbol === symbol;
	}


	public findSymbol(name: string, type: nodes.ReferenceType, offset: number): Symbol {
		let scope = this.global.findScope(offset);
		while (scope) {
			let symbol = scope.getSymbol(name, type);
			if (symbol) {
				return symbol;
			}
			scope = scope.parent;
		}
		return null;
	}
}