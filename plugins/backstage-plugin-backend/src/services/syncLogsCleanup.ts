import {
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { PagerDutyBackendStore } from '../db';

export interface SyncLogsCleanupConfig {
  enabled: boolean;
  retentionDays: number;
  maxRows: number;
  frequencyMinutes: number;
  batchSize: number;
  maxBatchesPerRun: number;
}

const DEFAULTS: SyncLogsCleanupConfig = {
  enabled: true,
  retentionDays: 30,
  maxRows: 500_000,
  frequencyMinutes: 15,
  batchSize: 10_000,
  maxBatchesPerRun: 500,
};

const CONFIG_ROOT = 'pagerDuty.customFieldsSyncLogs';

export function readSyncLogsCleanupConfig(
  config: RootConfigService,
): SyncLogsCleanupConfig {
  const clamp = (value: number | undefined, fallback: number, min: number) =>
    Math.max(Math.floor(value ?? fallback), min);

  return {
    enabled:
      config.getOptionalBoolean(`${CONFIG_ROOT}.cleanup.enabled`) ??
      DEFAULTS.enabled,
    retentionDays: clamp(
      config.getOptionalNumber(`${CONFIG_ROOT}.retentionDays`),
      DEFAULTS.retentionDays,
      1,
    ),
    maxRows: clamp(
      config.getOptionalNumber(`${CONFIG_ROOT}.maxRows`),
      DEFAULTS.maxRows,
      1000,
    ),
    frequencyMinutes: clamp(
      config.getOptionalNumber(`${CONFIG_ROOT}.cleanup.frequencyMinutes`),
      DEFAULTS.frequencyMinutes,
      1,
    ),
    batchSize: clamp(
      config.getOptionalNumber(`${CONFIG_ROOT}.cleanup.batchSize`),
      DEFAULTS.batchSize,
      100,
    ),
    maxBatchesPerRun: clamp(
      config.getOptionalNumber(`${CONFIG_ROOT}.cleanup.maxBatchesPerRun`),
      DEFAULTS.maxBatchesPerRun,
      1,
    ),
  };
}

export async function runSyncLogsCleanup(options: {
  store: PagerDutyBackendStore;
  logger: LoggerService;
  cleanupConfig: SyncLogsCleanupConfig;
}): Promise<void> {
  const { store, logger, cleanupConfig } = options;
  const startedAt = Date.now();

  try {
    const result = await store.cleanupSyncLogs({
      olderThanDays: cleanupConfig.retentionDays,
      maxRows: cleanupConfig.maxRows,
      batchSize: cleanupConfig.batchSize,
      maxBatchesPerRun: cleanupConfig.maxBatchesPerRun,
    });

    const durationMs = Date.now() - startedAt;
    logger.info(
      `Sync log cleanup: deleted ${result.deletedByAge} expired and ${result.deletedByCap} over-cap row(s) in ${result.batchesUsed} batch(es) (${durationMs}ms)`,
    );

    if (result.batchesUsed >= cleanupConfig.maxBatchesPerRun) {
      logger.warn(
        `Sync log cleanup exhausted its batch budget (${cleanupConfig.maxBatchesPerRun} batches of ${cleanupConfig.batchSize}); a backlog remains and will be processed on the next run`,
      );
    }
  } catch (error) {
    // A failed cleanup must never crash the backend; the scheduler retries on
    // the next cycle.
    logger.error(
      `Sync log cleanup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
}
