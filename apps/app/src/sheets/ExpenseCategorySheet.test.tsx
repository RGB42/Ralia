import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from '../i18n/catalog.js';
import { ExpenseCategorySheet } from './ExpenseCategorySheet.js';

beforeEach(() => localStorage.setItem(LANG_STORAGE_KEY, 'de'));

describe('ExpenseCategorySheet', () => {
  it('returns a cent-precise category limit', async () => {
    const onSave = vi.fn();
    render(
      <I18nProvider>
        <ExpenseCategorySheet
          open
          initialName="Freizeit"
          initialLimit={null}
          onClose={() => {}}
          onSave={onSave}
        />
      </I18nProvider>,
    );
    await userEvent.type(screen.getByLabelText('Monatliches Limit'), '99,50');
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Freizeit', monthlyLimit: 99.5 });
  });
});
