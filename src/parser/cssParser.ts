/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { TokenType, Scanner, IToken } from './cssScanner';
import * as nodes from './cssNodes';
import { ParseError, CSSIssueType } from './cssErrors';
import * as languageFacts from '../services/languageFacts';
import { TextDocument } from 'vscode-languageserver-types';

export interface IMark {
	prev: IToken;
	curr: IToken;
	pos: number;
}

/// <summary>
/// A parser for the css core specification. See for reference:
/// http://www.w3.org/TR/CSS21/syndata.html#tokenization
/// </summary>
export class Parser {

	public scanner: Scanner;
	public token: IToken;
	public prevToken: IToken;

	private lastErrorToken: IToken;

	constructor(scnr: Scanner = new Scanner()) {
		this.scanner = scnr;
		this.token = null;
		this.prevToken = null;
	}

	public peek(type: TokenType, text?: string, ignoreCase: boolean = true): boolean {
		if (type !== this.token.type) {
			return false;
		}
		if (typeof text !== 'undefined') {
			if (ignoreCase) {
				return text.toLowerCase() === this.token.text.toLowerCase();
			} else {
				return text === this.token.text;
			}
		}
		return true;
	}

	public peekRegExp(type: TokenType, regEx: RegExp): boolean {
		if (type !== this.token.type) {
			return false;
		}
		return regEx.test(this.token.text);
	}

	public hasWhitespace(): boolean {
		return this.prevToken && (this.prevToken.offset + this.prevToken.len !== this.token.offset);
	}

	public consumeToken(): void {
		this.prevToken = this.token;
		this.token = this.scanner.scan();
	}

	public mark(): IMark {
		return {
			prev: this.prevToken,
			curr: this.token,
			pos: this.scanner.pos()
		};
	}

	public restoreAtMark(mark: IMark): void {
		this.prevToken = mark.prev;
		this.token = mark.curr;
		this.scanner.goBackTo(mark.pos);
	}

	public acceptOne(type: TokenType, text?: string[], ignoreCase: boolean = true): boolean {
		for (let i = 0; i < text.length; i++) {
			if (this.peek(type, text[i], ignoreCase)) {
				this.consumeToken();
				return true;
			}
		}
		return false;
	}

	public accept(type: TokenType, text?: string, ignoreCase: boolean = true): boolean {
		if (this.peek(type, text, ignoreCase)) {
			this.consumeToken();
			return true;
		}
		return false;
	}

	protected acceptUnquotedString(): boolean {
		let pos = this.scanner.pos();
		this.scanner.goBackTo(this.token.offset);
		let unquoted = this.scanner.scanUnquotedString();
		if (unquoted) {
			this.token = unquoted;
			this.consumeToken();
			return true;
		}
		this.scanner.goBackTo(pos);
		return false;
	}

	public resync(resyncTokens: TokenType[], resyncStopTokens: TokenType[]): boolean {
		while (true) {
			if (resyncTokens && resyncTokens.indexOf(this.token.type) !== -1) {
				this.consumeToken();
				return true;
			} else if (resyncStopTokens && resyncStopTokens.indexOf(this.token.type) !== -1) {
				return true;
			} else {
				if (this.token.type === TokenType.EOF) {
					return false;
				}
				this.token = this.scanner.scan();
			}
		}
	}

	public createNode(nodeType: nodes.NodeType): nodes.Node {
		return new nodes.Node(this.token.offset, this.token.len, nodeType);
	}

	public create(ctor: any): nodes.Node {
		let obj = Object.create(ctor.prototype);
		ctor.apply(obj, [this.token.offset, this.token.len]);
		return obj;
	}

	public finish<T extends nodes.Node>(node: T, error?: CSSIssueType, resyncTokens?: TokenType[], resyncStopTokens?: TokenType[]): T {
		// parseNumeric misuses error for boolean flagging (however the real error mustn't be a false)
		// + nodelist offsets mustn't be modified, because there is a offset hack in rulesets for smartselection
		if (!(node instanceof nodes.Nodelist)) {
			if (error) {
				this.markError(node, error, resyncTokens, resyncStopTokens);
			}
			// set the node end position
			if (this.prevToken !== null) {
				// length with more elements belonging together
				let prevEnd = this.prevToken.offset + this.prevToken.len;
				node.length = prevEnd > node.offset ? prevEnd - node.offset : 0; // offset is taken from current token, end from previous: Use 0 for empty nodes
			}

		}
		return node;
	}

	public markError<T extends nodes.Node>(node: T, error: CSSIssueType, resyncTokens?: TokenType[], resyncStopTokens?: TokenType[]): void {
		if (this.token !== this.lastErrorToken) { // do not report twice on the same token
			node.addIssue(new nodes.Marker(node, error, nodes.Level.Error, null, this.token.offset, this.token.len));
			this.lastErrorToken = this.token;
		}
		if (resyncTokens || resyncStopTokens) {
			this.resync(resyncTokens, resyncStopTokens);
		}
	}

