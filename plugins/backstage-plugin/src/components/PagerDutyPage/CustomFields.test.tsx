// eslint-disable-next-line @backstage/no-undeclared-imports
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider } from '@backstage/core-app-api';
import { pagerDutyApiRef } from '../../api';
import { CustomFields } from './CustomFields';

describe('CustomFields', () => {
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

  const mockGetCustomFields = jest.fn();
  const mockGetSyncLogs = jest.fn();
  const mockGetAccounts = jest.fn();
  const mockGetSetting = jest.fn();
  const mockStoreSettings = jest.fn();
  const mockPagerDutyApi = {
    getCustomFields: mockGetCustomFields,
    getSyncLogs: mockGetSyncLogs,
    getAccounts: mockGetAccounts,
    getSetting: mockGetSetting,
    storeSettings: mockStoreSettings,
  };

  const apis = TestApiRegistry.from([pagerDutyApiRef, mockPagerDutyApi]);

  beforeEach(() => {
    mockGetCustomFields.mockReset();
    mockGetSyncLogs.mockReset();
    mockGetAccounts.mockReset();
    mockGetSetting.mockReset();
    mockStoreSettings.mockReset();
    mockGetAccounts.mockResolvedValue([{ id: 'test-account', isDefault: true }]);
    mockGetCustomFields.mockResolvedValue({ customFields: [] });
    mockGetSetting.mockResolvedValue({
      id: 'settings::data-sync',
      value: 'disabled',
    });
    mockStoreSettings.mockResolvedValue({ status: 200 } as Response);
    mockGetSyncLogs.mockResolvedValue({
      logs: [],
      total: 0,
      customFieldNames: [],
      entityPaths: [],
      serviceNames: [],
    });
  });

  it('renders both tabs and shows the custom fields panel by default', async () => {
    await renderInTestApp(
      <ApiProvider apis={apis}>
        <CustomFields />
      </ApiProvider>,
    );

    expect(
      screen.getByRole('button', { name: 'Custom Fields' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Activity Logs' }),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText('No custom fields have been added'),
      ).toBeInTheDocument();
    });
  });

  it('switches to the sync logs tab when Activity Logs is clicked', async () => {
    await renderInTestApp(
      <ApiProvider apis={apis}>
        <CustomFields />
      </ApiProvider>,
    );

    await waitFor(() => {
      expect(
        screen.getByText('No custom fields have been added'),
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Activity Logs' }));

    await waitFor(() => {
      expect(
        screen.getByText('No sync log entries found'),
      ).toBeInTheDocument();
    });
  });

  it('reflects the stored data-sync setting on load', async () => {
    mockGetSetting.mockResolvedValue({
      id: 'settings::data-sync',
      value: 'enabled',
    });

    await renderInTestApp(
      <ApiProvider apis={apis}>
        <CustomFields />
      </ApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Org-Wide Data Sync: On')).toBeInTheDocument();
    });
    expect(mockGetSetting).toHaveBeenCalledWith('settings::data-sync');
  });

  it('persists the data-sync setting when the toggle is flipped', async () => {
    await renderInTestApp(
      <ApiProvider apis={apis}>
        <CustomFields />
      </ApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Org-Wide Data Sync: Off')).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole('switch', { name: 'Toggle org-wide data sync' }),
    );

    await waitFor(() => {
      expect(mockStoreSettings).toHaveBeenCalledWith([
        { id: 'settings::data-sync', value: 'enabled' },
      ]);
    });
    expect(screen.getByText('Org-Wide Data Sync: On')).toBeInTheDocument();
  });
});
