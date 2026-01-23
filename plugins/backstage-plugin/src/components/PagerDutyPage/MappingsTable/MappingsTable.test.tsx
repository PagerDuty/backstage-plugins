// eslint-disable-next-line @backstage/no-undeclared-imports
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { pagerDutyApiRef } from '../../../api';
import MappingsTable from './MappingsTable';
import { ApiProvider } from '@backstage/core-app-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('MappingsTable', () => {
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

  const mockGetEntityMappingsWithPagination = jest.fn();
  const mockPagerDutyApi = {
    getEntityMappingsWithPagination: mockGetEntityMappingsWithPagination,
  };

  const apis = TestApiRegistry.from([pagerDutyApiRef, mockPagerDutyApi]);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  it('renders entities when API returns data', async () => {
    const mockEntities = [
      {
        id: 'entity-1',
        name: 'my-service',
        namespace: 'default',
        type: 'service',
        system: 'core-platform',
        owner: 'team-platform',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'int-key-123',
          'pagerduty.com/service-id': 'PD123',
        },
        serviceName: 'My Service PD',
        serviceUrl: 'https://pagerduty.com/services/PD123',
        team: 'Platform Team',
        escalationPolicy: 'Default',
        status: 'InSync' as const,
        account: 'my-account',
      },
      {
        id: 'entity-2',
        name: 'another-service',
        namespace: 'default',
        type: 'service',
        system: 'payments',
        owner: 'team-payments',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'int-key-456',
          'pagerduty.com/service-id': 'PD456',
        },
        serviceName: 'Another Service PD',
        serviceUrl: 'https://pagerduty.com/services/PD456',
        team: 'Payments Team',
        escalationPolicy: 'Critical',
        status: 'NotMapped' as const,
        account: 'my-account',
      },
    ];

    mockGetEntityMappingsWithPagination.mockResolvedValue({
      entities: mockEntities,
      totalCount: 2,
    });

    await renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <MappingsTable />
        </QueryClientProvider>
      </ApiProvider>,
    );

    expect(screen.getByText('my-service')).toBeInTheDocument();
    expect(screen.getByText('another-service')).toBeInTheDocument();
    expect(screen.getByText('team-platform')).toBeInTheDocument();
    expect(screen.getByText('team-payments')).toBeInTheDocument();
  });

  it('renders different status values correctly', async () => {
    const mockEntities = [
      {
        id: 'entity-1',
        name: 'in-sync-service',
        namespace: 'default',
        type: 'service',
        system: 'core',
        owner: 'team-a',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'key-1',
          'pagerduty.com/service-id': 'PD1',
        },
        status: 'InSync' as const,
      },
      {
        id: 'entity-2',
        name: 'out-of-sync-service',
        namespace: 'default',
        type: 'service',
        system: 'core',
        owner: 'team-b',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'key-2',
          'pagerduty.com/service-id': 'PD2',
        },
        status: 'OutOfSync' as const,
      },
      {
        id: 'entity-3',
        name: 'not-mapped-service',
        namespace: 'default',
        type: 'service',
        system: 'core',
        owner: 'team-c',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'key-3',
          'pagerduty.com/service-id': 'PD3',
        },
        status: 'NotMapped' as const,
      },
      {
        id: 'entity-4',
        name: 'error-service',
        namespace: 'default',
        type: 'service',
        system: 'core',
        owner: 'team-d',
        lifecycle: 'production',
        annotations: {
          'pagerduty.com/integration-key': 'key-4',
          'pagerduty.com/service-id': 'PD4',
        },
        status: 'ErrorWhenFetchingService' as const,
      },
    ];

    mockGetEntityMappingsWithPagination.mockResolvedValue({
      entities: mockEntities,
      totalCount: 4,
    });

    await renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <MappingsTable />
        </QueryClientProvider>
      </ApiProvider>,
    );

    expect(screen.getByText('In Sync')).toBeInTheDocument();
    expect(screen.getByText('Out of Sync')).toBeInTheDocument();
    expect(screen.getByText('Not Mapped')).toBeInTheDocument();
    expect(
      screen.getByText('Error occured while fetching service'),
    ).toBeInTheDocument();
  });

  it('calls API with correct search parameters when search is performed', async () => {
    jest.useFakeTimers();
    mockGetEntityMappingsWithPagination.mockResolvedValue({
      entities: [],
      totalCount: 0,
    });

    await renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <MappingsTable />
        </QueryClientProvider>
      </ApiProvider>,
    );

    const searchInput = screen.getByPlaceholderText(
      'Search for components or teams',
    );

    await act(async () => {
      fireEvent.change(searchInput, { target: { value: 'my-component' } });
    });

    await act(async () => {
      jest.advanceTimersByTime(500);
    });

    await waitFor(() => {
      expect(mockGetEntityMappingsWithPagination).toHaveBeenCalledWith({
        offset: 0,
        limit: 10,
        search: 'my-component',
        searchFields: ['metadata.name', 'spec.owner'],
      });
    });

    jest.useRealTimers();
  });

  it('handles pagination correctly when navigating pages', async () => {
    const mockEntities = Array.from({ length: 10 }, (_, i) => ({
      id: `entity-${i}`,
      name: `service-${i}`,
      namespace: 'default',
      type: 'service',
      system: 'core',
      owner: `team-${i}`,
      lifecycle: 'production',
      annotations: {
        'pagerduty.com/integration-key': `key-${i}`,
        'pagerduty.com/service-id': `PD${i}`,
      },
      status: 'InSync' as const,
    }));

    mockGetEntityMappingsWithPagination.mockResolvedValue({
      entities: mockEntities,
      totalCount: 25,
    });

    await renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <MappingsTable />
        </QueryClientProvider>
      </ApiProvider>,
    );

    expect(mockGetEntityMappingsWithPagination).toHaveBeenCalledWith({
      offset: 0,
      limit: 10,
      search: '',
      searchFields: ['metadata.name', 'spec.owner'],
    });

    expect(screen.getByText('1 - 10 of 25')).toBeInTheDocument();

    const nextButton = screen.getByLabelText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    await waitFor(() => {
      expect(mockGetEntityMappingsWithPagination).toHaveBeenCalledWith({
        offset: 10,
        limit: 10,
        search: '',
        searchFields: ['metadata.name', 'spec.owner'],
      });
    });

    const previousButton = screen.getByLabelText('Previous');
    await act(async () => {
      fireEvent.click(previousButton);
    });

    await waitFor(() => {
      expect(mockGetEntityMappingsWithPagination).toHaveBeenCalledWith({
        offset: 0,
        limit: 10,
        search: '',
        searchFields: ['metadata.name', 'spec.owner'],
      });
    });
  });
});
