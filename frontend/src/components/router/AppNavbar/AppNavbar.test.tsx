import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { useRouterState } from '@tanstack/react-router';

import { AppNavbarPreview } from './AppNavbarPreview';

function CurrentPath() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return <div data-testid="pathname">{pathname}</div>;
}

describe('AppNavbar', () => {
  it('renders 4 nav items in mobile nav and keeps account in the mobile header', async () => {
    render(
      <AppNavbarPreview initialPath="/home">
        <CurrentPath />
      </AppNavbarPreview>,
    );

    const mobileNav = await screen.findByRole('navigation', {
      name: /mobile navigation/i,
    });

    expect(
      within(mobileNav).getByRole('link', { name: /home/i }),
    ).toBeInTheDocument();
    expect(
      within(mobileNav).getByRole('link', { name: /lesson/i }),
    ).toBeInTheDocument();
    expect(
      within(mobileNav).getByRole('link', { name: /practice/i }),
    ).toBeInTheDocument();
    expect(
      within(mobileNav).queryByRole('link', { name: /search/i }),
    ).not.toBeInTheDocument();
    expect(
      within(mobileNav).getByRole('link', { name: /reading/i }),
    ).toBeInTheDocument();
    expect(
      within(mobileNav).queryByRole('link', { name: 'Account' }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Account' })).toHaveLength(2);
  });

  it('marks the current route as active', async () => {
    render(
      <AppNavbarPreview initialPath="/reading">
        <CurrentPath />
      </AppNavbarPreview>,
    );

    const mobileNav = await screen.findByRole('navigation', {
      name: /mobile navigation/i,
    });

    expect(
      within(mobileNav).getByRole('link', { name: /reading/i }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('navigates when a nav item is clicked', async () => {
    const user = userEvent.setup();

    render(
      <AppNavbarPreview initialPath="/home">
        <CurrentPath />
      </AppNavbarPreview>,
    );

    await screen.findByRole('navigation', {
      name: /mobile navigation/i,
    });

    await user.click(screen.getAllByRole('link', { name: 'Account' })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('pathname')).toHaveTextContent('/account');
    });
    expect(screen.getAllByRole('link', { name: 'Account' })[0]).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('has search icon button on desktop navbar', async () => {
    render(
      <AppNavbarPreview initialPath="/home">
        <CurrentPath />
      </AppNavbarPreview>,
    );

    expect(
      await screen.findAllByRole('button', { name: 'Search dictionary' }),
    ).toHaveLength(2);
  });

  it('clicking search icon button opens lookup sheet in search mode', async () => {
    const user = userEvent.setup();

    render(
      <AppNavbarPreview initialPath="/home">
        <CurrentPath />
      </AppNavbarPreview>,
    );

    const searchButtons = await screen.findAllByRole('button', {
      name: 'Search dictionary',
    });

    await user.click(searchButtons[1]);

    // The dialog should open with the search input
    const searchInput = await screen.findByPlaceholderText(
      'Search a Norwegian word',
    );
    expect(searchInput).toBeInTheDocument();
  });

  it('mobile header has search icon button and it opens lookup sheet', async () => {
    const user = userEvent.setup();

    render(
      <AppNavbarPreview initialPath="/home">
        <CurrentPath />
      </AppNavbarPreview>,
    );

    // Find the search button (multiple instances: mobile header + desktop)
    const searchButtons = await screen.findAllByRole('button', {
      name: 'Search dictionary',
    });
    expect(searchButtons.length).toBeGreaterThan(0);

    // Click the mobile header search button (the lg:hidden one)
    const mobileSearchBtn = searchButtons[0];
    await user.click(mobileSearchBtn);

    // The dialog should open with the search input
    const searchInput = await screen.findByPlaceholderText(
      'Search a Norwegian word',
    );
    expect(searchInput).toBeInTheDocument();
  });
});
