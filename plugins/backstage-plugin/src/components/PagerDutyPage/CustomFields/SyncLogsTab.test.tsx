// eslint-disable-next-line @backstage/no-undeclared-imports
import { screen, waitFor } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider } from '@backstage/core-app-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pagerDutyApiRef } from '../../../api';
import { SyncLogsTab } from './SyncLogsTab';
import { AccountProvider } from '../AccountContext';

describe('SyncLogsTab', () => {
  beforeAll(() => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });

  const mockGetSyncLogs = jest.fn();
  const mockGetAccounts = jest.fn();
  const mockPagerDutyApi = {
    getSyncLogs: mockGetSyncLogs,
    getAccounts: mockGetAccounts,
  };

  const apis = TestApiRegistry.from([pagerDutyApiRef, mockPagerDutyApi]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  beforeEach(() => {
    mockGetSyncLogs.mockReset();
    mockGetAccounts.mockReset();
    mockGetAccounts.mockResolvedValue([{ id: 'test-account', isDefault: true }]);
  });

  const renderTab = () =>
    renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <AccountProvider>
            <SyncLogsTab />
          </AccountProvider>
        </QueryClientProvider>
      </ApiProvider>,
    );

  it('renders sync log rows returned by the API', async () => {
    mockGetSyncLogs.mockResolvedValue({
      logs: [
        {
          id: 1,
          timestamp: new Date('2026-05-01T10:00:00Z'),
          errorCode: 'INVALID_PATH',
          customFieldId: 'PD1',
          customFieldName: 'Team',
          entityPath: 'spec.owner',
          serviceId: 'PSERV1',
          serviceName: 'my-service',
          errorMessage: 'path resolves to undefined',
          subdomain: 'test-account',
        },
      ],
      total: 1,
      customFieldNames: ['Team'],
      entityPaths: ['spec.owner'],
      serviceNames: ['my-service'],
    });

    const { container } = await renderTab();

    await waitFor(() => {
      expect(mockGetSyncLogs).toHaveBeenCalled();
    });

    // Wait for rows to render — once the rowgroup has 2+ rows the header row
    // and at least one data row are present.
    await waitFor(() => {
      const rows = container.querySelectorAll('[role="row"]');
      expect(rows.length).toBeGreaterThan(1);
    });
    expect(container.textContent).toContain('my-service');
    expect(container.textContent).toContain('Team');
    expect(container.textContent).toContain('spec.owner');
    expect(container.textContent).toContain('path resolves to undefined');
  });

  it('renders an Info badge for SYNC_SUCCESS rows', async () => {
    mockGetSyncLogs.mockResolvedValue({
      logs: [
        {
          id: 1,
          timestamp: new Date('2026-05-01T10:00:00Z'),
          errorCode: 'SYNC_SUCCESS',
          customFieldId: 'PD1',
          customFieldName: 'Team',
          entityPath: 'spec.owner',
          serviceId: 'PSERV1',
          serviceName: 'my-service',
          errorMessage: 'Synced successfully',
          subdomain: 'test-account',
        },
      ],
      total: 1,
      customFieldNames: ['Team'],
      entityPaths: ['spec.owner'],
      serviceNames: ['my-service'],
    });

    const { container } = await renderTab();

    await waitFor(() => {
      const rows = container.querySelectorAll('[role="row"]');
      expect(rows.length).toBeGreaterThan(1);
    });
    // "Info" also appears in the hidden native <option> of the severity
    // filter, so scope the assertion to the severity badge span itself.
    const badge = container.querySelector('[class*="severityBadge"]');
    expect(badge).toHaveTextContent('Info');
  });

  it('shows the empty state when no logs are returned', async () => {
    mockGetSyncLogs.mockResolvedValue({
      logs: [],
      total: 0,
      customFieldNames: [],
      entityPaths: [],
      serviceNames: [],
    });

    await renderTab();

    await waitFor(() => {
      expect(screen.getByText('No sync log entries found')).toBeInTheDocument();
    });
  });
});
