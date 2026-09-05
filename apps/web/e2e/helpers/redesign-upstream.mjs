/** Test-process-only replay. Never imported by application code. */
import { appendFileSync, readFileSync } from 'node:fs';

export function createRedesignFetch(fixtures, localFetch = globalThis.fetch, onUnexpected = () => {}) {
  const cache = new Map(Object.entries(fixtures.cache));
  const expires = new Map();
  // journey.spec.ts owns these DB records and cleans them up. Its 14-character
  // run-id cap permits worker indices through 999 with this explicit run name.
  const journeyHandle = /^chapa-e2e-redesign-(?:0|[1-9]\d{0,2})-\d-(?:chrom|mobil)-(craft|plain|linked)$/;
  const journeyShape = handle => fixtures.journeyRunId === 'redesign' && typeof handle === 'string'
    ? journeyHandle.exec(handle)?.[1]
    : undefined;
  function command([name, ...args]) {
    for (const [key, deadline] of expires) if (deadline <= Date.now()) { cache.delete(key); expires.delete(key); }
    const op = String(name).toLowerCase();
    const key = String(args[0]);
    switch (op) {
      case 'dbsize': return cache.size;
      case 'get': return cache.get(key) ?? null;
      case 'mget': return args.map(k => cache.get(String(k)) ?? null);
      case 'set': {
        if (args.slice(2).some(v => String(v).toLowerCase() === 'nx') && cache.has(key)) return null;
        cache.set(key, args[1]);
        expires.delete(key);
        const ex = args.findIndex(v => String(v).toLowerCase() === 'ex');
        if (ex >= 0) expires.set(key, Date.now() + Number(args[ex + 1]) * 1000);
        return 'OK';
      }
      case 'del': return args.reduce((n, k) => n + Number(cache.delete(String(k))), 0);
      case 'incr': case 'incrby': { const n = Number(cache.get(key) ?? 0) + (op === 'incrby' ? Number(args[1]) : 1); cache.set(key, String(n)); return n; }
      case 'expire': if (!cache.has(key)) return 0; expires.set(key, Date.now() + Number(args[1]) * 1000); return 1;
      case 'exists': return Number(cache.has(key));
      case 'ttl': return !cache.has(key) ? -2 : expires.has(key) ? Math.ceil((expires.get(key) - Date.now()) / 1000) : -1;
      case 'ping': return 'PONG';
      case 'eval': {
        const script = String(args[0]);
        if (Number(args[1]) !== 1) throw new Error('Unexpected redesign Lua key count');
        const luaKey = String(args[2]);
        if (script.trim() === 'local current = redis.call("INCR", KEYS[1])\nif redis.call("TTL", KEYS[1]) == -1 then\n  redis.call("EXPIRE", KEYS[1], ARGV[1])\nend\nreturn current') {
          const value = command(['incr', luaKey]);
          if (!expires.has(luaKey)) command(['expire', luaKey, args[3]]);
          return value;
        }
        throw new Error('Unexpected redesign Lua script');
      }
      case 'pfadd': {
        const members = new Set(cache.get(key) ?? []); const size = members.size;
        for (const value of args.slice(1)) members.add(String(value));
        cache.set(key, [...members]); return Number(size !== members.size);
      }
      case 'pfcount': return new Set(args.flatMap(k => cache.get(String(k)) ?? [])).size;
      case 'hgetall': return [];
      case 'zrange': case 'smembers': return [];
      case 'zcard': case 'scard': case 'hlen': return 0;
      case 'hset': case 'zadd': case 'sadd': return 1;
      default: throw new Error(`Unexpected redesign cache command: ${op}`);
    }
  }
  return async function redesignFetch(input, init) {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) return localFetch(input, { ...init, redirect: 'error' });
    const body = init?.body ?? (input instanceof Request ? await input.clone().text() : undefined);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.origin === 'https://redesign.upstash.invalid') {
      const commands = JSON.parse(String(body));
      const pipeline = url.pathname === '/pipeline' || url.pathname === '/multi-exec';
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const encode = value => Array.isArray(value) ? value.map(encode) : typeof value === 'string' && value !== 'OK' && headers.get('Upstash-Encoding') === 'base64' ? Buffer.from(value).toString('base64') : value;
      const execute = cmd => {
        try { return { result: encode(command(cmd)) }; }
        catch (error) { onUnexpected(error.message); throw error; }
      };
      return Response.json(pipeline ? commands.map(execute) : execute(commands));
    }
    if (url.href === 'https://api.github.com/graphql') {
      const request = JSON.parse(String(body));
      const response = fixtures.github[request.variables?.login];
      if (response && request.query === fixtures.contributionQuery && fixtures.contributionQuery) return Response.json(response);
      if (method === 'POST' && journeyShape(request.variables?.login) && request.query === fixtures.contributionQuery && fixtures.contributionQuery) {
        // Synthetic journey accounts intentionally do not exist on GitHub;
        // durable snapshot/config assertions remain in the real journey test.
        return Response.json({ data: { user: null } });
      }
    }
    if (method === 'GET' && url.href === 'https://api.bitbucket.org/2.0/user/permissions/workspaces') {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const handle = headers.get('Authorization')?.match(/^Bearer token-(.+)$/)?.[1];
      if (journeyShape(handle) === 'linked') return Response.json({ values: [], size: 0, pagelen: 10 });
    }
    if (url.origin === 'https://avatars.githubusercontent.com' && fixtures.github[url.pathname.slice(1)] && fixtures.avatarPng) {
      return new Response(Buffer.from(fixtures.avatarPng, 'base64'), { headers: { 'Content-Type': 'image/png' } });
    }
    const message = `Unexpected redesign upstream: ${url.origin}${url.pathname}`;
    onUnexpected(message);
    throw new Error(message);
  };
}

// Explicit fixture path is supplied only to the local test server's Node preload.
if (process.env.REDESIGN_FIXTURE_FILE) {
  const fixtures = JSON.parse(readFileSync(process.env.REDESIGN_FIXTURE_FILE, 'utf8'));
  globalThis.fetch = createRedesignFetch(fixtures, globalThis.fetch, message => {
    if (process.env.REDESIGN_UPSTREAM_AUDIT) appendFileSync(process.env.REDESIGN_UPSTREAM_AUDIT, `${message}\n`);
    console.error(message);
  });
}
