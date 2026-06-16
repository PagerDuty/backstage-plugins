import { mockServices } from '@backstage/backend-test-utils';
import { PagerDutyBackendStore } from '../db';
import {
  readSyncLogsCleanupConfig,
  runSyncLogsCleanup,
} from './syncLogsCleanup';

describe('readSyncLogsCleanupConfig', () => {
  it('returns defaults when no config is set', () => {
    const config = mockServices.rootConfig({ data: {} });

    expect(readSyncLogsCleanupConfig(config)).toEqual({
      enabled: true,
      retentionDays: 30,
      maxRows: 500_000,
      frequencyMinutes: 15,
      batchSize: 10_000,
      maxBatchesPerRun: 500,
    });
  });

  it('reads configured values', () => {
    const config = mockServices.rootConfig({
      data: {
        pagerDuty: {
          customFieldsSyncLogs: {
            retentionDays: 7,
            maxRows: 50_000,
            cleanup: {
              enabled: false,
              frequencyMinutes: 60,
              batchSize: 1_000,
              maxBatchesPerRun: 10,
            },
          },
        },
      },
    });

    expect(readSyncLogsCleanupConfig(config)).toEqual({
      enabled: false,
      retentionDays: 7,
      maxRows: 50_000,
      frequencyMinutes: 60,
      batchSize: 1_000,
      maxBatchesPerRun: 10,
    });
  });

  it('clamps values to sane minimums', () => {
    const config = mockServices.rootConfig({
      data: {
        pagerDuty: {
          customFieldsSyncLogs: {
            retentionDays: 0,
            maxRows: 10,
            cleanup: {
              frequencyMinutes: 0,
              batchSize: 1,
              maxBatchesPerRun: 0,
            },
          },
        },
      },
    });

    expect(readSyncLogsCleanupConfig(config)).toEqual({
      enabled: true,
      retentionDays: 1,
      maxRows: 1000,
      frequencyMinutes: 1,
      batchSize: 100,
      maxBatchesPerRun: 1,
    });
  });
});

describe('runSyncLogsCleanup', () => {
  const cleanupConfig = {
    enabled: true,
    retentionDays: 30,
    maxRows: 500_000,
    frequencyMinutes: 15,
    batchSize: 10_000,
    maxBatchesPerRun: 500,
  };

  function createStore(
    cleanupSyncLogs: jest.Mock,
  ): PagerDutyBackendStore {
    return { cleanupSyncLogs } as unknown as PagerDutyBackendStore;
  }

  it('runs the cleanup with the configured thresholds and logs the result', async () => {
    const cleanupSyncLogs = jest.fn().mockResolvedValue({
      deletedByAge: 12,
      deletedByCap: 3,
      batchesUsed: 2,
    });
    const logger = mockServices.logger.mock();

    await runSyncLogsCleanup({
      store: createStore(cleanupSyncLogs),
      logger,
      cleanupConfig,
    });

    expect(cleanupSyncLogs).toHaveBeenCalledWith({
      olderThanDays: 30,
      maxRows: 500_000,
      batchSize: 10_000,
      maxBatchesPerRun: 500,
    });
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('deleted 12 expired and 3 over-cap row(s)'),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('logs correctly when age phase empties the table (no cap deletions)', async () => {
    const cleanupSyncLogs = jest.fn().mockResolvedValue({
      deletedByAge: 50,
      deletedByCap: 0,
      batchesUsed: 1,
    });
    const logger = mockServices.logger.mock();

    await runSyncLogsCleanup({
      store: createStore(cleanupSyncLogs),
      logger,
      cleanupConfig,
    });

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('deleted 50 expired and 0 over-cap row(s)'),
    );
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('warns when the batch budget was exhausted', async () => {
    const cleanupSyncLogs = jest.fn().mockResolvedValue({
      deletedByAge: 5_000_000,
      deletedByCap: 0,
      batchesUsed: 500,
    });
    const logger = mockServices.logger.mock();

    await runSyncLogsCleanup({
      store: createStore(cleanupSyncLogs),
      logger,
      cleanupConfig,
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('exhausted its batch budget'),
    );
  });

  it('logs store errors instead of throwing', async () => {
    const cleanupSyncLogs = jest
      .fn()
      .mockRejectedValue(new Error('database is locked'));
    const logger = mockServices.logger.mock();

    await expect(
      runSyncLogsCleanup({
        store: createStore(cleanupSyncLogs),
        logger,
        cleanupConfig,
      }),
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('database is locked'),
    );
  });
});
