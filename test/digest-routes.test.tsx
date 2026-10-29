import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const NORMAL = '2026-01-01';
const EMPTY = '2026-01-02';
const BAD = '2026-01-03';
const MISSING = '2026-01-04';

const normalLog = [
  { at: '2026-01-01T02:00:00+01:00', job: 'backup', status: 'ok', owner: 'ana' },
  { at: '2026-01-01T02:10:00+01:00', job: 'sync', status: 'retry', owner: null },
  { at: '2026-01-01T02:20:00+01:00', job: 'sync', status: 'fail', owner: null, error: 'timeout' },
]
  .map((l) => JSON.stringify(l))
  .join('\n');

const badLog = [
  JSON.stringify({ at: '2026-01-03T02:00:00+01:00', job: 'backup', status: 'ok', owner: 'ana' }),
  'this is not json',
].join('\n');

let runsDir = '';
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
  mkdirSync(runsDir, { recursive: true });
  writeFileSync(join(runsDir, `${NORMAL}.jsonl`), `${normalLog}\n`);
  writeFileSync(join(runsDir, `${EMPTY}.jsonl`), '');
  writeFileSync(join(runsDir, `${BAD}.jsonl`), `${badLog}\n`);
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('GET /digest/:night', () => {
  it('renders rows in job order, with — for a missing owner and warn on trouble', async () => {
    const res = await app.request(`/digest/${NORMAL}`);
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.indexOf('backup')).toBeGreaterThan(-1);
    expect(html.indexOf('backup')).toBeLessThan(html.indexOf('sync'));
    expect(html).toContain('—');
    expect(html).toContain('class="warn"');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request(`/digest/${MISSING}`)).status).toBe(404);
  });

  it('says "nothing ran" for an empty night', async () => {
    const res = await app.request(`/digest/${EMPTY}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('survives a bad line and still shows the good rows', async () => {
    const res = await app.request(`/digest/${BAD}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('backup');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns the Night as JSON', async () => {
    const res = await app.request(`/api/digest/${NORMAL}`);
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.night).toBe(NORMAL);
    expect(night.badLines).toBe(0);
    expect(night.rows.map((r) => r.job)).toEqual(['backup', 'sync']);
    expect(night.rows[1]?.lastStatus).toBe('fail');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request(`/api/digest/${MISSING}`)).status).toBe(404);
  });

  it('empty night has no rows', async () => {
    const night = (await (await app.request(`/api/digest/${EMPTY}`)).json()) as Night;
    expect(night.rows).toEqual([]);
  });

  it('counts a bad line instead of throwing', async () => {
    const res = await app.request(`/api/digest/${BAD}`);
    expect(res.status).toBe(200);
    const night = (await res.json()) as Night;
    expect(night.badLines).toBe(1);
    expect(night.rows).toHaveLength(1);
  });
});
