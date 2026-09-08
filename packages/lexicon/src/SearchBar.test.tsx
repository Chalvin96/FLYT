import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SearchBar } from './SearchBar';

describe('SearchBar', () => {
  it('renders search input with placeholder', () => {
    render(<SearchBar value="" onChange={vi.fn()} onSearch={vi.fn()} />);
    expect(
      screen.getByPlaceholderText('Search for a word...'),
    ).toBeInTheDocument();
  });

  it('displays current value', () => {
    render(<SearchBar value="hund" onChange={vi.fn()} onSearch={vi.fn()} />);
    expect(screen.getByDisplayValue('hund')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    render(<SearchBar value="" onChange={onChange} onSearch={vi.fn()} />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'hund');

    expect(onChange).toHaveBeenCalled();
  });

  it('calls onSearch after debounce', async () => {
    const onSearch = vi.fn();
    const onChange = vi.fn();
    const { rerender } = render(
      <SearchBar value="" onChange={onChange} onSearch={onSearch} />,
    );

    // Change the value to trigger debounce
    rerender(
      <SearchBar value="hund" onChange={onChange} onSearch={onSearch} />,
    );

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith('hund');
    });
  });

  it('shows clear button when value is not empty', () => {
    render(<SearchBar value="hund" onChange={vi.fn()} onSearch={vi.fn()} />);
    expect(
      screen.getByRole('button', { name: /clear search/i }),
    ).toBeInTheDocument();
  });

  it('renders the clear button as a 44px touch target', () => {
    render(<SearchBar value="hund" onChange={vi.fn()} onSearch={vi.fn()} />);

    expect(screen.getByRole('button', { name: /clear search/i })).toHaveClass(
      'h-11',
      'w-11',
    );
  });

  it('clears the query when the clear button is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSearch = vi.fn();

    render(<SearchBar value="hund" onChange={onChange} onSearch={onSearch} />);

    await user.click(screen.getByRole('button', { name: /clear search/i }));

    expect(onChange).toHaveBeenCalledWith('');
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('clears input when clear button clicked', async () => {
    const onChange = vi.fn();
    const onSearch = vi.fn();
    render(<SearchBar value="hund" onChange={onChange} onSearch={onSearch} />);

    await userEvent.click(
      screen.getByRole('button', { name: /clear search/i }),
    );
    expect(onChange).toHaveBeenCalledWith('');
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('shows validation error for invalid Norwegian characters', () => {
    render(
      <SearchBar value="hello123" onChange={vi.fn()} onSearch={vi.fn()} />,
    );
    expect(
      screen.getByText(
        /Please use letters only\. Norwegian letters like ae, oe, and aa are supported\./i,
      ),
    ).toBeInTheDocument();
  });

  it('does not show error for valid Norwegian characters', () => {
    render(<SearchBar value="båt" onChange={vi.fn()} onSearch={vi.fn()} />);
    expect(
      screen.queryByText(
        /Please use letters only\. Norwegian letters like ae, oe, and aa are supported\./i,
      ),
    ).not.toBeInTheDocument();
  });
});
