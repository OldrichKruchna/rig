import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { readNight } from '../src/digest/read.js';
import type { RigConfig } from '../src/config.js';

const config: RigConfig = { adapter: 'test', installed: 'test', beatEverySeconds: 60, runsDir: 'runs' };

describe('GET /api/digest/:night', () => {
  it('returns the Night from readNight, jobs in the same order', async () => {
    const res = await createApp(config).request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(readNight('runs', '2026-10-28'));
  });

  it('404s for a night with no log', async () => {
    const res = await createApp(config).request('/api/digest/2000-01-01');
    expect(res.status).toBe(404);
  });
});