	public parseStylesheet(textDocument: TextDocument): nodes.Stylesheet {
		let versionId = textDocument.version;
		let textProvider = (offset: number, length: number) => {
			if (textDocument.version !== versionId) {
				throw new Error('Underlying model has changed, AST is no longer valid');
			}
			return textDocument.getText().substr(offset, length);
		};

		return this.internalParse(textDocument.getText(), this._parseStylesheet, textProvider);
	}

	public internalParse<T extends nodes.Node>(input: string, parseFunc: () => T, textProvider?: nodes.ITextProvider): T {
		this.scanner.setSource(input);
		this.token = this.scanner.scan();
		let node = parseFunc.bind(this)();
		if (node) {
			if (textProvider) {
				node.textProvider = textProvider;
			} else {
				node.textProvider = (offset: number, length: number) => { return input.substr(offset, length); };
			}
		}
		return node;
	}

	public _parseStylesheet(): nodes.Stylesheet {
		let node = <nodes.Stylesheet>this.create(nodes.Stylesheet);
		node.addChild(this._parseCharset());

		let inRecovery = false;
		do {
			let hasMatch = false;
			do {
				hasMatch = false;
				let statement = this._parseStylesheetStatement();
				if (statement) {
					node.addChild(statement);
					hasMatch = true;
					inRecovery = false;
					if (!this.peek(TokenType.EOF) && this._needsSemicolonAfter(statement) && !this.accept(TokenType.SemiColon)) {
						this.markError(node, ParseError.SemiColonExpected);
					}
				}
				while (this.accept(TokenType.SemiColon) || this.accept(TokenType.CDO) || this.accept(TokenType.CDC)) {
					// accept empty statements
					hasMatch = true;
					inRecovery = false;
				}
			} while (hasMatch);

			if (this.peek(TokenType.EOF)) {
				break;
			}

			if (!inRecovery) {
				if (this.peek(TokenType.AtKeyword)) {
					this.markError(node, ParseError.UnknownAtRule);
				} else {
					this.markError(node, ParseError.RuleOrSelectorExpected);
				}
				inRecovery = true;
			}
			this.consumeToken();
		} while (!this.peek(TokenType.EOF));

		return this.finish(node);
	}

	public _parseStylesheetStatement(): nodes.Node {
		return this._parseRuleset(false)
			|| this._parseImport()
			|| this._parseMedia()
			|| this._parsePage()
			|| this._parseFontFace()
			|| this._parseKeyframe()
			|| this._parseViewPort()
			|| this._parseNamespace()
			|| this._parseDocument();
	}

	public _tryParseRuleset(isNested: boolean): nodes.RuleSet {
		let mark = this.mark();
		if (this._parseSelector(isNested)) {
			while (this.accept(TokenType.Comma) && this._parseSelector(isNested)) {
				// loop
			}
			if (this.accept(TokenType.CurlyL)) {
				this.restoreAtMark(mark);
				return this._parseRuleset(isNested);
			}
		}
		this.restoreAtMark(mark);
		return null;
	}

