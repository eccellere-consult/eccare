import test, { beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { trackAiCall, reportAiCall, anthropicUsage, openAiUsage, errorCodeOf, isTimeoutError, aiopsEnabled, AI_CAPABILITIES } from './aiops.ts';

// A fake network: nothing here ever reaches a real server.
const realFetch = globalThis.fetch;
const realEnv = { endpoint: process.env.AIOPS_ENDPOINT, key: process.env.AIOPS_KEY };
let calls;

function fakeFetch(behaviour = () => new Response('{"ok":true}', { status: 200 })) {
  calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init, body: init?.body ? JSON.parse(init.body) : undefined });
    return behaviour(url, init);
  };
}
const turnOn = () => {
  process.env.AIOPS_ENDPOINT = 'https://tower.example.test/api/v1';
  process.env.AIOPS_KEY = 'test-key-not-real';
};
const turnOff = () => {
  delete process.env.AIOPS_ENDPOINT;
  delete process.env.AIOPS_KEY;
};
// Reports are sent in the background, so give them a moment before looking.
const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

beforeEach(() => {
  turnOff();
  fakeFetch();
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (realEnv.endpoint === undefined) delete process.env.AIOPS_ENDPOINT;
  else process.env.AIOPS_ENDPOINT = realEnv.endpoint;
  if (realEnv.key === undefined) delete process.env.AIOPS_KEY;
  else process.env.AIOPS_KEY = realEnv.key;
});

const meta = { ...AI_CAPABILITIES.voiceCommand, provider: 'anthropic', model: 'claude-haiku-4-5' };
const answer = { model: 'claude-haiku-4-5-20251001', content: [{ type: 'text', text: 'PRIVATE ANSWER about Mrs Sharma metformin' }], usage: { input_tokens: 120, output_tokens: 30 } };

test('does nothing at all without the two settings: no network, answer unchanged', async () => {
  assert.equal(aiopsEnabled(), false);
  const out = await trackAiCall(meta, async () => answer, anthropicUsage);
  assert.equal(out, answer);
  await settle();
  assert.equal(calls.length, 0);
});

test('does nothing when only one of the two settings is present', async () => {
  process.env.AIOPS_KEY = 'only-the-key';
  await trackAiCall(meta, async () => answer, anthropicUsage);
  turnOff();
  process.env.AIOPS_ENDPOINT = 'https://tower.example.test/api/v1';
  await trackAiCall(meta, async () => answer, anthropicUsage);
  await settle();
  assert.equal(calls.length, 0);
});

test('a blank setting counts as not set', async () => {
  process.env.AIOPS_ENDPOINT = '   ';
  process.env.AIOPS_KEY = '  ';
  await trackAiCall(meta, async () => answer, anthropicUsage);
  await settle();
  assert.equal(calls.length, 0);
});

test('without settings a failing call still fails exactly as before', async () => {
  const boom = new Error('provider said no');
  await assert.rejects(() => trackAiCall(meta, async () => { throw boom; }), (e) => e === boom);
  assert.equal(calls.length, 0);
});

test('reports a successful call with the technical fields only', async () => {
  turnOn();
  const out = await trackAiCall({ ...meta, userId: 'user-123' }, async () => answer, anthropicUsage);
  assert.equal(out, answer, 'the app gets the very same answer back');
  await settle();
  assert.equal(calls.length, 1);
  const { url, init, body } = calls[0];
  assert.equal(url, 'https://tower.example.test/api/v1/requests');
  assert.equal(init.headers['x-aiops-key'], 'test-key-not-real');
  assert.equal(body.app_code, 'eccare');
  assert.equal(body.capability_code, 'voice_command');
  assert.equal(body.module_code, 'voice');
  assert.equal(body.provider, 'anthropic');
  assert.equal(body.model, 'claude-haiku-4-5-20251001', 'the model the provider reports wins');
  assert.equal(body.input_tokens, 120);
  assert.equal(body.output_tokens, 30);
  assert.equal(body.status, 'success');
  assert.equal(body.retry_count, 0);
  assert.equal(typeof body.latency_ms, 'number');
  assert.equal(body.token_usage_estimated, false);
});

