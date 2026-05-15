import { v4 as uuid } from 'uuid';
import { CacheService } from '@backstage/backend-plugin-api';
import {
  AutoMatchEntityMappingsResponse,
  AutoMatchJobStatus,
} from '@pagerduty/backstage-plugin-common';

export interface AutoMatchJob {
  id: string;
  status: AutoMatchJobStatus;
  createdAt: string;
  completedAt?: string;
  result?: AutoMatchEntityMappingsResponse;
  error?: string;
}

export interface AutoMatchJobParams {
  threshold: number;
  bestOnly: boolean;
  team?: string;
  account?: string;
}

export type AutoMatchJobRunner = (
  params: AutoMatchJobParams,
) => Promise<AutoMatchEntityMappingsResponse>;

const JOB_TTL_MS = 30 * 60 * 1000;
const KEY_PREFIX = 'auto-match-job:';

const key = (id: string) => `${KEY_PREFIX}${id}`;

export class AutoMatchJobRegistry {
  constructor(
    private readonly cache: CacheService,
    private readonly runner: AutoMatchJobRunner,
    private readonly ttlMs: number = JOB_TTL_MS,
  ) {}

  async start(params: AutoMatchJobParams): Promise<AutoMatchJob> {
    const job: AutoMatchJob = {
      id: uuid(),
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    await this.write(job);

    // Kick off execution without awaiting.
    void this.execute(job, params);

    return job;
  }

  async get(jobId: string): Promise<AutoMatchJob | undefined> {
    return (await this.cache.get(key(jobId))) as AutoMatchJob | undefined;
  }

  private async write(job: AutoMatchJob): Promise<void> {
    await this.cache.set(key(job.id), job as unknown as Parameters<CacheService['set']>[1], { ttl: this.ttlMs });
  }

  private async execute(
    job: AutoMatchJob,
    params: AutoMatchJobParams,
  ): Promise<void> {
    const running: AutoMatchJob = { ...job, status: 'running' };
    await this.write(running);

    try {
      const result = await this.runner(params);
      await this.write({
        ...running,
        status: 'completed',
        result,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      await this.write({
        ...running,
        status: 'failed',
        error: error instanceof Error ? error.message : String(error),
        completedAt: new Date().toISOString(),
      });
    }
  }
}
