/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import * as scssScanner from './scssScanner';
import { TokenType } from './cssScanner';
import * as cssParser from './cssParser';
import * as nodes from './cssNodes';

import { SCSSParseError } from './scssErrors';
import { ParseError } from './cssErrors';

/// <summary>
/// A parser for scss
/// http://sass-lang.com/documentation/file.SASS_REFERENCE.html
/// </summary>
export class SCSSParser extends cssParser.Parser {

	public constructor() {
		super(new scssScanner.SCSSScanner());
	}

	public _parseStylesheetStatement(): nodes.Node {
		let node = super._parseStylesheetStatement();
		if (node) {
			return node;
		}
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseWarnAndDebug()
				|| this._parseControlStatement()
				|| this._parseMixinDeclaration()
				|| this._parseMixinContent()
				|| this._parseMixinReference() // @include
				|| this._parseFunctionDeclaration();
		}
		return this._parseVariableDeclaration();
	}

	public _parseImport(): nodes.Node {

		if (!this.peekKeyword('@import')) {
			return null;
		}
		let node = <nodes.Import>this.create(nodes.Import);
		this.consumeToken();


		if (!node.addChild(this._parseURILiteral()) && !node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.URIOrStringExpected);
		}
		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this._parseURILiteral()) && !node.addChild(this._parseStringLiteral())) {
				return this.finish(node, ParseError.URIOrStringExpected);
			}
		}

		if (!this.peek(TokenType.SemiColon) && !this.peek(TokenType.EOF)) {
			node.setMedialist(this._parseMediaQueryList());
		}

		return this.finish(node);
	}

	// scss variables: $font-size: 12px;
	public _parseVariableDeclaration(panic: TokenType[] = []): nodes.VariableDeclaration {
		if (!this.peek(scssScanner.VariableName)) {
			return null;
		}

		let node = <nodes.VariableDeclaration>this.create(nodes.VariableDeclaration);

		if (!node.setVariable(this._parseVariable())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return this.finish(node, ParseError.ColonExpected);
		}
		node.colonPosition = this.prevToken.offset;

		if (!node.setValue(this._parseExpr())) {
			return this.finish(node, ParseError.VariableValueExpected, [], panic);
		}

		while (this.accept(TokenType.Exclamation)) {
			if (!this.peekRegExp(TokenType.Ident, /^(default|global)$/)) {
				return this.finish(node, ParseError.UnknownKeyword);
			}
			this.consumeToken();
		}

		if (this.peek(TokenType.SemiColon)) {
			node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
		}

		return this.finish(node);
	}

	public _parseMediaFeatureName(): nodes.Node {
		return this._parseFunction() || this._parseIdent() || this._parseVariable(); // first function, the indent
	}

	public _parseKeyframeSelector(): nodes.Node {
		return this._tryParseKeyframeSelector() || this._parseControlStatement(this._parseKeyframeSelector.bind(this)) || this._parseMixinContent();
	}

	public _parseVariable(): nodes.Variable {
		if (!this.peek(scssScanner.VariableName)) {
			return null;
		}
		let node = <nodes.Variable>this.create(nodes.Variable);
		this.consumeToken();
		return <nodes.Variable>node;
	}

	public _parseIdent(referenceTypes?: nodes.ReferenceType[]): nodes.Identifier {
		if (!this.peek(TokenType.Ident) && !this.peek(scssScanner.InterpolationFunction) && !this.peekDelim('-')) {
			return null;
		}

		let node = <nodes.Identifier>this.create(nodes.Identifier);
		node.referenceTypes = referenceTypes;
		let hasContent = false;
		let delimWithInterpolation = () => {
			if (!this.acceptDelim('-')) {
				return null;
			}
			if (!this.hasWhitespace() && this.acceptDelim('-')) {
				node.isCustomProperty = true;
			}
			if (!this.hasWhitespace()) {
				return this._parseInterpolation();
			}
			return null;
		};
		while (this.accept(TokenType.Ident) || node.addChild(this._parseInterpolation() || this.try(delimWithInterpolation))) {
			hasContent = true;
			if (!this.hasWhitespace() && this.acceptDelim('-')) {
				// '-' is a valid char inside a ident (special treatment here to support #{foo}-#{bar})
			}
			if (this.hasWhitespace()) {
				break;
			}
		}
		return hasContent ? this.finish(node) : null;
	}

	public _parseTerm(): nodes.Term {
		let term = super._parseTerm();
		if (term) { return term; }

		term = <nodes.Term>this.create(nodes.Term);
		if (term.setExpression(this._parseVariable())
			|| term.setExpression(this._parseSelectorCombinator())
			|| term.setExpression(this._tryParsePrio())) {
			return <nodes.Term>this.finish(term);
		}

		return null;
	}

	public _parseInterpolation(): nodes.Node {
		if (this.peek(scssScanner.InterpolationFunction)) {
			let node = this.create(nodes.Interpolation);
			this.consumeToken();
			if (!node.addChild(this._parseBinaryExpr()) && !this._parseSelectorCombinator()) {
				return this.finish(node, ParseError.ExpressionExpected);
			}
			if (!this.accept(TokenType.CurlyR)) {
				return this.finish(node, ParseError.RightCurlyExpected);
			}
			return this.finish(node);
		}
		return null;
	}

	public _parseOperator(): nodes.Node {
		if (this.peek(scssScanner.EqualsOperator) || this.peek(scssScanner.NotEqualsOperator)
			|| this.peek(scssScanner.GreaterEqualsOperator) || this.peek(scssScanner.SmallerEqualsOperator)
			|| this.peekDelim('>') || this.peekDelim('<')
			|| this.peekIdent('and') || this.peekIdent('or')
			|| this.peekDelim('%')
		) {
			let node = this.createNode(nodes.NodeType.Operator);
			this.consumeToken();
			return this.finish(node);
		}
		return super._parseOperator();
	}

	public _parseUnaryOperator(): nodes.Node {
		if (this.peekIdent('not')) {
			let node = this.create(nodes.Node);
			this.consumeToken();
			return this.finish(node);
		}
		return super._parseUnaryOperator();
	}

	public _parseRuleSetDeclaration(): nodes.Node {
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseKeyframe() // nested @keyframe
				|| this._parseImport() // nested @import
				|| this._parseMedia(true) // nested @media
				|| this._parseFontFace() // nested @font-face
				|| this._parseWarnAndDebug() // @warn, @debug and @error statements
				|| this._parseControlStatement() // @if, @while, @for, @each
				|| this._parseFunctionDeclaration() // @function
				|| this._parseExtends() // @extends
				|| this._parseMixinReference() // @include
				|| this._parseMixinContent() // @content
				|| this._parseMixinDeclaration() // nested @mixin
				|| this._parseRuleset(true) // @at-rule
				|| this._parseSupports(true); // @supports
		}
		return this._parseVariableDeclaration() // variable declaration
			|| this._tryParseRuleset(true) // nested ruleset
			|| super._parseRuleSetDeclaration(); // try css ruleset declaration as last so in the error case, the ast will contain a declaration
	}

	public _parseDeclaration(resyncStopTokens?: TokenType[]): nodes.Declaration {
		let node = <nodes.Declaration>this.create(nodes.Declaration);
		if (!node.setProperty(this._parseProperty())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return this.finish(node, ParseError.ColonExpected, [TokenType.Colon], resyncStopTokens);
		}
		node.colonPosition = this.prevToken.offset;

		let hasContent = false;
		if (node.setValue(this._parseExpr())) {
			hasContent = true;
			node.addChild(this._parsePrio());
		}
		if (this.peek(TokenType.CurlyL)) {
			node.setNestedProperties(this._parseNestedProperties());
		} else {
			if (!hasContent) {
				return this.finish(node, ParseError.PropertyValueExpected);
			}
		}
		if (this.peek(TokenType.SemiColon)) {
			node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
		}
		return this.finish(node);
	}

	public _parseNestedProperties(): nodes.NestedProperties {
		let node = <nodes.NestedProperties>this.create(nodes.NestedProperties);
		return this._parseBody(node, this._parseDeclaration.bind(this));
	}

	public _parseExtends(): nodes.Node {
		if (this.peekKeyword('@extend')) {
			let node = <nodes.ExtendsReference>this.create(nodes.ExtendsReference);
			this.consumeToken();
			if (!node.getSelectors().addChild(this._parseSimpleSelector())) {
				return this.finish(node, ParseError.SelectorExpected);
			}
			while (this.accept(TokenType.Comma)) {
				node.getSelectors().addChild(this._parseSimpleSelector());
			}
			if (this.accept(TokenType.Exclamation)) {
				if (!this.acceptIdent('optional')) {
					return this.finish(node, ParseError.UnknownKeyword);
				}
			}
			return this.finish(node);
		}
		return null;
	}

	public _parseSimpleSelectorBody(): nodes.Node {
		return this._parseSelectorCombinator() || this._parseSelectorPlaceholder() || super._parseSimpleSelectorBody();
	}

	public _parseSelectorCombinator(): nodes.Node {
		if (this.peekDelim('&')) {
			let node = this.createNode(nodes.NodeType.SelectorCombinator);
			this.consumeToken();
			while (!this.hasWhitespace() && (this.acceptDelim('-') || this.accept(TokenType.Num) || this.accept(TokenType.Dimension) || node.addChild(this._parseIdent()) || this.acceptDelim('&'))) {
				//  support &-foo-1
			}
			return this.finish(node);
		}
		return null;
	}

	public _parseSelectorPlaceholder(): nodes.Node {
		if (this.peekDelim('%')) {
			let node = this.createNode(nodes.NodeType.SelectorPlaceholder);
			this.consumeToken();
			this._parseIdent();
			return this.finish(node);
		} else if (this.peekKeyword('@at-root')) {
			let node = this.createNode(nodes.NodeType.SelectorPlaceholder);
			this.consumeToken();
			return this.finish(node);
		}
		return null;
	}

	public _parseWarnAndDebug(): nodes.Node {
		if (!this.peekKeyword('@debug')
			&& !this.peekKeyword('@warn')
			&& !this.peekKeyword('@error')) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.Debug);
		this.consumeToken(); // @debug, @warn or @error
		node.addChild(this._parseExpr()); // optional
		return this.finish(node);
	}

	public _parseControlStatement(parseStatement: () => nodes.Node = this._parseRuleSetDeclaration.bind(this)): nodes.Node {
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}
		return this._parseIfStatement(parseStatement) || this._parseForStatement(parseStatement)
			|| this._parseEachStatement(parseStatement) || this._parseWhileStatement(parseStatement);
	}

	public _parseIfStatement(parseStatement: () => nodes.Node): nodes.Node {
		if (!this.peekKeyword('@if')) {
			return null;
		}
		return this._internalParseIfStatement(parseStatement);
	}

	private _internalParseIfStatement(parseStatement: () => nodes.Node): nodes.IfStatement {
		let node = <nodes.IfStatement>this.create(nodes.IfStatement);
		this.consumeToken(); // @if or if
		if (!node.setExpression(this._parseExpr(true))) {
			return this.finish(node, ParseError.ExpressionExpected);
		}
		this._parseBody(node, parseStatement);
		if (this.acceptKeyword('@else')) {
			if (this.peekIdent('if')) {
				node.setElseClause(this._internalParseIfStatement(parseStatement));
			} else if (this.peek(TokenType.CurlyL)) {
				let elseNode = <nodes.BodyDeclaration>this.create(nodes.ElseStatement);
				this._parseBody(elseNode, parseStatement);
				node.setElseClause(elseNode);
			}
		}
		return this.finish(node);
	}

	public _parseForStatement(parseStatement: () => nodes.Node): nodes.Node {
		if (!this.peekKeyword('@for')) {
			return null;
		}

		let node = <nodes.ForStatement>this.create(nodes.ForStatement);
		this.consumeToken(); // @for
		if (!node.setVariable(this._parseVariable())) {
			return this.finish(node, ParseError.VariableNameExpected, [TokenType.CurlyR]);
		}
		if (!this.acceptIdent('from')) {
			return this.finish(node, SCSSParseError.FromExpected, [TokenType.CurlyR]);
		}
		if (!node.addChild(this._parseBinaryExpr())) {
			return this.finish(node, ParseError.ExpressionExpected, [TokenType.CurlyR]);
		}
		if (!this.acceptIdent('to') && !this.acceptIdent('through')) {
			return this.finish(node, SCSSParseError.ThroughOrToExpected, [TokenType.CurlyR]);
		}
		if (!node.addChild(this._parseBinaryExpr())) {
			return this.finish(node, ParseError.ExpressionExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, parseStatement);
	}

	public _parseEachStatement(parseStatement: () => nodes.Node): nodes.Node {
		if (!this.peekKeyword('@each')) {
			return null;
		}

		let node = <nodes.EachStatement>this.create(nodes.EachStatement);
		this.consumeToken(); // @each
		let variables = node.getVariables();
		if (!variables.addChild(this._parseVariable())) {
			return this.finish(node, ParseError.VariableNameExpected, [TokenType.CurlyR]);
		}
		while (this.accept(TokenType.Comma)) {
			if (!variables.addChild(this._parseVariable())) {
				return this.finish(node, ParseError.VariableNameExpected, [TokenType.CurlyR]);
			}
		}
		this.finish(variables);
		if (!this.acceptIdent('in')) {
			return this.finish(node, SCSSParseError.InExpected, [TokenType.CurlyR]);
		}
		if (!node.addChild(this._parseExpr())) {
			return this.finish(node, ParseError.ExpressionExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, parseStatement);
	}

	public _parseWhileStatement(parseStatement: () => nodes.Node): nodes.Node {
		if (!this.peekKeyword('@while')) {
			return null;
		}

		let node = <nodes.WhileStatement>this.create(nodes.WhileStatement);
		this.consumeToken(); // @while
		if (!node.addChild(this._parseBinaryExpr())) {
			return this.finish(node, ParseError.ExpressionExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, parseStatement);
	}

	public _parseFunctionBodyDeclaration(): nodes.Node {
		return this._parseVariableDeclaration() || this._parseReturnStatement() || this._parseWarnAndDebug()
			|| this._parseControlStatement(this._parseFunctionBodyDeclaration.bind(this));
	}

	public _parseFunctionDeclaration(): nodes.Node {
		if (!this.peekKeyword('@function')) {
			return null;
		}

		let node = <nodes.FunctionDeclaration>this.create(nodes.FunctionDeclaration);
		this.consumeToken(); // @function

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Function]))) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		if (!this.accept(TokenType.ParenthesisL)) {
			return this.finish(node, ParseError.LeftParenthesisExpected, [TokenType.CurlyR]);
		}

		if (node.getParameters().addChild(this._parseParameterDeclaration())) {
			while (this.accept(TokenType.Comma)) {
				if (!node.getParameters().addChild(this._parseParameterDeclaration())) {
					return this.finish(node, ParseError.VariableNameExpected);
				}
			}
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, this._parseFunctionBodyDeclaration.bind(this));
	}

	public _parseReturnStatement(): nodes.Node {
		if (!this.peekKeyword('@return')) {
			return null;
		}

		let node = this.createNode(nodes.NodeType.ReturnStatement);
		this.consumeToken(); // @function

		if (!node.addChild(this._parseExpr())) {
			return this.finish(node, ParseError.ExpressionExpected);
		}
		return this.finish(node);
	}

	public _parseMixinDeclaration(): nodes.Node {
		if (!this.peekKeyword('@mixin')) {
			return null;
		}

		let node = <nodes.MixinDeclaration>this.create(nodes.MixinDeclaration);
		this.consumeToken();

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Mixin]))) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		if (this.accept(TokenType.ParenthesisL)) {
			if (node.getParameters().addChild(this._parseParameterDeclaration())) {
				while (this.accept(TokenType.Comma)) {
					if (!node.getParameters().addChild(this._parseParameterDeclaration())) {
						return this.finish(node, ParseError.VariableNameExpected);
					}
				}
			}

			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected, [TokenType.CurlyR]);
			}
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseParameterDeclaration(): nodes.Node {

		let node = <nodes.FunctionParameter>this.create(nodes.FunctionParameter);

		if (!node.setIdentifier(this._parseVariable())) {
			return null;
		}

		if (this.accept(scssScanner.Ellipsis)) {
			// ok
		}

		if (this.accept(TokenType.Colon)) {
			if (!node.setDefaultValue(this._parseExpr(true))) {
				return this.finish(node, ParseError.VariableValueExpected, [], [TokenType.Comma, TokenType.ParenthesisR]);
			}
		}
		return this.finish(node);
	}

	public _parseMixinContent(): nodes.Node {
		if (!this.peekKeyword('@content')) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.MixinContent);
		this.consumeToken();
		return this.finish(node);
	}


	public _parseMixinReference(): nodes.Node {
		if (!this.peekKeyword('@include')) {
			return null;
		}

		let node = <nodes.MixinReference>this.create(nodes.MixinReference);
		this.consumeToken();

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Mixin]))) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		if (this.accept(TokenType.ParenthesisL)) {
			if (node.getArguments().addChild(this._parseFunctionArgument())) {
				while (this.accept(TokenType.Comma)) {
					if (!node.getArguments().addChild(this._parseFunctionArgument())) {
						return this.finish(node, ParseError.ExpressionExpected);
					}
				}
			}

			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected);
			}
		}

		if (this.peek(TokenType.CurlyL)) {
			let content = <nodes.BodyDeclaration>this.create(nodes.BodyDeclaration);
			this._parseBody(content, this._parseMixinReferenceBodyStatement.bind(this));
			node.setContent(content);
		}
		return this.finish(node);
	}

	public _parseMixinReferenceBodyStatement(): nodes.Node {
		return this._tryParseKeyframeSelector() || this._parseRuleSetDeclaration();
	}

	public _parseFunctionArgument(): nodes.Node {
		// [variableName ':'] expression | variableName '...'
		let node = <nodes.FunctionArgument>this.create(nodes.FunctionArgument);

		let pos = this.mark();
		let argument = this._parseVariable();
		if (argument) {
			if (!this.accept(TokenType.Colon)) {
				if (this.accept(scssScanner.Ellipsis)) { // optional
					node.setValue(argument);
					return this.finish(node);
				} else {
					this.restoreAtMark(pos);
				}
			} else {
				node.setIdentifier(argument);
			}
		}

		if (node.setValue(this._parseExpr(true))) {
			node.addChild(this._parsePrio()); // #9859
			return this.finish(node);
		}

		return null;
	}

	public _parseURLArgument(): nodes.Node {
		let pos = this.mark();
		let node = super._parseURLArgument();
		if (!node || !this.peek(TokenType.ParenthesisR)) {
			this.restoreAtMark(pos);

			let node = this.create(nodes.Node);
			node.addChild(this._parseBinaryExpr());
			return this.finish(node);
		}
		return node;
	}

	public _parseOperation(): nodes.Node {
		if (!this.peek(TokenType.ParenthesisL)) {
			return null;
		}
		let node = this.create(nodes.Node);
		this.consumeToken();

		while (node.addChild(this._parseListElement())) {
			this.accept(TokenType.Comma); // optional
		}
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseListElement(): nodes.Node {
		let node = this.createNode(nodes.NodeType.ListEntry);
		if (!node.addChild(this._parseBinaryExpr())) {
			return null;
		}
		if (this.accept(TokenType.Colon)) {
			if (!node.addChild(this._parseBinaryExpr())) {
				return this.finish(node, ParseError.ExpressionExpected);
			}
		}
		return this.finish(node);
	}
}
