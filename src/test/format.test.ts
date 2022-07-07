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
		var rangeStart = content.indexOf('|');
		var rangeEnd = content.lastIndexOf('|');
		if (rangeStart !== -1 && rangeEnd !== -1) {
			content = content.substring(0, rangeStart) + content.substring(rangeStart + 1, rangeEnd) + content.substring(rangeEnd + 1);
			range = { offset: rangeStart, length: rangeEnd - rangeStart };
		}

		var edits = Formatter.format(content, range, { tabSize: 2, insertSpaces, insertFinalNewline, eol: '\n', keepLines});

		let lastEditOffset = content.length;
		for (let i = edits.length - 1; i >= 0; i--) {
			let edit = edits[i];
			assert(edit.offset >= 0 && edit.length >= 0 && edit.offset + edit.length <= content.length);
			assert(typeof edit.content === 'string');
			assert(lastEditOffset >= edit.offset + edit.length); // make sure all edits are ordered
			lastEditOffset = edit.offset;
			content = content.substring(0, edit.offset) + edit.content + content.substring(edit.offset + edit.length);
		}

		assert.strictEqual(content, expected);
	}

	test('object - single property', () => {
		var content = [
			'{"x" : 1}'
		].join('\n');

		var expected = [
			'{',
			'  "x": 1',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('object - multiple properties', () => {
		var content = [
			'{"x" : 1,  "y" : "foo", "z"  : true}'
		].join('\n');

		var expected = [
			'{',
			'  "x": 1,',
			'  "y": "foo",',
			'  "z": true',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('object - no properties ', () => {
		var content = [
			'{"x" : {    },  "y" : {}}'
		].join('\n');

		var expected = [
			'{',
			'  "x": {},',
			'  "y": {}',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('object - nesting', () => {
		var content = [
			'{"x" : {  "y" : { "z"  : { }}, "a": true}}'
		].join('\n');

		var expected = [
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
		var content = [
			'["[]"]'
		].join('\n');

		var expected = [
			'[',
			'  "[]"',
			']'
		].join('\n');

		format(content, expected);
	});

	test('array - multiple items', () => {
		var content = [
			'[true,null,1.2]'
		].join('\n');

		var expected = [
			'[',
			'  true,',
			'  null,',
			'  1.2',
			']'
		].join('\n');

		format(content, expected);
	});

	test('array - no items', () => {
		var content = [
			'[      ]'
		].join('\n');

		var expected = [
			'[]'
		].join('\n');

		format(content, expected);
	});

	test('array - nesting', () => {
		var content = [
			'[ [], [ [ {} ], "a" ]  ]'
		].join('\n');

		var expected = [
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
		var content = [
			'[ null  1.2 "Hello" ]'
		].join('\n');

		var expected = [
			'[',
			'  null  1.2 "Hello"',
			']',
		].join('\n');

		format(content, expected);
	});

	test('syntax errors 2', () => {
		var content = [
			'{"a":"b""c":"d" }'
		].join('\n');

		var expected = [
			'{',
			'  "a": "b""c": "d"',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('empty lines', () => {
		var content = [
			'{',
			'"a": true,',
			'',
			'"b": true',
			'}',
		].join('\n');

		var expected = [
			'{',
			'\t"a": true,',
			'\t"b": true',
			'}',
		].join('\n');

		format(content, expected, false);
	});
	test('single line comment', () => {
		var content = [
			'[ ',
			'//comment',
			'"foo", "bar"',
			'] '
		].join('\n');

		var expected = [
			'[',
			'  //comment',
			'  "foo",',
			'  "bar"',
			']',
		].join('\n');

		format(content, expected);
	});
	test('block line comment', () => {
		var content = [
			'[{',
			'        /*comment*/     ',
			'"foo" : true',
			'}] '
		].join('\n');

		var expected = [
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
		var content = [
			' {  ',
			'        "a": {}// comment    ',
			' } '
		].join('\n');

		var expected = [
			'{',
			'  "a": {} // comment    ',
			'}',
		].join('\n');

		format(content, expected);
	});
	test('single line comment on same line 2', () => {
		var content = [
			'{ //comment',
			'}'
		].join('\n');

		var expected = [
			'{ //comment',
			'}'
		].join('\n');

		format(content, expected);
	});
	test('block comment on same line', () => {
		var content = [
			'{      "a": {}, /*comment*/    ',
			'        /*comment*/ "b": {},    ',
			'        "c": {/*comment*/}    } ',
		].join('\n');

		var expected = [
			'{',
			'  "a": {}, /*comment*/',
			'  /*comment*/ "b": {},',
			'  "c": { /*comment*/}',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('block comment on same line advanced', () => {
		var content = [
			' {       "d": [',
			'             null',
			'        ] /*comment*/',
			'        ,"e": /*comment*/ [null] }',
		].join('\n');

		var expected = [
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
		var content = [
			'{      "a": {} /*comment*/, /*comment*/   ',
			'        /*comment*/ "b": {}  /*comment*/  } '
		].join('\n');

		var expected = [
			'{',
			'  "a": {} /*comment*/, /*comment*/',
			'  /*comment*/ "b": {} /*comment*/',
			'}',
		].join('\n');

		format(content, expected);
	});

	test('multiple mixed comments on same line', () => {
		var content = [
			'[ /*comment*/  /*comment*/   // comment ',
			']'
		].join('\n');

		var expected = [
			'[ /*comment*/ /*comment*/ // comment ',
			']'
		].join('\n');

		format(content, expected);
	});

	test('range', () => {
		var content = [
			'{ "a": {},',
			'|"b": [null, null]|',
			'} '
		].join('\n');

		var expected = [
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
		var content = [
			'{ "a": {},',
			'   |"b": [null],',
			'"c": {}',
			'}|'
		].join('\n');

		var expected = [
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
		var content = [
			'{ "a": {},',
			'|  "b": [null],   ',
			'"c": {}',
			'}|    '
		].join('\n');

		var expected = [
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
		var content = [
			'{ |"a" :| 1,',
			'  "b": 1',
			'}'
		].join('\n');

		var expected = [
			'{ "a": 1,',
			'  "b": 1',
			'}'
		].join('\n');

		format(content, expected, false);
	});
	test('block comment none-line breaking symbols', () => {
		var content = [
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

		var expected = [
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
		var content = [
			'{ "a":',
			'// comment',
			'null,',
			' "b"',
			'// comment',
			': null',
			'// comment',
			'}'
		].join('\n');

		var expected = [
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
		var content = [
			'{"settings": // This is some text',
			'{',
			'"foo": 1',
			'}',
			'}'
		].join('\n');

		var expected = [
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
		var content = [
			'a 1 b 1 3 true'
		].join('\n');

		var expected = [
			'a 1 b 1 3 true',
		].join('\n');

		format(content, expected);
	});

	test('insertFinalNewline', () => {
		var content = [
			'{',
			'}'
		].join('\n');

		var expected = [
			'{}',
			''
		].join('\n');

		format(content, expected, undefined, true);
	});


	// tests added for the keepLines feature

	test('one-line array', () => {
		var content = [
			'{ "array": [1,2,3]',
		    '}'
		].join('\n');

		var expected = [
			'{ "array": [ 1, 2, 3 ]',
		    '}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('multi-line array', () => {
		var content = [
			'{"array":',
			' [1,2,',
			' 3]',
		    '}'
		].join('\n');

		var expected = [
			'{ "array":',
			'  [ 1, 2,',
			'    3 ]',
		    '}'
		].join('\n');
 
		format(content, expected, true, false, true);
	});

	test('one-line object', () => {
		var content = [
			'{"settings": // This is some text',
			'{"foo": 1}',
			'}'
		].join('\n');

		var expected = [
			'{ "settings": // This is some text',
			'  { "foo": 1 }',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('multiple line breaks', () => {
		var content = [
			'{"settings":',
			'',
			'',
			'',
			'{"foo": 1}',
			'}'
		].join('\n');

		var expected = [
			'{ "settings":',
			'',
			'',
			'',
			'  { "foo": 1 }',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('multiple line breaks and block comment', () => {
		var content = [
			'{"settings":',
			'',
			'',
			'{"foo": 1} /* this is a multiline',
			'comment */',
			'}'
		].join('\n');

		var expected = [
			'{ "settings":',
			'',
			'',
			'  { "foo": 1 } /* this is a multiline',
			'comment */',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('colon on its own line', () => {
		var content = [
			'{"settings"',
			':',
			'{"foo"',
			':',
			'1}',
			'}'
		].join('\n');

		var expected = [
			'{ "settings"',
			'  :',
			'  { "foo"',
			'    :',
			'    1 }',
			'}'
		].join('\n');

		format(content, expected, true, false, true);
	});

	test('nested multi-line array', () => {
		var content = [
			'{',
			'',
			'{',
			'',
			'"array"   : [1, 2',
			'3, 4]',
			'}',
			'}'
		].join('\n');

		var expected = [
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

	test('empty arrays or objects', () => {
		var content = [
			'{',
			'',
			'}',
			'',
			'{',
			'[',
			']',
			'}'
		].join('\n');

		var expected = [
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

	test('multiple empty lines at the end', () => {
		var content = [
			'{',
			'}',
			'',
			'',
			''
		].join('\n');

		var expected = [
			'{',
			'}',
			'',
			'',
			''
		].join('\n');

		format(content, expected, true, false, true);
	});
});