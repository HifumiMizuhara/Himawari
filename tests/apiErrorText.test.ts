import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sanitizeApiErrorDetails, truncatePlainText } from '../src/utils/apiErrorText.ts';

describe('apiErrorText', () => {
  it('extracts message fields from JSON error bodies', () => {
    const details = sanitizeApiErrorDetails(
      JSON.stringify({ error: { message: 'Invalid API key provided' } })
    );
    assert.equal(details, 'Invalid API key provided');
  });

  it('strips HTML and truncates long bodies', () => {
    const details = sanitizeApiErrorDetails(`<b>alert</b> ${'x'.repeat(300)}`);
    assert.equal(details.startsWith('alert '), true);
    assert.equal(details.length <= 241, true);
  });

  it('removes control characters from plain text', () => {
    assert.equal(truncatePlainText('hello\u0000world'), 'helloworld');
  });
});
