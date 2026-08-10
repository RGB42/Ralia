import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../i18n/catalog.js';
import { RecurrenceScopeDialog } from './RecurrenceScopeDialog.js';

describe('RecurrenceScopeDialog', () => {
  beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

  it('offers occurrence, future and whole-series scopes', async () => {
    const onSelect = vi.fn();
    render(
      <I18nProvider>
        <RecurrenceScopeDialog open canChooseFuture onClose={() => {}} onSelect={onSelect} />
      </I18nProvider>,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Nur diesen Termin' }));
    await userEvent.click(screen.getByRole('button', { name: 'Diesen und alle folgenden' }));
    await userEvent.click(screen.getByRole('button', { name: 'Die ganze Serie' }));
    expect(onSelect.mock.calls.map(([scope]) => scope)).toEqual(['occurrence', 'future', 'series']);
  });

  it('disables future scope for the first occurrence', () => {
    render(
      <I18nProvider>
        <RecurrenceScopeDialog
          open
          canChooseFuture={false}
          onClose={() => {}}
          onSelect={() => {}}
        />
      </I18nProvider>,
    );
    expect(screen.getByRole('button', { name: 'Diesen und alle folgenden' })).toBeDisabled();
  });
});
