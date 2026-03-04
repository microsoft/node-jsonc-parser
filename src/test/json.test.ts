/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { suite, test } from 'mocha';
import {
	SyntaxKind, createScanner, parse, getLocation, Node, ParseError, parseTree, ParseErrorCode,
	ParseOptions, Segment, findNodeAtLocation, getNodeValue, getNodePath, ScanError, visit, JSONVisitor, JSONPath
} from '../main';

function assertKinds(text: string, ...kinds: SyntaxKind[]): void {
	var scanner = createScanner(text);
	var kind: SyntaxKind;
	while ((kind = scanner.scan()) !== SyntaxKind.EOF) {
		assert.strictEqual(kind, kinds.shift());
		assert.strictEqual(scanner.getTokenError(), ScanError.None, text);
	}
	assert.strictEqual(kinds.length, 0);
}
function assertScanError(text: string, scanError: ScanError, ...kinds: SyntaxKind[]): void {
	var scanner = createScanner(text);
	scanner.scan();
	assert.strictEqual(scanner.getToken(), kinds.shift());
	assert.strictEqual(scanner.getTokenError(), scanError);
	var kind: SyntaxKind;
	while ((kind = scanner.scan()) !== SyntaxKind.EOF) {
		assert.strictEqual(kind, kinds.shift());
	}
	assert.strictEqual(kinds.length, 0);
}

function assertValidParse(input: string, expected: any, options?: ParseOptions): void {
	var errors: ParseError[] = [];
	var actual = parse(input, errors, options);

	assert.deepStrictEqual([], errors);
	assert.deepStrictEqual(actual, expected);
}

function assertInvalidParse(input: string, expected: any, options?: ParseOptions): void {
	var errors: ParseError[] = [];
	var actual = parse(input, errors, options);

	assert(errors.length > 0);
	assert.deepStrictEqual(actual, expected);
}

function assertTree(input: string, expected: any, expectedErrors: ParseError[] = [], options?: ParseOptions): void {
	var errors: ParseError[] = [];
	var actual = parseTree(input, errors, options);

	assert.deepStrictEqual(errors, expectedErrors);
	let checkParent = (node: Node | undefined) => {
		if (node?.children) {
			for (let child of node.children) {
				assert.strictEqual(node, child.parent);
				delete (<any>child).parent; // delete to avoid recursion in deep equal
				checkParent(child);
			}
		}
	};
	checkParent(actual);

	assert.deepStrictEqual(actual, expected, JSON.stringify(actual));
}

interface VisitorCallback {
	id: keyof JSONVisitor,
	text: string;
	startLine: number;
	startCharacter: number;
	arg?: any;
	path?: JSONPath;
}
interface VisitorError extends ParseError {
	startLine: number;
	startCharacter: number;
}

function assertVisit(input: string, expected: VisitorCallback[], expectedErrors: VisitorError[] = [], disallowComments = false, stopOffsets?: number[]): void {
	let errors: VisitorError[] = [];
	let actuals: VisitorCallback[] = [];
	let noArgHandler = (id: keyof JSONVisitor) => (offset: number, length: number, startLine: number, startCharacter: number) => actuals.push({ id, text: input.substr(offset, length), startLine, startCharacter });
	let oneArgHandler = (id: keyof JSONVisitor) => (arg: any, offset: number, length: number, startLine: number, startCharacter: number) => actuals.push({ id, text: input.substr(offset, length), startLine, startCharacter, arg });
	let oneArgHandlerWithPath = (id: keyof JSONVisitor) => (arg: any, offset: number, length: number, startLine: number, startCharacter: number, pathSupplier: () => JSONPath) => actuals.push({ id, text: input.substr(offset, length), startLine, startCharacter, arg, path: pathSupplier() });
	let beginHandler = (id: keyof JSONVisitor) => (offset: number, length: number, startLine: number, startCharacter: number, pathSupplier: () => JSONPath) => { actuals.push({ id, text: input.substr(offset, length), startLine, startCharacter, path: pathSupplier() }); return !stopOffsets || (stopOffsets.indexOf(offset) === -1); };
	visit(input, {
		onObjectBegin: beginHandler('onObjectBegin'),
		onObjectProperty: oneArgHandlerWithPath('onObjectProperty'),
		onObjectEnd: noArgHandler('onObjectEnd'),
		onArrayBegin: beginHandler('onArrayBegin'),
		onArrayEnd: noArgHandler('onArrayEnd'),
		onLiteralValue: oneArgHandlerWithPath('onLiteralValue'),
		onSeparator: oneArgHandler('onSeparator'),
		onComment: noArgHandler('onComment'),
		onError: (error: ParseErrorCode, offset: number, length: number, startLine: number, startCharacter: number) => {
			errors.push({ error, offset, length, startLine, startCharacter });
		}
	}, {
		disallowComments
	});
	assert.deepStrictEqual(errors, expectedErrors);
	assert.deepStrictEqual(actuals, expected, JSON.stringify(actuals));
}

