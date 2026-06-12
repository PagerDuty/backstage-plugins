import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import { pagerDutyPlugin } from './plugin';

describe('pagerDutyPlugin', () => {
  it('schedules the sync log cleanup task with global scope', async () => {
    const scheduler = mockServices.scheduler.mock();

    await startTestBackend({
      features: [pagerDutyPlugin, scheduler.factory],
    });

    expect(scheduler.scheduleTask).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'pagerduty-custom-field-sync-logs-cleanup',
        frequency: { minutes: 15 },
        scope: 'global',
      }),
    );
  });

  it('does not schedule the cleanup task when disabled in config', async () => {
    const scheduler = mockServices.scheduler.mock();

    await startTestBackend({
      features: [
        pagerDutyPlugin,
        scheduler.factory,
        mockServices.rootConfig.factory({
          data: {
            pagerDuty: {
              customFieldsSyncLogs: { cleanup: { enabled: false } },
            },
          },
        }),
      ],
    });

    expect(scheduler.scheduleTask).not.toHaveBeenCalled();
  });
});
