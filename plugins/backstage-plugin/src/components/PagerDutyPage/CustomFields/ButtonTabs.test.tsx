// eslint-disable-next-line @backstage/no-undeclared-imports
import { fireEvent, render, screen } from '@testing-library/react';
import { ButtonTabs, ButtonTabItem } from './ButtonTabs';

describe('ButtonTabs', () => {
  const items: ButtonTabItem<'a' | 'b'>[] = [
    { key: 'a', label: 'Alpha' },
    { key: 'b', label: 'Beta' },
  ];

  it('renders all tabs and marks the active one as pressed', () => {
    render(<ButtonTabs items={items} value="a" onChange={() => {}} />);

    const alpha = screen.getByRole('button', { name: 'Alpha' });
    const beta = screen.getByRole('button', { name: 'Beta' });

    expect(alpha).toBeInTheDocument();
    expect(beta).toBeInTheDocument();
    expect(alpha).toHaveAttribute('aria-pressed', 'true');
    expect(beta).toHaveAttribute('aria-pressed', 'false');
  });

  it('fires onChange with the clicked key', () => {
    const onChange = jest.fn();
    render(<ButtonTabs items={items} value="a" onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: 'Beta' }));

    expect(onChange).toHaveBeenCalledWith('b');
  });
});
