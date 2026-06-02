// eslint-disable-next-line @backstage/no-undeclared-imports
import { screen, waitFor } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { ApiProvider } from '@backstage/core-app-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { pagerDutyApiRef } from '../../../api';
import { CustomFieldsTabPanel } from './CustomFieldsTabPanel';
import { AccountProvider } from '../AccountContext';

describe('CustomFieldsTabPanel', () => {
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
  const mockGetAccounts = jest.fn();
  const mockPagerDutyApi = {
    getCustomFields: mockGetCustomFields,
    getAccounts: mockGetAccounts,
  };

  const apis = TestApiRegistry.from([pagerDutyApiRef, mockPagerDutyApi]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  beforeEach(() => {
    mockGetCustomFields.mockReset();
    mockGetAccounts.mockReset();
    mockGetAccounts.mockResolvedValue([{ id: 'test-account', isDefault: true }]);
  });

  const renderPanel = () =>
    renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <AccountProvider>
            <CustomFieldsTabPanel />
          </AccountProvider>
        </QueryClientProvider>
      </ApiProvider>,
    );

  it('renders custom fields when the API returns data', async () => {
    mockGetCustomFields.mockResolvedValue({
      customFields: [
        {
          id: 1,
          pagerdutyCustomFieldId: 'PDCF1',
          pagerdutyCustomFieldDisplayName: 'Team',
          pagerdutyCustomFieldEnabled: true,
          backstageEntityMappingPath: 'spec.owner',
          pagerdutySubdomain: 'test-account',
          description: 'Owning team',
          createdAt: new Date('2026-01-01T00:00:00Z'),
          updatedAt: new Date('2026-01-01T00:00:00Z'),
        },
      ],
    });

    await renderPanel();

    await waitFor(() => {
      expect(screen.getByText('Team')).toBeInTheDocument();
    });
    expect(screen.getByText('spec.owner')).toBeInTheDocument();
    expect(screen.getByText('Owning team')).toBeInTheDocument();
  });

  it('shows the empty state when there are no custom fields', async () => {
    mockGetCustomFields.mockResolvedValue({ customFields: [] });

    await renderPanel();

    await waitFor(() => {
      expect(
        screen.getByText('No custom fields have been added'),
      ).toBeInTheDocument();
    });
  });
});
