import type { NotesTodo, NotesTodoGroupsRow, ProfilesRow, SessionState } from '@ralia/data';
import { ThemeProvider, ToastProvider } from '@ralia/ui';
import { render } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { vi } from 'vitest';
import { AuthContext, type ActionResult, type AuthContextValue } from './auth/AuthProvider.js';
import { DataContext, type DataServices } from './data/DataProvider.js';
import { I18nProvider } from './i18n/I18nProvider.js';
import { LANG_STORAGE_KEY } from './i18n/catalog.js';
import { MOCK_TODOS, MOCK_TODO_LISTS } from './mock/fixtures.js';
import { routes } from './routes/router.js';

/**
 * Der Provider-Stapel der echten App fuer Tests, die mehr als eine Route
 * beruehren. Die Screens setzen ihn voraus: Einstellungen brauchen Theme und
 * Toast, jeder Screen den Katalog. Ohne ihn wirft der Baum beim Rendern, und
 * der Test scheitert an einer Meldung, die nichts mit seiner Zusicherung zu
 * tun hat.
 */

/** jsdom kennt matchMedia nicht; der ThemeProvider fragt es beim Rendern ab. */
export function stubMatchMedia(darkPreferred = false): void {
  vi.stubGlobal('matchMedia', () => ({
    matches: darkPreferred,
    media: '(prefers-color-scheme: dark)',
    addEventListener() {},
    removeEventListener() {},
  }));
}

/**
 * Sprache festnageln. jsdom meldet `navigator.language` als `en-US`, sonst
 * haengt jede Beschriftungspruefung am Umgebungslocale.
 */
export function pinLanguage(lang: 'de' | 'en' = 'de'): void {
  localStorage.setItem(LANG_STORAGE_KEY, lang);
}

export const TEST_USER_ID = '11111111-1111-4111-8111-111111111111';
export const TEST_PARTNER_ID = '22222222-2222-4222-8222-222222222222';

export const TEST_PROFILE: ProfilesRow = {
  id: TEST_USER_ID,
  name: 'Lena',
  email: 'lena@example.com',
  invite_code: 'R7K2QM',
  partner_id: null,
  timezone: 'Europe/Berlin',
  anniversary_date: null,
  plan_tier: 'free',
  plan_status: 'inactive',
  ls_customer_id: null,
  ls_subscription_id: null,
  pro_expires_at: null,
  created_at: '2026-01-01T00:00:00Z',
};

export function signedInState(profile: ProfilesRow = TEST_PROFILE): SessionState {
  return {
    status: 'signed-in',
    offline: false,
    identity: {
      userId: profile.id,
      profile,
      partner: null,
      calendarId: profile.id,
    },
  };
}

const OK: ActionResult = { ok: true };

const TEST_TODO_GROUPS: NotesTodoGroupsRow[] = MOCK_TODO_LISTS.map((list) => ({
  id: list.id,
  calendar_id: TEST_USER_ID,
  created_by: TEST_USER_ID,
  name: list.title,
  created_at: '2026-08-10T10:00:00Z',
}));

const TEST_TODOS: NotesTodo[] = MOCK_TODOS.map((item, index) => ({
  id: item.id,
  calendar_id: TEST_USER_ID,
  created_by: TEST_USER_ID,
  group_name: MOCK_TODO_LISTS.find((list) => list.id === item.listId)?.title ?? 'Allgemein',
  item_type: 'todo',
  title: item.text,
  content: item.note || null,
  is_done: item.done,
  sort_order: index,
  created_at: '2026-08-10T10:00:00Z',
  updated_at: '2026-08-10T10:00:00Z',
  quantity: null,
  unit: null,
  category: null,
  assigned_to:
    item.slot === 'u1' ? TEST_USER_ID : item.slot === 'u2' ? TEST_PARTNER_ID : 'both',
  workflow_status: 'open',
  completed_at: item.done ? '2026-08-10T10:00:00Z' : null,
}));

