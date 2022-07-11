/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as assert from 'assert';
import { FormattingOptions, Edit, ModificationOptions, modify } from '../main';

suite('JSON - edits', () => {

	function assertEdit(content: string, edits: Edit[], expected: string) {
		assert(edits);
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

	let formattingOptions: FormattingOptions = {
		insertSpaces: true,
		tabSize: 2,
		eol: '\n',
		keepLines: false
	};

	let formattingOptionsKeepLines: FormattingOptions = {
		insertSpaces: true,
		tabSize: 2,
		eol: '\n',
		keepLines: true
	};

	let options: ModificationOptions = {
		formattingOptions
	};

	let optionsKeepLines: ModificationOptions = {
		formattingOptions : formattingOptionsKeepLines
	};

	test('set property', () => {
		let content = '{\n  "x": "y"\n}';
		let edits = modify(content, ['x'], 'bar', options);
		assertEdit(content, edits, '{\n  "x": "bar"\n}');

		content = 'true';
		edits = modify(content, [], 'bar', options);
		assertEdit(content, edits, '"bar"');

		content = '{\n  "x": "y"\n}';
		edits = modify(content, ['x'], { key: true }, options);
		assertEdit(content, edits, '{\n  "x": {\n    "key": true\n  }\n}');

		content = '{\n  "a": "b",  "x": "y"\n}';
		edits = modify(content, ['a'], null, options);
		assertEdit(content, edits, '{\n  "a": null,  "x": "y"\n}');
	});

	test('insert property', () => {
		let content = '{}';
		let edits = modify(content, ['foo'], 'bar', options);
		assertEdit(content, edits, '{\n  "foo": "bar"\n}');

		edits = modify(content, ['foo', 'foo2'], 'bar', options);
		assertEdit(content, edits, '{\n  "foo": {\n    "foo2": "bar"\n  }\n}');

		content = '{\n}';
		edits = modify(content, ['foo'], 'bar', options);
		assertEdit(content, edits, '{\n  "foo": "bar"\n}');

		content = '  {\n  }';
		edits = modify(content, ['foo'], 'bar', options);
		assertEdit(content, edits, '  {\n    "foo": "bar"\n  }');

		content = '{\n  "x": "y"\n}';
		edits = modify(content, ['foo'], 'bar', options);
		assertEdit(content, edits, '{\n  "x": "y",\n  "foo": "bar"\n}');

		content = '{\n  "x": "y"\n}';
		edits = modify(content, ['e'], 'null', options);
		assertEdit(content, edits, '{\n  "x": "y",\n  "e": "null"\n}');

		edits = modify(content, ['x'], 'bar', options);
		assertEdit(content, edits, '{\n  "x": "bar"\n}');

		content = '{\n  "x": {\n    "a": 1,\n    "b": true\n  }\n}\n';
		edits = modify(content, ['x'], 'bar', options);
		assertEdit(content, edits, '{\n  "x": "bar"\n}\n');

		edits = modify(content, ['x', 'b'], 'bar', options);
		assertEdit(content, edits, '{\n  "x": {\n    "a": 1,\n    "b": "bar"\n  }\n}\n');

		edits = modify(content, ['x', 'c'], 'bar', { formattingOptions, getInsertionIndex: () => 0 });
		assertEdit(content, edits, '{\n  "x": {\n    "c": "bar",\n    "a": 1,\n    "b": true\n  }\n}\n');

		edits = modify(content, ['x', 'c'], 'bar', { formattingOptions, getInsertionIndex: () => 1 });
		assertEdit(content, edits, '{\n  "x": {\n    "a": 1,\n    "c": "bar",\n    "b": true\n  }\n}\n');

		edits = modify(content, ['x', 'c'], 'bar', { formattingOptions, getInsertionIndex: () => 2 });
		assertEdit(content, edits, '{\n  "x": {\n    "a": 1,\n    "b": true,\n    "c": "bar"\n  }\n}\n');

		edits = modify(content, ['c'], 'bar', options);
		assertEdit(content, edits, '{\n  "x": {\n    "a": 1,\n    "b": true\n  },\n  "c": "bar"\n}\n');

		content = '{\n  "a": [\n    {\n    } \n  ]  \n}';
		edits = modify(content, ['foo'], 'bar', options);
		assertEdit(content, edits, '{\n  "a": [\n    {\n    } \n  ],\n  "foo": "bar"\n}');

		content = '';
		edits = modify(content, ['foo', 0], 'bar', options);
		assertEdit(content, edits, '{\n  "foo": [\n    "bar"\n  ]\n}');

		content = '//comment';
		edits = modify(content, ['foo', 0], 'bar', options);
		assertEdit(content, edits, '{\n  "foo": [\n    "bar"\n  ]\n} //comment');
	});

	test('remove property', () => {
		let content = '{\n  "x": "y"\n}';
		let edits = modify(content, ['x'], undefined, options);
		assertEdit(content, edits, '{\n}');

		content = '{\n  "x": "y", "a": []\n}';
		edits = modify(content, ['x'], undefined, options);
		assertEdit(content, edits, '{\n  "a": []\n}');

		content = '{\n  "x": "y", "a": []\n}';
		edits = modify(content, ['a'], undefined, options);
		assertEdit(content, edits, '{\n  "x": "y"\n}');
	});

	test('set item', () => {
		let content = '{\n  "x": [1, 2, 3],\n  "y": 0\n}';

		let edits = modify(content, ['x', 0], 6, options);
		assertEdit(content, edits, '{\n  "x": [6, 2, 3],\n  "y": 0\n}');

		edits = modify(content, ['x', 1], 5, options);
		assertEdit(content, edits, '{\n  "x": [1, 5, 3],\n  "y": 0\n}');

		edits = modify(content, ['x', 2], 4, options);
		assertEdit(content, edits, '{\n  "x": [1, 2, 4],\n  "y": 0\n}');

		edits = modify(content, ['x', 3], 3, options);
		assertEdit(content, edits, '{\n  "x": [\n    1,\n    2,\n    3,\n    3\n  ],\n  "y": 0\n}');
	});

	test('insert item at 0; isArrayInsertion = true', () => {
		let content = '[\n  2,\n  3\n]';
		let edits = modify(content, [0], 1, { formattingOptions, isArrayInsertion: true });
		assertEdit(content, edits, '[\n  1,\n  2,\n  3\n]');
	});

	test('insert item at 0 in empty array', () => {
		let content = '[\n]';
		let edits = modify(content, [0], 1, options);
		assertEdit(content, edits, '[\n  1\n]');
	});

	test('insert item at an index; isArrayInsertion = true', () => {
		let content = '[\n  1,\n  3\n]';
		let edits = modify(content, [1], 2, { formattingOptions, isArrayInsertion: true });
		assertEdit(content, edits, '[\n  1,\n  2,\n  3\n]');
	});

	test('insert item at an index in empty array', () => {
		let content = '[\n]';
		let edits = modify(content, [1], 1, options);
		assertEdit(content, edits, '[\n  1\n]');
	});

	test('insert item at end index', () => {
		let content = '[\n  1,\n  2\n]';
		let edits = modify(content, [2], 3, options);
		assertEdit(content, edits, '[\n  1,\n  2,\n  3\n]');
	});

	test('insert item at end to empty array', () => {
		let content = '[\n]';
		let edits = modify(content, [-1], 'bar', options);
		assertEdit(content, edits, '[\n  "bar"\n]');
	});

	test('insert item at end', () => {
		let content = '[\n  1,\n  2\n]';
		let edits = modify(content, [-1], 'bar', options);
		assertEdit(content, edits, '[\n  1,\n  2,\n  "bar"\n]');
	});

	test('remove item in array with one item', () => {
		let content = '[\n  1\n]';
		let edits = modify(content, [0], void 0, options);
		assertEdit(content, edits, '[]');
	});

	test('remove item in the middle of the array', () => {
		let content = '[\n  1,\n  2,\n  3\n]';
		let edits = modify(content, [1], void 0, options);
		assertEdit(content, edits, '[\n  1,\n  3\n]');
	});

	test('remove last item in the array', () => {
		let content = '[\n  1,\n  2,\n  "bar"\n]';
		let edits = modify(content, [2], void 0, options);
		assertEdit(content, edits, '[\n  1,\n  2\n]');
	});

	test('remove last item in the array if ends with comma', () => {
		let content = '[\n  1,\n  "foo",\n  "bar",\n]';
		let edits = modify(content, [2], void 0, options);
		assertEdit(content, edits, '[\n  1,\n  "foo"\n]');
	});

	test('remove last item in the array if there is a comment in the beginning', () => {
		let content = '// This is a comment\n[\n  1,\n  "foo",\n  "bar"\n]';
		let edits = modify(content, [2], void 0, options);
		assertEdit(content, edits, '// This is a comment\n[\n  1,\n  "foo"\n]');
	});

	test('set property without formatting', () => {
		let content = '{\n  "x": [1, 2, 3],\n  "y": 0\n}';

		let edits = modify(content, ['x', 0], { a: 1, b: 2 }, { formattingOptions });
		assertEdit(content, edits, '{\n  "x": [{\n      "a": 1,\n      "b": 2\n    }, 2, 3],\n  "y": 0\n}');

		edits = modify(content, ['x', 0], { a: 1, b: 2 }, { formattingOptions: undefined });
		assertEdit(content, edits, '{\n  "x": [{"a":1,"b":2}, 2, 3],\n  "y": 0\n}');
	});

	// test added for the keepLines feature
	test('insert property when keepLines is true', () => {

		let content = '{}';
		let edits = modify(content, ['foo', 'foo2'], 'bar', options);
		assertEdit(content, edits, '{\n  "foo": {\n    "foo2": "bar"\n  }\n}');
	});
});