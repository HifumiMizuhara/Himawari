import test from 'node:test';
import assert from 'node:assert/strict';
import { decryptString, encryptString } from '../src/utils/crypto.ts';
import { computeCost, estimateTokens, resolvePrice, selectUsageCost } from '../src/utils/tokens.ts';

test('API key encryption round-trips and rejects a wrong passphrase', async () => {
  const payload = await encryptString('secret-key', 'correct horse battery staple');
  assert.equal(await decryptString(payload, 'correct horse battery staple'), 'secret-key');
  await assert.rejects(() => decryptString(payload, 'wrong passphrase'));
});

test('token estimates and longest pricing match remain stable', () => {
  assert.ok(estimateTokens('日本語 and English') > 0);
  const table = {
    'gpt-5': { input: 1, output: 2 },
    'gpt-5-mini': { input: 0.25, output: 0.5 },
  };
  assert.deepEqual(resolvePrice('vendor/gpt-5-mini-2026', table), table['gpt-5-mini']);
  assert.equal(computeCost('gpt-5-mini', 1_000_000, 1_000_000, table), 0.75);
});

test('provider-reported cost wins over local price table', () => {
  const selected = selectUsageCost(
    'vendor/gpt-5-mini-2026',
    { inputTokens: 1_000_000, outputTokens: 1_000_000, providerReportedCost: 1.23 },
    { 'gpt-5-mini': { input: 0.25, output: 0.5 } }
  );
  assert.deepEqual(selected, { cost: 1.23, estimated: false });
});
