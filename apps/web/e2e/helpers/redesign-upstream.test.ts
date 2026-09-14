import { CONTRIBUTION_QUERY } from '@chapa/shared';
import { describe, expect, it, vi } from 'vitest';
import { createRedesignFetch } from './redesign-upstream.mjs';

describe('redesign test-process upstream boundary', () => {
  it('reports the current cache key count after deleting and expiring entries', async () => {
    vi.useFakeTimers();
    try {
      const replay = createRedesignFetch({ cache: { seeded: 'value' }, github: {} });
      const send = async (cmd: unknown[]) => (await replay('https://redesign.upstash.invalid', { method: 'POST', body: JSON.stringify(cmd) })).json();
      expect(await send(['dbsize'])).toEqual({ result: 1 });
      await send(['set', 'seeded', 'replacement']);
      await send(['set', 'temporary', 'value', 'ex', 2]);
      await send(['set', 'deleted', 'value']);
      expect(await send(['dbsize'])).toEqual({ result: 3 });
      await send(['del', 'deleted']);
      expect(await send(['dbsize'])).toEqual({ result: 2 });
      vi.advanceTimersByTime(2001);
      expect(await send(['dbsize'])).toEqual({ result: 1 });
      await send(['del', 'seeded']);
      expect(await send(['dbsize'])).toEqual({ result: 0 });
    } finally { vi.useRealTimers(); }
  });

  it('replays only this journey run and its exact contribution query across worker restarts', async () => {
    const local = vi.fn();
    const replay = createRedesignFetch({ journeyRunId: 'redesign', contributionQuery: CONTRIBUTION_QUERY, cache: {}, github: {} }, local);
    for (const project of ['chrom', 'mobil']) for (const shape of ['craft', 'plain', 'linked']) for (const worker of [0, 12, 999]) {
      const login = `chapa-e2e-redesign-${worker}-0-${project}-${shape}`;
      const response = await replay('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login } }) });
      expect(await response.json()).toEqual({ data: { user: null } });
    }
    for (const login of ['octocat', 'chapa-e2e-other-0-0-chrom-craft', 'chapa-e2e-redesign-0-0-webki-craft', 'chapa-e2e-redesign-0-0-chrom-admin', 'chapa-e2e-redesign-000-0-chrom-craft', 'chapa-e2e-redesign-1000-0-chrom-craft', 'chapa-e2e-redesign-0-0-chrom-craft-extra']) {
      await expect(replay('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login } }) })).rejects.toThrow('Unexpected redesign upstream');
    }
    await expect(replay('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: 'query { viewer { login } }', variables: { login: 'chapa-e2e-redesign-0-0-chrom-craft' } }) })).rejects.toThrow('Unexpected redesign upstream');
    const disabled = createRedesignFetch({ contributionQuery: CONTRIBUTION_QUERY, cache: {}, github: {} }, local);
    await expect(disabled('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login: 'chapa-e2e-redesign-0-0-chrom-craft' } }) })).rejects.toThrow('Unexpected redesign upstream');
    expect(local).not.toHaveBeenCalled();
  });

  it('scopes Bitbucket empty-workspace replay to linked journey tokens and the actual GET endpoint', async () => {
    const audit = vi.fn();
    const replay = createRedesignFetch({ journeyRunId: 'redesign', cache: {}, github: {} }, vi.fn(), audit);
    const url = 'https://api.bitbucket.org/2.0/user/permissions/workspaces';
    const headers = { Authorization: 'Bearer token-chapa-e2e-redesign-2-0-mobil-linked' };
    const response = await replay(new Request(url, { headers }));
    expect(await response.json()).toEqual({ values: [], size: 0, pagelen: 10 });
    for (const token of ['real-token', 'token-chapa-e2e-redesign-2-0-mobil-craft', 'token-chapa-e2e-other-2-0-mobil-linked']) {
      await expect(replay(url, { headers: { Authorization: `Bearer ${token}` } })).rejects.toThrow('Unexpected redesign upstream');
    }
    await expect(replay(url, { method: 'POST', headers })).rejects.toThrow('Unexpected redesign upstream');
    await expect(replay(`${url}?page=2`, { headers })).rejects.toThrow('Unexpected redesign upstream');
    await expect(replay('https://api.bitbucket.org/2.0/repositories/unrelated', { headers })).rejects.toThrow('Unexpected redesign upstream');
    expect(audit).toHaveBeenCalledTimes(6);
  });

  it('passes only loopback through and rejects unexpected external reads', async () => {
    const local = vi.fn(async () => Response.json({ local: true }));
    const fetch = createRedesignFetch({ cache: {}, github: {} }, local);
    await expect(fetch('http://127.0.0.1:55331/rest/v1/users')).resolves.toBeInstanceOf(Response);
    await expect(fetch('https://api.github.com/users/unknown')).rejects.toThrow('Unexpected redesign upstream');
    expect(local).toHaveBeenCalledTimes(1);
    expect(local).toHaveBeenCalledWith('http://127.0.0.1:55331/rest/v1/users', { redirect: 'error' });
  });
  it('replays current GraphQL variables and the Upstash pipeline encoding', async () => {
    const fetch = createRedesignFetch({ contributionQuery: CONTRIBUTION_QUERY, cache: { 'stats:v2:merged:octocat': JSON.stringify({ handle: 'octocat' }) }, github: { octocat: { data: { user: { login: 'octocat' } } } } });
    const graph = await fetch('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login: 'octocat' } }) });
    expect(await graph.json()).toMatchObject({ data: { user: { login: 'octocat' } } });
    const result = await fetch('https://redesign.upstash.invalid/pipeline', { method: 'POST', headers: { 'Upstash-Encoding': 'base64' }, body: JSON.stringify([['get', 'stats:v2:merged:octocat']]) });
    const rows = await result.json();
    expect(JSON.parse(Buffer.from(rows[0].result, 'base64').toString())).toEqual({ handle: 'octocat' });
    await expect(fetch('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: CONTRIBUTION_QUERY, variables: { login: 'someone-else' } }) })).rejects.toThrow('Unexpected redesign upstream');
  });
  it('expires replay counters and audits unsupported cache operations', async () => {
    vi.useFakeTimers();
    try {
      const audit = vi.fn();
      const fetch = createRedesignFetch({ cache: {}, github: {} }, globalThis.fetch, audit);
      const send = async (cmd: unknown[]) => (await fetch('https://redesign.upstash.invalid', { method: 'POST', body: JSON.stringify(cmd) })).json();
      await send(['set', 'counter', '4', 'ex', 2]);
      expect(await send(['get', 'counter'])).toEqual({ result: '4' });
      vi.advanceTimersByTime(2001);
      expect(await send(['get', 'counter'])).toEqual({ result: null });
      await expect(send(['unrecognized'])).rejects.toThrow('Unexpected redesign cache command');
      expect(audit).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });

});

it('replays only the explicit synthetic qualification GitHub health request', async () => {
  const local = vi.fn();
  const replay = createRedesignFetch({ cache: {}, github: {}, qualificationHealth: true }, local);
  const headers = { Authorization: 'token redesign-local-fixture', 'User-Agent': 'chapa-health-check' };
  const result = await replay('https://api.github.com/rate_limit', { headers });
  expect(await result.json()).toEqual({ rate: { remaining: 5000, limit: 5000 } });
  expect(result.headers.get('x-oauth-scopes')).toBe('repo');
  await expect(replay('https://api.github.com/rate_limit', { method: 'POST', headers })).rejects.toThrow('Unexpected redesign upstream');
  await expect(replay('https://api.github.com/rate_limit', { headers: { Authorization: 'token real' } })).rejects.toThrow('Unexpected redesign upstream');
  const disabled = createRedesignFetch({ cache: {}, github: {} }, local);
  await expect(disabled('https://api.github.com/rate_limit', { headers })).rejects.toThrow('Unexpected redesign upstream');
  expect(local).not.toHaveBeenCalled();
});

it('replays only the declared qualification negative handle with its exact query', async () => {
  const replay = createRedesignFetch({ qualificationHealth: true, contributionQuery: CONTRIBUTION_QUERY, github: {}, cache: {} });
  const request = (login: string, query = CONTRIBUTION_QUERY) => replay('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query, variables: { login } }) });
  expect(await (await request('this-user-definitely-does-not-exist-xyz123')).json()).toEqual({ data: { user: null } });
  await expect(request('arbitrary-owner')).rejects.toThrow(/Unexpected/);
  await expect(request('this-user-definitely-does-not-exist-xyz123', 'unknown-query')).rejects.toThrow(/Unexpected/);
});

it('serves the exact historical journey avatar from local fixture bytes only', async () => {
  const send = vi.fn();
  const replay = createRedesignFetch({ journeyRunId: 'redesign', avatarPng: Buffer.from('local-avatar').toString('base64'), cache: {}, github: {} }, send);
  for (const url of ['https://avatars.githubusercontent.com/u/583231', 'https://avatars.githubusercontent.com/u/583231?v=4']) expect(await (await replay(url)).text()).toBe('local-avatar');
  await expect(replay('https://avatars.githubusercontent.com/u/583232?v=4')).rejects.toThrow(/Unexpected/);
  await expect(replay('https://avatars.githubusercontent.com/u/583231?v=4', { method: 'POST' })).rejects.toThrow(/Unexpected/);
  expect(send).not.toHaveBeenCalled();
});

it('classifies denied GraphQL without logging query bodies, credentials or arbitrary handles', async () => {
  const unexpected = vi.fn();
  const replay = createRedesignFetch({ cache: {}, github: { 'chapa-score-boundary': {} } }, vi.fn(), unexpected);
  await expect(replay('https://api.github.com/graphql', { method: 'POST', headers: { Authorization: 'private-secret' }, body: JSON.stringify({ query: 'query V7Profile { private_sentinel }', variables: { login: 'chapa-score-boundary' } }) })).rejects.toThrow(/Unexpected/);
  expect(unexpected.mock.calls[0]?.[0]).toMatch(/operation=V7Profile querySha256=[a-f0-9]{64} login=chapa-score-boundary/);
  expect(unexpected.mock.calls[0]?.[0]).not.toMatch(/private_sentinel|private-secret/);
  await expect(replay('https://api.github.com/graphql', { method: 'POST', body: JSON.stringify({ query: 'query PrivateCustomer { x }', variables: { login: 'private-customer' } }) })).rejects.toThrow(/Unexpected/);
  expect(unexpected.mock.calls[1]?.[0]).toMatch(/operation=other querySha256=[a-f0-9]{64} login=not_allowlisted/);
  expect(unexpected.mock.calls[1]?.[0]).not.toMatch(/PrivateCustomer|private-customer/);
});
