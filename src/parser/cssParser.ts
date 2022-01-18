/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';
import { TokenType, Scanner, IToken } from './cssScanner';
import * as nodes from './cssNodes';
import { ParseError, CSSIssueType } from './cssErrors';
import * as languageFacts from '../languageFacts/facts';
import { TextDocument } from '../cssLanguageTypes';
import { isDefined } from '../utils/objects';

export interface IMark {
	prev?: IToken;
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
	public prevToken?: IToken;

	private lastErrorToken?: IToken;

	constructor(scnr: Scanner = new Scanner()) {
		this.scanner = scnr;
		this.token = { type: TokenType.EOF, offset: -1, len: 0, text: '' };
		this.prevToken = undefined!;
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

	public peekOne(...types: TokenType[]): boolean {
		return types.indexOf(this.token.type) !== -1;
	}

	public peekRegExp(type: TokenType, regEx: RegExp): boolean {
		if (type !== this.token.type) {
			return false;
		}
		return regEx.test(this.token.text);
	}

	public hasWhitespace(): boolean {
		return !!this.prevToken && (this.prevToken.offset + this.prevToken.len !== this.token.offset);
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

	public try(func: () => nodes.Node | null): nodes.Node | null {
		const pos = this.mark();
		const node = func();
		if (!node) {
			this.restoreAtMark(pos);
			return null;
		}
		return node;
	}

	public acceptOneKeyword(keywords: string[]): boolean {
		if (TokenType.AtKeyword === this.token.type) {
			for (const keyword of keywords) {
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

	public acceptRegexp(regEx: RegExp): boolean {
		if (regEx.test(this.token.text)) {
			this.consumeToken();
			return true;
		}
		return false;
	}

	public _parseRegexp(regEx: RegExp): nodes.Node {
		let node = this.createNode(nodes.NodeType.Identifier);
		do { } while (this.acceptRegexp(regEx));
		return this.finish(node);
	}

	protected acceptUnquotedString(): boolean {
		const pos = this.scanner.pos();
		this.scanner.goBackTo(this.token.offset);
		const unquoted = this.scanner.scanUnquotedString();
		if (unquoted) {
			this.token = unquoted;
			this.consumeToken();
			return true;
		}
		this.scanner.goBackTo(pos);
		return false;
	}

	public resync(resyncTokens: TokenType[] | undefined, resyncStopTokens: TokenType[] | undefined): boolean {
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

	public create<T>(ctor: nodes.NodeConstructor<T>): T {
		return new ctor(this.token.offset, this.token.len);
	}

	public finish<T extends nodes.Node>(node: T, error?: CSSIssueType, resyncTokens?: TokenType[], resyncStopTokens?: TokenType[]): T {
		// parseNumeric misuses error for boolean flagging (however the real error mustn't be a false)
		// + nodelist offsets mustn't be modified, because there is a offset hack in rulesets for smartselection
		if (!(node instanceof nodes.Nodelist)) {
			if (error) {
				this.markError(node, error, resyncTokens, resyncStopTokens);
			}
			// set the node end position
			if (this.prevToken) {
				// length with more elements belonging together
				const prevEnd = this.prevToken.offset + this.prevToken.len;
				node.length = prevEnd > node.offset ? prevEnd - node.offset : 0; // offset is taken from current token, end from previous: Use 0 for empty nodes
			}

		}
		return node;
	}

	public markError<T extends nodes.Node>(node: T, error: CSSIssueType, resyncTokens?: TokenType[], resyncStopTokens?: TokenType[]): void {
		if (this.token !== this.lastErrorToken) { // do not report twice on the same token
			node.addIssue(new nodes.Marker(node, error, nodes.Level.Error, undefined, this.token.offset, this.token.len));
			this.lastErrorToken = this.token;
		}
		if (resyncTokens || resyncStopTokens) {
			this.resync(resyncTokens, resyncStopTokens);
		}
	}

	public parseStylesheet(textDocument: TextDocument): nodes.Stylesheet {
		const versionId = textDocument.version;
		const text = textDocument.getText();
		const textProvider = (offset: number, length: number) => {
			if (textDocument.version !== versionId) {
				throw new Error('Underlying model has changed, AST is no longer valid');
			}
			return text.substr(offset, length);
		};

		return this.internalParse(text, this._parseStylesheet, textProvider);
	}

	public internalParse<T extends nodes.Node, U extends T | null>(input: string, parseFunc: () => U, textProvider?: nodes.ITextProvider): U;
	public internalParse<T extends nodes.Node, U extends T>(input: string, parseFunc: () => U, textProvider?: nodes.ITextProvider): U {
		this.scanner.setSource(input);
		this.token = this.scanner.scan();
		const node: U = parseFunc.bind(this)();
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
		const node = this.create(nodes.Stylesheet);

		while (node.addChild(this._parseStylesheetStart())) {
			// Parse statements only valid at the beginning of stylesheets.
		}

		let inRecovery = false;
		do {
			let hasMatch = false;
			do {
				hasMatch = false;
				const statement = this._parseStylesheetStatement();
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

	public _parseStylesheetStart(): nodes.Node | null {
		return this._parseCharset();
	}

	public _parseStylesheetStatement(isNested: boolean = false): nodes.Node | null {
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseStylesheetAtStatement(isNested);
		}
		return this._parseRuleset(isNested);
	}

	public _parseStylesheetAtStatement(isNested: boolean = false): nodes.Node | null {
		return this._parseImport()
			|| this._parseMedia(isNested)
			|| this._parsePage()
			|| this._parseFontFace()
			|| this._parseKeyframe()
			|| this._parseSupports(isNested)
			|| this._parseViewPort()
			|| this._parseNamespace()
			|| this._parseDocument()
			|| this._parseUnknownAtRule();
	}

	public _tryParseRuleset(isNested: boolean): nodes.RuleSet | null {
		const mark = this.mark();
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

	public _parseRuleset(isNested: boolean = false): nodes.RuleSet | null {
		const node = this.create(nodes.RuleSet);
		const selectors = node.getSelectors();

		if (!selectors.addChild(this._parseSelector(isNested))) {
			return null;
		}

		while (this.accept(TokenType.Comma)) {
			if (!selectors.addChild(this._parseSelector(isNested))) {
				return this.finish(node, ParseError.SelectorExpected);
			}
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	protected _parseRuleSetDeclarationAtStatement(): nodes.Node | null {
		return this._parseUnknownAtRule();
	}

	public _parseRuleSetDeclaration(): nodes.Node | null {
		// https://www.w3.org/TR/css-syntax-3/#consume-a-list-of-declarations0
		if (this.peek(TokenType.AtKeyword)) {
			return this._parseRuleSetDeclarationAtStatement();
		}
		return this._parseDeclaration();
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
			case nodes.NodeType.MixinContentDeclaration:
				return false;
			case nodes.NodeType.ExtendsReference:
			case nodes.NodeType.MixinContentReference:
			case nodes.NodeType.ReturnStatement:
			case nodes.NodeType.MediaQuery:
			case nodes.NodeType.Debug:
			case nodes.NodeType.Import:
			case nodes.NodeType.AtApplyRule:
			case nodes.NodeType.CustomPropertyDeclaration:
				return true;
			case nodes.NodeType.VariableDeclaration:
				return (<nodes.VariableDeclaration>node).needsSemicolon;
			case nodes.NodeType.MixinReference:
				return !(<nodes.MixinReference>node).getContent();
			case nodes.NodeType.Declaration:
				return !(<nodes.Declaration>node).getNestedProperties();
		}
		return false;
	}

	public _parseDeclarations(parseDeclaration: () => nodes.Node | null): nodes.Declarations | null {
		const node = this.create(nodes.Declarations);
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
			// We accepted semicolon token. Link it to declaration.
			if (decl && this.prevToken && this.prevToken.type === TokenType.SemiColon) {
				(decl as nodes.Declaration).semicolonPosition = this.prevToken.offset;
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

	public _parseBody<T extends nodes.BodyDeclaration>(node: T, parseDeclaration: () => nodes.Node | null): T {
		if (!node.setDeclarations(this._parseDeclarations(parseDeclaration))) {
			return this.finish(node, ParseError.LeftCurlyExpected, [TokenType.CurlyR, TokenType.SemiColon]);
		}
		return this.finish(node);
	}

	public _parseSelector(isNested: boolean): nodes.Selector | null {
		const node = this.create(nodes.Selector);

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

	public _parseDeclaration(stopTokens?: TokenType[]): nodes.Declaration | null {
		const custonProperty = this._tryParseCustomPropertyDeclaration(stopTokens);
		if (custonProperty) {
			return custonProperty;
		}

		const node = this.create(nodes.Declaration);
		if (!node.setProperty(this._parseProperty())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return <nodes.Declaration>this.finish(node, ParseError.ColonExpected, [TokenType.Colon], stopTokens || [TokenType.SemiColon]);
		}
		if (this.prevToken) {
			node.colonPosition = this.prevToken.offset;
		}

		if (!node.setValue(this._parseExpr())) {
			return this.finish(node, ParseError.PropertyValueExpected);
		}

		node.addChild(this._parsePrio());
		if (this.peek(TokenType.SemiColon)) {
			node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
		}
		return this.finish(node);
	}

	public _tryParseCustomPropertyDeclaration(stopTokens?: TokenType[]): nodes.CustomPropertyDeclaration | null {
		if (!this.peekRegExp(TokenType.Ident, /^--/)) {
			return null;
		}
		const node = this.create(nodes.CustomPropertyDeclaration);
		if (!node.setProperty(this._parseProperty())) {
			return null;
		}

		if (!this.accept(TokenType.Colon)) {
			return this.finish(node, ParseError.ColonExpected, [TokenType.Colon]);
		}
		if (this.prevToken) {
			node.colonPosition = this.prevToken.offset;
		}

		const mark = this.mark();
		if (this.peek(TokenType.CurlyL)) {
			// try to parse it as nested declaration
			const propertySet = this.create(nodes.CustomPropertySet);
			const declarations = this._parseDeclarations(this._parseRuleSetDeclaration.bind(this));
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

		// try to parse as expression
		const expression = this._parseExpr();
		if (expression && !expression.isErroneous(true)) {
			this._parsePrio();
			if (this.peekOne(...(stopTokens || []), TokenType.SemiColon, TokenType.EOF)) {
				node.setValue(expression);
				if (this.peek(TokenType.SemiColon)) {
					node.semicolonPosition = this.token.offset; // not part of the declaration, but useful information for code assist
				}
				return this.finish(node);
			}
		}
		this.restoreAtMark(mark);
		node.addChild(this._parseCustomPropertyValue(stopTokens));
		node.addChild(this._parsePrio());
		if (isDefined(node.colonPosition) && this.token.offset === node.colonPosition + 1) {
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
	public _parseCustomPropertyValue(stopTokens: TokenType[] = [TokenType.CurlyR]): nodes.Node {
		const node = this.create(nodes.Node);
		const isTopLevel = () => curlyDepth === 0 && parensDepth === 0 && bracketsDepth === 0;
		const onStopToken = () => stopTokens.indexOf(this.token.type) !== -1;
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
						if (onStopToken() && parensDepth === 0 && bracketsDepth === 0) {
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
						if (onStopToken() && bracketsDepth === 0 && curlyDepth === 0) {
							break done;
						}
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

	public _tryToParseDeclaration(stopTokens?: TokenType[]): nodes.Declaration | null {
		const mark = this.mark();
		if (this._parseProperty() && this.accept(TokenType.Colon)) {
			// looks like a declaration, go ahead
			this.restoreAtMark(mark);
			return this._parseDeclaration(stopTokens);
		}

		this.restoreAtMark(mark);
		return null;
	}

	public _parseProperty(): nodes.Property | null {
		const node = this.create(nodes.Property);

		const mark = this.mark();
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

	public _parsePropertyIdentifier(): nodes.Identifier | null {
		return this._parseIdent();
	}

	public _parseCharset(): nodes.Node | null {
		if (!this.peek(TokenType.Charset)) {
			return null;
		}

		const node = this.create(nodes.Node);
		this.consumeToken(); // charset
		if (!this.accept(TokenType.String)) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		if (!this.accept(TokenType.SemiColon)) {
			return this.finish(node, ParseError.SemiColonExpected);
		}
		return this.finish(node);
	}



	public _parseImport(): nodes.Node | null {
		if (!this.peekKeyword('@import')) {
			return null;
		}

		const node = this.create(nodes.Import);
		this.consumeToken(); // @import

		if (!node.addChild(this._parseURILiteral()) && !node.addChild(this._parseStringLiteral())) {
			return this.finish(node, ParseError.URIOrStringExpected);
		}

		if (!this.peek(TokenType.SemiColon) && !this.peek(TokenType.EOF)) {
			node.setMedialist(this._parseMediaQueryList());
		}

		return this.finish(node);
	}

	public _parseNamespace(): nodes.Node | null {
		// http://www.w3.org/TR/css3-namespace/
		// namespace  : NAMESPACE_SYM S* [IDENT S*]? [STRING|URI] S* ';' S*
		if (!this.peekKeyword('@namespace')) {
			return null;
		}
		const node = this.create(nodes.Namespace);
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

	public _parseFontFace(): nodes.Node | null {
		if (!this.peekKeyword('@font-face')) {
			return null;
		}
		const node = this.create(nodes.FontFace);
		this.consumeToken(); // @font-face

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	public _parseViewPort(): nodes.Node | null {
		if (!this.peekKeyword('@-ms-viewport') &&
			!this.peekKeyword('@-o-viewport') &&
			!this.peekKeyword('@viewport')
		) {
			return null;
		}
		const node = this.create(nodes.ViewPort);
		this.consumeToken(); // @-ms-viewport

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}

	private keyframeRegex = /^@(\-(webkit|ms|moz|o)\-)?keyframes$/i;

	public _parseKeyframe(): nodes.Node | null {
		if (!this.peekRegExp(TokenType.AtKeyword, this.keyframeRegex)) {
			return null;
		}
		const node = this.create(nodes.Keyframe);

		const atNode = this.create(nodes.Node);
		this.consumeToken(); // atkeyword
		node.setKeyword(this.finish(atNode));
		if (atNode.matches('@-ms-keyframes')) { // -ms-keyframes never existed
			this.markError(atNode, ParseError.UnknownKeyword);
		}

		if (!node.setIdentifier(this._parseKeyframeIdent())) {
			return this.finish(node, ParseError.IdentifierExpected, [TokenType.CurlyR]);
		}

		return this._parseBody(node, this._parseKeyframeSelector.bind(this));
	}

	public _parseKeyframeIdent(): nodes.Node | null {
		return this._parseIdent([nodes.ReferenceType.Keyframe]);
	}

	public _parseKeyframeSelector(): nodes.Node | null {
		const node = this.create(nodes.KeyframeSelector);

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

	public _tryParseKeyframeSelector(): nodes.Node | null {
		const node = this.create(nodes.KeyframeSelector);
		const pos = this.mark();

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

	public _parseSupports(isNested = false): nodes.Node | null {
		// SUPPORTS_SYM S* supports_condition '{' S* ruleset* '}' S*
		if (!this.peekKeyword('@supports')) {
			return null;
		}

		const node = this.create(nodes.Supports);
		this.consumeToken(); // @supports
		node.addChild(this._parseSupportsCondition());

		return this._parseBody(node, this._parseSupportsDeclaration.bind(this, isNested));
	}

	public _parseSupportsDeclaration(isNested = false): nodes.Node | null {
		if (isNested) {
			// if nested, the body can contain rulesets, but also declarations
			return this._tryParseRuleset(true)
				|| this._tryToParseDeclaration()
				|| this._parseStylesheetStatement(true);
		}
		return this._parseStylesheetStatement(false);
	}

	protected _parseSupportsCondition(): nodes.Node {
		// supports_condition : supports_negation | supports_conjunction | supports_disjunction | supports_condition_in_parens ;
		// supports_condition_in_parens: ( '(' S* supports_condition S* ')' ) | supports_declaration_condition | general_enclosed ;
		// supports_negation: NOT S+ supports_condition_in_parens ;
		// supports_conjunction: supports_condition_in_parens ( S+ AND S+ supports_condition_in_parens )+;
		// supports_disjunction: supports_condition_in_parens ( S+ OR S+ supports_condition_in_parens )+;
		// supports_declaration_condition: '(' S* declaration ')';
		// general_enclosed: ( FUNCTION | '(' ) ( any | unused )* ')' ;
		const node = this.create(nodes.SupportsCondition);

		if (this.acceptIdent('not')) {
			node.addChild(this._parseSupportsConditionInParens());
		} else {
			node.addChild(this._parseSupportsConditionInParens());
			if (this.peekRegExp(TokenType.Ident, /^(and|or)$/i)) {
				const text = this.token.text.toLowerCase();
				while (this.acceptIdent(text)) {
					node.addChild(this._parseSupportsConditionInParens());
				}
			}
		}
		return this.finish(node);
	}

	private _parseSupportsConditionInParens(): nodes.Node {
		const node = this.create(nodes.SupportsCondition);
		if (this.accept(TokenType.ParenthesisL)) {
			if (this.prevToken) {
				node.lParent = this.prevToken.offset;
			}
			if (!node.addChild(this._tryToParseDeclaration([TokenType.ParenthesisR]))) {
				if (!this._parseSupportsCondition()) {
					return this.finish(node, ParseError.ConditionExpected);
				}
			}
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected, [TokenType.ParenthesisR], []);
			}
			if (this.prevToken) {
				node.rParent = this.prevToken.offset;
			}
			return this.finish(node);
		} else if (this.peek(TokenType.Ident)) {
			const pos = this.mark();
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

	public _parseMediaDeclaration(isNested = false): nodes.Node | null {
		if (isNested) {
			// if nested, the body can contain rulesets, but also declarations
			return this._tryParseRuleset(true)
				|| this._tryToParseDeclaration()
				|| this._parseStylesheetStatement(true);
		}
		return this._parseStylesheetStatement(false);
	}

	public _parseMedia(isNested = false): nodes.Node | null {
		// MEDIA_SYM S* media_query_list '{' S* ruleset* '}' S*
		// media_query_list : S* [media_query [ ',' S* media_query ]* ]?
		if (!this.peekKeyword('@media')) {
			return null;
		}
		const node = this.create(nodes.Media);
		this.consumeToken(); // @media

		if (!node.addChild(this._parseMediaQueryList())) {
			return this.finish(node, ParseError.MediaQueryExpected);
		}
		return this._parseBody(node, this._parseMediaDeclaration.bind(this, isNested));
	}

	public _parseMediaQueryList(): nodes.Medialist {
		const node = this.create(nodes.Medialist);
		if (!node.addChild(this._parseMediaQuery())) {
			return this.finish(node, ParseError.MediaQueryExpected);
		}
		while (this.accept(TokenType.Comma)) {
			if (!node.addChild(this._parseMediaQuery())) {
				return this.finish(node, ParseError.MediaQueryExpected);
			}
		}
		return this.finish(node);
	}

	public _parseMediaQuery(): nodes.Node | null {
		// <media-query> = <media-condition> | [ not | only ]? <media-type> [ and <media-condition-without-or> ]?
		const node = this.create(nodes.MediaQuery);
		const pos = this.mark();
		this.acceptIdent('not');
		if (!this.peek(TokenType.ParenthesisL)) {
			if (this.acceptIdent('only')) {
				// optional
			}
			if (!node.addChild(this._parseIdent())) {
				return null;
			}
			if (this.acceptIdent('and')) {
				node.addChild(this._parseMediaCondition());
			}
		} else {
			this.restoreAtMark(pos); // 'not' is part of the MediaCondition
			node.addChild(this._parseMediaCondition());
		}
		return this.finish(node);
	}

	public _parseRatio(): nodes.Node | null {
		const pos = this.mark();
		const node = this.create(nodes.RatioValue);
		if (!this._parseNumeric()) {
			return null;
		}
		if (!this.acceptDelim('/')) {
			this.restoreAtMark(pos);
			return null;
		}
		if (!this._parseNumeric()) {
			return this.finish(node, ParseError.NumberExpected);
		}
		return this.finish(node);
	}

	public _parseMediaCondition(): nodes.Node | null {
		// <media-condition> = <media-not> | <media-and> | <media-or> | <media-in-parens>
		// <media-not> = not <media-in-parens>
		// <media-and> = <media-in-parens> [ and <media-in-parens> ]+
		// <media-or> = <media-in-parens> [ or <media-in-parens> ]+
		// <media-in-parens> = ( <media-condition> ) | <media-feature> | <general-enclosed>

		const node = this.create(nodes.MediaCondition);

		this.acceptIdent('not');
		let parseExpression = true;

		while (parseExpression) {
			if (!this.accept(TokenType.ParenthesisL)) {
				return this.finish(node, ParseError.LeftParenthesisExpected, [], [TokenType.CurlyL]);
			}
			if (this.peek(TokenType.ParenthesisL) || this.peekIdent('not')) {
				// <media-condition>
				node.addChild(this._parseMediaCondition());
			} else {
				node.addChild(this._parseMediaFeature());
			}
			// not yet implemented: general enclosed
			if (!this.accept(TokenType.ParenthesisR)) {
				return this.finish(node, ParseError.RightParenthesisExpected, [], [TokenType.CurlyL]);
			}
			parseExpression = this.acceptIdent('and') || this.acceptIdent('or');
		}
		return this.finish(node);
	}

	public _parseMediaFeature(): nodes.Node | null {
		const resyncStopToken = [TokenType.ParenthesisR];

		const node = this.create(nodes.MediaFeature);
		// <media-feature> = ( [ <mf-plain> | <mf-boolean> | <mf-range> ] )
		// <mf-plain> = <mf-name> : <mf-value>
		// <mf-boolean> = <mf-name>
		// <mf-range> = <mf-name> [ '<' | '>' ]? '='? <mf-value> | <mf-value> [ '<' | '>' ]? '='? <mf-name> | <mf-value> '<' '='? <mf-name> '<' '='? <mf-value> | <mf-value> '>' '='? <mf-name> '>' '='? <mf-value>

		const parseRangeOperator = () => {
			if (this.acceptDelim('<') || this.acceptDelim('>')) {
				if (!this.hasWhitespace()) {
					this.acceptDelim('=');
				}
				return true;
			} else if (this.acceptDelim('=')) {
				return true;
			}
			return false;
		};

		if (node.addChild(this._parseMediaFeatureName())) {
			if (this.accept(TokenType.Colon)) {
				if (!node.addChild(this._parseMediaFeatureValue())) {
					return this.finish(node, ParseError.TermExpected, [], resyncStopToken);
				}
			} else if (parseRangeOperator()) {
				if (!node.addChild(this._parseMediaFeatureValue())) {
					return this.finish(node, ParseError.TermExpected, [], resyncStopToken);
				}
				if (parseRangeOperator()) {
					if (!node.addChild(this._parseMediaFeatureValue())) {
						return this.finish(node, ParseError.TermExpected, [], resyncStopToken);
					}
				}
			} else {
				// <mf-boolean> = <mf-name>
			}
		} else if (node.addChild(this._parseMediaFeatureValue())) {
			if (!parseRangeOperator()) {
				return this.finish(node, ParseError.OperatorExpected, [], resyncStopToken);
			}
			if (!node.addChild(this._parseMediaFeatureName())) {
				return this.finish(node, ParseError.IdentifierExpected, [], resyncStopToken);
			}
			if (parseRangeOperator()) {
				if (!node.addChild(this._parseMediaFeatureValue())) {
					return this.finish(node, ParseError.TermExpected, [], resyncStopToken);
				}
			}
		} else {
			return this.finish(node, ParseError.IdentifierExpected, [], resyncStopToken);
		}
		return this.finish(node);
	}


	public _parseMediaFeatureName(): nodes.Node | null {
		return this._parseIdent();
	}

	public _parseMediaFeatureValue(): nodes.Node | null {
		return this._parseRatio() || this._parseTermExpression();
	}

	public _parseMedium(): nodes.Node | null {
		const node = this.create(nodes.Node);
		if (node.addChild(this._parseIdent())) {
			return this.finish(node);
		} else {
			return null;
		}
	}

	public _parsePageDeclaration(): nodes.Node | null {
		return this._parsePageMarginBox() || this._parseRuleSetDeclaration();
	}

	public _parsePage(): nodes.Node | null {
		// http://www.w3.org/TR/css3-page/
		// page_rule : PAGE_SYM S* page_selector_list '{' S* page_body '}' S*
		// page_body :  /* Can be empty */ declaration? [ ';' S* page_body ]? | page_margin_box page_body
		if (!this.peekKeyword('@page')) {
			return null;
		}
		const node = this.create(nodes.Page);
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

	public _parsePageMarginBox(): nodes.Node | null {
		// page_margin_box :  margin_sym S* '{' S* declaration? [ ';' S* declaration? ]* '}' S*
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}
		const node = this.create(nodes.PageBoxMarginBox);

		if (!this.acceptOneKeyword(languageFacts.pageBoxDirectives)) {
			this.markError(node, ParseError.UnknownAtRule, [], [TokenType.CurlyL]);
		}

		return this._parseBody(node, this._parseRuleSetDeclaration.bind(this));
	}


	public _parsePageSelector(): nodes.Node | null {
		// page_selector : pseudo_page+ | IDENT pseudo_page*
		// pseudo_page :  ':' [ "left" | "right" | "first" | "blank" ];
		if (!this.peek(TokenType.Ident) && !this.peek(TokenType.Colon)) {
			return null;
		}
		const node = this.create(nodes.Node);
		node.addChild(this._parseIdent()); // optional ident

		if (this.accept(TokenType.Colon)) {
			if (!node.addChild(this._parseIdent())) { // optional ident
				return this.finish(node, ParseError.IdentifierExpected);
			}
		}
		return this.finish(node);
	}

	public _parseDocument(): nodes.Node | null {
		// -moz-document is experimental but has been pushed to css4
		if (!this.peekKeyword('@-moz-document')) {
			return null;
		}
		const node = this.create(nodes.Document);
		this.consumeToken(); // @-moz-document

		this.resync([], [TokenType.CurlyL]); // ignore all the rules
		return this._parseBody(node, this._parseStylesheetStatement.bind(this));
	}

	// https://www.w3.org/TR/css-syntax-3/#consume-an-at-rule
	public _parseUnknownAtRule(): nodes.Node | null {
		if (!this.peek(TokenType.AtKeyword)) {
			return null;
		}

		const node = this.create(nodes.UnknownAtRule);
		node.addChild(this._parseUnknownAtRuleName());

		const isTopLevel = () => curlyDepth === 0 && parensDepth === 0 && bracketsDepth === 0;
		let curlyLCount = 0;
		let curlyDepth = 0;
		let parensDepth = 0;
		let bracketsDepth = 0;
		done: while (true) {
			switch (this.token.type) {
				case TokenType.SemiColon:
					if (isTopLevel()) {
						break done;
					}
					break;
				case TokenType.EOF:
					if (curlyDepth > 0) {
						return this.finish(node, ParseError.RightCurlyExpected);
					} else if (bracketsDepth > 0) {
						return this.finish(node, ParseError.RightSquareBracketExpected);
					} else if (parensDepth > 0) {
						return this.finish(node, ParseError.RightParenthesisExpected);
					} else {
						return this.finish(node);
					}
				case TokenType.CurlyL:
					curlyLCount++;
					curlyDepth++;
					break;
				case TokenType.CurlyR:
					curlyDepth--;
					// End of at-rule, consume CurlyR and return node
					if (curlyLCount > 0 && curlyDepth === 0) {
						this.consumeToken();

						if (bracketsDepth > 0) {
							return this.finish(node, ParseError.RightSquareBracketExpected);
						} else if (parensDepth > 0) {
							return this.finish(node, ParseError.RightParenthesisExpected);
						}
						break done;
					}
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
			}

			this.consumeToken();
		}

		return node;
	}

	public _parseUnknownAtRuleName(): nodes.Node {
		const node = this.create(nodes.Node);

		if (this.accept(TokenType.AtKeyword)) {
			return this.finish(node);
		}

		return node;
	}

	public _parseOperator(): nodes.Operator | null {
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
			const node = this.createNode(nodes.NodeType.Operator);
			this.consumeToken();
			return this.finish(node);
		} else {
			return null;
		}
	}

	public _parseUnaryOperator(): nodes.Node | null {
		if (!this.peekDelim('+') && !this.peekDelim('-')) {
			return null;
		}
		const node = this.create(nodes.Node);
		this.consumeToken();
		return this.finish(node);
	}

	public _parseCombinator(): nodes.Node | null {

		if (this.peekDelim('>')) {
			const node = this.create(nodes.Node);
			this.consumeToken();
			const mark = this.mark();
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
			const node = this.create(nodes.Node);
			this.consumeToken();
			node.type = nodes.NodeType.SelectorCombinatorSibling;
			return this.finish(node);
		} else if (this.peekDelim('~')) {
			const node = this.create(nodes.Node);
			this.consumeToken();
			node.type = nodes.NodeType.SelectorCombinatorAllSiblings;
			return this.finish(node);
		} else if (this.peekDelim('/')) {
			const node = this.create(nodes.Node);
			this.consumeToken();
			const mark = this.mark();
			if (!this.hasWhitespace() && this.acceptIdent('deep') && !this.hasWhitespace() && this.acceptDelim('/')) {
				node.type = nodes.NodeType.SelectorCombinatorShadowPiercingDescendant;
				return this.finish(node);
			}
			this.restoreAtMark(mark);
		}

		return null;
	}

	public _parseSimpleSelector(): nodes.SimpleSelector | null {
		// simple_selector
		//  : element_name [ HASH | class | attrib | pseudo ]* | [ HASH | class | attrib | pseudo ]+ ;

		const node = this.create(nodes.SimpleSelector);
		let c = 0;
		if (node.addChild(this._parseElementName())) {
			c++;
		}
		while ((c === 0 || !this.hasWhitespace()) && node.addChild(this._parseSimpleSelectorBody())) {
			c++;
		}
		return c > 0 ? this.finish(node) : null;
	}

	public _parseSimpleSelectorBody(): nodes.Node | null {
		return this._parsePseudo() || this._parseHash() || this._parseClass() || this._parseAttrib();
	}

	public _parseSelectorIdent(): nodes.Node | null {
		return this._parseIdent();
	}

	public _parseHash(): nodes.Node | null {
		if (!this.peek(TokenType.Hash) && !this.peekDelim('#')) {
			return null;
		}
		const node = this.createNode(nodes.NodeType.IdentifierSelector);
		if (this.acceptDelim('#')) {
			if (this.hasWhitespace() || !node.addChild(this._parseSelectorIdent())) {
				return this.finish(node, ParseError.IdentifierExpected);
			}
		} else {
			this.consumeToken(); // TokenType.Hash
		}
		return this.finish(node);
	}

	public _parseClass(): nodes.Node | null {
		// class: '.' IDENT ;
		if (!this.peekDelim('.')) {
			return null;
		}
		const node = this.createNode(nodes.NodeType.ClassSelector);
		this.consumeToken(); // '.'

		if (this.hasWhitespace() || !node.addChild(this._parseSelectorIdent())) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		return this.finish(node);
	}

	public _parseElementName(): nodes.Node | null {
		// element_name: (ns? '|')? IDENT | '*';
		const pos = this.mark();
		const node = this.createNode(nodes.NodeType.ElementNameSelector);
		node.addChild(this._parseNamespacePrefix());
		if (!node.addChild(this._parseSelectorIdent()) && !this.acceptDelim('*')) {
			this.restoreAtMark(pos);
			return null;
		}
		return this.finish(node);
	}

	public _parseNamespacePrefix(): nodes.Node | null {
		const pos = this.mark();
		const node = this.createNode(nodes.NodeType.NamespacePrefix);
		if (!node.addChild(this._parseIdent()) && !this.acceptDelim('*')) {
			// ns is optional
		}
		if (!this.acceptDelim('|')) {
			this.restoreAtMark(pos);
			return null;
		}
		return this.finish(node);
	}

	public _parseAttrib(): nodes.Node | null {
		// attrib : '[' S* IDENT S* [ [ '=' | INCLUDES | DASHMATCH ] S*   [ IDENT | STRING ] S* ]? ']'
		if (!this.peek(TokenType.BracketL)) {
			return null;
		}
		const node = this.create(nodes.AttributeSelector);
		this.consumeToken(); // BracketL

		// Optional attrib namespace
		node.setNamespacePrefix(this._parseNamespacePrefix());

		if (!node.setIdentifier(this._parseIdent())) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		if (node.setOperator(this._parseOperator())) {
			node.setValue(this._parseBinaryExpr());
			this.acceptIdent('i'); // case insensitive matching
			this.acceptIdent('s'); // case sensitive matching
		}

		if (!this.accept(TokenType.BracketR)) {
			return this.finish(node, ParseError.RightSquareBracketExpected);
		}
		return this.finish(node);
	}

	public _parsePseudo(): nodes.Node | null {
		// pseudo: ':' [ IDENT | FUNCTION S* [IDENT S*]? ')' ]
		const node = this._tryParsePseudoIdentifier();
		if (node) {
			if (!this.hasWhitespace() && this.accept(TokenType.ParenthesisL)) {
				const tryAsSelector = () => {
					const selectors = this.create(nodes.Node);
					if (!selectors.addChild(this._parseSelector(false))) {
						return null;
					}
					while (this.accept(TokenType.Comma) && selectors.addChild(this._parseSelector(false))) {
						// loop
					}
					if (this.peek(TokenType.ParenthesisR)) {
						return this.finish(selectors);
					}

					return null;
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

	public _tryParsePseudoIdentifier(): nodes.Node | null {
		if (!this.peek(TokenType.Colon)) {
			return null;
		}
		const pos = this.mark();
		const node = this.createNode(nodes.NodeType.PseudoSelector);
		this.consumeToken(); // Colon
		if (this.hasWhitespace()) {
			this.restoreAtMark(pos);
			return null;
		}
		// optional, support ::
		this.accept(TokenType.Colon);
		if (this.hasWhitespace() || !node.addChild(this._parseIdent())) {
			return this.finish(node, ParseError.IdentifierExpected);
		}
		return this.finish(node);
	}

	public _tryParsePrio(): nodes.Node | null {
		const mark = this.mark();

		const prio = this._parsePrio();
		if (prio) {
			return prio;
		}
		this.restoreAtMark(mark);
		return null;
	}

	public _parsePrio(): nodes.Node | null {
		if (!this.peek(TokenType.Exclamation)) {
			return null;
		}

		const node = this.createNode(nodes.NodeType.Prio);
		if (this.accept(TokenType.Exclamation) && this.acceptIdent('important')) {
			return this.finish(node);
		}
		return null;
	}

	public _parseExpr(stopOnComma: boolean = false): nodes.Expression | null {
		const node = this.create(nodes.Expression);
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

	public _parseNamedLine(): nodes.Node | null {
		// https://www.w3.org/TR/css-grid-1/#named-lines
		if (!this.peek(TokenType.BracketL)) {
			return null;
		}
		const node = this.createNode(nodes.NodeType.GridLine);
		this.consumeToken();
		while (node.addChild(this._parseIdent())) {
			// repeat
		}
		if (!this.accept(TokenType.BracketR)) {
			return this.finish(node, ParseError.RightSquareBracketExpected);
		}
		return this.finish(node);
	}

	public _parseBinaryExpr(preparsedLeft?: nodes.BinaryExpression, preparsedOper?: nodes.Node): nodes.BinaryExpression | null {
		let node = this.create(nodes.BinaryExpression);

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
		const operator = this._parseOperator();
		if (operator) {
			node = <nodes.BinaryExpression>this._parseBinaryExpr(node, operator);
		}

		return this.finish(node);
	}

	public _parseTerm(): nodes.Term | null {

		let node = this.create(nodes.Term);
		node.setOperator(this._parseUnaryOperator()); // optional

		if (node.setExpression(this._parseTermExpression())) {
			return <nodes.Term>this.finish(node);
		}

		return null;
	}

	public _parseTermExpression(): nodes.Node | null {
		return this._parseURILiteral() || // url before function
			this._parseFunction() || // function before ident
			this._parseIdent() ||
			this._parseStringLiteral() ||
			this._parseNumeric() ||
			this._parseHexColor() ||
			this._parseOperation() ||
			this._parseNamedLine();
	}

	public _parseOperation(): nodes.Node | null {
		if (!this.peek(TokenType.ParenthesisL)) {
			return null;
		}
		const node = this.create(nodes.Node);
		this.consumeToken(); // ParenthesisL
		node.addChild(this._parseExpr());
		if (!this.accept(TokenType.ParenthesisR)) {
			return this.finish(node, ParseError.RightParenthesisExpected);
		}
		return this.finish(node);
	}

	public _parseNumeric(): nodes.NumericValue | null {

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
			const node = this.create(nodes.NumericValue);
			this.consumeToken();
			return <nodes.NumericValue>this.finish(node);
		}

		return null;
	}

	public _parseStringLiteral(): nodes.Node | null {
		if (!this.peek(TokenType.String) && !this.peek(TokenType.BadString)) {
			return null;
		}
		const node = this.createNode(nodes.NodeType.StringLiteral);
		this.consumeToken();
		return this.finish(node);
	}

	public _parseURILiteral(): nodes.Node | null {
		if (!this.peekRegExp(TokenType.Ident, /^url(-prefix)?$/i)) {
			return null;
		}
		const pos = this.mark();
		const node = this.createNode(nodes.NodeType.URILiteral);
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

	public _parseURLArgument(): nodes.Node | null {
		const node = this.create(nodes.Node);
		if (!this.accept(TokenType.String) && !this.accept(TokenType.BadString) && !this.acceptUnquotedString()) {
			return null;
		}
		return this.finish(node);
	}

	public _parseIdent(referenceTypes?: nodes.ReferenceType[]): nodes.Identifier | null {
		if (!this.peek(TokenType.Ident)) {
			return null;
		}
		const node = this.create(nodes.Identifier);
		if (referenceTypes) {
			node.referenceTypes = referenceTypes;
		}
		node.isCustomProperty = this.peekRegExp(TokenType.Ident, /^--/);
		this.consumeToken();
		return this.finish(node);
	}

	public _parseFunction(): nodes.Function | null {

		const pos = this.mark();
		const node = this.create(nodes.Function);

		if (!node.setIdentifier(this._parseFunctionIdentifier())) {
			return null;
		}

		if (this.hasWhitespace() || !this.accept(TokenType.ParenthesisL)) {
			this.restoreAtMark(pos);
			return null;
		}

		if (node.getArguments().addChild(this._parseFunctionArgument())) {
			while (this.accept(TokenType.Comma)) {
				if (this.peek(TokenType.ParenthesisR)) {
					break;
				}
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

	public _parseFunctionIdentifier(): nodes.Identifier | null {
		if (!this.peek(TokenType.Ident)) {
			return null;
		}

		const node = this.create(nodes.Identifier);
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

	public _parseFunctionArgument(): nodes.Node | null {
		const node = this.create(nodes.FunctionArgument);
		if (node.setValue(this._parseExpr(true))) {
			return this.finish(node);
		}
		return null;
	}

	public _parseHexColor(): nodes.Node | null {
		if (this.peekRegExp(TokenType.Hash, /^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/g)) {
			const node = this.create(nodes.HexColorValue);
			this.consumeToken();
			return this.finish(node);
		} else {
			return null;
		}
	}
}