test('the payload holds no prompt, answer, name, medicine or cost', async () => {
  turnOn();
  await trackAiCall({ ...meta, userId: 'user-123' }, async () => answer, anthropicUsage);
  await settle();
  const text = JSON.stringify(calls[0].body);
  for (const secret of ['PRIVATE ANSWER', 'Sharma', 'metformin', 'user-123']) assert.equal(text.includes(secret), false, secret);
  const allowed = new Set([
    'request_uuid', 'app_code', 'module_code', 'capability_code', 'user_hash', 'provider', 'model', 'prompt_code', 'prompt_version',
    'input_tokens', 'output_tokens', 'cached_tokens', 'token_usage_estimated', 'latency_ms', 'retry_count', 'status', 'error_code', 'occurred_at',
  ]);
  for (const key of Object.keys(calls[0].body)) assert.ok(allowed.has(key), `unexpected field ${key}`);
  assert.equal('cost' in calls[0].body, false);
  assert.equal('estimated_cost' in calls[0].body, false);
  assert.match(calls[0].body.user_hash, /^[0-9a-f]{32}$/, 'the person is only a one-way hash');
});

test('no user id means no user hash', async () => {
  turnOn();
  await trackAiCall(meta, async () => answer, anthropicUsage);
  await settle();
  assert.equal(calls[0].body.user_hash, undefined);
});

test('cached tokens: Anthropic reports cache reads separately, OpenAI includes them in the input', () => {
  assert.deepEqual(
    anthropicUsage({ model: 'm', usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 400, cache_creation_input_tokens: 50 } }),
    { model: 'm', inputTokens: 10, outputTokens: 5, cachedTokens: 400 },
  );
  assert.deepEqual(
    openAiUsage({ model: 'gpt-4o-2024-08-06', usage: { prompt_tokens: 900, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 512 } } }),
    { model: 'gpt-4o-2024-08-06', inputTokens: 900, outputTokens: 40, cachedTokens: 512 },
  );
  assert.deepEqual(openAiUsage({ usage: { prompt_tokens: 7, completion_tokens: 2 } }), { model: undefined, inputTokens: 7, outputTokens: 2, cachedTokens: undefined });
  assert.equal(anthropicUsage({}), undefined);
  assert.equal(anthropicUsage(null), undefined);
  assert.equal(openAiUsage(undefined), undefined);
  assert.equal(anthropicUsage({ usage: { input_tokens: -4, output_tokens: 'x' } }).inputTokens, undefined, 'junk numbers are dropped, not guessed');
});

test('sends cached tokens as the provider returned them', async () => {
  turnOn();
  await trackAiCall({ ...meta, provider: 'openai', model: 'gpt-4o' }, async () => ({ model: 'gpt-4o', usage: { prompt_tokens: 900, completion_tokens: 40, prompt_tokens_details: { cached_tokens: 512 } } }), openAiUsage);
  await settle();
  assert.equal(calls[0].body.input_tokens, 900);
  assert.equal(calls[0].body.cached_tokens, 512);
});

test('speech calls have no tokens: status, time and model only, so the cost stays unknown', async () => {
  turnOn();
  await trackAiCall({ ...AI_CAPABILITIES.speechToText, provider: 'openai', model: 'whisper-1' }, async () => ({ text: 'PRIVATE TRANSCRIPT' }));
  await settle();
  const body = calls[0].body;
  assert.equal(body.status, 'success');
  assert.equal(body.model, 'whisper-1');
  assert.equal(body.capability_code, 'speech_to_text');
  assert.equal('input_tokens' in body, false);
  assert.equal('output_tokens' in body, false);
  assert.equal(JSON.stringify(body).includes('PRIVATE'), false);
});

test('a failed call is reported as failed with a safe code, and the same error is thrown on', async () => {
  turnOn();
  const boom = Object.assign(new Error('Rate limited: key sk-ant-SECRET for patient Mrs Sharma'), { status: 429, name: 'RateLimitError' });
  await assert.rejects(() => trackAiCall(meta, async () => { throw boom; }, anthropicUsage), (e) => e === boom);
  await settle();
  assert.equal(calls.length, 1);
  const body = calls[0].body;
  assert.equal(body.status, 'failed');
  assert.equal(body.error_code, 'http_429');
  assert.equal(body.model, 'claude-haiku-4-5', 'a failed call still names the model that was asked for');
  assert.equal('input_tokens' in body, false);
  const text = JSON.stringify(body);
  assert.equal(text.includes('SECRET'), false);
  assert.equal(text.includes('Sharma'), false);
});

