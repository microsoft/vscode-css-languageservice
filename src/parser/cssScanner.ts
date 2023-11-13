/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

export enum TokenType {
	Ident,
	AtKeyword,
	String,
	BadString,
	UnquotedString,
	Hash,
	Num,
	Percentage,
	Dimension,
	UnicodeRange,
	CDO, // <!--
	CDC, // -->
	Colon,
	SemiColon,
	CurlyL,
	CurlyR,
	ParenthesisL,
	ParenthesisR,
	BracketL,
	BracketR,
	Whitespace,
	Includes,
	Dashmatch, // |=
	SubstringOperator, // *=
	PrefixOperator, // ^=
	SuffixOperator, // $=
	Delim,
	EMS, // 3em
	EXS, // 3ex
	Length,
	Angle,
	Time,
	Freq,
	Exclamation,
	Resolution,
	Comma,
	Charset,
	EscapedJavaScript,
	BadEscapedJavaScript,
	Comment,
	SingleLineComment,
	EOF,
	ContainerQueryLength,
	CustomToken // must be last token type
}

export interface IToken {
	type: TokenType;
	text: string;
	offset: number;
	len: number;
}

export class MultiLineStream {

	private source: string;
	private len: number;
	private position: number;

	constructor(source: string) {
		this.source = source;
		this.len = source.length;
		this.position = 0;
	}

	public substring(from: number, to: number = this.position): string {
		return this.source.substring(from, to);
	}

	public eos(): boolean {
		return this.len <= this.position;
	}

	public pos(): number {
		return this.position;
	}

	public goBackTo(pos: number): void {
		this.position = pos;
	}

	public goBack(n: number): void {
		this.position -= n;
	}

	public advance(n: number): void {
		this.position += n;
	}

	public nextChar(): number {
		return this.source.charCodeAt(this.position++) || 0;
	}

	public peekChar(n: number = 0): number {
		return this.source.charCodeAt(this.position + n) || 0;
	}

	public lookbackChar(n: number = 0): number {
		return this.source.charCodeAt(this.position - n) || 0;
	}

	public advanceIfChar(ch: number): boolean {
		if (ch === this.source.charCodeAt(this.position)) {
			this.position++;
			return true;
		}
		return false;
	}

	public advanceIfChars(ch: number[]): boolean {
		if (this.position + ch.length > this.source.length) {
			return false;
		}
		let i = 0;
		for (; i < ch.length; i++) {
			if (this.source.charCodeAt(this.position + i) !== ch[i]) {
				return false;
			}
		}
		this.advance(i);
		return true;
	}

	public advanceWhileChar(condition: (ch: number) => boolean): number {
		const posNow = this.position;
		while (this.position < this.len && condition(this.source.charCodeAt(this.position))) {
			this.position++;
		}
		return this.position - posNow;
	}
}

const _a = 'a'.charCodeAt(0);
const _f = 'f'.charCodeAt(0);
const _z = 'z'.charCodeAt(0);
const _u = 'u'.charCodeAt(0);
const _A = 'A'.charCodeAt(0);
const _F = 'F'.charCodeAt(0);
const _Z = 'Z'.charCodeAt(0);
const _0 = '0'.charCodeAt(0);
const _9 = '9'.charCodeAt(0);
const _TLD = '~'.charCodeAt(0);
const _HAT = '^'.charCodeAt(0);
const _EQS = '='.charCodeAt(0);
const _PIP = '|'.charCodeAt(0);
const _MIN = '-'.charCodeAt(0);
const _USC = '_'.charCodeAt(0);
const _PRC = '%'.charCodeAt(0);
const _MUL = '*'.charCodeAt(0);
const _LPA = '('.charCodeAt(0);
const _RPA = ')'.charCodeAt(0);
const _LAN = '<'.charCodeAt(0);
const _RAN = '>'.charCodeAt(0);
const _ATS = '@'.charCodeAt(0);
const _HSH = '#'.charCodeAt(0);
const _DLR = '$'.charCodeAt(0);
const _BSL = '\\'.charCodeAt(0);
const _FSL = '/'.charCodeAt(0);
const _NWL = '\n'.charCodeAt(0);
const _CAR = '\r'.charCodeAt(0);
const _LFD = '\f'.charCodeAt(0);
const _DQO = '"'.charCodeAt(0);
const _SQO = '\''.charCodeAt(0);
const _WSP = ' '.charCodeAt(0);
const _TAB = '\t'.charCodeAt(0);
const _SEM = ';'.charCodeAt(0);
const _COL = ':'.charCodeAt(0);
const _CUL = '{'.charCodeAt(0);
const _CUR = '}'.charCodeAt(0);
const _BRL = '['.charCodeAt(0);
const _BRR = ']'.charCodeAt(0);
const _CMA = ','.charCodeAt(0);
const _DOT = '.'.charCodeAt(0);
const _BNG = '!'.charCodeAt(0);
const _QSM = '?'.charCodeAt(0);
const _PLS = '+'.charCodeAt(0);

