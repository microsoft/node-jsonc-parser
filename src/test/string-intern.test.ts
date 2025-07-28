import * as assert from 'assert';
import { suite, test } from 'mocha';
import { cachedBreakLinesWithSpaces, cachedSpaces, supportedEols } from '../impl/string-intern';

suite('string intern', () => {
  test('should correctly define spaces intern', () => {
    for (let i = 0; i < cachedSpaces.length; i++) {
      assert.strictEqual(cachedSpaces[i], ' '.repeat(i));
    }
  });

  test('should correctly define break lines with spaces intern', () => {
    for (const indentType of [' ', '\t'] as const) {
      for (const eol of supportedEols) {
        for (let i = 0; i < cachedBreakLinesWithSpaces[indentType][eol].length; i++) {
          assert.strictEqual(cachedBreakLinesWithSpaces[indentType][eol][i], eol + indentType.repeat(i));
        }
      }
    }
  });
});
