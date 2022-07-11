/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { Range, FormattingOptions, Edit, SyntaxKind, ScanError } from '../main';
import { createScanner } from './scanner';

export function format(documentText: string, range: Range | undefined, options: FormattingOptions): Edit[] {
	let initialIndentLevel: number;
	let formatText: string;
	let formatTextStart: number;
	let rangeStart: number;
	let rangeEnd: number;
	if (range) {
		rangeStart = range.offset;
		rangeEnd = rangeStart + range.length;

		formatTextStart = rangeStart;
		while (formatTextStart > 0 && !isEOL(documentText, formatTextStart - 1)) {
			formatTextStart--;
		}
		let endOffset = rangeEnd;
		while (endOffset < documentText.length && !isEOL(documentText, endOffset)) {
			endOffset++;
		}
		formatText = documentText.substring(formatTextStart, endOffset);
		initialIndentLevel = computeIndentLevel(formatText, options);
	} else {
		formatText = documentText;
		initialIndentLevel = 0;
		formatTextStart = 0;
		rangeStart = 0;
		rangeEnd = documentText.length;
	}
	const eol = getEOL(options, documentText);

	let numberLineBreaks = 0;

	let indentLevel = 0;
	let indentValue: string;
	if (options.insertSpaces) {
		indentValue = repeat(' ', options.tabSize || 4);
	} else {
		indentValue = '\t';
	}

	let scanner = createScanner(formatText, false);
	let hasError = false;

	function newLinesAndIndent(): string {
		if (numberLineBreaks > 1) {
			return repeat(eol, numberLineBreaks) + repeat(indentValue, initialIndentLevel + indentLevel);
		} else {
			return eol + repeat(indentValue, initialIndentLevel + indentLevel);
		}
	}

	function scanNext(): SyntaxKind {
		let token = scanner.scan();
		numberLineBreaks = 0;

		while (token === SyntaxKind.Trivia || token === SyntaxKind.LineBreakTrivia) {
			if (token === SyntaxKind.LineBreakTrivia && options.keepLines) {
				numberLineBreaks += 1;
			} else if (token === SyntaxKind.LineBreakTrivia) {
				numberLineBreaks = 1;
			}
			token = scanner.scan();
		}
		hasError = token === SyntaxKind.Unknown || scanner.getTokenError() !== ScanError.None;
		return token;
	}
	const editOperations: Edit[] = [];
	function addEdit(text: string, startOffset: number, endOffset: number) {
		if (!hasError && (!range || (startOffset < rangeEnd && endOffset > rangeStart)) && documentText.substring(startOffset, endOffset) !== text) {
			editOperations.push({ offset: startOffset, length: endOffset - startOffset, content: text });
		}
	}

	let firstToken = scanNext();
	if (options.keepLines && numberLineBreaks > 0) {
		addEdit(repeat(eol, numberLineBreaks), 0, 0);
	}

	if (firstToken !== SyntaxKind.EOF) {
		let firstTokenStart = scanner.getTokenOffset() + formatTextStart;
		let initialIndent = repeat(indentValue, initialIndentLevel);
		addEdit(initialIndent, formatTextStart, firstTokenStart);
	}

	while (firstToken !== SyntaxKind.EOF) {

		let firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
		let secondToken = scanNext();
		let replaceContent = '';
		let needsLineBreak = false;

		while (numberLineBreaks === 0 && (secondToken === SyntaxKind.LineCommentTrivia || secondToken === SyntaxKind.BlockCommentTrivia)) {
			let commentTokenStart = scanner.getTokenOffset() + formatTextStart;
			addEdit(' ', firstTokenEnd, commentTokenStart);
			firstTokenEnd = scanner.getTokenOffset() + scanner.getTokenLength() + formatTextStart;
			needsLineBreak = secondToken === SyntaxKind.LineCommentTrivia;
			replaceContent = needsLineBreak ? newLinesAndIndent() : '';
			secondToken = scanNext();
		}

		if (secondToken === SyntaxKind.CloseBraceToken) {
			if (firstToken !== SyntaxKind.OpenBraceToken) { indentLevel--; };

			if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== SyntaxKind.OpenBraceToken) {
				replaceContent = newLinesAndIndent();
			} else if (options.keepLines) {
				replaceContent = ' ';
			}
		} else if (secondToken === SyntaxKind.CloseBracketToken) {
			if (firstToken !== SyntaxKind.OpenBracketToken) { indentLevel--; };

			if (options.keepLines && numberLineBreaks > 0 || !options.keepLines && firstToken !== SyntaxKind.OpenBracketToken) {
				replaceContent = newLinesAndIndent();
			} else if (options.keepLines) {
				replaceContent = ' ';
			}
		} else {
			switch (firstToken) {
				case SyntaxKind.OpenBracketToken:
				case SyntaxKind.OpenBraceToken:
					indentLevel++;
					if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
						replaceContent = newLinesAndIndent();
					} else {
						replaceContent = ' ';
					}
					break;
				case SyntaxKind.CommaToken:
					if (options.keepLines && numberLineBreaks > 0 || !options.keepLines) {
						replaceContent = newLinesAndIndent();
					} else {
						replaceContent = ' ';
					}
					break;
				case SyntaxKind.LineCommentTrivia:
					replaceContent = newLinesAndIndent();
					break;
				case SyntaxKind.BlockCommentTrivia:
					if (numberLineBreaks > 0) {
						replaceContent = newLinesAndIndent();
					} else if (!needsLineBreak) {
						replaceContent = ' ';
					}
					break;
				case SyntaxKind.ColonToken:
					if (options.keepLines && numberLineBreaks > 0) {
						replaceContent = newLinesAndIndent();
					} else if (!needsLineBreak) {
						replaceContent = ' ';
					}
					break;
				case SyntaxKind.StringLiteral:
					if (options.keepLines && numberLineBreaks > 0) {
						replaceContent = newLinesAndIndent();
					} else if (secondToken === SyntaxKind.ColonToken && !needsLineBreak) {
						replaceContent = '';
					}
					break;
				case SyntaxKind.NullKeyword:
				case SyntaxKind.TrueKeyword:
				case SyntaxKind.FalseKeyword:
				case SyntaxKind.NumericLiteral:
				case SyntaxKind.CloseBraceToken:
				case SyntaxKind.CloseBracketToken:
					if (options.keepLines && numberLineBreaks > 0) {
						replaceContent = newLinesAndIndent();
					} else {
						if ((secondToken === SyntaxKind.LineCommentTrivia || secondToken === SyntaxKind.BlockCommentTrivia) && !needsLineBreak) {
							replaceContent = ' ';
						} else if (secondToken !== SyntaxKind.CommaToken && secondToken !== SyntaxKind.EOF) {
							hasError = true;
						}
					}
					break;
				case SyntaxKind.Unknown:
					hasError = true;
					break;
			}
			if (numberLineBreaks > 0 && (secondToken === SyntaxKind.LineCommentTrivia || secondToken === SyntaxKind.BlockCommentTrivia)) {
				replaceContent = newLinesAndIndent();
			}
		}
		if (secondToken === SyntaxKind.EOF) {
			if (options.keepLines && numberLineBreaks > 0) {
				replaceContent = newLinesAndIndent();
			} else {
				replaceContent = options.insertFinalNewline ? eol : '';
			}
		}
		const secondTokenStart = scanner.getTokenOffset() + formatTextStart;
		addEdit(replaceContent, firstTokenEnd, secondTokenStart);
		firstToken = secondToken;
	}
	return editOperations;
}

function repeat(s: string, count: number): string {
	let result = '';
	for (let i = 0; i < count; i++) {
		result += s;
	}
	return result;
}

function computeIndentLevel(content: string, options: FormattingOptions): number {
	let i = 0;
	let nChars = 0;
	const tabSize = options.tabSize || 4;
	while (i < content.length) {
		let ch = content.charAt(i);
		if (ch === ' ') {
			nChars++;
		} else if (ch === '\t') {
			nChars += tabSize;
		} else {
			break;
		}
		i++;
	}
	return Math.floor(nChars / tabSize);
}

function getEOL(options: FormattingOptions, text: string): string {
	for (let i = 0; i < text.length; i++) {
		const ch = text.charAt(i);
		if (ch === '\r') {
			if (i + 1 < text.length && text.charAt(i + 1) === '\n') {
				return '\r\n';
			}
			return '\r';
		} else if (ch === '\n') {
			return '\n';
		}
	}
	return (options && options.eol) || '\n';
}

export function isEOL(text: string, offset: number) {
	return '\r\n'.indexOf(text.charAt(offset)) !== -1;
}