const staticTokenTable: { [code: number]: TokenType; } = {};
staticTokenTable[_SEM] = TokenType.SemiColon;
staticTokenTable[_COL] = TokenType.Colon;
staticTokenTable[_CUL] = TokenType.CurlyL;
staticTokenTable[_CUR] = TokenType.CurlyR;
staticTokenTable[_BRR] = TokenType.BracketR;
staticTokenTable[_BRL] = TokenType.BracketL;
staticTokenTable[_LPA] = TokenType.ParenthesisL;
staticTokenTable[_RPA] = TokenType.ParenthesisR;
staticTokenTable[_CMA] = TokenType.Comma;

const staticUnitTable: { [code: string]: TokenType; } = {};
staticUnitTable['em'] = TokenType.EMS;
staticUnitTable['ex'] = TokenType.EXS;
staticUnitTable['px'] = TokenType.Length;
staticUnitTable['cm'] = TokenType.Length;
staticUnitTable['mm'] = TokenType.Length;
staticUnitTable['in'] = TokenType.Length;
staticUnitTable['pt'] = TokenType.Length;
staticUnitTable['pc'] = TokenType.Length;
staticUnitTable['deg'] = TokenType.Angle;
staticUnitTable['rad'] = TokenType.Angle;
staticUnitTable['grad'] = TokenType.Angle;
staticUnitTable['ms'] = TokenType.Time;
staticUnitTable['s'] = TokenType.Time;
staticUnitTable['hz'] = TokenType.Freq;
staticUnitTable['khz'] = TokenType.Freq;
staticUnitTable['%'] = TokenType.Percentage;
staticUnitTable['fr'] = TokenType.Percentage;
staticUnitTable['dpi'] = TokenType.Resolution;
staticUnitTable['dpcm'] = TokenType.Resolution;
staticUnitTable['cqw'] = TokenType.ContainerQueryLength;
staticUnitTable['cqh'] = TokenType.ContainerQueryLength;
staticUnitTable['cqi'] = TokenType.ContainerQueryLength;
staticUnitTable['cqb'] = TokenType.ContainerQueryLength;
staticUnitTable['cqmin'] = TokenType.ContainerQueryLength;
staticUnitTable['cqmax'] = TokenType.ContainerQueryLength;

export class Scanner {

	public stream: MultiLineStream = new MultiLineStream('');
	public ignoreComment = true;
	public ignoreWhitespace = true;
	public inURL = false;

	public setSource(input: string): void {
		this.stream = new MultiLineStream(input);
	}

	public finishToken(offset: number, type: TokenType, text?: string): IToken {
		return {
			offset: offset,
			len: this.stream.pos() - offset,
			type: type,
			text: text || this.stream.substring(offset)
		};
	}

	public substring(offset: number, len: number): string {
		return this.stream.substring(offset, offset + len);
	}

	public pos(): number {
		return this.stream.pos();
	}

	public goBackTo(pos: number): void {
		this.stream.goBackTo(pos);
	}

	public scanUnquotedString(): IToken | null {
		const offset = this.stream.pos();
		const content: string[] = [];
		if (this._unquotedString(content)) {
			return this.finishToken(offset, TokenType.UnquotedString, content.join(''));
		}
		return null;
	}

