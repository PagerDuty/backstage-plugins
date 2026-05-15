import { CacheService } from '@backstage/backend-plugin-api';
import { AutoMatchJobRegistry } from './autoMatchJobs';
import type { AutoMatchEntityMappingsResponse } from '@pagerduty/backstage-plugin-common';

const emptyResult: AutoMatchEntityMappingsResponse = {
  matches: [],
  statistics: {
    totalPagerDutyServices: 0,
    totalBackstageComponents: 0,
    totalPossibleComparisons: 0,
    matchesFound: 0,
    exactMatches: 0,
    highConfidenceMatches: 0,
    mediumConfidenceMatches: 0,
    threshold: 100,
    loadTimeMs: 0,
    matchTimeMs: 0,
    totalTimeMs: 0,
  },
};

const createInMemoryCache = (): CacheService => {
  const store = new Map<string, unknown>();
  const api: CacheService = {
    async get(key) {
      return store.get(key) as never;
    },
    async set(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
    withOptions() {
      return api;
    },
  };
  return api;
};

const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 1000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await predicate())) {
    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for condition');
    }
    await new Promise(r => setTimeout(r, 5));
  }
};

describe('AutoMatchJobRegistry', () => {
  it('runs a job and marks it completed with the runner result', async () => {
    const cache = createInMemoryCache();
    const registry = new AutoMatchJobRegistry(cache, async () => emptyResult);

    const job = await registry.start({ threshold: 100, bestOnly: false });
    expect(['pending', 'running']).toContain(job.status);

    await waitFor(async () => {
      const latest = await registry.get(job.id);
      return latest?.status === 'completed';
    });

    const stored = await registry.get(job.id);
    expect(stored?.result).toEqual(emptyResult);
    expect(stored?.completedAt).toEqual(expect.any(String));
  });

  it('captures runner errors and marks the job failed', async () => {
    const cache = createInMemoryCache();
    const registry = new AutoMatchJobRegistry(cache, async () => {
      throw new Error('kaboom');
    });

    const job = await registry.start({ threshold: 100, bestOnly: false });
    await waitFor(async () => {
      const latest = await registry.get(job.id);
      return latest?.status === 'failed';
    });

    const stored = await registry.get(job.id);
    expect(stored?.error).toBe('kaboom');
    expect(stored?.result).toBeUndefined();
  });

  it('returns undefined for unknown job ids', async () => {
    const cache = createInMemoryCache();
    const registry = new AutoMatchJobRegistry(cache, async () => emptyResult);

    expect(await registry.get('nope')).toBeUndefined();
  });
});
