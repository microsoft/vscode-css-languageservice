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
/// https://www.w3.org/TR/CSS21/grammar.html
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

	public peekIdent(text: string): boolean {
		return TokenType.Ident === this.token.type && text.length === this.token.text.length && text === this.token.text.toLowerCase();
	}

	public peekKeyword(text: string): boolean {
		return TokenType.AtKeyword === this.token.type && text.length === this.token.text.length && text === this.token.text.toLowerCase();
	}

	public peekDelim(text: string): boolean {
		return TokenType.Delim === this.token.type && text === this.token.text;
	}

	public peek(type: TokenType): boolean {
		return type === this.token.type;
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

	public try(func: () => nodes.Node): nodes.Node {
		let pos = this.mark();
		let node = func();
		if (!node) {
			this.restoreAtMark(pos);
			return null;
		}
		return node;
	}

	public acceptOneKeyword(keywords: string[]): boolean {
		if (TokenType.AtKeyword === this.token.type) {
			for (let keyword of keywords) {
				if (keyword.length === this.token.text.length && keyword === this.token.text.toLowerCase()) {
					this.consumeToken();
					return true;
				}
			}
		}
		return false;
	}

	public accept(type: TokenType) {
		if (type === this.token.type) {
			this.consumeToken();
			return true;
		}
		return false;
	}

	public acceptIdent(text: string): boolean {
		if (this.peekIdent(text)) {
			this.consumeToken();
			return true;
		}
		return false;
	}

	public acceptKeyword(text: string) {
		if (this.peekKeyword(text)) {
			this.consumeToken();
			return true;
		}
		return false;
	}

	public acceptDelim(text: string) {
		if (this.peekDelim(text)) {
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
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseImport()
				|| this._parseMedia()
				|| this._parsePage()
				|| this._parseFontFace()
				|| this._parseKeyframe()
				|| this._parseSupports()
				|| this._parseViewPort()
				|| this._parseNamespace()
				|| this._parseDocument();
		}
		return this._parseRuleset(false);
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
		if (!this.peekKeyword('@apply')) {
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
		if (this.acceptDelim('*') || this.acceptDelim('_')) {
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
		if (!this.peek(TokenType.Charset)) {
			return null;
		}

		let node = this.create(nodes.Node);
		this.consumeToken(); // charset
		if (!this.accept(TokenType.String)) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		if (!this.accept(TokenType.SemiColon)) {
			return this.finish(node, ParseError.SemiColonExpected);
		}
		return this.finish(node);
	}



	public _parseImport(): nodes.Node {
		if (!this.peekKeyword('@import')) {
			return null;
		}

		let node = <nodes.Import>this.create(nodes.Import);
		this.consumeToken(); // @import

		if (!node.addChild(this._parseURILiteral()) && !node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.URIOrStringExpected);
		}

		if (!this.peek(TokenType.SemiColon) && !this.peek(TokenType.EOF)) {
			node.setMedialist(this._parseMediaQueryList());
		}

		return this.finish(node);
	}

	public _parseNamespace(): nodes.Node {
		// http://www.w3.org/TR/css3-namespace/
		// namespace  : NAMESPACE_SYM S* [IDENT S*]? [STRING|URI] S* ';' S*
		if (!this.peekKeyword('@namespace')) {
			return null;
		}
		let node = <nodes.Namespace>this.create(nodes.Namespace);
		this.consumeToken(); // @namespace

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
		if (!this.peekKeyword('@font-face')) {
			return null;
		}
		let node = <nodes.FontFace>this.create(nodes.FontFace);
		this.consumeToken(); // @font-face

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseViewPort(): nodes.Node {
		if (!this.peekKeyword('@-ms-viewport') &&
			!this.peekKeyword('@-o-viewport') &&
			!this.peekKeyword('@viewport')
		) {
			return null;
		}
		let node = <nodes.ViewPort>this.create(nodes.ViewPort);
		this.consumeToken(); // @-ms-viewport

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	private keyframeRegex = /^@(\-(webkit|ms|moz|o)\-)?keyframes$/i;

	public _parseKeyframe(): nodes.Node {
		if (!this.peekRegExp(TokenType.AtKeyword, this.keyframeRegex)) {
			return null;
		}
		let node = <nodes.Keyframe>this.create(nodes.Keyframe);

		let atNode = this.create(nodes.Node);
		this.consumeToken(); // atkeyword
		node.setKeyword(this.finish(atNode));
		if (atNode.getText() === '@-ms-keyframes') { // -ms-keyframes never existed
			this.markError(atNode, ParseError.UnknownKeyword);
		}

		if (!node.setIdentifier(this._parseKeyframeIdent())) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, this._parseKeyframeSelector.bind(this));
	}

	public _parseKeyframeIdent(): nodes.Node {
		return this._parseIdent([nodes.ReferenceType.Keyframe]);
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

	public _tryParseKeyframeSelector(): nodes.Node {
		let node = <nodes.KeyframeSelector>this.create(nodes.KeyframeSelector);
		let pos = this.mark();

		if (!node.addChild(this._parseIdent()) && !this.accept(TokenType.Percentage)) {
			return null;
		}

		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this._parseIdent()) && !this.accept(TokenType.Percentage)) {
				this.restoreAtMark(pos);
				return null;
			}
		}

		if (!this.peek(TokenType.CurlyL)) {
			this.restoreAtMark(pos);
			return null;
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseSupports(isNested = false): nodes.Node {
		// SUPPORTS_SYM S* supports_condition '{' S* ruleset* '}' S*
		if (!this.peekKeyword('@supports')) {
			return null;
		}

		let node = <nodes.Supports>this.create(nodes.Supports);
		this.consumeToken(); // @supports
		node.addChild(this._parseSupportsCondition());

		return this._parseBody(node, this._parseSupportsDeclaration.bind(this, isNested));
	}

	public _parseSupportsDeclaration(isNested = false): nodes.Node {
		if (isNested) {
			// if nested, the body can contain rulesets, but also declarations
			return this._tryParseRuleset(isNested)
				|| this._tryToParseDeclaration()
				|| this._parseStylesheetStatement();
		}
		return this._parseStylesheetStatement();
	}

	private _parseSupportsCondition(): nodes.Node {
		// supports_condition : supports_negation | supports_conjunction | supports_disjunction | supports_condition_in_parens ;
		// supports_condition_in_parens: ( '(' S* supports_condition S* ')' ) | supports_declaration_condition | general_enclosed ;
		// supports_negation: NOT S+ supports_condition_in_parens ;
		// supports_conjunction: supports_condition_in_parens ( S+ AND S+ supports_condition_in_parens )+;
		// supports_disjunction: supports_condition_in_parens ( S+ OR S+ supports_condition_in_parens )+;
		// supports_declaration_condition: '(' S* declaration ')';
		// general_enclosed: ( FUNCTION | '(' ) ( any | unused )* ')' ;
		let node = <nodes.SupportsCondition>this.create(nodes.SupportsCondition);

		if (this.acceptIdent('not')) {
			node.addChild(this._parseSupportsConditionInParens());
		} else {
			node.addChild(this._parseSupportsConditionInParens());
			if (this.peekRegExp(TokenType.Ident, /^(and|or)$/i)) {
				let text = this.token.text.toLowerCase();
				while (this.acceptIdent(text)) {
					node.addChild(this._parseSupportsConditionInParens());
				}
			}
		}
		return this.finish(node);
	}

	private _parseSupportsConditionInParens(): nodes.Node {
		let node = <nodes.SupportsCondition>this.create(nodes.SupportsCondition);
		if (this.accept(TokenType.ParenthesisL)) {
			node.lParent = this.prevToken.offset;
			if (!node.addChild(this._tryToParseDeclaration())) {
				if (!this._parseSupportsCondition()) {
					return this.finish(node, ParseError.ConditionExpected);
				}
			}
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected, [TokenType.ParenthesisR], []);
			}
			node.rParent = this.prevToken.offset;
			return this.finish(node);
		} else if (this.peek(TokenType.Ident)) {
			let pos = this.mark();
			this.consumeToken();
			if (!this.hasWhitespace() && this.accept(TokenType.ParenthesisL)) {
				let openParentCount = 1;
				while (this.token.type !== TokenType.EOF && openParentCount !== 0) {
					if (this.token.type === TokenType.ParenthesisL) {
						openParentCount++;
					} else if (this.token.type === TokenType.ParenthesisR) {
						openParentCount--;
					}
					this.consumeToken();
				}
				return this.finish(node);
			} else {
				this.restoreAtMark(pos);
			}
		}
		return this.finish(node, ParseError.LeftParenthesisExpected, [], [TokenType.ParenthesisL]);
	}

	public _parseMediaDeclaration(isNested = false): nodes.Node {
		return this._tryParseRuleset(isNested)
			|| this._tryToParseDeclaration()
			|| this._parseStylesheetStatement();
	}

	public _parseMedia(isNested = false): nodes.Node {
		// MEDIA_SYM S* media_query_list '{' S* ruleset* '}' S*
		// media_query_list : S* [media_query [ ',' S* media_query ]* ]?
		if (!this.peekKeyword('@media')) {
			return null;
		}
		let node = <nodes.Media>this.create(nodes.Media);
		this.consumeToken(); // @media

		if (!node.addChild(this._parseMediaQueryList())) {
			return this.finish(node, ParseError.MediaQueryExpected);
		}
		return this._parseBody(node, this._parseMediaDeclaration.bind(this, isNested));
	}

	public _parseMediaQueryList(): nodes.Medialist {
		let node = <nodes.Medialist>this.create(nodes.Medialist);
		if (!node.addChild(this._parseMediaQuery([TokenType.CurlyL]))) {
			return this.finish(node, ParseError.MediaQueryExpected);
		}
		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this._parseMediaQuery([TokenType.CurlyL]))) {
				return this.finish(node, ParseError.MediaQueryExpected);
			}
		}
		return this.finish(node);
	}

	public _parseMediaQuery(resyncStopToken: TokenType[]): nodes.Node {
		// http://www.w3.org/TR/css3-mediaqueries/
		// media_query : [ONLY | NOT]? S* IDENT S* [ AND S* expression ]* | expression [ AND S* expression ]*
		// expression : '(' S* IDENT S* [ ':' S* expr ]? ')' S*

		let node = <nodes.MediaQuery>this.create(nodes.MediaQuery);

		let parseExpression = true;
		let hasContent = false;
		if (!this.peek(TokenType.ParenthesisL)) {
			if (this.acceptIdent('only') || this.acceptIdent('not')) {
				// optional
			}
			if (!node.addChild(this._parseIdent())) {
				return null;
			}
			hasContent = true;
			parseExpression = this.acceptIdent('and');
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
			parseExpression = this.acceptIdent('and');
		}
		return this.finish(node);
	}

	public _parseMediaFeatureName(): nodes.Node {
		return this._parseIdent();
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
		if (!this.peekKeyword('@page')) {
			return null;
		}
		let node = <nodes.Page>this.create(nodes.Page);
		this.consumeToken();

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
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}
		let node = <nodes.PageBoxMarginBox>this.create(nodes.PageBoxMarginBox);

		if (!this.acceptOneKeyword(languageFacts.getPageBoxDirectives())) {
			this.markError(node, ParseError.UnknownAtRule, [], [TokenType.CurlyL]);
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}


	public _parsePageSelector(): nodes.Node {
		// page_selector : pseudo_page+ | IDENT pseudo_page*
		// pseudo_page :  ':' [ "left" | "right" | "first" | "blank" ];
		if (!this.peek(TokenType.Ident) && !this.peek(TokenType.Colon)) {
			return null;
		}
		let node = this.create(nodes.Node);
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
		if (!this.peekKeyword('@-moz-document')) {
			return null;
		}
		let node = <nodes.Document>this.create(nodes.Document);
		this.consumeToken(); // @-moz-document

		this.resync([], [TokenType.CurlyL]); // ignore all the rules
		return this._parseBody(node, this._parseStylesheetStatement.bind(this));
	}

	public _parseOperator(): nodes.Operator {
		// these are operators for binary expressions
		if (this.peekDelim('/') ||
			this.peekDelim('*') ||
			this.peekDelim('+') ||
			this.peekDelim('-') ||
			this.peek(TokenType.Dashmatch) ||
			this.peek(TokenType.Includes) ||
			this.peek(TokenType.SubstringOperator) ||
			this.peek(TokenType.PrefixOperator) ||
			this.peek(TokenType.SuffixOperator) ||
			this.peekDelim('=')) { // doesn't stick to the standard here
			let node = this.createNode(nodes.NodeType.Operator);
			this.consumeToken();
			return this.finish(node);
		} else {
			return null;
		}
	}

	public _parseUnaryOperator(): nodes.Node {
		if (!this.peekDelim('+') && !this.peekDelim('-')) {
			return null;
		}
		let node = this.create(nodes.Node);
		this.consumeToken();
		return this.finish(node);
	}

	public _parseCombinator(): nodes.Node {

		if (this.peekDelim('>')) {
			let node = this.create(nodes.Node);
			this.consumeToken();
			let mark = this.mark();
			if (!this.hasWhitespace() && this.acceptDelim('>')) {
				if (!this.hasWhitespace() && this.acceptDelim('>')) {
					node.type = nodes.NodeType.SelectorCombinatorShadowPiercingDescendant;
					return this.finish(node);
				}
				this.restoreAtMark(mark);
			}
			node.type = nodes.NodeType.SelectorCombinatorParent;
			return this.finish(node);
		} else if (this.peekDelim('+')) {
			let node = this.create(nodes.Node);
			this.consumeToken();
			node.type = nodes.NodeType.SelectorCombinatorSibling;
			return this.finish(node);
		} else if (this.peekDelim('~')) {
			let node = this.create(nodes.Node);
			this.consumeToken();
			node.type = nodes.NodeType.SelectorCombinatorAllSiblings;
			return this.finish(node);
		} else if (this.peekDelim('/')) {
			let node = this.create(nodes.Node);
			this.consumeToken();
			let mark = this.mark();
			if (!this.hasWhitespace() && this.acceptIdent('deep') && !this.hasWhitespace() && this.acceptDelim('/')) {
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
		if (!this.peek(TokenType.Hash) && !this.peekDelim('#')) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.IdentifierSelector);
		if (this.acceptDelim('#')) {
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
		if (!this.peekDelim('.')) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.ClassSelector);
		this.consumeToken(); // '.'
		if (this.hasWhitespace() || !node.addChild(this._parseSelectorIdent())) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		return this.finish(node);
	}

	public _parseElementName(): nodes.Node | null {
		// element_name: (ns? '|')? IDENT | '*';
		let pos = this.mark();
		let node = this.createNode(nodes.NodeType.ElementNameSelector);
		node.addChild(this._parseNamespacePrefix());
		if (!node.addChild(this._parseSelectorIdent()) && !this.acceptDelim('*')) {
			this.restoreAtMark(pos);
			return null;
		}
		return this.finish(node);
	}

	public _parseNamespacePrefix(): nodes.Node | null {
		let pos = this.mark();
		let node = this.createNode(nodes.NodeType.NamespacePrefix);
		if (!node.addChild(this._parseIdent()) && !this.acceptDelim('*')) {
			// ns is optional
		}
		if (!this.acceptDelim('|')) {
			this.restoreAtMark(pos);
			return null;
		}
		return this.finish(node);
	}

	public _parseAttrib(): nodes.Node {
		// attrib : '[' S* IDENT S* [ [ '=' | INCLUDES | DASHMATCH ] S*   [ IDENT | STRING ] S* ]? ']'
		if (!this.peek(TokenType.BracketL)) {
			return null;
		}
		let node = <nodes.AttributeSelector>this.create(nodes.AttributeSelector);
		this.consumeToken(); // BracketL

		// Optional attrib namespace
		node.setNamespacePrefix(this._parseNamespacePrefix());

		if (!node.setIdentifier(this._parseIdent())) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		if (node.setOperator(this._parseOperator())) {
			node.setValue(this._parseBinaryExpr());
		}

		if (!this.accept(TokenType.BracketR)) {
			return this.finish(node, ParseError.RightSquareBracketExpected);
		}
		return this.finish(node);
	}

	public _parsePseudo(): nodes.Node {
		// pseudo: ':' [ IDENT | FUNCTION S* [IDENT S*]? ')' ]
		let node = this._tryParsePseudoIdentifier();
		if (node) {
			if (!this.hasWhitespace() && this.accept(TokenType.ParenthesisL)) {
				let tryAsSelector = () => {
					let selectors = this.create(nodes.Node);
					if (!selectors.addChild(this._parseSelector(false))) {
						return null;
					}
					while (this.accept(TokenType.Comma) && selectors.addChild(this._parseSelector(false))) {
						// loop
					}
					if (this.peek(TokenType.ParenthesisR)) {
						return this.finish(selectors);
					}
				};
				node.addChild(this.try(tryAsSelector) || this._parseBinaryExpr());
				if (!this.accept(TokenType.ParenthesisR)) {
					return this.finish(node, ParseError.RightParenthesisExpected);
				}
			}
			return this.finish(node);
		}
		return null;
	}

	public _tryParsePseudoIdentifier(): nodes.Node {
		if (!this.peek(TokenType.Colon)) {
			return null;
		}
		let pos = this.mark();
		let node = this.createNode(nodes.NodeType.PseudoSelector);
		this.consumeToken(); // Colon
		if (this.hasWhitespace()) {
			this.restoreAtMark(pos);
			return null;
		}
		// optional, support ::
		if (this.accept(TokenType.Colon) && this.hasWhitespace()) {
			this.markError(node, ParseError.IdentifierExpected);
		}
		if (!node.addChild(this._parseIdent())) {
			this.markError(node, ParseError.IdentifierExpected);
		}
		return node;
	}

	public _tryParsePrio(): nodes.Node {
		let mark = this.mark();

		let prio = this._parsePrio();
		if (prio) {
			return prio;
		}
		this.restoreAtMark(mark);
		return null;
	}

	public _parsePrio(): nodes.Node {
		if (!this.peek(TokenType.Exclamation)) {
			return null;
		}

		let node = this.createNode(nodes.NodeType.Prio);
		if (this.accept(TokenType.Exclamation) && this.acceptIdent('important')) {
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

	public _parseNamedLine(): nodes.Node {
		// https://www.w3.org/TR/css-grid-1/#named-lines
		if (!this.peek(TokenType.BracketL)) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.GridLine);
		this.consumeToken();
		while (node.addChild(this._parseIdent())) {
			// repeat
		}
		if (!this.accept(TokenType.BracketR)) {
			return this.finish(node, ParseError.RightSquareBracketExpected);
		}
		return this.finish(node);
	}

	public _parseBinaryExpr(preparsedLeft?: nodes.BinaryExpression, preparsedOper?: nodes.Node): nodes.BinaryExpression {
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
			node.setExpression(this._parseOperation()) ||
			node.setExpression(this._parseNamedLine())
		) {
			return <nodes.Term>this.finish(node);
		}

		return null;
	}

	public _parseOperation(): nodes.Node {
		if (!this.peek(TokenType.ParenthesisL)) {
			return null;
		}
		let node = this.create(nodes.Node);
		this.consumeToken(); // ParenthesisL
		node.addChild(this._parseExpr());
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseNumeric(): nodes.NumericValue {

		if (this.peek(TokenType.Num) ||
			this.peek(TokenType.Percentage) ||
			this.peek(TokenType.Resolution) ||
			this.peek(TokenType.Length) ||
			this.peek(TokenType.EMS) ||
			this.peek(TokenType.EXS) ||
			this.peek(TokenType.Angle) ||
			this.peek(TokenType.Time) ||
			this.peek(TokenType.Dimension) ||
			this.peek(TokenType.Freq)) {
			let node = <nodes.NumericValue>this.create(nodes.NumericValue);
			this.consumeToken();
			return <nodes.NumericValue>this.finish(node);
		}

		return null;
	}

	public _parseStringLiteral(): nodes.Node {
		if (!this.peek(TokenType.String) && !this.peek(TokenType.BadString)) {
			return null;
		}
		let node = this.createNode(nodes.NodeType.StringLiteral);
		this.consumeToken();
		return this.finish(node);
	}

	public _parseURILiteral(): nodes.Node {
		if (!this.peekRegExp(TokenType.Ident, /^url(-prefix)?$/i)) {
			return null;
		}
		let pos = this.mark();
		let node = this.createNode(nodes.NodeType.URILiteral);
		this.accept(TokenType.Ident);
		if (this.hasWhitespace() || !this.peek(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos);
			return null;
		}
		this.scanner.inURL = true;
		this.consumeToken(); // consume ()
		node.addChild(this._parseURLArgument());  // argument is optional
		this.scanner.inURL = false;

		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseURLArgument(): nodes.Node {
		let node = this.create(nodes.Node);
		if (!this.accept(TokenType.String) && !this.accept(TokenType.BadString) && !this.acceptUnquotedString()) {
			return null;
		}
		return this.finish(node);
	}

	public _parseIdent(referenceTypes?: nodes.ReferenceType[]): nodes.Identifier {
		if (!this.peek(TokenType.Ident)) {
			return null;
		}
		let node = <nodes.Identifier>this.create(nodes.Identifier);
		if (referenceTypes) {
			node.referenceTypes = referenceTypes;
		}
		node.isCustomProperty = this.peekRegExp(TokenType.Ident, /^--/);
		this.consumeToken();
		return this.finish(node);
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
		if (!this.peek(TokenType.Ident)) {
			return null;
		}

		let node = <nodes.Identifier>this.create(nodes.Identifier);
		node.referenceTypes = [nodes.ReferenceType.Function];

		if (this.acceptIdent('progid')) {
			// support for IE7 specific filters: 'progid:DXImageTransform.Microsoft.MotionBlur(strength=13, direction=310)'
			if (this.accept(TokenType.Colon)) {
				while (this.accept(TokenType.Ident) && this.acceptDelim('.')) {
					// loop
				}
			}
			return this.finish(node);
		}
		this.consumeToken();
		return this.finish(node);
	}

	public _parseFunctionArgument(): nodes.Node {
		let node = <nodes.FunctionArgument>this.create(nodes.FunctionArgument);
		if (node.setValue(this._parseExpr(true))) {
			return this.finish(node);
		}
		return null;
	}

	public _parseHexColor(): nodes.Node {
		if (this.peekRegExp(TokenType.Hash, /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/g)) {
			let node = this.create(nodes.HexColorValue);
			this.consumeToken();
			return this.finish(node);
		} else {
			return null;
		}
	}
}