	public scan(): IToken {
		// processes all whitespaces and comments
		const triviaToken = this.trivia();
		if (triviaToken !== null) {
			return triviaToken;
		}

		const offset = this.stream.pos();

		// End of file/input
		if (this.stream.eos()) {
			return this.finishToken(offset, TokenType.EOF);
		}
		return this.scanNext(offset);
	}

	/**
	 * Read the range as described in https://www.w3.org/TR/CSS21/syndata.html#tokenization
	 * Assume the `u` has aleady been consumed
	 * @returns if reading the unicode was successful
	 */
	public tryScanUnicode(): IToken | undefined {
		const offset = this.stream.pos();
		if (!this.stream.eos() && this._unicodeRange()) {
			return this.finishToken(offset, TokenType.UnicodeRange);
		}
		this.stream.goBackTo(offset);
		return undefined;
	}

	protected scanNext(offset: number): IToken {

		// CDO <!--
		if (this.stream.advanceIfChars([_LAN, _BNG, _MIN, _MIN])) {
			return this.finishToken(offset, TokenType.CDO);
		}

		// CDC -->
		if (this.stream.advanceIfChars([_MIN, _MIN, _RAN])) {
			return this.finishToken(offset, TokenType.CDC);
		}

		let content: string[] = [];
		if (this.ident(content)) {
			return this.finishToken(offset, TokenType.Ident, content.join(''));
		}

		// at-keyword
		if (this.stream.advanceIfChar(_ATS)) {
			content = ['@'];
			if (this._name(content)) {
				const keywordText = content.join('');
				if (keywordText === '@charset') {
					return this.finishToken(offset, TokenType.Charset, keywordText);
				}
				return this.finishToken(offset, TokenType.AtKeyword, keywordText);
			} else {
				return this.finishToken(offset, TokenType.Delim);
			}
		}

		// hash
		if (this.stream.advanceIfChar(_HSH)) {
			content = ['#'];
			if (this._name(content)) {
				return this.finishToken(offset, TokenType.Hash, content.join(''));
			} else {
				return this.finishToken(offset, TokenType.Delim);
			}
		}

		// Important
		if (this.stream.advanceIfChar(_BNG)) {
			return this.finishToken(offset, TokenType.Exclamation);
		}

		// Numbers
		if (this._number()) {

			const pos = this.stream.pos();
			content = [this.stream.substring(offset, pos)];
			if (this.stream.advanceIfChar(_PRC)) {
				// Percentage 43%
				return this.finishToken(offset, TokenType.Percentage);
			} else if (this.ident(content)) {
				const dim = this.stream.substring(pos).toLowerCase();
				const tokenType = <TokenType>staticUnitTable[dim];
				if (typeof tokenType !== 'undefined') {
					// Known dimension 43px
					return this.finishToken(offset, tokenType, content.join(''));
				} else {
					// Unknown dimension 43ft
					return this.finishToken(offset, TokenType.Dimension, content.join(''));
				}
			}

			return this.finishToken(offset, TokenType.Num);
		}

		// String, BadString
		content = [];
		let tokenType = this._string(content);
		if (tokenType !== null) {
			return this.finishToken(offset, tokenType, content.join(''));
		}

		// single character tokens
		tokenType = <TokenType>staticTokenTable[this.stream.peekChar()];
		if (typeof tokenType !== 'undefined') {
			this.stream.advance(1);
			return this.finishToken(offset, tokenType);
		}

		// includes ~=
		if (this.stream.peekChar(0) === _TLD && this.stream.peekChar(1) === _EQS) {
			this.stream.advance(2);
			return this.finishToken(offset, TokenType.Includes);
		}

		// DashMatch |=
		if (this.stream.peekChar(0) === _PIP && this.stream.peekChar(1) === _EQS) {
			this.stream.advance(2);
			return this.finishToken(offset, TokenType.Dashmatch);
		}

		// Substring operator *=
		if (this.stream.peekChar(0) === _MUL && this.stream.peekChar(1) === _EQS) {
			this.stream.advance(2);
			return this.finishToken(offset, TokenType.SubstringOperator);
		}

		// Substring operator ^=
		if (this.stream.peekChar(0) === _HAT && this.stream.peekChar(1) === _EQS) {
			this.stream.advance(2);
			return this.finishToken(offset, TokenType.PrefixOperator);
		}

		// Substring operator $=
		if (this.stream.peekChar(0) === _DLR && this.stream.peekChar(1) === _EQS) {
			this.stream.advance(2);
			return this.finishToken(offset, TokenType.SuffixOperator);
		}

		// Delim
		this.stream.nextChar();
		return this.finishToken(offset, TokenType.Delim);
	}

