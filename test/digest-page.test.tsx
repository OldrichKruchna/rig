import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };

describe('digest page', () => {
  it('renders a real night', async () => {
    const app = createApp({ ...base, runsDir: 'runs' });
    const res = await app.request('/digest/2026-10-28');
    expect(res.status).toBe(200);
    const api = await app.request('/api/digest/2026-10-28');
    expect(((await api.json()) as { night: string }).night).toBe('2026-10-28');
  });

  it('404s for a missing night, "nothing ran" for an empty one', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    const app = createApp({ ...base, runsDir: dir });
    expect((await app.request('/digest/2026-01-02')).status).toBe(404);
    expect((await app.request('/api/digest/2026-01-02')).status).toBe(404);
    expect(await (await app.request('/digest/2026-01-01')).text()).toContain('nothing ran');
  });

  it('marks warn rows and shows — for null owner', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    const l = (job: string, status: string) => JSON.stringify({ at: '2026-01-01T01:00:00+01:00', job, status, owner: null });
    writeFileSync(join(dir, '2026-01-01.jsonl'), [l('a', 'ok'), l('b', 'fail')].join('\n'));
    const html = await (await createApp({ ...base, runsDir: dir }).request('/digest/2026-01-01')).text();
    expect(html).toContain('<tr class="warn"><td>b</td><td>—</td>');
    expect(html).not.toContain('<tr class="warn"><td>a');
  });
});
