// eslint-disable-next-line @backstage/no-undeclared-imports
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderInTestApp, TestApiRegistry } from '@backstage/test-utils';
import { pagerDutyApiRef } from '../../api';
import AutomaticMappingsDialog from './AutomaticMappingsDialog';
import { ApiProvider } from '@backstage/core-app-api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { catalogApiRef } from '@backstage/plugin-catalog-react';

describe('AutomaticMappingsDialog', () => {
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

  const mockGetEntities = jest.fn();
  const mockAutoMatchEntityMappings = jest.fn();
  const mockOnAutoMatchComplete = jest.fn();
  const mockSetIsOpen = jest.fn();

  const mockCatalogApi = {
    getEntities: mockGetEntities,
  };

  const mockPagerDutyApi = {
    autoMatchEntityMappings: mockAutoMatchEntityMappings,
  };

  const apis = TestApiRegistry.from(
    [catalogApiRef, mockCatalogApi],
    [pagerDutyApiRef, mockPagerDutyApi],
  );

  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  it('renders dialog when isOpen is true', async () => {
    mockGetEntities.mockResolvedValue({
      items: [],
    });

    await renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <AutomaticMappingsDialog
            isOpen
            setIsOpen={mockSetIsOpen}
            onAutoMatchComplete={mockOnAutoMatchComplete}
          />
        </QueryClientProvider>
      </ApiProvider>,
    );

    expect(screen.getByText('Service Auto-Mapping')).toBeInTheDocument();
  });

  it('loads teams from catalog API', async () => {
    await renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <AutomaticMappingsDialog
            isOpen
            setIsOpen={mockSetIsOpen}
            onAutoMatchComplete={mockOnAutoMatchComplete}
          />
        </QueryClientProvider>
      </ApiProvider>,
    );

    await waitFor(() => {
      expect(mockGetEntities).toHaveBeenCalledWith({
        filter: {
          kind: 'Group',
        },
      });
    });
  });

  it('enables Begin button when threshold is selected', async () => {
    mockGetEntities.mockResolvedValue({
      items: [],
    });

    await renderInTestApp(
      <ApiProvider apis={apis}>
        <QueryClientProvider client={queryClient}>
          <AutomaticMappingsDialog
            isOpen
            setIsOpen={mockSetIsOpen}
            onAutoMatchComplete={mockOnAutoMatchComplete}
          />
        </QueryClientProvider>
      </ApiProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('Service Auto-Mapping')).toBeInTheDocument();
    });

    const beginButton = screen.getByRole('button', { name: /Begin/i });
    expect(beginButton).toBeDisabled();

    const thresholdSelect = screen.getByLabelText(/Confidence Threshold/i);

    fireEvent.click(thresholdSelect);

    await waitFor(() => {
      const option100 = screen.getByRole('option', { name: /100%/i });
      expect(option100).toBeInTheDocument();
    });

    const option100 = screen.getByRole('option', { name: /100%/i });
    fireEvent.click(option100);

    await waitFor(() => {
      expect(beginButton).not.toBeDisabled();
    });
  });
});
