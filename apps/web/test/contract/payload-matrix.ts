export const ABSENT: unique symbol = Symbol("ABSENT");

export type Candidate = unknown | typeof ABSENT;

export interface FieldSpec {
  name: string;
  candidates: Candidate[];
  typical: Candidate;
}

export type Payload = Record<string, unknown>;

export interface FieldOptions {
  candidates: unknown[];
  includeAbsent?: boolean;
  includeNull?: boolean;
  typical?: unknown;
}

export interface GeneratePayloadsOptions {
  fields: FieldSpec[];
  randomCount?: number;
  seed: number;
}

export interface MatrixResponse {
  status: number;
  ok: boolean;
  body: unknown;
}

export interface RunMatrixOptions {
  allowedStatuses?: number[];
  assertPersisted?: (payload: Payload, response: MatrixResponse) => Promise<void> | void;
  assertObservable?: (payload: Payload, response: MatrixResponse) => Promise<void> | void;
}

interface MatrixViolation {
  kind: "status" | "persistence" | "observability";
  status: number;
  body: unknown;
  payload: Payload;
  message?: string;
}

export function declareField(name: string, options: FieldOptions): FieldSpec {
  const candidates: Candidate[] = [];
  if (options.includeAbsent) candidates.push(ABSENT);
  if (options.includeNull) candidates.push(null);
  candidates.push(...options.candidates);

  const typical = options.typical ?? options.candidates[0] ?? null;
  return { name, candidates: dedupeCandidates(candidates), typical };
}

export function generatePayloads(options: GeneratePayloadsOptions): Payload[] {
  const { fields, seed } = options;
  const randomCount = options.randomCount ?? 300;
  const cases: Record<string, Candidate>[] = [];

  cases.push(
    Object.fromEntries(
      fields.map((field) => [
        field.name,
        field.candidates.includes(ABSENT) ? ABSENT : field.typical,
      ]),
    ),
  );

  for (const field of fields) {
    if (!field.candidates.includes(null)) continue;
    cases.push(
      Object.fromEntries(
        fields.map((candidateField) => [
          candidateField.name,
          candidateField === field ? null : candidateField.typical,
        ]),
      ),
    );
  }

  cases.push(Object.fromEntries(fields.map((field) => [field.name, field.typical])));

  const typicalBackground = Object.fromEntries(
    fields.map((field) => [field.name, field.typical]),
  );
  const absentBackground = Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.candidates.includes(ABSENT) ? ABSENT : field.typical,
    ]),
  );

  for (const field of fields) {
    for (const candidate of field.candidates) {
      cases.push({ ...typicalBackground, [field.name]: candidate });
      cases.push({ ...absentBackground, [field.name]: candidate });
    }
  }

  const random = mulberry32(seed);
  for (let i = 0; i < randomCount; i += 1) {
    cases.push(
      Object.fromEntries(
        fields.map((field) => [
          field.name,
          field.candidates[Math.floor(random() * field.candidates.length)] ?? field.typical,
        ]),
      ),
    );
  }

  const seen = new Set<string>();
  const payloads: Payload[] = [];
  for (const candidate of cases) {
    const payload = buildPayload(candidate);
    const key = stablePayloadKey(candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    payloads.push(payload);
  }
  return payloads;
}

export async function runMatrix(
  payloads: Payload[],
  invoke: (payload: Payload) => Promise<MatrixResponse>,
  options: RunMatrixOptions = {},
): Promise<{ total: number; statusCounts: Record<number, number> }> {
  const allowedStatuses = new Set(options.allowedStatuses ?? []);
  const statusCounts: Record<number, number> = {};
  const violations: MatrixViolation[] = [];

  for (const payload of payloads) {
    const response = await invoke(payload);
    statusCounts[response.status] = (statusCounts[response.status] ?? 0) + 1;

    if (response.status >= 500) {
      violations.push({ kind: "status", status: response.status, body: response.body, payload });
      continue;
    }

    if (response.status >= 400 && !allowedStatuses.has(response.status)) {
      violations.push({ kind: "status", status: response.status, body: response.body, payload });
      continue;
    }

    if (response.ok && options.assertPersisted) {
      try {
        await options.assertPersisted(payload, response);
      } catch (error) {
        violations.push({
          kind: "persistence",
          status: response.status,
          body: response.body,
          payload,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (response.ok && options.assertObservable) {
      try {
        await options.assertObservable(payload, response);
      } catch (error) {
        violations.push({
          kind: "observability",
          status: response.status,
          body: response.body,
          payload,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (violations.length > 0) {
    throw new Error(
      [
        `Payload matrix found ${violations.length} violation(s) across ${payloads.length} payloads.`,
        JSON.stringify(violations.slice(0, 20), null, 2),
        violations.length > 20 ? `...and ${violations.length - 20} more` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return { total: payloads.length, statusCounts };
}

function dedupeCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = tag(candidate);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildPayload(fields: Record<string, Candidate>): Payload {
  const payload: Payload = {};
  for (const [path, value] of Object.entries(fields)) {
    if (value === ABSENT) continue;
    setPath(payload, path, value);
  }
  return payload;
}

function setPath(target: Payload, path: string, value: unknown): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = target;
  for (const part of parts.slice(0, -1)) {
    const existing = cursor[part];
    if (existing == null || typeof existing !== "object" || Array.isArray(existing)) {
      cursor[part] = {};
    }
    cursor = cursor[part] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
}

function stablePayloadKey(fields: Record<string, Candidate>): string {
  return JSON.stringify(
    Object.entries(fields)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => [key, tag(value)]),
  );
}

function tag(value: Candidate): string {
  if (value === ABSENT) return "ABSENT";
  if (value === null) return "NULL";
  return `VALUE:${JSON.stringify(value)}`;
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
