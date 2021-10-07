/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as lessScanner from './lessScanner';
import { TokenType } from './cssScanner';
import * as cssParser from './cssParser';
import * as nodes from './cssNodes';
import { ParseError } from './cssErrors';

/// <summary>
/// A parser for LESS
/// http://lesscss.org/
/// </summary>
export class LESSParser extends cssParser.Parser {

	public constructor() {
		super(new lessScanner.LESSScanner());
	}

	public _parseStylesheetStatement(isNested: boolean = false): nodes.Node | null {
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseVariableDeclaration()
				|| this._parsePlugin()
				|| super._parseStylesheetAtStatement(isNested);
		}

		return this._tryParseMixinDeclaration()
			|| this._tryParseMixinReference()
			|| this._parseFunction()
			|| this._parseRuleset(true);
	}

	public _parseImport(): nodes.Node | null {

		if (!this.peekKeyword('@import') && !this.peekKeyword('@import-once') /* deprecated in less 1.4.1 */) {
			return null;
		}
		const node = <nodes.Import>this.create(nodes.Import);
		this.consumeToken();

		// less 1.4.1: @import (css) "lib"
		if (this.accept(TokenType.ParenthesisL)) {
			if (!this.accept(TokenType.Ident)) {
				return this.finish(node, ParseError.IdentifierExpected, [TokenType.SemiColon]);
			}
			do {
				if (!this.accept(TokenType.Comma)) {
					break;
				}
			} while (this.accept(TokenType.Ident));

			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected, [TokenType.SemiColon]);
			}
		}

		if (!node.addChild(this._parseURILiteral()) && !node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.URIOrStringExpected, [TokenType.SemiColon]);
		}

		if (!this.peek(TokenType.SemiColon) && !this.peek(TokenType.EOF)) {
			node.setMedialist(this._parseMediaQueryList());
		}

		return this.finish(node);
	}

	public _parsePlugin(): nodes.Node | null {
		if (!this.peekKeyword('@plugin')) {
			return null;
		}

		const node = this.createNode(nodes.NodeType.Plugin);
		this.consumeToken(); // @import

		if (!node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.StringLiteralExpected);
		}

		if (!this.accept(TokenType.SemiColon)) {
			return this.finish(node, ParseError.SemiColonExpected);
		}

		return this.finish(node);
	}

	public _parseMediaQuery(): nodes.Node | null {
		const node = super._parseMediaQuery();
		if (!node) {
			const node = this.create(nodes.MediaQuery);
			if (node.addChild(this._parseVariable())) {
				return this.finish(node);
			}
			return null;
		}
		return node;
	}

	public _parseMediaDeclaration(isNested: boolean = false): nodes.Node | null {
		return this._tryParseRuleset(isNested)
			|| this._tryToParseDeclaration()
			|| this._tryParseMixinDeclaration()
			|| this._tryParseMixinReference()
			|| this._parseDetachedRuleSetMixin()
			|| this._parseStylesheetStatement(isNested);
	}

	public _parseMediaFeatureName(): nodes.Node | null {
		return this._parseIdent() || this._parseVariable();
	}

	public _parseVariableDeclaration(panic: TokenType[] = []): nodes.VariableDeclaration | null {
		const node = <nodes.VariableDeclaration>this.create(nodes.VariableDeclaration);
		const mark = this.mark();

		if (!node.setVariable(this._parseVariable(true))) {
			return null;
		}

		if (this.accept(TokenType.Colon)) {
			if (this.prevToken) {
				node.colonPosition = this.prevToken.offset;
			}
			if (node.setValue(this._parseDetachedRuleSet())) {
				node.needsSemicolon = false;
			} else if (!node.setValue(this._parseExpr())) {
				return <nodes.VariableDeclaration>this.finish(node, ParseError.VariableValueExpected, [], panic);
			}

			node.addChild(this._parsePrio());
		} else {
			this.restoreAtMark(mark);
			return null; // at keyword, but no ':', not a variable declaration but some at keyword
		}

		if (this.peek(TokenType.SemiColon)) {
			node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
		}

		return <nodes.VariableDeclaration>this.finish(node);
	}

	public _parseDetachedRuleSet(): nodes.Node | null {
		let mark = this.mark();

		// "Anonymous mixin" used in each() and possibly a generic type in the future
		if (this.peekDelim('#') || this.peekDelim('.')) {
			this.consumeToken();
			if (!this.hasWhitespace() && this.accept(TokenType.ParenthesisL)) {
				let node = <nodes.MixinDeclaration>this.create(nodes.MixinDeclaration);

				if (node.getParameters().addChild(this._parseMixinParameter())) {
					while (this.accept(TokenType.Comma) || this.accept(TokenType.SemiColon)) {
						if (this.peek(TokenType.ParenthesisR)) {
							break;
						}
						if (!node.getParameters().addChild(this._parseMixinParameter())) {
							this.markError(node, ParseError.IdentifierExpected, [], [TokenType.ParenthesisR]);
						}
					}
				}

				if (!this.accept(TokenType.ParenthesisR)) {
					this.restoreAtMark(mark);
					return null;
				}
			} else {
				this.restoreAtMark(mark);
				return null;
			}
		}

		if (!this.peek(TokenType.CurlyL)) {
			return null;
		}
		const content = <nodes.BodyDeclaration>this.create(nodes.BodyDeclaration);

		this._parseBody(content, this._parseDetachedRuleSetBody.bind(this));
		return this.finish(content);
	}

	public _parseDetachedRuleSetBody(): nodes.Node | null {
		return this._tryParseKeyframeSelector() || this._parseRuleSetDeclaration();
	}

	public _addLookupChildren(node: nodes.Node): boolean {
		if (!node.addChild(this._parseLookupValue())) {
			return false;
		}

		let expectsValue = false;

		while (true) {
			if (this.peek(TokenType.BracketL)) {
				expectsValue = true;
			}
			if (!node.addChild(this._parseLookupValue())) {
				break;
			}
			expectsValue = false;
		}
		return !expectsValue;
	}

	public _parseLookupValue(): nodes.Node | null {
		const node = <nodes.Node>this.create(nodes.Node);
		const mark = this.mark();

		if (!this.accept(TokenType.BracketL)) {
			this.restoreAtMark(mark);
			return null;
		}

		if (((node.addChild(this._parseVariable(false, true)) ||
			node.addChild(this._parsePropertyIdentifier())) &&
			this.accept(TokenType.BracketR)) || this.accept(TokenType.BracketR)) {
			return <nodes.Node>node;
		}

		this.restoreAtMark(mark);
		return null;
	}

	public _parseVariable(declaration: boolean = false, insideLookup: boolean = false): nodes.Variable | null {
		const isPropertyReference = !declaration && this.peekDelim('$');
		if (!this.peekDelim('@') && !isPropertyReference && !this.peek(TokenType.AtKeyword)) {
			return null;
		}

		const node = <nodes.Variable>this.create(nodes.Variable);
		const mark = this.mark();

		while (this.acceptDelim('@') || (!declaration && this.acceptDelim('$'))) {
			if (this.hasWhitespace()) {
				this.restoreAtMark(mark);
				return null;
			}
		}
		if (!this.accept(TokenType.AtKeyword) && !this.accept(TokenType.Ident)) {
			this.restoreAtMark(mark);
			return null;
		}
		if (!insideLookup && this.peek(TokenType.BracketL)) {
			if (!this._addLookupChildren(node)) {
				this.restoreAtMark(mark);
				return null;
			}
		}
		return <nodes.Variable>node;
	}

	public _parseTermExpression(): nodes.Node | null {
		return this._parseVariable() ||
			this._parseEscaped() ||
			super._parseTermExpression() || // preference for colors before mixin references
			this._tryParseMixinReference(false);
	}

	public _parseEscaped(): nodes.Node | null {

		if (this.peek(TokenType.EscapedJavaScript) ||
			this.peek(TokenType.BadEscapedJavaScript)) {

			const node = this.createNode(nodes.NodeType.EscapedValue);
			this.consumeToken();
			return this.finish(node);
		}

		if (this.peekDelim('~')) {
			const node = this.createNode(nodes.NodeType.EscapedValue);
			this.consumeToken();
			if (this.accept(TokenType.String) || this.accept(TokenType.EscapedJavaScript)) {
				return this.finish(node);
			} else {
				return this.finish(node, ParseError.TermExpected);
			}
		}

		return null;
	}

	public _parseOperator(): nodes.Node | null {
		const node = this._parseGuardOperator();
		if (node) {
			return node;
		} else {
			return super._parseOperator();
		}
	}

	public _parseGuardOperator(): nodes.Node | null {

		if (this.peekDelim('>')) {
			const node = this.createNode(nodes.NodeType.Operator);
			this.consumeToken();
			this.acceptDelim('=');
			return node;
		} else if (this.peekDelim('=')) {
			const node = this.createNode(nodes.NodeType.Operator);
			this.consumeToken();
			this.acceptDelim('<');
			return node;
		} else if (this.peekDelim('<')) {
			const node = this.createNode(nodes.NodeType.Operator);
			this.consumeToken();
			this.acceptDelim('=');
			return node;
		}
		return null;
	}

	public _parseRuleSetDeclaration(): nodes.Node | null {
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseKeyframe()
				|| this._parseMedia(true)
				|| this._parseImport()
				|| this._parseSupports(true) // @supports
				|| this._parseDetachedRuleSetMixin() // less detached ruleset mixin
				|| this._parseVariableDeclaration() // Variable declarations
				|| super._parseRuleSetDeclarationAtStatement();
		}
		return this._tryParseMixinDeclaration()
			|| this._tryParseRuleset(true)  // nested ruleset
			|| this._tryParseMixinReference() // less mixin reference
			|| this._parseFunction()
			|| this._parseExtend() // less extend declaration
			|| super._parseRuleSetDeclaration(); // try css ruleset declaration as the last option
	}

	public _parseKeyframeIdent(): nodes.Node | null {
		return this._parseIdent([nodes.ReferenceType.Keyframe]) || this._parseVariable();
	}

	public _parseKeyframeSelector(): nodes.Node | null {
		return this._parseDetachedRuleSetMixin()  // less detached ruleset mixin
			|| super._parseKeyframeSelector();
	}

	public _parseSimpleSelectorBody(): nodes.Node | null {
		return this._parseSelectorCombinator() || super._parseSimpleSelectorBody();
	}

	public _parseSelector(isNested: boolean): nodes.Selector | null {
		// CSS Guards
		const node = <nodes.Selector>this.create(nodes.Selector);

		let hasContent = false;
		if (isNested) {
			// nested selectors can start with a combinator
			hasContent = node.addChild(this._parseCombinator());
		}
		while (node.addChild(this._parseSimpleSelector())) {
			hasContent = true;
			const mark = this.mark();
			if (node.addChild(this._parseGuard()) && this.peek(TokenType.CurlyL)) {
				break;
			}
			this.restoreAtMark(mark);
			node.addChild(this._parseCombinator()); // optional
		}
		return hasContent ? this.finish(node) : null;
	}

	public _parseSelectorCombinator(): nodes.Node | null {

		if (this.peekDelim('&')) {
			const node = this.createNode(nodes.NodeType.SelectorCombinator);
			this.consumeToken();
			while (!this.hasWhitespace() && (this.acceptDelim('-') || this.accept(TokenType.Num) || this.accept(TokenType.Dimension) || node.addChild(this._parseIdent()) || this.acceptDelim('&'))) {
				//  support &-foo
			}
			return this.finish(node);
		}
		return null;
	}

	public _parseSelectorIdent(): nodes.Node | null {
		if (!this.peekInterpolatedIdent()) {
			return null;
		}
		const node = this.createNode(nodes.NodeType.SelectorInterpolation);
		const hasContent = this._acceptInterpolatedIdent(node);
		return hasContent ? this.finish(node) : null;
	}

	public _parsePropertyIdentifier(inLookup: boolean = false): nodes.Identifier | null {
		const propertyRegex = /^[\w-]+/;
		if (!this.peekInterpolatedIdent() && !this.peekRegExp(this.token.type, propertyRegex)) {
			return null;
		}
		const mark = this.mark();
		const node = <nodes.Identifier>this.create(nodes.Identifier);

		node.isCustomProperty = this.acceptDelim('-') && this.acceptDelim('-');

		let childAdded = false;
		if (!inLookup) {
			if (node.isCustomProperty) {
				childAdded = this._acceptInterpolatedIdent(node);
			} else {
				childAdded = this._acceptInterpolatedIdent(node, propertyRegex);
			}
		} else {
			if (node.isCustomProperty) {
				childAdded = node.addChild(this._parseIdent());
			} else {
				childAdded = node.addChild(this._parseRegexp(propertyRegex));
			}
		}

		if (!childAdded) {
			this.restoreAtMark(mark);
			return null;
		}


		if (!inLookup && !this.hasWhitespace()) {
			this.acceptDelim('+');
			if (!this.hasWhitespace()) {
				this.acceptIdent('_');
			}
		}

		return this.finish(node);
	}

	private peekInterpolatedIdent() {
		return this.peek(TokenType.Ident) ||
			this.peekDelim('@') ||
			this.peekDelim('$') ||
			this.peekDelim('-');
	}

	public _acceptInterpolatedIdent(node: nodes.Node, identRegex?: RegExp): boolean {
		let hasContent = false;
		const indentInterpolation = () => {
			const pos = this.mark();
			if (this.acceptDelim('-')) {
				if (!this.hasWhitespace()) {
					this.acceptDelim('-');
				}
				if (this.hasWhitespace()) {
					this.restoreAtMark(pos);
					return null;
				}
			}
			return this._parseInterpolation();
		};
		const accept = identRegex ?
			(): boolean => this.acceptRegexp(identRegex) :
			(): boolean => this.accept(TokenType.Ident);

		while (
			accept() ||
			node.addChild(this._parseInterpolation() ||
				this.try(indentInterpolation))
		) {
			hasContent = true;
			if (this.hasWhitespace()) {
				break;
			}
		}
		return hasContent;
	}

	public _parseInterpolation(): nodes.Node | null {
		// @{name} Variable or
		// ${name} Property
		const mark = this.mark();
		if (this.peekDelim('@') || this.peekDelim('$')) {
			const node = this.createNode(nodes.NodeType.Interpolation);
			this.consumeToken();
			if (this.hasWhitespace() || !this.accept(TokenType.CurlyL)) {
				this.restoreAtMark(mark);
				return null;
			}
			if (!node.addChild(this._parseIdent())) {
				return this.finish(node, ParseError.IdentifierExpected);
			}
			if (!this.accept(TokenType.CurlyR)) {
				return this.finish(node, ParseError.RightCurlyExpected);
			}
			return this.finish(node);
		}
		return null;
	}

	public _tryParseMixinDeclaration(): nodes.Node | null {
		const mark = this.mark();
		const node = <nodes.MixinDeclaration>this.create(nodes.MixinDeclaration);

		if (!node.setIdentifier(this._parseMixinDeclarationIdentifier()) || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(mark);
			return null;
		}

		if (node.getParameters().addChild(this._parseMixinParameter())) {
			while (this.accept(TokenType.Comma) || this.accept(TokenType.SemiColon)) {
				if (this.peek(TokenType.ParenthesisR)) {
					break;
				}
				if (!node.getParameters().addChild(this._parseMixinParameter())) {
					this.markError(node, ParseError.IdentifierExpected, [], [TokenType.ParenthesisR]);
				}
			}
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			this.restoreAtMark(mark);
			return null;
		}
		node.setGuard(this._parseGuard());

		if (!this.peek(TokenType.CurlyL)) {
			this.restoreAtMark(mark);
			return null;
		}

		return this._parseBody(node, this._parseMixInBodyDeclaration.bind(this));
	}

	private _parseMixInBodyDeclaration(): nodes.Node | null {
		return this._parseFontFace() || this._parseRuleSetDeclaration();
	}

	private _parseMixinDeclarationIdentifier(): nodes.Identifier | null {
		let identifier: nodes.Identifier;
		if (this.peekDelim('#') || this.peekDelim('.')) {
			identifier = <nodes.Identifier>this.create(nodes.Identifier);
			this.consumeToken(); // # or .
			if (this.hasWhitespace() || !identifier.addChild(this._parseIdent())) {
				return null;
			}
		} else if (this.peek(TokenType.Hash)) {
			identifier = <nodes.Identifier>this.create(nodes.Identifier);
			this.consumeToken(); // TokenType.Hash
		} else {
			return null;
		}
		identifier.referenceTypes = [nodes.ReferenceType.Mixin];
		return this.finish(identifier);
	}

	public _parsePseudo(): nodes.Node | null {
		if (!this.peek(TokenType.Colon)) {
			return null;
		}
		const mark = this.mark();
		const node = <nodes.ExtendsReference>this.create(nodes.ExtendsReference);
		this.consumeToken(); // :
		if (this.acceptIdent('extend')) {
			return this._completeExtends(node);
		}
		this.restoreAtMark(mark);
		return super._parsePseudo();
	}

	public _parseExtend(): nodes.Node | null {
		if (!this.peekDelim('&')) {
			return null;
		}

		const mark = this.mark();
		const node = <nodes.ExtendsReference>this.create(nodes.ExtendsReference);
		this.consumeToken(); // &

		if (this.hasWhitespace() || !this.accept(TokenType.Colon) || !this.acceptIdent('extend')) {
			this.restoreAtMark(mark);
			return null;
		}
		return this._completeExtends(node);
	}

	private _completeExtends(node: nodes.ExtendsReference): nodes.Node | null {
		if (!this.accept(TokenType.ParenthesisL)) {
			return this.finish(node, ParseError.LeftParenthesisExpected);
		}
		const selectors = node.getSelectors();
		if (!selectors.addChild(this._parseSelector(true))) {
			return this.finish(node, ParseError.SelectorExpected);
		}
		while (this.accept(TokenType.Comma)) {
			if (!selectors.addChild(this._parseSelector(true))) {
				return this.finish(node, ParseError.SelectorExpected);
			}
		}
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseDetachedRuleSetMixin(): nodes.Node | null {
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}
		const mark = this.mark();
		const node = <nodes.MixinReference>this.create(nodes.MixinReference);
		if (node.addChild(this._parseVariable(true)) && (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL))) {
			this.restoreAtMark(mark);
			return null;
		}
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}


	public _tryParseMixinReference(atRoot = true): nodes.Node | null {
		const mark = this.mark();
		const node = <nodes.MixinReference>this.create(nodes.MixinReference);

		let identifier = this._parseMixinDeclarationIdentifier();
		while (identifier) {
			this.acceptDelim('>');
			const nextId = this._parseMixinDeclarationIdentifier();
			if (nextId) {
				node.getNamespaces().addChild(identifier);
				identifier = nextId;
			} else {
				break;
			}
		}
		if (!node.setIdentifier(identifier)) {
			this.restoreAtMark(mark);
			return null;
		}
		let hasArguments = false;

		if (this.accept(TokenType.ParenthesisL)) {
			hasArguments = true;
			if (node.getArguments().addChild(this._parseMixinArgument())) {
				while (this.accept(TokenType.Comma) || this.accept(TokenType.SemiColon)) {
					if (this.peek(TokenType.ParenthesisR)) {
						break;
					}
					if (!node.getArguments().addChild(this._parseMixinArgument())) {
						return this.finish(node, ParseError.ExpressionExpected);
					}
				}
			}
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected);
			}
			identifier.referenceTypes = [nodes.ReferenceType.Mixin];
		} else {
			identifier.referenceTypes = [nodes.ReferenceType.Mixin, nodes.ReferenceType.Rule];
		}

		if (this.peek(TokenType.BracketL)) {
			if (!atRoot) {
				this._addLookupChildren(node);
			}
		} else {
			node.addChild(this._parsePrio());
		}

		if (!hasArguments && !this.peek(TokenType.SemiColon) && !this.peek(TokenType.CurlyR) && !this.peek(TokenType.EOF)) {
			this.restoreAtMark(mark);
			return null;
		}
		return this.finish(node);
	}

	public _parseMixinArgument(): nodes.Node | null {
		// [variableName ':'] expression | variableName '...'
		const node = <nodes.FunctionArgument>this.create(nodes.FunctionArgument);

		const pos = this.mark();
		const argument = this._parseVariable();
		if (argument) {
			if (!this.accept(TokenType.Colon)) {
				this.restoreAtMark(pos);
			} else {
				node.setIdentifier(argument);
			}
		}

		if (node.setValue(this._parseDetachedRuleSet() || this._parseExpr(true))) {
			return this.finish(node);
		}
		this.restoreAtMark(pos);
		return null;
	}

	public _parseMixinParameter(): nodes.Node | null {

		const node = <nodes.FunctionParameter>this.create(nodes.FunctionParameter);

		// special rest variable: @rest...
		if (this.peekKeyword('@rest')) {
			const restNode = this.create(nodes.Node);
			this.consumeToken();
			if (!this.accept(lessScanner.Ellipsis)) {
				return this.finish(node, ParseError.DotExpected, [], [TokenType.Comma, TokenType.ParenthesisR]);
			}
			node.setIdentifier(this.finish(restNode));
			return this.finish(node);
		}

		// special const args: ...
		if (this.peek(lessScanner.Ellipsis)) {
			const varargsNode = this.create(nodes.Node);
			this.consumeToken();
			node.setIdentifier(this.finish(varargsNode));
			return this.finish(node);
		}

		let hasContent = false;
		// default variable declaration: @param: 12 or @name
		if (node.setIdentifier(this._parseVariable())) {
			this.accept(TokenType.Colon);
			hasContent = true;
		}
		if (!node.setDefaultValue(this._parseDetachedRuleSet() || this._parseExpr(true)) && !hasContent) {
			return null;
		}
		return this.finish(node);
	}

	public _parseGuard(): nodes.LessGuard | null {
		if (!this.peekIdent('when')) {
			return null;
		}
		const node = <nodes.LessGuard>this.create(nodes.LessGuard);
		this.consumeToken(); // when
		node.isNegated = this.acceptIdent('not');

		if (!node.getConditions().addChild(this._parseGuardCondition())) {
			return <nodes.LessGuard>this.finish(node, ParseError.ConditionExpected);
		}
		while (this.acceptIdent('and') || this.accept(TokenType.Comma)) {
			if (!node.getConditions().addChild(this._parseGuardCondition())) {
				return <nodes.LessGuard>this.finish(node, ParseError.ConditionExpected);
			}
		}

		return <nodes.LessGuard>this.finish(node);
	}

	public _parseGuardCondition(): nodes.Node | null {

		if (!this.peek(TokenType.ParenthesisL)) {
			return null;
		}
		const node = this.create(nodes.GuardCondition);
		this.consumeToken(); // ParenthesisL

		if (!node.addChild(this._parseExpr())) {
			// empty (?)
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}

		return this.finish(node);
	}

	public _parseFunction(): nodes.Function | null {
		const pos = this.mark();
		const node = <nodes.Function>this.create(nodes.Function);

		if (!node.setIdentifier(this._parseFunctionIdentifier())) {
			return null;
		}

		if (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos);
			return null;
		}

		if (node.getArguments().addChild(this._parseMixinArgument())) {
			while (this.accept(TokenType.Comma) || this.accept(TokenType.SemiColon)) {
				if (this.peek(TokenType.ParenthesisR)) {
					break;
				}
				if (!node.getArguments().addChild(this._parseMixinArgument())) {
					return this.finish(node, ParseError.ExpressionExpected);
				}
			}
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return <nodes.Function>this.finish(node, ParseError.RightParenthesisExpected);
		}
		return <nodes.Function>this.finish(node);
	}

	public _parseFunctionIdentifier(): nodes.Identifier | null {
		if (this.peekDelim('%')) {
			const node = <nodes.Identifier>this.create(nodes.Identifier);
			node.referenceTypes = [nodes.ReferenceType.Function];
			this.consumeToken();
			return this.finish(node);
		}

		return super._parseFunctionIdentifier();
	}

	public _parseURLArgument(): nodes.Node | null {
		const pos = this.mark();
		const node = super._parseURLArgument();
		if (!node || !this.peek(TokenType.ParenthesisR)) {
			this.restoreAtMark(pos);

			const node = this.create(nodes.Node);
			node.addChild(this._parseBinaryExpr());
			return this.finish(node);
		}
		return node;
	}
}