export function dataDouble(overrides: Partial<DataServices> = {}): DataServices {
  return {
    appPreferences: {
      getByUserId: async () => null,
      ensure: async (userId) => ({
        user_id: userId,
        solo_mode: false,
        week_start: 'mo',
        locale: 'de',
        notification_settings: {},
        created_at: '2026-08-10T10:00:00Z',
        updated_at: '2026-08-10T10:00:00Z',
      }),
      update: async (userId, changes) => ({
        user_id: userId,
        solo_mode: changes.solo_mode ?? false,
        week_start: changes.week_start ?? 'mo',
        locale: changes.locale ?? 'de',
        notification_settings: changes.notification_settings ?? {},
        created_at: '2026-08-10T10:00:00Z',
        updated_at: '2026-08-10T10:00:00Z',
      }),
    },
    events: {
      list: async () => [],
      create: async () => {
        throw new Error('Unexpected event create in test');
      },
      update: async () => {
        throw new Error('Unexpected event update in test');
      },
      delete: async () => undefined,
    },
    expenses: {
      list: async () => [],
      create: async () => {
        throw new Error('Unexpected expense create in test');
      },
      update: async () => {
        throw new Error('Unexpected expense update in test');
      },
      delete: async () => undefined,
    },
    expenseBudgets: {
      list: async () => [],
      create: async () => {
        throw new Error('Unexpected expense budget create in test');
      },
      update: async () => {
        throw new Error('Unexpected expense budget update in test');
      },
      delete: async () => undefined,
    },
    expenseCategories: {
      list: async () => [],
      create: async () => {
        throw new Error('Unexpected expense category create in test');
      },
      update: async () => {
        throw new Error('Unexpected expense category update in test');
      },
      delete: async () => undefined,
    },
    expenseSettlements: {
      list: async () => [],
      create: async () => {
        throw new Error('Unexpected expense settlement create in test');
      },
      delete: async () => undefined,
    },
    expenseSplits: {
      list: async () => [],
      create: async () => {
        throw new Error('Unexpected expense split create in test');
      },
      update: async () => {
        throw new Error('Unexpected expense split update in test');
      },
      delete: async () => undefined,
    },
    notesTodoGroups: {
      list: async () => TEST_TODO_GROUPS.map((group) => ({ ...group })),
      create: async (input) => ({
        id: 'new-group',
        calendar_id: input.calendarId,
        created_by: input.createdBy,
        name: input.name,
        created_at: '2026-08-10T10:00:00Z',
      }),
      rename: async (input) => ({
        ...(TEST_TODO_GROUPS.find((group) => group.id === input.id) ?? TEST_TODO_GROUPS[0]!),
        name: input.name,
      }),
      delete: async () => undefined,
    },
    notesTodos: {
      list: async () => TEST_TODOS.map((item) => ({ ...item })),
      create: async (input) => ({
        ...TEST_TODOS[0]!,
        id: 'new-todo',
        calendar_id: input.calendarId,
        created_by: input.createdBy,
        group_name: input.groupName,
        title: input.title,
        content: input.content ?? null,
        assigned_to: input.assignedTo,
        sort_order: input.sortOrder,
      }),
      update: async (input) => ({
        ...(TEST_TODOS.find((item) => item.id === input.id) ?? TEST_TODOS[0]!),
        ...(input.title === undefined ? {} : { title: input.title }),
        ...(input.content === undefined ? {} : { content: input.content }),
      }),
      toggleDone: async (input) => ({
        ...(TEST_TODOS.find((item) => item.id === input.id) ?? TEST_TODOS[0]!),
        is_done: !input.currentIsDone,
      }),
      delete: async () => undefined,
      reorder: async () => undefined,
    },
    weekPlan: {
      list: async () => [],
      create: async () => {
        throw new Error('Unexpected week plan create in test');
      },
      update: async () => {
        throw new Error('Unexpected week plan update in test');
      },
      delete: async () => undefined,
    },
    ...overrides,
  };
}

/**
 * Auth-Doppelgaenger fuer Screen-Tests.
 *
 * Kein echter `AuthProvider`: der wuerde einen Supabase-Client bauen und ins
 * Netz greifen wollen. Die Regeln dahinter sind in `@ralia/data` geprueft, ohne
 * Browser und ohne Attrappe — hier geht es um die Screens. Was ein Test
 * beobachten will, ueberschreibt er per `overrides`; der Standard ist angemeldet,
 * weil das der Zustand der meisten Screens ist.
 */
export function authDouble(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    session: signedInState(),
    loading: false,
    pendingRecovery: false,
    callbackErrorKey: null,
    signIn: async () => OK,
    signUp: async () => OK,
    signInWithGoogle: async () => OK,
    requestPasswordReset: async () => OK,
    resendConfirmation: async () => OK,
    updatePassword: async () => OK,
    signOut: async () => undefined,
    connectPartner: async () => OK,
    disconnectPartner: async () => OK,
    setAnniversary: async () => OK,
    ...overrides,
  };
}

export interface RenderAppOptions {
  auth?: Partial<AuthContextValue>;
  data?: Partial<DataServices>;
}

/**
 * Gibt den Router mit zurueck.
 *
 * Manche Zusicherungen sind ein *Ziel*, kein Bildschirm: nach der Anmeldung ohne
 * Partner soll es auf `/partner-verbinden` gehen. Ob dort etwas Sichtbares
 * ankommt, haengt am Auth-Doppelgaenger — der bleibt abgemeldet, also weist die
 * Wache ihn ab. Geprueft wird deshalb der Pfad.
 */
export function renderAppAt(path: string, options: RenderAppOptions = {}) {
  stubMatchMedia();
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const result = render(
    <ThemeProvider>
      <I18nProvider>
        <ToastProvider>
          <AuthContext.Provider value={authDouble(options.auth)}>
            <DataContext.Provider value={dataDouble(options.data)}>
              <RouterProvider router={router} />
            </DataContext.Provider>
          </AuthContext.Provider>
        </ToastProvider>
      </I18nProvider>
    </ThemeProvider>,
  );
  return { ...result, router, path: () => router.state.location.pathname };
}
