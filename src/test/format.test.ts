/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import * as Formatter from '../impl/format';
import { Range } from '../main';

suite('JSON - formatter', () => {

	function format(content: string, expected: string, insertSpaces = true, insertFinalNewline = false, keepLines = false) {
		let range: Range | undefined = void 0;
		const rangeStart = content.indexOf('|');
		const rangeEnd = content.lastIndexOf('|');
		if (rangeStart !== -1 && rangeEnd !== -1) {
			content = content.substring(0, rangeStart) + content.substring(rangeStart + 1, rangeEnd) + content.substring(rangeEnd + 1);
			range = { offset: rangeStart, length: rangeEnd - rangeStart };
		}

		const edits = Formatter.format(content, range, { tabSize: 2, insertSpaces, insertFinalNewline, eol: '\n', keepLines });

		let lastEditOffset = content.length;

		for (let i = edits.length - 1; i >= 0; i--) {
			const edit = edits[i];
			// assert(edit.offset >= 0 && edit.length >= 0 && edit.offset + edit.length <= content.length);
			// assert(typeof edit.content === 'string');
			// assert(lastEditOffset >= edit.offset + edit.length); // make sure all edits are ordered
			lastEditOffset = edit.offset;
			content = content.substring(0, edit.offset) + edit.content + content.substring(edit.offset + edit.length);
		}

		assert.strictEqual(content, expected);
	}

	test('object - single property', () => {
		const content = [
			'{"x" : 1}'
		].join('\n');

		const expected = [
			'{',
			'  "x": 1',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('object - multiple properties', () => {
		const content = [
			'{"x" : 1,  "y" : "foo", "z"  : true}'
		].join('\n');

		const expected = [
			'{',
			'  "x": 1,',
			'  "y": "foo",',
			'  "z": true',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('object - no properties ', () => {
		const content = [
			'{"x" : {    },  "y" : {}}'
		].join('\n');

		const expected = [
			'{',
			'  "x": {},',
			'  "y": {}',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('object - nesting', () => {
		const content = [
			'{"x" : {  "y" : { "z"  : { }}, "a": true}}'
		].join('\n');

		const expected = [
			'{',
			'  "x": {',
			'    "y": {',
			'      "z": {}',
			'    },',
			'    "a": true',
			'  }',
			'}'
		].join('\n');

		format(content, expected);
	});

	test('array - single items', () => {
		const content = [
			'["[]"]'
		].join('\n');

		const expected = [
			'[',
			'  "[]"',
			']'
		].join('\n');

		format(content, expected);
	});

	test('array - multiple items', () => {
		const content = [
			'[true,null,1.2]'
		].join('\n');

		const expected = [
			'[',
			'  true,',
			'  null,',
			'  1.2',
			']'
		].join('\n');

		format(content, expected);
	});

	test('array - no items', () => {
		const content = [
			'[      ]'
		].join('\n');

		const expected = [
			'[]'
		].join('\n');

		format(content, expected);
	});

	test('array - nesting', () => {
		const content = [
			'[ [], [ [ {} ], "a" ]  ]'
		].join('\n');

		const expected = [
			'[',
			'  [],',
			'  [',
			'    [',
			'      {}',
			'    ],',
			'    "a"',
			'  ]',
			']',
		].join('\n');

		format(content, expected);
	});

	test('syntax errors', () => {
		const content = [
			'[ null  1.2 "Hello" ]'
		].join('\n');

		const expected = [
			'[',
			'  null  1.2 "Hello"',
			']',
		].join('\n');

		format(content, expected);
	});

	test('syntax errors 2', () => {
		const content = [
			'{"a":"b""c":"d" }'
		].join('\n');

		const expected = [
			'{',
			'  "a": "b""c": "d"',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('empty lines', () => {
		const content = [
			'{',
			'"a": true,',
			'',
			'"b": true',
			'}',
		].join('\n');

		const expected = [
			'{',
			'\t"a": true,',
			'\t"b": true',
			'}',
		].join('\n');

		format(content, expected, false);
	});
	test('single line comment', () => {
		const content = [
			'[ ',
			'//comment',
			'"foo", "bar"',
			'] '
		].join('\n');

		const expected = [
			'[',
			'  //comment',
			'  "foo",',
			'  "bar"',
			']',
		].join('\n');

		format(content, expected);
	});
	test('block line comment', () => {
		const content = [
			'[{',
			'        /*comment*/     ',
			'"foo" : true',
			'}] '
		].join('\n');

		const expected = [
			'[',
			'  {',
			'    /*comment*/',
			'    "foo": true',
			'  }',
			']',
		].join('\n');

		format(content, expected);
	});
	test('single line comment on same line', () => {
		const content = [
			' {  ',
			'        "a": {}// comment    ',
			' } '
		].join('\n');

		const expected = [
			'{',
			'  "a": {} // comment    ',
			'}',
		].join('\n');

		format(content, expected);
	});
	test('single line comment on same line 2', () => {
		const content = [
			'{ //comment',
			'}'
		].join('\n');

		const expected = [
			'{ //comment',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('block comment on same line', () => {
		const content = [
			'{      "a": {}, /*comment*/    ',
			'        /*comment*/ "b": {},    ',
			'        "c": {/*comment*/}    } ',
		].join('\n');

		const expected = [
			'{',
			'  "a": {}, /*comment*/',
			'  /*comment*/ "b": {},',
			'  "c": { /*comment*/}',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('block comment on same line advanced', () => {
		const content = [
			' {       "d": [',
			'             null',
			'        ] /*comment*/',
			'        ,"e": /*comment*/ [null] }',
		].join('\n');

		const expected = [
			'{',
			'  "d": [',
			'    null',
			'  ] /*comment*/,',
			'  "e": /*comment*/ [',
			'    null',
			'  ]',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('multiple block comments on same line', () => {
		const content = [
			'{      "a": {} /*comment*/, /*comment*/   ',
			'        /*comment*/ "b": {}  /*comment*/  } '
		].join('\n');

		const expected = [
			'{',
			'  "a": {} /*comment*/, /*comment*/',
			'  /*comment*/ "b": {} /*comment*/',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('multiple mixed comments on same line', () => {
		const content = [
			'[ /*comment*/  /*comment*/   // comment ',
			']'
		].join('\n');

		const expected = [
			'[ /*comment*/ /*comment*/ // comment ',
			']'
		].join('\n');

		format(content, expected);
	});

	test('range', () => {
		const content = [
			'{ "a": {},',
			'|"b": [null, null]|',
			'} '
		].join('\n');

		const expected = [
			'{ "a": {},',
			'"b": [',
			'  null,',
			'  null',
			']',
			'} ',
		].join('\n');

		format(content, expected);
	});

	test('range with existing indent', () => {
		const content = [
			'{ "a": {},',
			'   |"b": [null],',
			'"c": {}',
			'}|'
		].join('\n');

		const expected = [
			'{ "a": {},',
			'   "b": [',
			'    null',
			'  ],',
			'  "c": {}',
			'}',
		].join('\n');

		format(content, expected);
	});


	test('range with existing indent - tabs', () => {
		const content = [
			'{ "a": {},',
			'|  "b": [null],   ',
			'"c": {}',
			'}|    '
		].join('\n');

		const expected = [
			'{ "a": {},',
			'\t"b": [',
			'\t\tnull',
			'\t],',
			'\t"c": {}',
			'}',
		].join('\n');

		format(content, expected, false);
	});

	test('property range - issue 14623', () => {
		const content = [
			'{ |"a" :| 1,',
			'  "b": 1',
			'}'
		].join('\n');

		const expected = [
			'{ "a": 1,',
			'  "b": 1',
			'}'
		].join('\n');

		format(content, expected, false);
	});
	test('block comment none-line breaking symbols', () => {
		const content = [
			'{ "a": [ 1',
			'/* comment */',
			', 2',
			'/* comment */',
			']',
			'/* comment */',
			',',
			' "b": true',
			'/* comment */',
			'}'
		].join('\n');

		const expected = [
			'{',
			'  "a": [',
			'    1',
			'    /* comment */',
			'    ,',
			'    2',
			'    /* comment */',
			'  ]',
			'  /* comment */',
			'  ,',
			'  "b": true',
			'  /* comment */',
			'}',
		].join('\n');

		format(content, expected);
	});
	test('line comment after none-line breaking symbols', () => {
		const content = [
			'{ "a":',
			'// comment',
			'null,',
			' "b"',
			'// comment',
			': null',
			'// comment',
			'}'
		].join('\n');

		const expected = [
			'{',
			'  "a":',
			'  // comment',
			'  null,',
			'  "b"',
			'  // comment',
			'  : null',
			'  // comment',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('line comment, enforce line comment ', () => {
		const content = [
			'{"settings": // This is some text',
			'{',
			'"foo": 1',
			'}',
			'}'
		].join('\n');

		const expected = [
			'{',
			'  "settings": // This is some text',
			'  {',
			'    "foo": 1',
			'  }',
			'}'
		].join('\n');

		format(content, expected);
	});

	test('random content', () => {
		const content = [
			'a 1 b 1 3 true'
		].join('\n');

		const expected = [
			'a 1 b 1 3 true',
		].join('\n');

		format(content, expected);
	});

	test('insertFinalNewline', () => {
		const content = [
			'{',
			'}'
		].join('\n');

		const expected = [
			'{}',
			''
		].join('\n');

		format(content, expected, undefined, true);
	});


	// tests added for the keepLines feature

	test('adjust the indentation of a one-line array', () => {
		const content = [
			'{ "array": [1,2,3]',
			'}'
		].join('\n');

		const expected = [
			'{ "array": [ 1, 2, 3 ]',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('adjust the indentation of a multi-line array', () => {
		const content = [
			'{"array":',
			' [1,2,',
			' 3]',
			'}'
		].join('\n');

		const expected = [
			'{ "array":',
			'  [ 1, 2,',
			'    3 ]',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('adjust the identation of a one-line object', () => {
		const content = [
			'{"settings": // This is some text',
			'{"foo": 1}',
			'}'
		].join('\n');

		const expected = [
			'{ "settings": // This is some text',
			'  { "foo": 1 }',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('multiple line breaks are kept', () => {
		const content = [
			'{"settings":',
			'',
			'',
			'',
			'{"foo": 1}',
			'}'
		].join('\n');

		const expected = [
			'{ "settings":',
			'',
			'',
			'',
			'  { "foo": 1 }',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('adjusting multiple line breaks and a block comment, line breaks are kept', () => {
		const content = [
			'{"settings":',
			'',
			'',
			'{"foo": 1} /* this is a multiline',
			'comment */',
			'}'
		].join('\n');

		const expected = [
			'{ "settings":',
			'',
			'',
			'  { "foo": 1 } /* this is a multiline',
			'comment */',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('colon is kept on its own line', () => {
		const content = [
			'{"settings"',
			':',
			'{"foo"',
			':',
			'1}',
			'}'
		].join('\n');

		const expected = [
			'{ "settings"',
			'  :',
			'  { "foo"',
			'    :',
			'    1 }',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('adjusting the indentation of a nested multi-line array', () => {
		const content = [
			'{',
			'',
			'{',
			'',
			'"array"   : [1, 2',
			'3, 4]',
			'}',
			'}'
		].join('\n');

		const expected = [
			'{',
			'',
			'  {',
			'',
			'    "array": [ 1, 2',
			'      3, 4 ]',
			'  }',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('adjusting the indentation for a series of empty arrays or objects', () => {
		const content = [
			'{',
			'',
			'}',
			'',
			'{',
			'[',
			']',
			'}'
		].join('\n');

		const expected = [
			'{',
			'',
			'}',
			'',
			'{',
			'  [',
			'  ]',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('adjusting the indentation for a series of multiple empty lines at the end', () => {
		const content = [
			'{',
			'}',
			'',
			'',
			''
		].join('\n');

		const expected = [
			'{',
			'}',
			'',
			'',
			''
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('adjusting the indentation for comments on separate lines', () => {
		const content = [
			'',
			'',
			'',
			'   // comment 1',
			'',
			'',
			'',
			'  /* comment 2 */',
			'const'
		].join('\n');

		const expected = [

			'',
			'',
			'',
			'// comment 1',
			'',
			'',
			'',
			'/* comment 2 */',
			'const'
		].join('\n');

		format(content, expected, true, false, true);
	});
});
