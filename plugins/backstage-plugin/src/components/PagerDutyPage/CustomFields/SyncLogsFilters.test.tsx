// eslint-disable-next-line @backstage/no-undeclared-imports
import { fireEvent, screen } from '@testing-library/react';
import { renderInTestApp } from '@backstage/test-utils';
import {
  SyncLogsFilters,
  EMPTY_SYNC_LOG_FILTERS,
} from './SyncLogsFilters';

describe('SyncLogsFilters', () => {
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

  it('renders the export button and triggers onExport when clicked', async () => {
    const onExport = jest.fn();
    await renderInTestApp(
      <SyncLogsFilters
        values={EMPTY_SYNC_LOG_FILTERS}
        onChange={() => {}}
        customFieldOptions={[{ value: '', label: 'All' }]}
        entityPathOptions={[{ value: '', label: 'All' }]}
        serviceOptions={[{ value: '', label: 'All' }]}
        onExport={onExport}
      />,
    );

    const exportButton = screen.getByRole('button', { name: /Export CSV/i });
    expect(exportButton).toBeInTheDocument();

    fireEvent.click(exportButton);
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('disables the export button when exportDisabled is true', async () => {
    await renderInTestApp(
      <SyncLogsFilters
        values={EMPTY_SYNC_LOG_FILTERS}
        onChange={() => {}}
        customFieldOptions={[{ value: '', label: 'All' }]}
        entityPathOptions={[{ value: '', label: 'All' }]}
        serviceOptions={[{ value: '', label: 'All' }]}
        onExport={() => {}}
        exportDisabled
      />,
    );

    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeDisabled();
  });
});