	protected trivia(): IToken | null {
		while (true) {
			const offset = this.stream.pos();
			if (this._whitespace()) {
				if (!this.ignoreWhitespace) {
					return this.finishToken(offset, TokenType.Whitespace);
				}
			} else if (this.comment()) {
				if (!this.ignoreComment) {
					return this.finishToken(offset, TokenType.Comment);
				}
			} else {
				return null;
			}
		}
	}

	protected comment(): boolean {
		if (this.stream.advanceIfChars([_FSL, _MUL])) {
			let success = false, hot = false;
			this.stream.advanceWhileChar((ch) => {
				if (hot && ch === _FSL) {
					success = true;
					return false;
				}
				hot = ch === _MUL;
				return true;
			});
			if (success) {
				this.stream.advance(1);
			}
			return true;
		}

		return false;
	}

	private _number(): boolean {
		let npeek = 0, ch: number;
		if (this.stream.peekChar() === _DOT) {
			npeek = 1;
		}
		ch = this.stream.peekChar(npeek);
		if (ch >= _0 && ch <= _9) {
			this.stream.advance(npeek + 1);
			this.stream.advanceWhileChar((ch) => {
				return ch >= _0 && ch <= _9 || npeek === 0 && ch === _DOT;
			});
			return true;
		}
		return false;
	}

	private _newline(result: string[]): boolean {
		const ch = this.stream.peekChar();
		switch (ch) {
			case _CAR:
			case _LFD:
			case _NWL:
				this.stream.advance(1);
				result.push(String.fromCharCode(ch));
				if (ch === _CAR && this.stream.advanceIfChar(_NWL)) {
					result.push('\n');
				}
				return true;
		}


		return false;
	}

	private _escape(result: string[], includeNewLines?: boolean): boolean {
		let ch = this.stream.peekChar();
		if (ch === _BSL) {
			this.stream.advance(1);
			ch = this.stream.peekChar();
			let hexNumCount = 0;
			while (hexNumCount < 6 && (ch >= _0 && ch <= _9 || ch >= _a && ch <= _f || ch >= _A && ch <= _F)) {
				this.stream.advance(1);
				ch = this.stream.peekChar();
				hexNumCount++;
			}
			if (hexNumCount > 0) {
				try {
					const hexVal = parseInt(this.stream.substring(this.stream.pos() - hexNumCount), 16);
					if (hexVal) {
						result.push(String.fromCharCode(hexVal));
					}
				} catch (e) {
					// ignore
				}

				// optional whitespace or new line, not part of result text
				if (ch === _WSP || ch === _TAB) {
					this.stream.advance(1);
				} else {
					this._newline([]);
				}
				return true;
			}
			if (ch !== _CAR && ch !== _LFD && ch !== _NWL) {
				this.stream.advance(1);
				result.push(String.fromCharCode(ch));
				return true;
			} else if (includeNewLines) {
				return this._newline(result);
			}
		}
		return false;
	}

	private _stringChar(closeQuote: number, result: string[]) {
		// not closeQuote, not backslash, not newline
		const ch = this.stream.peekChar();
		if (ch !== 0 && ch !== closeQuote && ch !== _BSL && ch !== _CAR && ch !== _LFD && ch !== _NWL) {
			this.stream.advance(1);
			result.push(String.fromCharCode(ch));
			return true;
		}
		return false;
	}