	public _parseRuleset(isNested: boolean = false): nodes.RuleSet {
		let node = <nodes.RuleSet>this.create(nodes.RuleSet);

		if (!node.getSelectors().addChild(this._parseSelector(isNested))) {
			return null;
		}

		while (this.accept(TokenType.Comma) && node.getSelectors().addChild(this._parseSelector(isNested))) {
			// loop
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseRuleSetDeclaration(): nodes.Node {
		return this._parseAtApply() || this._tryParseCustomPropertyDeclaration() || this._parseDeclaration();
	}

	/**
	 * Parses declarations like:
	 *   @apply --my-theme;
	 *
	 * Follows https://tabatkins.github.io/specs/css-apply-rule/#using
	 */
	public _parseAtApply(): nodes.Node {
		if (!this.peek(TokenType.AtKeyword, '@apply')) {
			return null;
		}
		const node = <nodes.AtApplyRule>this.create(nodes.AtApplyRule);
		this.consumeToken();

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Variable]))) {
			return this.finish(node, ParseError.IdentifierExpected);
		}

		return this.finish(node);
	}

	public _needsSemicolonAfter(node: nodes.Node): boolean {
		switch (node.type) {
			case nodes.NodeType.Keyframe:
			case nodes.NodeType.ViewPort:
			case nodes.NodeType.Media:
			case nodes.NodeType.Ruleset:
			case nodes.NodeType.Namespace:
			case nodes.NodeType.If:
			case nodes.NodeType.For:
			case nodes.NodeType.Each:
			case nodes.NodeType.While:
			case nodes.NodeType.MixinDeclaration:
			case nodes.NodeType.FunctionDeclaration:
				return false;
			case nodes.NodeType.VariableDeclaration:
			case nodes.NodeType.ExtendsReference:
			case nodes.NodeType.MixinContent:
			case nodes.NodeType.ReturnStatement:
			case nodes.NodeType.MediaQuery:
			case nodes.NodeType.Debug:
			case nodes.NodeType.Import:
			case nodes.NodeType.AtApplyRule:
			case nodes.NodeType.CustomPropertyDeclaration:
				return true;
			case nodes.NodeType.MixinReference:
				return !(<nodes.MixinReference>node).getContent();
			case nodes.NodeType.Declaration:
				return !(<nodes.Declaration>node).getNestedProperties();
		}
		return false;
	}

	public _parseDeclarations(parseDeclaration: () => nodes.Node): nodes.Declarations {
		let node = <nodes.Declarations>this.create(nodes.Declarations);
		if (!this.accept(TokenType.CurlyL)) {
			return null;
		}

		let decl = parseDeclaration();
		while (node.addChild(decl)) {
			if (this.peek(TokenType.CurlyR)) {
				break;
			}
			if (this._needsSemicolonAfter(decl) && !this.accept(TokenType.SemiColon)) {
				return this.finish(node, ParseError.SemiColonExpected, [TokenType.SemiColon, TokenType.CurlyR]);
			}
			while (this.accept(TokenType.SemiColon)) {
				// accept empty statements
			}
			decl = parseDeclaration();
		}

		if (!this.accept(TokenType.CurlyR)) {
			return this.finish(node, ParseError.RightCurlyExpected, [TokenType.CurlyR, TokenType.SemiColon]);
		}
		return this.finish(node);
	}

	public _parseBody<T extends nodes.BodyDeclaration>(node: T, parseDeclaration: () => nodes.Node): T {
		if (!node.setDeclarations(this._parseDeclarations(parseDeclaration))) {
			return this.finish(node, ParseError.LeftCurlyExpected, [TokenType.CurlyR, TokenType.SemiColon]);
		}
		return this.finish(node);
	}

	public _parseSelector(isNested: boolean): nodes.Selector {
		let node = <nodes.Selector>this.create(nodes.Selector);

		let hasContent = false;
		if (isNested) {
			// nested selectors can start with a combinator
			hasContent = node.addChild(this._parseCombinator());
		}
		while (node.addChild(this._parseSimpleSelector())) {
			hasContent = true;
			node.addChild(this._parseCombinator()); // optional
		}
		return hasContent ? this.finish(node) : null;
	}

	public _parseDeclaration(resyncStopTokens?: TokenType[]): nodes.Declaration {
		let node = <nodes.Declaration>this.create(nodes.Declaration);
		if (!node.setProperty(this._parseProperty())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return <nodes.Declaration>this.finish(node, ParseError.ColonExpected, [TokenType.Colon], resyncStopTokens);
		}
		node.colonPosition = this.prevToken.offset;

		if (!node.setValue(this._parseExpr())) {
			return this.finish(node, ParseError.PropertyValueExpected);
		}
		node.addChild(this._parsePrio());
		if (this.peek(TokenType.SemiColon)) {
			node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
		}
		return this.finish(node);
	}

	public _tryParseCustomPropertyDeclaration(): nodes.Node {
		if (!this.peekRegExp(TokenType.Ident, /^--/)) {
			return null;
		}
		let node = <nodes.CustomPropertyDeclaration>this.create(nodes.CustomPropertyDeclaration);
		if (!node.setProperty(this._parseProperty())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return this.finish(node, ParseError.ColonExpected, [TokenType.Colon]);
		}
		node.colonPosition = this.prevToken.offset;

		let mark = this.mark();
		if (this.peek(TokenType.CurlyL)) {
			// try to parse it as nested declaration
			let propertySet = <nodes.CustomPropertySet>this.create(nodes.CustomPropertySet);
			let declarations = this._parseDeclarations(this._parseRuleSetDeclaration.bind(this));
			if (propertySet.setDeclarations(declarations) && !declarations.isErroneous(true)) {
				propertySet.addChild(this._parsePrio());
				if (this.peek(TokenType.SemiColon)) {
					this.finish(propertySet);
					node.setPropertySet(propertySet);
					node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
					return this.finish(node);
				}
			}
			this.restoreAtMark(mark);
		}
		// try tp parse as expression
		let expression = this._parseExpr();
		if (expression && !expression.isErroneous(true)) {
			this._parsePrio();
			if (this.peek(TokenType.SemiColon)) {
				node.setValue(expression);
				node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
				return this.finish(node);
			}
		}
		this.restoreAtMark(mark);
		node.addChild(this._parseCustomPropertyValue());
		node.addChild(this._parsePrio());
		if (this.token.offset === node.colonPosition + 1) {
			return this.finish(node, ParseError.PropertyValueExpected);
		}
		return this.finish(node);
	}

	/**
	 * Parse custom property values.
	 *
	 * Based on https://www.w3.org/TR/css-variables/#syntax
	 *
	 * This code is somewhat unusual, as the allowed syntax is incredibly broad,
	 * parsing almost any sequence of tokens, save for a small set of exceptions.
	 * Unbalanced delimitors, invalid tokens, and declaration
	 * terminators like semicolons and !important directives (when not inside
	 * of delimitors).
	 */
	public _parseCustomPropertyValue(): nodes.Node {
		const node = this.create(nodes.Node);
		const isTopLevel = () => curlyDepth === 0 && parensDepth === 0 && bracketsDepth === 0;
		let curlyDepth = 0;
		let parensDepth = 0;
		let bracketsDepth = 0;
		done: while (true) {
			switch (this.token.type) {
				case TokenType.SemiColon:
					// A semicolon only ends things if we're not inside a delimitor.
					if (isTopLevel()) {
						break done;
					}
					break;
				case TokenType.Exclamation:
					// An exclamation ends the value if we're not inside delims.
					if (isTopLevel()) {
						break done;
					}
					break;
				case TokenType.CurlyL:
					curlyDepth++;
					break;
				case TokenType.CurlyR:
					curlyDepth--;
					if (curlyDepth < 0) {
						// The property value has been terminated without a semicolon, and
						// this is the last declaration in the ruleset.
						if (parensDepth === 0 && bracketsDepth === 0) {
							break done;
						}
						return this.finish(node, ParseError.LeftCurlyExpected);
					}
					break;
				case TokenType.ParenthesisL:
					parensDepth++;
					break;
				case TokenType.ParenthesisR:
					parensDepth--;
					if (parensDepth < 0) {
						return this.finish(node, ParseError.LeftParenthesisExpected);
					}
					break;
				case TokenType.BracketL:
					bracketsDepth++;
					break;
				case TokenType.BracketR:
					bracketsDepth--;
					if (bracketsDepth < 0) {
						return this.finish(node, ParseError.LeftSquareBracketExpected);
					}
					break;
				case TokenType.BadString: // fall through
					break done;
				case TokenType.EOF:
					// We shouldn't have reached the end of input, something is
					// unterminated.
					let error = ParseError.RightCurlyExpected;
					if (bracketsDepth > 0) {
						error = ParseError.RightSquareBracketExpected;
					} else if (parensDepth > 0) {
						error = ParseError.RightParenthesisExpected;
					}
					return this.finish(node, error);
			}
			this.consumeToken();
		}
		return this.finish(node);
	}

	public _tryToParseDeclaration(): nodes.Declaration {
		let mark = this.mark();
		if (this._parseProperty() && this.accept(TokenType.Colon)) {
			// looks like a declaration, go ahead
			this.restoreAtMark(mark);
			return this._parseDeclaration();
		}

		this.restoreAtMark(mark);
		return null;
	}

	public _parseProperty(): nodes.Property {
		let node = <nodes.Property>this.create(nodes.Property);

		let mark = this.mark();
		if (this.accept(TokenType.Delim, '*') || this.accept(TokenType.Delim, '_')) {
			// support for  IE 5.x, 6 and 7 star hack: see http://en.wikipedia.org/wiki/CSS_filter#Star_hack
			if (this.hasWhitespace()) {
				this.restoreAtMark(mark);
				return null;
			}
		}
		if (node.setIdentifier(this._parsePropertyIdentifier())) {
			return <nodes.Property>this.finish(node);
		}
		return null;
	}

	public _parsePropertyIdentifier(): nodes.Identifier {
		return this._parseIdent();
	}

	public _parseCharset(): nodes.Node {
		let node = this.create(nodes.Node);
		if (!this.accept(TokenType.Charset)) {
			return null;
		}
		if (!this.accept(TokenType.String)) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		if (!this.accept(TokenType.SemiColon)) {
			return this.finish(node, ParseError.SemiColonExpected);
		}
		return this.finish(node);
	}



	public _parseImport(): nodes.Node {
		let node = <nodes.Import>this.create(nodes.Import);
		if (!this.accept(TokenType.AtKeyword, '@import')) {
			return null;
		}

		if (!node.addChild(this._parseURILiteral()) && !node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.URIOrStringExpected);
		}

		node.setMedialist(this._parseMediaList());

		return this.finish(node);
	}

	public _parseNamespace(): nodes.Node {
		// http://www.w3.org/TR/css3-namespace/
		// namespace  : NAMESPACE_SYM S* [IDENT S*]? [STRING|URI] S* ';' S*

		let node = <nodes.Namespace>this.create(nodes.Namespace);
		if (!this.accept(TokenType.AtKeyword, '@namespace')) {
			return null;
		}

		if (!node.addChild(this._parseURILiteral())) { // url literal also starts with ident
			node.addChild(this._parseIdent()); // optional prefix

			if (!node.addChild(this._parseURILiteral()) && !node.addChild(this._parseStringLiteral())) {
				return this.finish(node, ParseError.URIExpected, [TokenType.SemiColon]);
			}
		}

		if (!this.accept(TokenType.SemiColon)) {
			return this.finish(node, ParseError.SemiColonExpected);
		}

		return this.finish(node);
	}

	public _parseFontFace(): nodes.Node {
		if (!this.peek(TokenType.AtKeyword, '@font-face')) {
			return null;
		}
		let node = <nodes.FontFace>this.create(nodes.FontFace);
		this.consumeToken(); // @font-face

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseViewPort(): nodes.Node {
		if (!this.peek(TokenType.AtKeyword, '@-ms-viewport') &&
			!this.peek(TokenType.AtKeyword, '@-o-viewport') &&
			!this.peek(TokenType.AtKeyword, '@viewport')
		) {
			return null;
		}
		let node = <nodes.ViewPort>this.create(nodes.ViewPort);
		this.consumeToken(); // @-ms-viewport

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseKeyframe(): nodes.Node {
		let node = <nodes.Keyframe>this.create(nodes.Keyframe);

		let atNode = this.create(nodes.Node);

		if (!this.accept(TokenType.AtKeyword, '@keyframes') &&
			!this.accept(TokenType.AtKeyword, '@-webkit-keyframes') &&
			!this.accept(TokenType.AtKeyword, '@-ms-keyframes') &&
			!this.accept(TokenType.AtKeyword, '@-moz-keyframes') &&
			!this.accept(TokenType.AtKeyword, '@-o-keyframes')) {

			return null;
		}
		node.setKeyword(this.finish(atNode));
		if (atNode.getText() === '@-ms-keyframes') { // -ms-keyframes never existed
			this.markError(atNode, ParseError.UnknownKeyword);
		}

		if (!node.setIdentifier(this._parseIdent([nodes.ReferenceType.Keyframe]))) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, this._parseKeyframeSelector.bind(this));
	}

	public _parseKeyframeSelector(): nodes.Node {
		let node = <nodes.KeyframeSelector>this.create(nodes.KeyframeSelector);

		if (!node.addChild(this._parseIdent()) && !this.accept(TokenType.Percentage)) {
			return null;
		}

		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this._parseIdent()) && !this.accept(TokenType.Percentage)) {
				return this.finish(node, ParseError.PercentageExpected);
			}
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseMediaDeclaration(isNested = false): nodes.Node {
		return this._tryParseRuleset(isNested)
			|| this._tryToParseDeclaration()
			|| this._parseStylesheetStatement();
	}

	public _parseMedia(isNested = false): nodes.Node {
		// MEDIA_SYM S* media_query_list '{' S* ruleset* '}' S*
		// media_query_list : S* [media_query [ ',' S* media_query ]* ]?
		let node = <nodes.Media>this.create(nodes.Media);
		if (!this.accept(TokenType.AtKeyword, '@media')) {
			return null;
		}
		if (!node.addChild(this._parseMediaQuery([TokenType.CurlyL]))) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this._parseMediaQuery([TokenType.CurlyL]))) {
				return this.finish(node, ParseError.IdentifierExpected);
			}
		}

		return this._parseBody(node, this._parseMediaDeclaration.bind(this, isNested));
	}

	public _parseMediaQuery(resyncStopToken: TokenType[]): nodes.Node {
		// http://www.w3.org/TR/css3-mediaqueries/
		// media_query : [ONLY | NOT]? S* IDENT S* [ AND S* expression ]* | expression [ AND S* expression ]*
		// expression : '(' S* IDENT S* [ ':' S* expr ]? ')' S*

		let node = <nodes.MediaQuery>this.create(nodes.MediaQuery);

		let parseExpression = true;
		let hasContent = false;
		if (!this.peek(TokenType.ParenthesisL)) {
			if (this.accept(TokenType.Ident, 'only', true) || this.accept(TokenType.Ident, 'not', true)) {
				// optional
			}
			if (!node.addChild(this._parseIdent())) {
				return null;
			}
			hasContent = true;
			parseExpression = this.accept(TokenType.Ident, 'and', true);
		}
		while (parseExpression) {
			if (!this.accept(TokenType.ParenthesisL)) {
				if (hasContent) {
					return this.finish(node, ParseError.LeftParenthesisExpected, [], resyncStopToken);
				}
				return null;
			}
			if (!node.addChild(this._parseMediaFeatureName())) {
				return this.finish(node, ParseError.IdentifierExpected, [], resyncStopToken);
			}
			if (this.accept(TokenType.Colon)) {
				if (!node.addChild(this._parseExpr())) {
					return this.finish(node, ParseError.TermExpected, [], resyncStopToken);
				}
			}
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected, [], resyncStopToken);
			}
			parseExpression = this.accept(TokenType.Ident, 'and', true);
		}
		return node;
	}

	public _parseMediaFeatureName(): nodes.Node {
		return this._parseIdent();
	}

	public _parseMediaList(): nodes.Medialist {
		let node = <nodes.Medialist>this.create(nodes.Medialist);
		if (node.getMediums().addChild(this._parseMedium())) {
			while (this.accept(TokenType.Comma)) {
				if (!node.getMediums().addChild(this._parseMedium())) {
					return this.finish(node, ParseError.IdentifierExpected);
				}
			}
			return <nodes.Medialist>this.finish(node);
		}
		return null;
	}

	public _parseMedium(): nodes.Node {
		let node = this.create(nodes.Node);
		if (node.addChild(this._parseIdent())) {
			return this.finish(node);
		} else {
			return null;
		}
	}

	public _parsePageDeclaration(): nodes.Node {
		return this._parsePageMarginBox() || this._parseRuleSetDeclaration();
	}

	public _parsePage(): nodes.Node {
		// http://www.w3.org/TR/css3-page/
		// page_rule : PAGE_SYM S* page_selector_list '{' S* page_body '}' S*
		// page_body :  /* Can be empty */ declaration? [ ';' S* page_body ]? | page_margin_box page_body

		let node = <nodes.Page>this.create(nodes.Page);
		if (!this.accept(TokenType.AtKeyword, '@Page')) {
			return null;
		}
		if (node.addChild(this._parsePageSelector())) {
			while (this.accept(TokenType.Comma)) {
				if (!node.addChild(this._parsePageSelector())) {
					return this.finish(node, ParseError.IdentifierExpected);
				}
			}
		}

		return this._parseBody(node, this._parsePageDeclaration.bind(this));
	}

	public _parsePageMarginBox(): nodes.Node {
		// page_margin_box :  margin_sym S* '{' S* declaration? [ ';' S* declaration? ]* '}' S*
		let node = <nodes.PageBoxMarginBox>this.create(nodes.PageBoxMarginBox);
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}

		if (!this.acceptOne(TokenType.AtKeyword, languageFacts.getPageBoxDirectives())) {
			this.markError(node, ParseError.UnknownAtRule, [], [TokenType.CurlyL]);
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}


	public _parsePageSelector(): nodes.Node {
		// page_selector : pseudo_page+ | IDENT pseudo_page*
		// pseudo_page :  ':' [ "left" | "right" | "first" | "blank" ];

		let node = this.create(nodes.Node);
		if (!this.peek(TokenType.Ident) && !this.peek(TokenType.Colon)) {
			return null;
		}
		node.addChild(this._parseIdent()); // optional ident

		if (this.accept(TokenType.Colon)) {
			if (!node.addChild(this._parseIdent())) { // optional ident
				return this.finish(node, ParseError.IdentifierExpected);
			}
		}
		return this.finish(node);
	}

	public _parseDocument(): nodes.Node {
		// -moz-document is experimental but has been pushed to css4

		let node = <nodes.Document>this.create(nodes.Document);
		if (!this.accept(TokenType.AtKeyword, '@-moz-document')) {
			return null;
		}
		this.resync([], [TokenType.CurlyL]); // ignore all the rules
		return this._parseBody(node, this._parseStylesheetStatement.bind(this));
	}

	public _parseOperator(): nodes.Node {
		// these are operators for binary expressions
		let node = this.createNode(nodes.NodeType.Operator);
		if (this.accept(TokenType.Delim, '/') ||
			this.accept(TokenType.Delim, '*') ||
			this.accept(TokenType.Delim, '+') ||
			this.accept(TokenType.Delim, '-') ||
			this.accept(TokenType.Dashmatch) ||
			this.accept(TokenType.Includes) ||
			this.accept(TokenType.SubstringOperator) ||
			this.accept(TokenType.PrefixOperator) ||
			this.accept(TokenType.SuffixOperator) ||
			this.accept(TokenType.Delim, '=')) { // doesn't stick to the standard here

			return this.finish(node);

		} else {
			return null;
		}
	}

	public _parseUnaryOperator(): nodes.Node {
		let node = this.create(nodes.Node);
		if (this.accept(TokenType.Delim, '+') || this.accept(TokenType.Delim, '-')) {
			return this.finish(node);
		} else {
			return null;
		}
	}

	public _parseCombinator(): nodes.Node {
		let node = this.create(nodes.Node);
		if (this.accept(TokenType.Delim, '>')) {
			let mark = this.mark();
			if (!this.hasWhitespace() && this.accept(TokenType.Delim, '>')) {
				if (!this.hasWhitespace() && this.accept(TokenType.Delim, '>')) {
					node.type = nodes.NodeType.SelectorCombinatorShadowPiercingDescendant;
					return this.finish(node);
				}
				this.restoreAtMark(mark);
			}
			node.type = nodes.NodeType.SelectorCombinatorParent;
			return this.finish(node);
		} else if (this.accept(TokenType.Delim, '+')) {
			node.type = nodes.NodeType.SelectorCombinatorSibling;
			return this.finish(node);
		} else if (this.accept(TokenType.Delim, '~')) {
			node.type = nodes.NodeType.SelectorCombinatorAllSiblings;
			return this.finish(node);
		} else if (this.accept(TokenType.Delim, '/')) {
			let mark = this.mark();
			if (!this.hasWhitespace() && this.accept(TokenType.Ident, 'deep') && !this.hasWhitespace() && this.accept(TokenType.Delim, '/')) {
				node.type = nodes.NodeType.SelectorCombinatorShadowPiercingDescendant;
				return this.finish(node);
			}
			this.restoreAtMark(mark);
		} else {
			return null;
		}
	}

	public _parseSimpleSelector(): nodes.SimpleSelector {
		// simple_selector
		//  : element_name [ HASH | class | attrib | pseudo ]* | [ HASH | class | attrib | pseudo ]+ ;

		let node = <nodes.SimpleSelector>this.create(nodes.SimpleSelector);
		let c = 0;
		if (node.addChild(this._parseElementName())) {
			c++;
		}
		while ((c === 0 || !this.hasWhitespace()) && node.addChild(this._parseSimpleSelectorBody())) {
			c++;
		}
		return c > 0 ? this.finish(node) : null;
	}

	public _parseSimpleSelectorBody(): nodes.Node {
		return this._parsePseudo() || this._parseHash() || this._parseClass() || this._parseAttrib();
	}

	public _parseSelectorIdent(): nodes.Node {
		return this._parseIdent();
	}

	public _parseHash(): nodes.Node {
		if (!this.peek(TokenType.Hash) && !this.peek(TokenType.Delim, '#')) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.IdentifierSelector);
		if (this.accept(TokenType.Delim, '#')) {
			if (this.hasWhitespace() || !node.addChild(this._parseSelectorIdent())) {
				return this.finish(node, ParseError.IdentifierExpected);
			}
		} else {
			this.consumeToken(); // TokenType.Hash
		}
		return this.finish(node);
	}

	public _parseClass(): nodes.Node {
		// class: '.' IDENT ;
		if (!this.peek(TokenType.Delim, '.')) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.ClassSelector);
		this.consumeToken(); // '.'
		if (this.hasWhitespace() || !node.addChild(this._parseSelectorIdent())) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		return this.finish(node);
	}

	public _parseElementName(): nodes.Node {
		// element_name: IDENT | '*';
		let node = this.createNode(nodes.NodeType.ElementNameSelector);
		if (node.addChild(this._parseSelectorIdent()) || this.accept(TokenType.Delim, '*')) {
			return this.finish(node);
		}
		return null;
	}

	public _parseAttrib(): nodes.Node {
		// attrib : '[' S* IDENT S* [ [ '=' | INCLUDES | DASHMATCH ] S*   [ IDENT | STRING ] S* ]? ']'
		if (!this.peek(TokenType.BracketL)) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.AttributeSelector);
		this.consumeToken(); // BracketL
		if (!node.addChild(this._parseBinaryExpr())) {
			// is this bad?
		}
		if (!this.accept(TokenType.BracketR)) {
			return this.finish(node, ParseError.RightSquareBracketExpected);
		}
		return this.finish(node);
	}

	public _parsePseudo(): nodes.Node {
		// pseudo: ':' [ IDENT | FUNCTION S* [IDENT S*]? ')' ]
		if (!this.peek(TokenType.Colon)) {
			return null;
		}
		let pos = this.mark();
		let node = this.createNode(nodes.NodeType.PseudoSelector);
		this.consumeToken(); // Colon
		if (!this.hasWhitespace()) {
			// optional, support ::
			if (this.accept(TokenType.Colon) && this.hasWhitespace()) {
				return this.finish(node, ParseError.IdentifierExpected);
			}
			if (!node.addChild(this._parseIdent())) {
				return this.finish(node, ParseError.IdentifierExpected);
			}
			if (!this.hasWhitespace() && this.accept(TokenType.ParenthesisL)) {
				node.addChild(this._parseBinaryExpr() || this._parseSimpleSelector());
				if (!this.accept(TokenType.ParenthesisR)) {
					return this.finish(node, ParseError.RightParenthesisExpected);
				}
			}
			return this.finish(node);
		}
		this.restoreAtMark(pos);
		return null;
	}

	public _parsePrio(): nodes.Node {
		if (!this.peek(TokenType.Exclamation)) {
			return null;
		}

		let node = this.createNode(nodes.NodeType.Prio);
		if (this.accept(TokenType.Exclamation) && this.accept(TokenType.Ident, 'important', true)) {
			return this.finish(node);
		}
		return null;
	}

	public _parseExpr(stopOnComma: boolean = false): nodes.Expression {
		let node = <nodes.Expression>this.create(nodes.Expression);
		if (!node.addChild(this._parseBinaryExpr())) {
			return null;
		}

		while (true) {
			if (this.peek(TokenType.Comma)) { // optional
				if (stopOnComma) {
					return this.finish(node);
				}
				this.consumeToken();
			}
			if (!node.addChild(this._parseBinaryExpr())) {
				break;
			}
		}

		return this.finish(node);
	}

	public _parseBinaryExpr(preparsedLeft?: nodes.BinaryExpression, preparsedOper?: nodes.Node): nodes.Node {
		let node = <nodes.BinaryExpression>this.create(nodes.BinaryExpression);

		if (!node.setLeft((<nodes.Node>preparsedLeft || this._parseTerm()))) {
			return null;
		}

		if (!node.setOperator(preparsedOper || this._parseOperator())) {
			return this.finish(node);
		}

		if (!node.setRight(this._parseTerm())) {
			return this.finish(node, ParseError.TermExpected);
		}

		// things needed for multiple binary expressions
		node = <nodes.BinaryExpression>this.finish(node);
		let operator = this._parseOperator();
		if (operator) {
			node = <nodes.BinaryExpression>this._parseBinaryExpr(node, operator);
		}

		return this.finish(node);
	}

	public _parseTerm(): nodes.Term {

		let node = <nodes.Term>this.create(nodes.Term);
		node.setOperator(this._parseUnaryOperator()); // optional

		if (node.setExpression(this._parseURILiteral()) || // url before function
			node.setExpression(this._parseFunction()) || // function before ident
			node.setExpression(this._parseIdent()) ||
			node.setExpression(this._parseStringLiteral()) ||
			node.setExpression(this._parseNumeric()) ||
			node.setExpression(this._parseHexColor()) ||
			node.setExpression(this._parseOperation())
		) {
			return <nodes.Term>this.finish(node);
		}

		return null;
	}

	public _parseOperation(): nodes.Node {
		let node = this.create(nodes.Node);
		if (!this.accept(TokenType.ParenthesisL)) {
			return null;
		}
		node.addChild(this._parseExpr());
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseNumeric(): nodes.NumericValue {
		let node = <nodes.NumericValue>this.create(nodes.NumericValue);
		if (this.accept(TokenType.Num) ||
			this.accept(TokenType.Percentage) ||
			this.accept(TokenType.Resolution) ||
			this.accept(TokenType.Length) ||
			this.accept(TokenType.EMS) ||
			this.accept(TokenType.EXS) ||
			this.accept(TokenType.Angle) ||
			this.accept(TokenType.Time) ||
			this.accept(TokenType.Dimension) ||
			this.accept(TokenType.Freq)) {

			return <nodes.NumericValue>this.finish(node);
		}

		return null;
	}

	public _parseStringLiteral(): nodes.Node {
		let node = this.createNode(nodes.NodeType.StringLiteral);
		if (this.accept(TokenType.String) || this.accept(TokenType.BadString)) {
			return this.finish(node);
		}
		return null;
	}

	public _parseURILiteral(): nodes.Node {
		if (!this.peekRegExp(TokenType.Ident, /url(-prefix)?/i)) {
			return null;
		}
		let pos = this.mark();
		let node = this.createNode(nodes.NodeType.URILiteral);
		this.accept(TokenType.Ident);

		if (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos);
			return null;
		}

		node.addChild(this._parseURLArgument());  // argument is optional

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseURLArgument(): nodes.Node {
		let node = this.create(nodes.Node);
		if (!this.accept(TokenType.String) && !this.accept(TokenType.BadString) && !this.acceptUnquotedString()) {
			return null;
		};
		return this.finish(node);
	}

	public _parseIdent(referenceTypes?: nodes.ReferenceType[]): nodes.Identifier {
		let node = <nodes.Identifier>this.create(nodes.Identifier);
		if (referenceTypes) {
			node.referenceTypes = referenceTypes;
		}
		node.isCustomProperty = this.peekRegExp(TokenType.Ident, /^--/);
		if (this.accept(TokenType.Ident)) {
			return this.finish(node);
		}
		return null;
	}

	public _parseFunction(): nodes.Function {

		let pos = this.mark();
		let node = <nodes.Function>this.create(nodes.Function);

		if (!node.setIdentifier(this._parseFunctionIdentifier())) {
			return null;
		}

		if (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos);
			return null;
		}

		if (node.getArguments().addChild(this._parseFunctionArgument())) {
			while (this.accept(TokenType.Comma)) {
				if (!node.getArguments().addChild(this._parseFunctionArgument())) {
					this.markError(node, ParseError.ExpressionExpected);
				}
			}
		}

		if (!this.accept(TokenType.ParenthesisR)) {
			return <nodes.Function>this.finish(node, ParseError.RightParenthesisExpected);
		}
		return <nodes.Function>this.finish(node);
	}

	public _parseFunctionIdentifier(): nodes.Identifier {
		let node = <nodes.Identifier>this.create(nodes.Identifier);
		node.referenceTypes = [nodes.ReferenceType.Function];

		if (this.accept(TokenType.Ident, 'progid')) {
			// support for IE7 specific filters: 'progid:DXImageTransform.Microsoft.MotionBlur(strength=13, direction=310)'
			if (this.accept(TokenType.Colon)) {
				while (this.accept(TokenType.Ident) && this.accept(TokenType.Delim, '.')) {
					// loop
				}
			}
			return this.finish(node);
		} else if (this.accept(TokenType.Ident)) {
			return this.finish(node);
		}
		return null;
	}

	public _parseFunctionArgument(): nodes.Node {
		let node = <nodes.FunctionArgument>this.create(nodes.FunctionArgument);
		if (node.setValue(this._parseExpr(true))) {
			return this.finish(node);
		}
		return null;
	}

	public _parseHexColor(): nodes.Node {
		if (this.peekRegExp(TokenType.Hash, /^#[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/g)) {
			let node = this.create(nodes.HexColorValue);
			this.consumeToken();
			return this.finish(node);
		} else {
			return null;
		}
	}
}