test('a call that ran out of time is reported as timeout', async () => {
  turnOn();
  await assert.rejects(() => trackAiCall(meta, async () => { throw new Error('anthropic took too long'); }));
  await assert.rejects(() => trackAiCall(meta, async () => { throw Object.assign(new Error('The operation was aborted'), { name: 'TimeoutError' }); }));
  await settle();
  assert.deepEqual(calls.map((c) => c.body.status), ['timeout', 'timeout']);
});

test('a code set by the caller wins, and an unknown error gets its class name', async () => {
  turnOn();
  await assert.rejects(() => trackAiCall(meta, async (call) => { call.setErrorCode('http_529'); throw new Error('busy'); }));
  await assert.rejects(() => trackAiCall(meta, async () => { throw new TypeError('x'); }));
  await settle();
  assert.deepEqual(calls.map((c) => c.body.error_code), ['http_529', 'TypeError']);
  assert.equal(errorCodeOf({ status: 'nope' }), 'error');
  assert.equal(errorCodeOf(undefined), 'error');
  assert.equal(isTimeoutError(new Error('Request timed out.')), true);
  assert.equal(isTimeoutError(new Error('bad request')), false);
});

test('usage given from inside the call is used, and a later retry is counted', async () => {
  turnOn();
  await trackAiCall({ ...meta, retryCount: 1 }, async (call) => {
    call.setUsage({ model: 'claude-sonnet-5', inputTokens: 1, outputTokens: 2, cachedTokens: 3 });
    return 'whatever the app wants';
  });
  await settle();
  const body = calls[0].body;
  assert.equal(body.retry_count, 1);
  assert.deepEqual([body.model, body.input_tokens, body.output_tokens, body.cached_tokens], ['claude-sonnet-5', 1, 2, 3]);
});

test('never throws when the Control Tower is down, slow or answers 500', async () => {
  turnOn();
  for (const behaviour of [
    () => { throw new Error('connect ECONNREFUSED'); },
    () => new Response('boom', { status: 500 }),
    () => new Response('nope', { status: 401 }),
    () => new Response('not json at all', { status: 200 }),
  ]) {
    fakeFetch(behaviour);
    const out = await trackAiCall(meta, async () => answer, anthropicUsage);
    assert.equal(out, answer);
    await assert.rejects(() => trackAiCall(meta, async () => { throw new Error('real failure'); }), /real failure/);
    await settle();
    assert.equal(calls.length, 2);
  }
});

test('a Control Tower that never answers does not hold the app up', async () => {
  turnOn();
  fakeFetch(() => new Promise(() => {})); // never settles
  const started = Date.now();
  const out = await trackAiCall(meta, async () => answer, anthropicUsage);
  assert.equal(out, answer);
  assert.ok(Date.now() - started < 500, 'the answer came back without waiting for the report');
  // the report itself is capped at 2 seconds by the client, not waited for by the caller
  assert.equal(typeof calls[0].init.signal, 'object');
});

test('reading usage can fail without affecting the answer', async () => {
  turnOn();
  const out = await trackAiCall(meta, async () => answer, () => { throw new Error('bad shape'); });
  assert.equal(out, answer);
  await settle();
  assert.equal(calls[0].body.status, 'success');
  assert.equal('input_tokens' in calls[0].body, false);
});

test('reportAiCall resolves false and stays quiet when switched off or when the network fails', async () => {
  assert.equal(await reportAiCall(meta, { status: 'success', latencyMs: 5 }), false);
  assert.equal(calls.length, 0);
  turnOn();
  fakeFetch(() => { throw new Error('down'); });
  assert.equal(await reportAiCall(meta, { status: 'success', latencyMs: 5 }), false);
});

test('every capability has a stable lower_snake name and a module', () => {
  const seen = new Set();
  for (const { capability, module } of Object.values(AI_CAPABILITIES)) {
    assert.match(capability, /^[a-z]+(_[a-z]+)*$/);
    assert.match(module, /^[a-z]+$/);
    assert.equal(seen.has(capability), false, `duplicate ${capability}`);
    seen.add(capability);
  }
});