function assertNodeAtLocation(input: Node | undefined, segments: Segment[], expected: any) {
	let actual = input && findNodeAtLocation(input, segments);
	assert.deepEqual(actual ? getNodeValue(actual) : void 0, expected);
	if (actual) {
		assert.deepStrictEqual(getNodePath(actual), segments);
	}
}

function assertLocation(input: string, expectedSegments: Segment[], expectedNodeType: string | undefined, expectedCompleteProperty: boolean): void {
	var offset = input.indexOf('|');
	input = input.substring(0, offset) + input.substring(offset + 1, input.length);
	var actual = getLocation(input, offset);
	assert(actual);
	assert.deepStrictEqual(actual.path, expectedSegments, input);
	assert.strictEqual(actual.previousNode && actual.previousNode.type, expectedNodeType, input);
	assert.strictEqual(actual.isAtPropertyKey, expectedCompleteProperty, input);
}

function assertMatchesLocation(input: string, matchingSegments: Segment[], expectedResult = true): void {
	var offset = input.indexOf('|');
	input = input.substring(0, offset) + input.substring(offset + 1, input.length);
	var actual = getLocation(input, offset);
	assert(actual);
	assert.strictEqual(actual.matches(matchingSegments), expectedResult);
}

suite('JSON', () => {
	test('tokens', () => {
		assertKinds('{', SyntaxKind.OpenBraceToken);
		assertKinds('}', SyntaxKind.CloseBraceToken);
		assertKinds('[', SyntaxKind.OpenBracketToken);
		assertKinds(']', SyntaxKind.CloseBracketToken);
		assertKinds(':', SyntaxKind.ColonToken);
		assertKinds(',', SyntaxKind.CommaToken);
	});

	test('comments', () => {
		assertKinds('// this is a comment', SyntaxKind.LineCommentTrivia);
		assertKinds('// this is a comment\n', SyntaxKind.LineCommentTrivia, SyntaxKind.LineBreakTrivia);
		assertKinds('/* this is a comment*/', SyntaxKind.BlockCommentTrivia);
		assertKinds('/* this is a \r\ncomment*/', SyntaxKind.BlockCommentTrivia);
		assertKinds('/* this is a \ncomment*/', SyntaxKind.BlockCommentTrivia);

		// unexpected end
		assertScanError('/* this is a', ScanError.UnexpectedEndOfComment, SyntaxKind.BlockCommentTrivia);
		assertScanError('/* this is a \ncomment', ScanError.UnexpectedEndOfComment, SyntaxKind.BlockCommentTrivia);

		// broken comment
		assertKinds('/ ttt', SyntaxKind.Unknown, SyntaxKind.Trivia, SyntaxKind.Unknown);
	});

	test('strings', () => {
		assertKinds('"test"', SyntaxKind.StringLiteral);
		assertKinds('"\\""', SyntaxKind.StringLiteral);
		assertKinds('"\\/"', SyntaxKind.StringLiteral);
		assertKinds('"\\b"', SyntaxKind.StringLiteral);
		assertKinds('"\\f"', SyntaxKind.StringLiteral);
		assertKinds('"\\n"', SyntaxKind.StringLiteral);
		assertKinds('"\\r"', SyntaxKind.StringLiteral);
		assertKinds('"\\t"', SyntaxKind.StringLiteral);
		assertKinds('"\u88ff"', SyntaxKind.StringLiteral);
		assertKinds('"​\u2028"', SyntaxKind.StringLiteral);
		assertScanError('"\\v"', ScanError.InvalidEscapeCharacter, SyntaxKind.StringLiteral);

		// unexpected end
		assertScanError('"test', ScanError.UnexpectedEndOfString, SyntaxKind.StringLiteral);
		assertScanError('"test\n"', ScanError.UnexpectedEndOfString, SyntaxKind.StringLiteral, SyntaxKind.LineBreakTrivia, SyntaxKind.StringLiteral);

		// invalid characters
		assertScanError('"\t"', ScanError.InvalidCharacter, SyntaxKind.StringLiteral);
		assertScanError('"\t "', ScanError.InvalidCharacter, SyntaxKind.StringLiteral);
		assertScanError('"\0 "', ScanError.InvalidCharacter, SyntaxKind.StringLiteral);
	});

	test('numbers', () => {
		assertKinds('0', SyntaxKind.NumericLiteral);
		assertKinds('0.1', SyntaxKind.NumericLiteral);
		assertKinds('-0.1', SyntaxKind.NumericLiteral);
		assertKinds('-1', SyntaxKind.NumericLiteral);
		assertKinds('1', SyntaxKind.NumericLiteral);
		assertKinds('123456789', SyntaxKind.NumericLiteral);
		assertKinds('10', SyntaxKind.NumericLiteral);
		assertKinds('90', SyntaxKind.NumericLiteral);
		assertKinds('90E+123', SyntaxKind.NumericLiteral);
		assertKinds('90e+123', SyntaxKind.NumericLiteral);
		assertKinds('90e-123', SyntaxKind.NumericLiteral);
		assertKinds('90E-123', SyntaxKind.NumericLiteral);
		assertKinds('90E123', SyntaxKind.NumericLiteral);
		assertKinds('90e123', SyntaxKind.NumericLiteral);

		// zero handling
		assertKinds('01', SyntaxKind.NumericLiteral, SyntaxKind.NumericLiteral);
		assertKinds('-01', SyntaxKind.NumericLiteral, SyntaxKind.NumericLiteral);

		// unexpected end
		assertKinds('-', SyntaxKind.Unknown);
		assertKinds('.0', SyntaxKind.Unknown);
	});

	test('keywords: true, false, null', () => {
		assertKinds('true', SyntaxKind.TrueKeyword);
		assertKinds('false', SyntaxKind.FalseKeyword);
		assertKinds('null', SyntaxKind.NullKeyword);


		assertKinds('true false null',
			SyntaxKind.TrueKeyword,
			SyntaxKind.Trivia,
			SyntaxKind.FalseKeyword,
			SyntaxKind.Trivia,
			SyntaxKind.NullKeyword);

		// invalid words
		assertKinds('nulllll', SyntaxKind.Unknown);
		assertKinds('True', SyntaxKind.Unknown);
		assertKinds('foo-bar', SyntaxKind.Unknown);
		assertKinds('foo bar', SyntaxKind.Unknown, SyntaxKind.Trivia, SyntaxKind.Unknown);

		assertKinds('false//hello', SyntaxKind.FalseKeyword, SyntaxKind.LineCommentTrivia);
	});

	test('trivia', () => {
		assertKinds(' ', SyntaxKind.Trivia);
		assertKinds('  \t  ', SyntaxKind.Trivia);
		assertKinds('  \t  \n  \t  ', SyntaxKind.Trivia, SyntaxKind.LineBreakTrivia, SyntaxKind.Trivia);
		assertKinds('\r\n', SyntaxKind.LineBreakTrivia);
		assertKinds('\r', SyntaxKind.LineBreakTrivia);
		assertKinds('\n', SyntaxKind.LineBreakTrivia);
		assertKinds('\n\r', SyntaxKind.LineBreakTrivia, SyntaxKind.LineBreakTrivia);
		assertKinds('\n   \n', SyntaxKind.LineBreakTrivia, SyntaxKind.Trivia, SyntaxKind.LineBreakTrivia);
	});

	test('parse: literals', () => {

		assertValidParse('true', true);
		assertValidParse('false', false);
		assertValidParse('null', null);
		assertValidParse('"foo"', 'foo');
		assertValidParse('"\\"-\\\\-\\/-\\b-\\f-\\n-\\r-\\t"', '"-\\-/-\b-\f-\n-\r-\t');
		assertValidParse('"\\u00DC"', 'Ü');
		assertValidParse('9', 9);
		assertValidParse('-9', -9);
		assertValidParse('0.129', 0.129);
		assertValidParse('23e3', 23e3);
		assertValidParse('1.2E+3', 1.2E+3);
		assertValidParse('1.2E-3', 1.2E-3);
		assertValidParse('1.2E-3 // comment', 1.2E-3);
	});

	test('parse: objects', () => {
		assertValidParse('{}', {});
		assertValidParse('{ "foo": true }', { foo: true });
		assertValidParse('{ "bar": 8, "xoo": "foo" }', { bar: 8, xoo: 'foo' });
		assertValidParse('{ "hello": [], "world": {} }', { hello: [], world: {} });
		assertValidParse('{ "a": false, "b": true, "c": [ 7.4 ] }', { a: false, b: true, c: [7.4] });
		assertValidParse('{ "lineComment": "//", "blockComment": ["/*", "*/"], "brackets": [ ["{", "}"], ["[", "]"], ["(", ")"] ] }', { lineComment: '//', blockComment: ['/*', '*/'], brackets: [['{', '}'], ['[', ']'], ['(', ')']] });
		assertValidParse('{ "hello": [], "world": {} }', { hello: [], world: {} });
		assertValidParse('{ "hello": { "again": { "inside": 5 }, "world": 1 }}', { hello: { again: { inside: 5 }, world: 1 } });
		assertValidParse('{ "foo": /*hello*/true }', { foo: true });
		assertValidParse('{ "": true }', { '': true });
	});

	test('parse: arrays', () => {
		assertValidParse('[]', []);
		assertValidParse('[ [],  [ [] ]]', [[], [[]]]);
		assertValidParse('[ 1, 2, 3 ]', [1, 2, 3]);
		assertValidParse('[ { "a": null } ]', [{ a: null }]);
	});

	test('parse: objects with errors with no trailing comma', () => {
        let options = { allowTrailingComma: false };
        assertInvalidParse('{ "foo": true, }', { foo: true }, options);
        assertInvalidParse('{ "hello": [], }', { hello: [] }, options);
        assertInvalidParse('{ "hello": [], "world": {}, }', { hello: [], world: {} }, options);
        assertInvalidParse('[ 1, 2, ]', [1, 2], options);
    });

    test('parse objects with errors', () => {
		assertInvalidParse('{,}', {});
		assertInvalidParse('{ "bar": 8 "xoo": "foo" }', { bar: 8, xoo: 'foo' });
		assertInvalidParse('{ ,"bar": 8 }', { bar: 8 });
		assertInvalidParse('{ ,"bar": 8, "foo" }', { bar: 8 });
		assertInvalidParse('{ "bar": 8, "foo": }', { bar: 8 });
		assertInvalidParse('{ 8, "foo": 9 }', { foo: 9 });
	});

	test('parse: array with errors', () => {
		assertInvalidParse('[,]', []);
		assertInvalidParse('[ 1 2, 3 ]', [1, 2, 3]);
		assertInvalidParse('[ ,1, 2, 3 ]', [1, 2, 3]);
		assertInvalidParse('[ ,1, 2, 3, ]', [1, 2, 3]);
	});

	test('parse: errors', () => {
		assertInvalidParse('', undefined);
		assertInvalidParse('1,1', 1);
	});

	test('parse: disallow comments', () => {
		let options = { disallowComments: true };

		assertValidParse('[ 1, 2, null, "foo" ]', [1, 2, null, 'foo'], options);
		assertValidParse('{ "hello": [], "world": {} }', { hello: [], world: {} }, options);

		assertInvalidParse('{ "foo": /*comment*/ true }', { foo: true }, options);
	});

	test('parse: trailing comma', () => {
		assertValidParse('{ "hello": [], }', { hello: [] });
		assertValidParse('{ "hello": [] }', { hello: [] });
		assertValidParse('{ "hello": [], "world": {}, }', { hello: [], world: {} });
		assertValidParse('{ "hello": [], "world": {} }', { hello: [], world: {} });
		assertValidParse('[ 1, 2, ]', [1, 2]);
		assertValidParse('[ 1, 2 ]', [1, 2]);
	});
	test('location: properties', () => {
		assertLocation('|{ "foo": "bar" }', [], void 0, false);
		assertLocation('{| "foo": "bar" }', [''], void 0, true);
		assertLocation('{ |"foo": "bar" }', ['foo'], 'property', true);
		assertLocation('{ "foo|": "bar" }', ['foo'], 'property', true);
		assertLocation('{ "foo"|: "bar" }', ['foo'], 'property', true);
		assertLocation('{ "foo": "bar"| }', ['foo'], 'string', false);
		assertLocation('{ "foo":| "bar" }', ['foo'], void 0, false);
		assertLocation('{ "foo": {"bar|": 1, "car": 2 } }', ['foo', 'bar'], 'property', true);
		assertLocation('{ "foo": {"bar": 1|, "car": 3 } }', ['foo', 'bar'], 'number', false);
		assertLocation('{ "foo": {"bar": 1,| "car": 4 } }', ['foo', ''], void 0, true);
		assertLocation('{ "foo": {"bar": 1, "ca|r": 5 } }', ['foo', 'car'], 'property', true);
		assertLocation('{ "foo": {"bar": 1, "car": 6| } }', ['foo', 'car'], 'number', false);
		assertLocation('{ "foo": {"bar": 1, "car": 7 }| }', ['foo'], void 0, false);
		assertLocation('{ "foo": {"bar": 1, "car": 8 },| "goo": {} }', [''], void 0, true);
		assertLocation('{ "foo": {"bar": 1, "car": 9 }, "go|o": {} }', ['goo'], 'property', true);
		assertLocation('{ "dep": {"bar": 1, "car": |', ['dep', 'car'], void 0, false);
		assertLocation('{ "dep": {"bar": 1,, "car": |', ['dep', 'car'], void 0, false);
		assertLocation('{ "dep": {"bar": "na", "dar": "ma", "car": | } }', ['dep', 'car'], void 0, false);
	});

	test('location: arrays', () => {
		assertLocation('|["foo", null ]', [], void 0, false);
		assertLocation('[|"foo", null ]', [0], 'string', false);
		assertLocation('["foo"|, null ]', [0], 'string', false);
		assertLocation('["foo",| null ]', [1], void 0, false);
		assertLocation('["foo", |null ]', [1], 'null', false);
		assertLocation('["foo", null,| ]', [2], void 0, false);
		assertLocation('["foo", null,,| ]', [3], void 0, false);
		assertLocation('[["foo", null,, ],|', [1], void 0, false);
	});

	test('tree: literals', () => {
		assertTree('true', { type: 'boolean', offset: 0, length: 4, value: true });
		assertTree('false', { type: 'boolean', offset: 0, length: 5, value: false });
		assertTree('null', { type: 'null', offset: 0, length: 4, value: null });
		assertTree('23', { type: 'number', offset: 0, length: 2, value: 23 });
		assertTree('-1.93e-19', { type: 'number', offset: 0, length: 9, value: -1.93e-19 });
		assertTree('"hello"', { type: 'string', offset: 0, length: 7, value: 'hello' });
	});

	test('tree: arrays', () => {
		assertTree('[]', { type: 'array', offset: 0, length: 2, children: [] });
		assertTree('[ 1 ]', { type: 'array', offset: 0, length: 5, children: [{ type: 'number', offset: 2, length: 1, value: 1 }] });
		assertTree('[ 1,"x"]', {
			type: 'array', offset: 0, length: 8, children: [
				{ type: 'number', offset: 2, length: 1, value: 1 },
				{ type: 'string', offset: 4, length: 3, value: 'x' }
			]
		});
		assertTree('[[]]', {
			type: 'array', offset: 0, length: 4, children: [
				{ type: 'array', offset: 1, length: 2, children: [] }
			]
		});
	});

	test('tree: objects', () => {
		assertTree('{ }', { type: 'object', offset: 0, length: 3, children: [] });
		assertTree('{ "val": 1 }', {
			type: 'object', offset: 0, length: 12, children: [
				{
					type: 'property', offset: 2, length: 8, colonOffset: 7, children: [
						{ type: 'string', offset: 2, length: 5, value: 'val' },
						{ type: 'number', offset: 9, length: 1, value: 1 }
					]
				}
			]
		});
		assertTree('{"id": "$", "v": [ null, null] }',
			{
				type: 'object', offset: 0, length: 32, children: [
					{
						type: 'property', offset: 1, length: 9, colonOffset: 5, children: [
							{ type: 'string', offset: 1, length: 4, value: 'id' },
							{ type: 'string', offset: 7, length: 3, value: '$' }
						]
					},
					{
						type: 'property', offset: 12, length: 18, colonOffset: 15, children: [
							{ type: 'string', offset: 12, length: 3, value: 'v' },
							{
								type: 'array', offset: 17, length: 13, children: [
									{ type: 'null', offset: 19, length: 4, value: null },
									{ type: 'null', offset: 25, length: 4, value: null }
								]
							}
						]
					}
				]
			}
		);
		assertTree('{  "id": { "foo": { } } , }',
			{
				type: 'object', offset: 0, length: 27, children: [
					{
						type: 'property', offset: 3, length: 20, colonOffset: 7, children: [
							{ type: 'string', offset: 3, length: 4, value: 'id' },
							{
								type: 'object', offset: 9, length: 14, children: [
									{
										type: 'property', offset: 11, length: 10, colonOffset: 16, children: [
											{ type: 'string', offset: 11, length: 5, value: 'foo' },
											{ type: 'object', offset: 18, length: 3, children: [] }
										]
									}
								]
							}
						]
					}
				]
			}, [
			{ error: ParseErrorCode.PropertyNameExpected, offset: 26, length: 1, startLine: 0, startCharacter: 26 },
			{ error: ParseErrorCode.ValueExpected, offset: 26, length: 1, startLine: 0, startCharacter: 26 },
		], { allowTrailingComma: false });
	});

	test('visit: object', () => {
		assertVisit('{ }', [
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 2 },
		]);
		assertVisit('{ "foo": "bar" }', [
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onObjectProperty', text: '"foo"', startLine: 0, startCharacter: 2, arg: 'foo', path: [] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 7, arg: ':' },
			{ id: 'onLiteralValue', text: '"bar"', startLine: 0, startCharacter: 9, arg: 'bar', path: ['foo'] },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 15 },
		]);
		assertVisit('{ "foo": { "goo": 3 } }', [
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onObjectProperty', text: '"foo"', startLine: 0, startCharacter: 2, arg: 'foo', path: [] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 7, arg: ':' },
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 9, path: ['foo'] },
			{ id: 'onObjectProperty', text: '"goo"', startLine: 0, startCharacter: 11, arg: 'goo', path: ['foo'] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 16, arg: ':' },
			{ id: 'onLiteralValue', text: '3', startLine: 0, startCharacter: 18, arg: 3, path: ['foo', 'goo'] },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 20 },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 22 },
		]);
		assertVisit('{ "foo": "bar", "a": {"b": "c"} }', [
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 32 },
		], [], false, [0]);
		assertVisit('{ "a": { "b": "c", "d": { "e": "f" } } }', [
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onObjectProperty', text: '"a"', startLine: 0, startCharacter: 2, arg: 'a', path: [] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 5, arg: ':' },
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 7, path: ['a'] },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 37 },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 39 }
		], [], true, [7]);
	});

	test('visit: array', () => {
		assertVisit('[]', [
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 1 },
		]);
		assertVisit('[ true, null, [] ]', [
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onLiteralValue', text: 'true', startLine: 0, startCharacter: 2, arg: true, path: [0] },
			{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 6, arg: ',' },
			{ id: 'onLiteralValue', text: 'null', startLine: 0, startCharacter: 8, arg: null, path: [1] },
			{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 12, arg: ',' },
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 14, path: [2] },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 15 },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 17 },
		]);
		assertVisit('[\r\n0,\r\n1,\r\n2\r\n]', [
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onLiteralValue', text: '0', startLine: 1, startCharacter: 0, arg: 0, path: [0] },
			{ id: 'onSeparator', text: ',', startLine: 1, startCharacter: 1, arg: ',' },
			{ id: 'onLiteralValue', text: '1', startLine: 2, startCharacter: 0, arg: 1, path: [1] },
			{ id: 'onSeparator', text: ',', startLine: 2, startCharacter: 1, arg: ',' },
			{ id: 'onLiteralValue', text: '2', startLine: 3, startCharacter: 0, arg: 2, path: [2] },
			{ id: 'onArrayEnd', text: ']', startLine: 4, startCharacter: 0 },
		]);
	});

	test('visit: object & array', () => {
		assertVisit('[ { "p1": [ { "p11": 1, "p12": [ true, [ false, 2 ] ] } ] } ]', [
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 2, path: [0] },
			{ id: 'onObjectProperty', text: '"p1"', startLine: 0, startCharacter: 4, arg: 'p1', path: [0] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 8, arg: ':' },
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 10, path: [0, 'p1'] },
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 12, path: [0, 'p1', 0] },
			{ id: 'onObjectProperty', text: '"p11"', startLine: 0, startCharacter: 14, arg: 'p11', path: [0, 'p1', 0] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 19, arg: ':' },
			{ id: 'onLiteralValue', text: '1', startLine: 0, startCharacter: 21, arg: 1, path: [0, 'p1', 0, 'p11'] },
			{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 22, arg: ',' },
			{ id: 'onObjectProperty', text: '"p12"', startLine: 0, startCharacter: 24, arg: 'p12', path: [0, 'p1', 0] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 29, arg: ':' },
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 31, path: [0, 'p1', 0, 'p12'] },
			{ id: 'onLiteralValue', text: 'true', startLine: 0, startCharacter: 33, arg: true, path: [0, 'p1', 0, 'p12', 0] },
			{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 37, arg: ',' },
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 39, path: [0, 'p1', 0, 'p12', 1] },
			{ id: 'onLiteralValue', text: 'false', startLine: 0, startCharacter: 41, arg: false, path: [0, 'p1', 0, 'p12', 1, 0] },
			{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 46, arg: ',' },
			{ id: 'onLiteralValue', text: '2', startLine: 0, startCharacter: 48, arg: 2, path: [0, 'p1', 0, 'p12', 1, 1] },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 50 },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 52 },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 54 },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 56 },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 58 },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 60 },
		]);
		assertVisit('{ "foo": [ { "a": "b", "c:": "d", "d": { "e": "f" } } ] }', [
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 0, path: [] },
			{ id: 'onObjectProperty', text: '"foo"', startLine: 0, startCharacter: 2, arg: 'foo', path: [] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 7, arg: ':' },
			{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 9, path: ['foo'] },
			{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 54 },
			{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 56 }
		], [], true, [9]);
	});

	test('visit: comment', () => {
		assertVisit('/* g */ { "foo": //f\n"bar" }', [
			{ id: 'onComment', text: '/* g */', startLine: 0, startCharacter: 0 },
			{ id: 'onObjectBegin', text: '{', startLine: 0, startCharacter: 8, path: [] },
			{ id: 'onObjectProperty', text: '"foo"', startLine: 0, startCharacter: 10, arg: 'foo', path: [] },
			{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 15, arg: ':' },
			{ id: 'onComment', text: '//f', startLine: 0, startCharacter: 17 },
			{ id: 'onLiteralValue', text: '"bar"', startLine: 1, startCharacter: 0, arg: 'bar', path: ['foo'] },
			{ id: 'onObjectEnd', text: '}', startLine: 1, startCharacter: 6 },
		]);
		assertVisit('/* g\r\n */ { "foo": //f\n"bar" }', [
			{ id: 'onComment', text: '/* g\r\n */', startLine: 0, startCharacter: 0 },
			{ id: 'onObjectBegin', text: '{', startLine: 1, startCharacter: 4, path: [] },
			{ id: 'onObjectProperty', text: '"foo"', startLine: 1, startCharacter: 6, arg: 'foo', path: [] },
			{ id: 'onSeparator', text: ':', startLine: 1, startCharacter: 11, arg: ':' },
			{ id: 'onComment', text: '//f', startLine: 1, startCharacter: 13 },
			{ id: 'onLiteralValue', text: '"bar"', startLine: 2, startCharacter: 0, arg: 'bar', path: ['foo'] },
			{ id: 'onObjectEnd', text: '}', startLine: 2, startCharacter: 6 },
		]);
		assertVisit('/* g\n */ { "foo": //f\n"bar"\n}',
			[
				{ id: 'onObjectBegin', text: '{', startLine: 1, startCharacter: 4, path: [] },
				{ id: 'onObjectProperty', text: '"foo"', startLine: 1, startCharacter: 6, arg: 'foo', path: [] },
				{ id: 'onSeparator', text: ':', startLine: 1, startCharacter: 11, arg: ':' },
				{ id: 'onLiteralValue', text: '"bar"', startLine: 2, startCharacter: 0, arg: 'bar', path: ['foo'] },
				{ id: 'onObjectEnd', text: '}', startLine: 3, startCharacter: 0 },
			],
			[
				{ error: ParseErrorCode.InvalidCommentToken, offset: 0, length: 8, startLine: 0, startCharacter: 0 },
				{ error: ParseErrorCode.InvalidCommentToken, offset: 18, length: 3, startLine: 1, startCharacter: 13 },
			],
			true
		);
	});

	test('visit: malformed', () => {
		// Note: The expected visitor calls below heavily depend on implementation details; they don't
		// dictate how exactly malformed JSON should be parsed
		assertVisit('[ { "a", "b": [] 1, "c" [ 1 2 ], true: "d":, "e": }, 2, 3 4 ]',
			[
				{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 0, path: [] },
				{ id: 'onObjectBegin', text: "{", startLine: 0, startCharacter: 2, path: [0] },
				{ id: 'onObjectProperty', text: '"a"', startLine: 0, startCharacter: 4, arg: 'a', path: [0] },
				{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 7, arg: ',' },
				{ id: 'onObjectProperty', text: '"b"', startLine: 0, startCharacter: 9, arg: 'b', path: [0] },
				{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 12, arg: ':' },
				{ id: 'onArrayBegin', text: '[', startLine: 0, startCharacter: 14, path: [0, 'b'] },
				{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 15 },
				{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 18, arg: ',' },
				{ id: 'onObjectProperty', text: '"c"', startLine: 0, startCharacter: 20, arg: 'c', path: [0] },
				{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 31, arg: ',' },
				{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 43, arg: ',' },
				{ id: 'onObjectProperty', text: '"e"', startLine: 0, startCharacter: 45, arg: 'e', path: [0] },
				{ id: 'onSeparator', text: ':', startLine: 0, startCharacter: 48, arg: ':' },
				{ id: 'onObjectEnd', text: '}', startLine: 0, startCharacter: 50 },
				{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 51, arg: ',' },
				{ id: 'onLiteralValue', text: '2', startLine: 0, startCharacter: 53, arg: 2, path: [1] },
				{ id: 'onSeparator', text: ',', startLine: 0, startCharacter: 54, arg: ',' },
				{ id: 'onLiteralValue', text: '3', startLine: 0, startCharacter: 56, arg: 3, path: [2] },
				{ id: 'onLiteralValue', text: '4', startLine: 0, startCharacter: 58, arg: 4, path: [3] },
				{ id: 'onArrayEnd', text: ']', startLine: 0, startCharacter: 60 },
			],
			[
				{ error: ParseErrorCode.ColonExpected, offset: 7, length: 1, startLine: 0, startCharacter: 7 },
				{ error: ParseErrorCode.CommaExpected, offset: 17, length: 1, startLine: 0, startCharacter: 17 },
				{ error: ParseErrorCode.PropertyNameExpected, offset: 17, length: 1, startLine: 0, startCharacter: 17 },
				{ error: ParseErrorCode.ValueExpected, offset: 18, length: 1, startLine: 0, startCharacter: 18 },
				{ error: ParseErrorCode.ColonExpected, offset: 24, length: 1, startLine: 0, startCharacter: 24 },
				{ error: ParseErrorCode.PropertyNameExpected, offset: 33, length: 4, startLine: 0, startCharacter: 33 },
				{ error: ParseErrorCode.ValueExpected, offset: 43, length: 1, startLine: 0, startCharacter: 43 },
				{ error: ParseErrorCode.ValueExpected, offset: 50, length: 1, startLine: 0, startCharacter: 50 },
				{ error: ParseErrorCode.CommaExpected, offset: 58, length: 1, startLine: 0, startCharacter: 58 },
			]
		);
	});

	test('visit: incomplete', () => {
		assertVisit('{"prop1":"foo","prop2":"foo2","prop3":{"prp1":{""}}}',
			[
				{ id: 'onObjectBegin', text: "{", startLine: 0, startCharacter: 0, path: [] },
				{ id: 'onObjectProperty', text: '"prop1"', startLine: 0, startCharacter: 1, arg: 'prop1', path: [] },
				{ id: 'onSeparator', text: ":", startLine: 0, startCharacter: 8, arg: ":" },
				{ id: 'onLiteralValue', text: '"foo"', startLine: 0, startCharacter: 9, arg: 'foo', path: ['prop1'] },
				{ id: 'onSeparator', text: ",", startLine: 0, startCharacter: 14, arg: "," },
				{ id: 'onObjectProperty', text: '"prop2"', startLine: 0, startCharacter: 15, arg: 'prop2', path: [] },
				{ id: 'onSeparator', text: ":", startLine: 0, startCharacter: 22, arg: ":" },
				{ id: 'onLiteralValue', text: '"foo2"', startLine: 0, startCharacter: 23, arg: 'foo2', path: ['prop2'] },
				{ id: 'onSeparator', text: ",", startLine: 0, startCharacter: 29, arg: "," },
				{ id: 'onObjectProperty', text: '"prop3"', startLine: 0, startCharacter: 30, arg: 'prop3', path: [] },
				{ id: 'onSeparator', text: ":", startLine: 0, startCharacter: 37, arg: ":" },
				{ id: 'onObjectBegin', text: "{", startLine: 0, startCharacter: 38, path: ['prop3'] },
				{ id: 'onObjectProperty', text: '"prp1"', startLine: 0, startCharacter: 39, arg: 'prp1', path: ['prop3'] },
				{ id: 'onSeparator', text: ":", startLine: 0, startCharacter: 45, arg: ':' },
				{ id: 'onObjectBegin', text: "{", startLine: 0, startCharacter: 46, path: ['prop3', 'prp1'] },
				{ id: 'onObjectProperty', text: '""', startLine: 0, startCharacter: 47, arg: '', path: ['prop3', 'prp1'] },
				{ id: 'onObjectEnd', text: "}", startLine: 0, startCharacter: 49 },
				{ id: 'onObjectEnd', text: "}", startLine: 0, startCharacter: 50 },
				{ id: 'onObjectEnd', text: "}", startLine: 0, startCharacter: 51 },
			],
			[
				{ error: ParseErrorCode.ColonExpected, offset: 49, length: 1, startLine: 0, startCharacter: 49 },
			]
		);

		assertTree('{"prop1":"foo","prop2":"foo2","prop3":{"prp1":{""}}}', {
			type: 'object', offset: 0, length: 52, children: [
				{
					type: 'property', offset: 1, length: 13, children: [
						{ type: 'string', value: 'prop1', offset: 1, length: 7 },
						{ type: 'string', offset: 9, length: 5, value: 'foo' }
					], colonOffset: 8
				}, {
					type: 'property', offset: 15, length: 14, children: [
						{ type: 'string', value: 'prop2', offset: 15, length: 7 },
						{ type: 'string', offset: 23, length: 6, value: 'foo2' }
					], colonOffset: 22
				},
				{
					type: 'property', offset: 30, length: 21, children: [
						{ type: 'string', value: 'prop3', offset: 30, length: 7 },
						{
							type: 'object', offset: 38, length: 13, children: [
								{
									type: 'property', offset: 39, length: 11, children: [
										{ type: 'string', value: 'prp1', offset: 39, length: 6 },
										{
											type: 'object', offset: 46, length: 4, children: [
												{
													type: 'property', offset: 47, length: 3, children: [
														{ type: 'string', value: '', offset: 47, length: 2 },
													]
												}
											]
										}
									], colonOffset: 45
								}
							]
						}
					], colonOffset: 37
				}
			]
		}, [{ error: ParseErrorCode.ColonExpected, offset: 49, length: 1, startLine: 0, startCharacter: 49 }]);
	});

	test('tree: find location', () => {
		let root = parseTree('{ "key1": { "key11": [ "val111", "val112" ] }, "key2": [ { "key21": false, "key22": 221 }, null, [{}] ], "key3": { "key31":, "key32": 32 } }');
		assertNodeAtLocation(root, ['key1'], { key11: ['val111', 'val112'] });
		assertNodeAtLocation(root, ['key1', 'key11'], ['val111', 'val112']);
		assertNodeAtLocation(root, ['key1', 'key11', 0], 'val111');
		assertNodeAtLocation(root, ['key1', 'key11', 1], 'val112');
		assertNodeAtLocation(root, ['key1', 'key11', 2], void 0);
		assertNodeAtLocation(root, ['key2', 0, 'key21'], false);
		assertNodeAtLocation(root, ['key2', 0, 'key22'], 221);
		assertNodeAtLocation(root, ['key2', 1], null);
		assertNodeAtLocation(root, ['key2', 2], [{}]);
		assertNodeAtLocation(root, ['key2', 2, 0], {});
		assertNodeAtLocation(root, ['key3', 'key31', 'key311'], undefined);
		assertNodeAtLocation(root, ['key3', 'key32'], 32);
	});

	test('location: matches', () => {
		assertMatchesLocation('{ "dependencies": { | } }', ['dependencies']);
		assertMatchesLocation('{ "dependencies": { "fo| } }', ['dependencies']);
		assertMatchesLocation('{ "dependencies": { "fo|" } }', ['dependencies']);
		assertMatchesLocation('{ "dependencies": { "fo|": 1 } }', ['dependencies']);
		assertMatchesLocation('{ "dependencies": { "fo|": 1 } }', ['dependencies']);
		assertMatchesLocation('{ "dependencies": { "fo": | } }', ['dependencies', '*']);
	});


});