	private _string(result: string[]): TokenType | null {
		if (this.stream.peekChar() === _SQO || this.stream.peekChar() === _DQO) {
			const closeQuote = this.stream.nextChar();
			result.push(String.fromCharCode(closeQuote));

			while (this._stringChar(closeQuote, result) || this._escape(result, true)) {
				// loop
			}

			if (this.stream.peekChar() === closeQuote) {
				this.stream.nextChar();
				result.push(String.fromCharCode(closeQuote));
				return TokenType.String;
			} else {
				return TokenType.BadString;
			}
		}
		return null;
	}

	private _unquotedChar(result: string[]): boolean {
		// not closeQuote, not backslash, not newline
		const ch = this.stream.peekChar();
		if (ch !== 0 && ch !== _BSL && ch !== _SQO && ch !== _DQO && ch !== _LPA && ch !== _RPA && ch !== _WSP && ch !== _TAB && ch !== _NWL && ch !== _LFD && ch !== _CAR) {
			this.stream.advance(1);
			result.push(String.fromCharCode(ch));
			return true;
		}
		return false;
	}


	protected _unquotedString(result: string[]): boolean {
		let hasContent = false;
		while (this._unquotedChar(result) || this._escape(result)) {
			hasContent = true;
		}
		return hasContent;
	}

	private _whitespace(): boolean {
		const n = this.stream.advanceWhileChar((ch) => {
			return ch === _WSP || ch === _TAB || ch === _NWL || ch === _LFD || ch === _CAR;
		});
		return n > 0;
	}

	private _name(result: string[]): boolean {
		let matched = false;
		while (this._identChar(result) || this._escape(result)) {
			matched = true;
		}
		return matched;
	}

	protected ident(result: string[]): boolean {
		const pos = this.stream.pos();
		const hasMinus = this._minus(result);
		if (hasMinus) {
			if (this._minus(result) /* -- */ || this._identFirstChar(result) || this._escape(result)) {
				while (this._identChar(result) || this._escape(result)) {
					// loop
				}
				return true;
			}
		} else if (this._identFirstChar(result) || this._escape(result)) {
			while (this._identChar(result) || this._escape(result)) {
				// loop
			}
			return true;
		}
		this.stream.goBackTo(pos);
		return false;
	}

	private _identFirstChar(result: string[]): boolean {
		const ch = this.stream.peekChar();
		if (ch === _USC || // _
			ch >= _a && ch <= _z || // a-z
			ch >= _A && ch <= _Z || // A-Z
			ch >= 0x80 && ch <= 0xFFFF) { // nonascii
			this.stream.advance(1);
			result.push(String.fromCharCode(ch));
			return true;
		}
		return false;
	}


	private _minus(result: string[]): boolean {
		const ch = this.stream.peekChar();
		if (ch === _MIN) {
			this.stream.advance(1);
			result.push(String.fromCharCode(ch));
			return true;
		}
		return false;
	}

	private _identChar(result: string[]): boolean {
		const ch = this.stream.peekChar();
		if (ch === _USC || // _
			ch === _MIN || // -
			ch >= _a && ch <= _z || // a-z
			ch >= _A && ch <= _Z || // A-Z
			ch >= _0 && ch <= _9 || // 0/9
			ch >= 0x80 && ch <= 0xFFFF) { // nonascii
			this.stream.advance(1);
			result.push(String.fromCharCode(ch));
			return true;
		}
		return false;
	}

	private _unicodeRange(): boolean {
		// follow https://www.w3.org/TR/CSS21/syndata.html#tokenization and https://www.w3.org/TR/css-syntax-3/#urange-syntax
		// assume u has already been parsed

		if (this.stream.advanceIfChar(_PLS)) {
			const isHexDigit = (ch: number) => (ch >= _0 && ch <= _9 || ch >= _a && ch <= _f || ch >= _A && ch <= _F);

			const codePoints = this.stream.advanceWhileChar(isHexDigit) + this.stream.advanceWhileChar(ch => ch === _QSM);
			if (codePoints >= 1 && codePoints <= 6) {
				if (this.stream.advanceIfChar(_MIN)) {
					const digits = this.stream.advanceWhileChar(isHexDigit);
					if (digits >= 1 && digits <= 6) {
						return true;
					}
				} else {
					return true;
				}
			}
		}
		return false;
	}
}
