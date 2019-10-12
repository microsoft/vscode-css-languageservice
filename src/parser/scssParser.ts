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

	public _parseStylesheetStatement(): nodes.Node | null {
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseWarnAndDebug()
				|| this._parseControlStatement()
				|| this._parseMixinDeclaration()
				|| this._parseMixinContent()
				|| this._parseMixinReference() // @include
				|| this._parseFunctionDeclaration()
				|| this._parseForward()
				|| this._parseUse()
				|| super._parseStylesheetAtStatement();
		}
		return this._parseRuleset(true) || this._parseVariableDeclaration();
	}

	public _parseImport(): nodes.Node | null {

		if (!this.peekKeyword('@import')) {
			return null;
		}
		const node = <nodes.Import>this.create(nodes.Import);
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
	public _parseVariableDeclaration(panic: TokenType[] = []): nodes.VariableDeclaration | null {
		if (!this.peek(scssScanner.VariableName)) {
			return null;
		}

		const node = <nodes.VariableDeclaration>this.create(nodes.VariableDeclaration);

		if (!node.setVariable(this._parseVariable())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return this.finish(node, ParseError.ColonExpected);
		}
		if (this.prevToken) {
			node.colonPosition = this.prevToken.offset;
		}

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

	public _parseMediaFeatureName(): nodes.Node | null {
		return this._parseFunction() || this._parseIdent() || this._parseVariable(); // first function, the indent
	}

	public _parseKeyframeSelector(): nodes.Node | null {
		return this._tryParseKeyframeSelector()
			|| this._parseControlStatement(this._parseKeyframeSelector.bind(this))
			|| this._parseVariableDeclaration()
			|| this._parseMixinContent();
	}

	public _parseVariable(): nodes.Variable | null {
		if (!this.peek(scssScanner.VariableName)) {
			return null;
		}
		const node = <nodes.Variable>this.create(nodes.Variable);
		this.consumeToken();
		return <nodes.Variable>node;
	}

	public _parseIdent(referenceTypes?: nodes.ReferenceType[]): nodes.Identifier | null {
		if (!this.peek(TokenType.Ident) && !this.peek(scssScanner.InterpolationFunction) && !this.peekDelim('-')) {
			return null;
		}

		const node = <nodes.Identifier>this.create(nodes.Identifier);
		node.referenceTypes = referenceTypes;
		node.isCustomProperty = this.peekRegExp(TokenType.Ident, /^--/);
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

		while (this.accept(TokenType.Ident) || node.addChild(indentInterpolation()) || (hasContent && (this.acceptDelim('-') || this.accept(TokenType.Num)))) {
			hasContent = true;
			if (this.hasWhitespace()) {
				break;
			}
		}
		return hasContent ? this.finish(node) : null;
	}

	public _parseTerm(): nodes.Term | null {
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

	public _parseInterpolation(): nodes.Node | null {
		if (this.peek(scssScanner.InterpolationFunction)) {
			const node = this.create(nodes.Interpolation);
			this.consumeToken();
			if (!node.addChild(this._parseExpr()) && !this._parseSelectorCombinator()) {
				if (this.accept(TokenType.CurlyR)) {
					return this.finish(node);
				}
				return this.finish(node, ParseError.ExpressionExpected);
			}
			if (!this.accept(TokenType.CurlyR)) {
				return this.finish(node, ParseError.RightCurlyExpected);
			}
			return this.finish(node);
		}
		return null;
	}

	public _parseOperator(): nodes.Node | null {
		if (this.peek(scssScanner.EqualsOperator) || this.peek(scssScanner.NotEqualsOperator)
			|| this.peek(scssScanner.GreaterEqualsOperator) || this.peek(scssScanner.SmallerEqualsOperator)
			|| this.peekDelim('>') || this.peekDelim('<')
			|| this.peekIdent('and') || this.peekIdent('or')
			|| this.peekDelim('%')
		) {
			const node = this.createNode(nodes.NodeType.Operator);
			this.consumeToken();
			return this.finish(node);
		}
		return super._parseOperator();
	}

	public _parseUnaryOperator(): nodes.Node | null {
		if (this.peekIdent('not')) {
			const node = this.create(nodes.Node);
			this.consumeToken();
			return this.finish(node);
		}
		return super._parseUnaryOperator();
	}

	public _parseRuleSetDeclaration(): nodes.Node | null {
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

	public _parseDeclaration(resyncStopTokens?: TokenType[]): nodes.Declaration | null {
		const node = <nodes.Declaration>this.create(nodes.Declaration);
		if (!node.setProperty(this._parseProperty())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return this.finish(node, ParseError.ColonExpected, [TokenType.Colon], resyncStopTokens);
		}
		if (this.prevToken) {
			node.colonPosition = this.prevToken.offset;
		}

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
		const node = <nodes.NestedProperties>this.create(nodes.NestedProperties);
		return this._parseBody(node, this._parseDeclaration.bind(this));
	}

	public _parseExtends(): nodes.Node | null {
		if (this.peekKeyword('@extend')) {
			const node = <nodes.ExtendsReference>this.create(nodes.ExtendsReference);
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

	public _parseSimpleSelectorBody(): nodes.Node | null {
		return this._parseSelectorCombinator() || this._parseSelectorPlaceholder() || super._parseSimpleSelectorBody();
	}

	public _parseSelectorCombinator(): nodes.Node | null {
		if (this.peekDelim('&')) {
			const node = this.createNode(nodes.NodeType.SelectorCombinator);
			this.consumeToken();
			while (!this.hasWhitespace() && (this.acceptDelim('-') || this.accept(TokenType.Num) || this.accept(TokenType.Dimension) || node.addChild(this._parseIdent()) || this.acceptDelim('&'))) {
				//  support &-foo-1
			}
			return this.finish(node);
		}
		return null;
	}

	public _parseSelectorPlaceholder(): nodes.Node | null {
		if (this.peekDelim('%')) {
			const node = this.createNode(nodes.NodeType.SelectorPlaceholder);
			this.consumeToken();
			this._parseIdent();
			return this.finish(node);
		} else if (this.peekKeyword('@at-root')) {
			const node = this.createNode(nodes.NodeType.SelectorPlaceholder);
			this.consumeToken();
			return this.finish(node);
		}
		return null;
	}

	public _parseElementName(): nodes.Node | null {
		const pos = this.mark();
		const node = super._parseElementName();
		if (node && !this.hasWhitespace() && this.peek(TokenType.ParenthesisL)) { // for #49589
			this.restoreAtMark(pos);
			return null;
		}
		return node;
	}

	public _tryParsePseudoIdentifier(): nodes.Node | null {
		return this._parseInterpolation() || super._tryParsePseudoIdentifier(); // for #49589
	}

	public _parseWarnAndDebug(): nodes.Node | null {
		if (!this.peekKeyword('@debug')
			&& !this.peekKeyword('@warn')
			&& !this.peekKeyword('@error')) {
			return null;
		}
		const node = this.createNode(nodes.NodeType.Debug);
		this.consumeToken(); // @debug, @warn or @error
		node.addChild(this._parseExpr()); // optional
		return this.finish(node);
	}

	public _parseControlStatement(parseStatement: () => nodes.Node | null = this._parseRuleSetDeclaration.bind(this)): nodes.Node | null {
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}
		return this._parseIfStatement(parseStatement) || this._parseForStatement(parseStatement)
			|| this._parseEachStatement(parseStatement) || this._parseWhileStatement(parseStatement);
	}

	public _parseIfStatement(parseStatement: () => nodes.Node | null): nodes.Node | null {
		if (!this.peekKeyword('@if')) {
			return null;
		}
		return this._internalParseIfStatement(parseStatement);
	}

	private _internalParseIfStatement(parseStatement: () => nodes.Node | null): nodes.IfStatement {
		const node = <nodes.IfStatement>this.create(nodes.IfStatement);
		this.consumeToken(); // @if or if
		if (!node.setExpression(this._parseExpr(true))) {
			return this.finish(node, ParseError.ExpressionExpected);
		}
		this._parseBody(node, parseStatement);
		if (this.acceptKeyword('@else')) {
			if (this.peekIdent('if')) {
				node.setElseClause(this._internalParseIfStatement(parseStatement));
			} else if (this.peek(TokenType.CurlyL)) {
				const elseNode = <nodes.BodyDeclaration>this.create(nodes.ElseStatement);
				this._parseBody(elseNode, parseStatement);
				node.setElseClause(elseNode);
			}
		}
		return this.finish(node);
	}

	public _parseForStatement(parseStatement: () => nodes.Node | null): nodes.Node | null {
		if (!this.peekKeyword('@for')) {
			return null;
		}

		const node = <nodes.ForStatement>this.create(nodes.ForStatement);
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

	public _parseEachStatement(parseStatement: () => nodes.Node | null): nodes.Node | null {
		if (!this.peekKeyword('@each')) {
			return null;
		}

		const node = <nodes.EachStatement>this.create(nodes.EachStatement);
		this.consumeToken(); // @each
		const variables = node.getVariables();
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

	public _parseWhileStatement(parseStatement: () => nodes.Node | null): nodes.Node | null {
		if (!this.peekKeyword('@while')) {
			return null;
		}

		const node = <nodes.WhileStatement>this.create(nodes.WhileStatement);
		this.consumeToken(); // @while
		if (!node.addChild(this._parseBinaryExpr())) {
			return this.finish(node, ParseError.ExpressionExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, parseStatement);
	}

	public _parseFunctionBodyDeclaration(): nodes.Node | null {
		return this._parseVariableDeclaration() || this._parseReturnStatement() || this._parseWarnAndDebug()
			|| this._parseControlStatement(this._parseFunctionBodyDeclaration.bind(this));
	}

	public _parseFunctionDeclaration(): nodes.Node | null {
		if (!this.peekKeyword('@function')) {
			return null;
		}

		const node = <nodes.FunctionDeclaration>this.create(nodes.FunctionDeclaration);
		this.consumeToken(); // @function

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Function]))) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		if (!this.accept(TokenType.ParenthesisL)) {
			return this.finish(node, ParseError.LeftParenthesisExpected, [TokenType.CurlyR]);
		}

		if (node.getParameters().addChild(this._parseParameterDeclaration())) {
			while (this.accept(TokenType.Comma)) {
				if (this.peek(TokenType.ParenthesisR)) {
					break;
				}
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

	public _parseReturnStatement(): nodes.Node | null {
		if (!this.peekKeyword('@return')) {
			return null;
		}

		const node = this.createNode(nodes.NodeType.ReturnStatement);
		this.consumeToken(); // @function

		if (!node.addChild(this._parseExpr())) {
			return this.finish(node, ParseError.ExpressionExpected);
		}
		return this.finish(node);
	}

	public _parseMixinDeclaration(): nodes.Node | null {
		if (!this.peekKeyword('@mixin')) {
			return null;
		}

		const node = <nodes.MixinDeclaration>this.create(nodes.MixinDeclaration);
		this.consumeToken();

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Mixin]))) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		if (this.accept(TokenType.ParenthesisL)) {
			if (node.getParameters().addChild(this._parseParameterDeclaration())) {
				while (this.accept(TokenType.Comma)) {
					if (this.peek(TokenType.ParenthesisR)) {
						break;
					}
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

	public _parseParameterDeclaration(): nodes.Node | null {

		const node = <nodes.FunctionParameter>this.create(nodes.FunctionParameter);

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

	public _parseMixinContent(): nodes.Node | null {
		if (!this.peekKeyword('@content')) {
			return null;
		}
		const node = this.createNode(nodes.NodeType.MixinContent);
		this.consumeToken();
		return this.finish(node);
	}


	public _parseMixinReference(): nodes.Node | null {
		if (!this.peekKeyword('@include')) {
			return null;
		}

		const node = <nodes.MixinReference>this.create(nodes.MixinReference);
		this.consumeToken();

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Mixin]))) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		if (this.accept(TokenType.ParenthesisL)) {
			if (node.getArguments().addChild(this._parseFunctionArgument())) {
				while (this.accept(TokenType.Comma)) {
					if (this.peek(TokenType.ParenthesisR)) {
						break;
					}
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
			const content = <nodes.BodyDeclaration>this.create(nodes.BodyDeclaration);
			this._parseBody(content, this._parseMixinReferenceBodyStatement.bind(this));
			node.setContent(content);
		}
		return this.finish(node);
	}

	public _parseMixinReferenceBodyStatement(): nodes.Node | null {
		return this._tryParseKeyframeSelector() || this._parseRuleSetDeclaration();
	}

	public _parseFunctionArgument(): nodes.Node | null {
		// [variableName ':'] expression | variableName '...'
		const node = <nodes.FunctionArgument>this.create(nodes.FunctionArgument);

		const pos = this.mark();
		const argument = this._parseVariable();
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
			this.accept(scssScanner.Ellipsis); // #43746
			node.addChild(this._parsePrio()); // #9859
			return this.finish(node);
		}

		return null;
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

	public _parseOperation(): nodes.Node | null {
		if (!this.peek(TokenType.ParenthesisL)) {
			return null;
		}
		const node = this.create(nodes.Node);
		this.consumeToken();

		while (node.addChild(this._parseListElement())) {
			this.accept(TokenType.Comma); // optional
		}
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseListElement(): nodes.Node | null {
		const node = <nodes.ListEntry>this.create(nodes.ListEntry);
		const child = this._parseBinaryExpr();
		if (!child) {
			return null;
		}
		if (this.accept(TokenType.Colon)) {
			node.setKey(child);
			if (!node.setValue(this._parseBinaryExpr())) {
				return this.finish(node, ParseError.ExpressionExpected);
			}
		} else {
			node.setValue(child);
		}
		return this.finish(node);
	}

	public _parseUse(): nodes.Node | null {
		if (!this.peekKeyword('@use')) {
			return null;
		}

		const node = <nodes.Use>this.create(nodes.Use);
		this.consumeToken();

		if (!node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.StringLiteralExpected);
		}

		if (
			this.acceptIdent('as') &&
			(!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Module])) && !this.acceptDelim('*'))
		) {
			return this.finish(node, ParseError.IdentifierOrWildcardExpected);
		}

		if (this.acceptIdent('with')) {
			if (!this.accept(TokenType.ParenthesisL)) {
				return this.finish(node, ParseError.LeftParenthesisExpected, [TokenType.ParenthesisR]);
			}

			// First variable statement, no comma.
			if (!node.getParameters().addChild(this._parseModuleConfigDeclaration())) {
				return this.finish(node, ParseError.VariableNameExpected);
			}

			while (this.accept(TokenType.Comma)) {
				if (this.peek(TokenType.ParenthesisR)) {
					break;
				}
				if (!node.getParameters().addChild(this._parseModuleConfigDeclaration())) {
					return this.finish(node, ParseError.VariableNameExpected);
				}
			}

			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected);
			}

		}

		return this.finish(node);
	}

	public _parseModuleConfigDeclaration(): nodes.Node | null {

		const node = <nodes.ModuleConfiguration>this.create(nodes.ModuleConfiguration);

		if (!node.setIdentifier(this._parseVariable())) {
			return null;
		}

		if (!this.accept(TokenType.Colon) || !node.setValue(this._parseExpr(true))) {
			return this.finish(node, ParseError.VariableValueExpected, [], [TokenType.Comma, TokenType.ParenthesisR]);
		}

		return this.finish(node);
	}

	public _parseForward(): nodes.Node | null {
		if (!this.peekKeyword('@forward')) {
			return null;
		}

		const node = <nodes.Forward>this.create(nodes.Forward);
		this.consumeToken();

		if (!node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.StringLiteralExpected);
		}

		return this.finish(node);
	}
}
