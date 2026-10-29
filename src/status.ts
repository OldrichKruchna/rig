import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RigConfig } from './config.js';
import { parseLine } from './digest/read.js';
import type { RunStatus } from './digest/types.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightCount[];
};

// Run lines per status for one night; bad lines are not counted.
export type NightCount = { night: string; counts: Record<RunStatus, number> };

export function countNight(runsDir: string, night: string): NightCount {
  const counts: Record<RunStatus, number> = { ok: 0, retry: 0, fail: 0 };
  try {
    for (const raw of readFileSync(join(runsDir, `${night}.jsonl`), 'utf8').split('\n')) {
      const line = parseLine(raw);
      if (line) counts[line.status]++;
    }
  } catch {
    // unreadable night: zero counts
  }
  return { night, counts };
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: nightsOnDisk(config.runsDir).map((n) => countNight(config.runsDir, n)),
  };
}
