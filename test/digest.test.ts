import { describe, expect, it } from 'vitest';
import { digest, readNight } from '../src/digest/read.js';

describe('run log reader', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night).not.toBeNull();
    expect(night!.badLines).toBe(1);
    expect(night!.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the last status, error and the log offsets', () => {
    const rows = readNight('runs', '2026-10-28')!.rows;
    const refresh = rows.find((r) => r.job === 'fixtures/refresh')!;
    expect(refresh).toMatchObject({
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
    const backup = rows.find((r) => r.job === 'notes/backup')!;
    expect(backup).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', runs: 1 });
    const sync = rows.find((r) => r.job === 'lane/sync')!;
    expect(sync).toMatchObject({ runs: 8, retries: 1, lastStatus: 'ok' });
  });

  it('keeps a row whose owner is null', () => {
    const render = readNight('runs', '2026-10-28')!.rows.find((r) => r.job === 'digest/render')!;
    expect(render.owner).toBeNull();
  });

  it('returns null for a night with no file', () => {
    expect(readNight('runs', '2026-01-01')).toBeNull();
    expect(readNight('runs', '../package')).toBeNull();
  });

  it('renders an empty night and counts lines that do not parse', () => {
    expect(digest('2026-10-30', '')).toEqual({ night: '2026-10-30', rows: [], badLines: 0 });
    const n = digest('2026-10-30', 'not json\n{"at":"x","job":"a","status":"nope","owner":null}\n');
    expect(n.badLines).toBe(2);
    expect(n.rows).toEqual([]);
  });
});
