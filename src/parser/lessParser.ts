/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as lessScanner from './lessScanner';
import {TokenType} from './cssScanner';
import * as cssParser from './cssParser';
import * as nodes from './cssNodes';
import {ParseError} from './cssErrors';

/// <summary>
/// A parser for LESS
/// http://lesscss.org/
/// </summary>
export class LESSParser extends cssParser.Parser {

	public constructor() {
		super(new lessScanner.LESSScanner());
	}

	public _parseStylesheetStatement(): nodes.Node {
		return this._tryParseMixinDeclaration()
			|| this._tryParseMixinReference(true)
			|| super._parseStylesheetStatement()
			|| this._parseVariableDeclaration();
	}

	public _parseImport(): nodes.Node {
		let node = <nodes.Import>this.create(nodes.Import);
		if (!this.accept(TokenType.AtKeyword, '@import') && !this.accept(TokenType.AtKeyword, '@import-once') /* deprecated in less 1.4.1 */) {
			return null;
		}

		// less 1.4.1: @import (css) "lib"
		if (this.accept(TokenType.ParenthesisL)) {
			if (!this.accept(TokenType.Ident)) {
				return this.finish(node, ParseError.IdentifierExpected, [TokenType.SemiColon]);
			}
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected, [TokenType.SemiColon]);
			}
		}

		if (!this.accept(TokenType.URI) && !this.accept(TokenType.String)) {
			return this.finish(node, ParseError.URIOrStringExpected, [TokenType.SemiColon]);
		}

		node.setMedialist(this._parseMediaList());

		return this.finish(node);
	}

	public _parseMediaQuery(resyncStopToken: TokenType[]): nodes.Node {
		let node = <nodes.MediaQuery>super._parseMediaQuery(resyncStopToken);
		if (!node) {
			let node = <nodes.MediaQuery>this.create(nodes.MediaQuery);
			if (node.addChild(this._parseVariable())) {
				return this.finish(node);
			}
			return null;
		}
		return node;
	}

	public _parseMediaDeclaration(): nodes.Node {
		return this._tryParseRuleset(false) 
			|| this._tryToParseDeclaration() 
			|| this._tryParseMixinDeclaration()
			|| this._tryParseMixinReference()
			|| this._parseStylesheetStatement();
	}	

	public _parseVariableDeclaration(panic: TokenType[] = []): nodes.VariableDeclaration {
		let node = <nodes.VariableDeclaration>this.create(nodes.VariableDeclaration);

		let mark = this.mark();
		if (!node.setVariable(this._parseVariable())) {
			return null;
		}

		if (this.accept(TokenType.Colon, ':')) {
			node.colonPosition = this.prevToken.offset;
			if (this.peek(TokenType.CurlyL)) {
				//detached ruleset 
				let content = <nodes.BodyDeclaration>this.create(nodes.BodyDeclaration);
				this._parseBody(content, this._parseRuleSetDeclaration.bind(this));
				node.setValue(content);
			} else if (!node.setValue(this._parseExpr())) {
				return <nodes.VariableDeclaration>this.finish(node, ParseError.VariableValueExpected, [], panic);
			} else if (this.peek(TokenType.Exclamation)) {
				node.addChild(this._parsePrio());
			}
		} else {
			this.restoreAtMark(mark);
			return null; // at keyword, but no ':', not a variable declaration but some at keyword
		}

		if (this.peek(TokenType.SemiColon)) {
			node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
		}

		return <nodes.VariableDeclaration>this.finish(node);
	}

	public _parseVariable(): nodes.Variable {
		let node = <nodes.Variable>this.create(nodes.Variable);
		let mark = this.mark();
		while (this.accept(TokenType.Delim, '@')) {
			if (this.hasWhitespace()) {
				this.restoreAtMark(mark);
				return null;
			}
		}
		if (!this.accept(TokenType.AtKeyword)) {
			this.restoreAtMark(mark);
			return null;
		}
		return <nodes.Variable>node;
	}

	public _parseTerm(): nodes.Term {
		let term = super._parseTerm();
		if (term) { return term; }

		term = <nodes.Term>this.create(nodes.Term);
		if (term.setExpression(this._parseVariable()) ||
			term.setExpression(this._parseEscaped())) {

			return <nodes.Term>this.finish(term);
		}

		return null;
	}

	public _parseEscaped(): nodes.Node {
		let node = this.createNode(nodes.NodeType.EscapedValue);
		if (this.accept(TokenType.EscapedJavaScript) ||
			this.accept(TokenType.BadEscapedJavaScript)) {

			return this.finish(node);
		}

		if (this.accept(TokenType.Delim, '~')) {
			return this.finish(node, this.accept(TokenType.String) ? null : ParseError.TermExpected);
		}

		return null;
	}

	public _parseOperator(): nodes.Node {
		let node = this._parseGuardOperator();
		if (node) {
			return node;
		} else {
			return super._parseOperator();
		}
	}

	public _parseGuardOperator(): nodes.Node {
		let node = this.createNode(nodes.NodeType.Operator);
		if (this.accept(TokenType.Delim, '>')) {
			this.accept(TokenType.Delim, '=');
			return node;
		} else if (this.accept(TokenType.Delim, '=')) {
			this.accept(TokenType.Delim, '<');
			return node;
		} else if (this.accept(TokenType.Delim, '<')) {
			this.accept(TokenType.Delim, '=');
			return node;
		}
		return null;
	}

	public _parseRuleSetDeclaration(): nodes.Node {
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseKeyframe()
				|| this._parseMedia()
				|| this._parseImport()
				|| this._parseDetachedRuleSetMixin() // less detached ruleset mixin
				|| this._parseVariableDeclaration(); // Variable declarations
		}
		return this._tryParseMixinDeclaration()
			|| this._tryParseRuleset(true)  // nested ruleset
			|| this._tryParseMixinReference() // less mixin reference
			|| this._parseExtend() // less extend declaration
			|| super._parseRuleSetDeclaration(); // try css ruleset declaration as the last option
	}

	public _parseSimpleSelectorBody(): nodes.Node {
		return this._parseSelectorCombinator() || super._parseSimpleSelectorBody();
	}

	public _parseSelector(isNested: boolean): nodes.Selector {
		// CSS Guards
		let mark = this.mark();
		let node = <nodes.Selector>this.create(nodes.Selector);
		if (node.addChild(this._parseSimpleSelector()) && node.addChild(this._parseGuard())) {
			return this.finish(node);
		}
		this.restoreAtMark(mark);
		return super._parseSelector(isNested);
	}

	public _parseSelectorCombinator(): nodes.Node {
		let node = this.createNode(nodes.NodeType.SelectorCombinator);
		if (this.accept(TokenType.Delim, '&')) {
			while (!this.hasWhitespace() && (this.accept(TokenType.Delim, '-') || node.addChild(this._parseIdent()) || this.accept(TokenType.Delim, '&'))) {
				//  support &-foo
			}
			return this.finish(node);
		}
		return null;
	}

	public _parseSelectorIdent(): nodes.Node {
		return this._parseIdent() || this._parseSelectorInterpolation();
	}

	public _parseSelectorInterpolation(): nodes.Node {
		// Selector interpolation;  old: ~"@{name}", new: @{name}
		let node = this.createNode(nodes.NodeType.SelectorInterpolation);
		if (this.accept(TokenType.Delim, '~')) {
			if (!this.hasWhitespace() && (this.accept(TokenType.String) || this.accept(TokenType.BadString))) {
				return this.finish(node);
			}
			return this.finish(node, ParseError.StringLiteralExpected);
		} else if (this.accept(TokenType.Delim, '@')) {
			if (this.hasWhitespace() || !this.accept(TokenType.CurlyL)) {
				return this.finish(node, ParseError.LeftCurlyExpected);
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

	public _tryParseMixinDeclaration(): nodes.Node {
		let mark = this.mark();
		let node = <nodes.MixinDeclaration>this.create(nodes.MixinDeclaration);

		if (!node.setIdentifier(this._parseMixinDeclarationIdentifier()) || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(mark);
			return null;
		}

		if (node.getParameters().addChild(this._parseMixinParameter())) {
			while (this.accept(TokenType.Comma) || this.accept(TokenType.SemiColon)) {
				if (!node.getParameters().addChild(this._parseMixinParameter())) {
					return this.finish(node, ParseError.IdentifierExpected);
				}
			}
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		node.setGuard(this._parseGuard());

		if (!this.peek(TokenType.CurlyL)) {
			this.restoreAtMark(mark);
			return null;
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	private _parseMixinDeclarationIdentifier(): nodes.Identifier {
		let identifier : nodes.Identifier;
		if (this.peek(TokenType.Delim, '#') || this.peek(TokenType.Delim, '.')) {
			identifier = <nodes.Identifier> this.create(nodes.Identifier);
			this.consumeToken(); // # or .
			if (this.hasWhitespace() || !identifier.addChild(this._parseIdent())) {
				return null;
			}
		} else if (this.peek(TokenType.Hash)) {
			identifier = <nodes.Identifier> this.create(nodes.Identifier);
			this.consumeToken(); // TokenType.Hash
		} else {
			return null;
		}
		identifier.referenceTypes = [nodes.ReferenceType.Mixin];
		return this.finish(identifier);
	}

	public _parsePseudo(): nodes.Node {
		if (!this.peek(TokenType.Colon)) {
			return null;
		}
		let mark = this.mark();
		let node = <nodes.ExtendsReference>this.create(nodes.ExtendsReference);
		this.consumeToken(); // :
		if (this.accept(TokenType.Ident, 'extend')) {
			return this._completeExtends(node);
		}
		this.restoreAtMark(mark);
		return super._parsePseudo();
	}

	public _parseExtend(): nodes.Node {
		if (!this.peek(TokenType.Delim, '&')) {
			return null;
		}

		let mark = this.mark();
		let node = <nodes.ExtendsReference>this.create(nodes.ExtendsReference);
		this.consumeToken(); // &

		if (this.hasWhitespace() || !this.accept(TokenType.Colon) || !this.accept(TokenType.Ident, 'extend')) {
			this.restoreAtMark(mark);
			return null;
		}
		return this._completeExtends(node);
	}

	private _completeExtends(node: nodes.ExtendsReference): nodes.Node {
		if (!this.accept(TokenType.ParenthesisL)) {
			return this.finish(node, ParseError.LeftParenthesisExpected);
		}
		if (!node.setSelector(this._parseSelector(true))) {
			return this.finish(node, ParseError.SelectorExpected);
		}
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseDetachedRuleSetMixin(): nodes.Node {
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}
		let mark = this.mark();
		let node = <nodes.MixinReference>this.create(nodes.MixinReference);
		if (!node.addChild(this._parseVariable()) || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(mark);
			return null;
		}
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		} 
		return this.finish(node);
	}
	

	public _tryParseMixinReference(atRoot = false): nodes.Node {
		let mark = this.mark();
		let node = <nodes.MixinReference>this.create(nodes.MixinReference);

		let identifier = this._parseMixinDeclarationIdentifier();
		while (identifier) {
			this.accept(TokenType.Delim, '>');
			let nextId = this._parseMixinDeclarationIdentifier();
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

		if (!this.hasWhitespace() && this.accept(TokenType.ParenthesisL)) {
			if (node.getArguments().addChild(this._parseMixinArgument())) {
				while (this.accept(TokenType.Comma) || this.accept(TokenType.SemiColon)) {
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

		node.addChild(this._parsePrio());
		if (atRoot && !this.peek(TokenType.SemiColon)) {
			this.restoreAtMark(mark);
			return null;
		}
		return this.finish(node);
	}

	public _parseMixinArgument(): nodes.Node {
		// [variableName ':'] expression | variableName '...'
		let node = <nodes.FunctionArgument>this.create(nodes.FunctionArgument);

		let pos = this.mark();
		let argument = this._parseVariable();
		if (argument) {
			if (!this.accept(TokenType.Colon)) {
				this.restoreAtMark(pos);
			} else {
				node.setIdentifier(argument);
			}
		}

		if (node.setValue(this._parseExpr(true))) {
			return this.finish(node);
		}

		return null;
	}	

	public _parseMixinParameter(): nodes.Node {

		let node = <nodes.FunctionParameter>this.create(nodes.FunctionParameter);

		// special rest variable: @rest...
		if (this.peek(TokenType.AtKeyword, '@rest')) {
			let restNode = this.create(nodes.Node);
			this.consumeToken();
			if (!this.accept(lessScanner.Ellipsis)) {
				return this.finish(node, ParseError.DotExpected, [], [TokenType.Comma, TokenType.ParenthesisR]);
			}
			node.setIdentifier(this.finish(restNode));
			return this.finish(node);
		}

		// special let args: ...
		if (this.peek(lessScanner.Ellipsis)) {
			let varargsNode = this.create(nodes.Node);
			this.consumeToken();
			node.setIdentifier(this.finish(varargsNode));
			return this.finish(node);
		}

		// default variable declaration: @param: 12 or @name
		if (node.setIdentifier(this._parseVariable())) {
			this.accept(TokenType.Colon);
		}
		node.setDefaultValue(this._parseExpr(true));

		return this.finish(node);
	}

	public _parseGuard(): nodes.LessGuard {
		if (!this.peek(TokenType.Ident, 'when')) {
			return null;
		}
		let node = <nodes.LessGuard>this.create(nodes.LessGuard);
		this.consumeToken(); // when
		node.isNegated = this.accept(TokenType.Ident, 'not');

		if (!node.getConditions().addChild(this._parseGuardCondition())) {
			return <nodes.LessGuard>this.finish(node, ParseError.ConditionExpected);
		}
		while (this.accept(TokenType.Ident, 'and') || this.accept(TokenType.Comma, ',')) {
			if (!node.getConditions().addChild(this._parseGuardCondition())) {
				return <nodes.LessGuard>this.finish(node, ParseError.ConditionExpected);
			}
		}

		return <nodes.LessGuard>this.finish(node);
	}

	public _parseGuardCondition(): nodes.Node {
		let node = this.create(nodes.GuardCondition);
		if (!this.accept(TokenType.ParenthesisL)) {
			return null;
		}

		if (!node.addChild(this._parseExpr())) {
			// empty (?)
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}

		return this.finish(node);
	}

	public _parseFunctionIdentifier(): nodes.Identifier {
		if (this.peek(TokenType.Delim, '%')) {
			let node = <nodes.Identifier>this.create(nodes.Identifier);
			node.referenceTypes = [nodes.ReferenceType.Function];
			this.consumeToken();
			return this.finish(node);
		}

		return super._parseFunctionIdentifier();
	}

	public _parsePropertyIdentifier(): nodes.Identifier {
		let identifier = this._parseIdent();
		if (!identifier) {
			return null;
		}
		if (!this.hasWhitespace()) {
			this.accept(TokenType.Delim, '+');
			if (!this.hasWhitespace()) {
				this.accept(TokenType.Ident, '_');
			}
		}
		return this.finish(identifier);
	}
}
