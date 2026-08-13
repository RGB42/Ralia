import {
  createSupabaseAppPreferencesRepo,
  createPrivacyApi,
  createEventOutboxExecutor,
  createPushRepo,
  createSupabaseEventRepo,
  createSupabaseExpenseBudgetsRepo,
  createSupabaseExpenseCategoriesRepo,
  createSupabaseExpenseSettlementsRepo,
  createSupabaseExpenseSplitsRepo,
  createSupabaseNotesTodoGroupsRepo,
  createSupabaseNotesTodosRepo,
  createSupabaseRecurringEventExceptionsRepo,
  createSupabaseRecurringSeriesRepo,
  createSupabaseSharedExpenseRepo,
  createSupabaseWeekPlanRepo,
  getSupabaseClient,
  subscribeToEventRealtime,
  type AppPreferencesRepo,
  type PrivacyApiClient,
  type EventRepo,
  type ExpenseBudgetsRepo,
  type ExpenseCategoriesRepo,
  type ExpenseSettlementsRepo,
  type ExpenseSplitsRepo,
  type NotesTodoGroupsRepo,
  type NotesTodosRepo,
  type PushRepo,
  type RecurringEventExceptionsRepo,
  type RecurringSeriesRepo,
  type EventRealtimeInvalidation,
  type EventRealtimeSubscription,
  type SharedExpenseRepo,
  type WeekPlanRepo,
  type EventMutation,
} from '@ralia/data';
import type { FlushSummary } from '@ralia/core';
import { createContext, useContext, useEffect, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../auth/useAuth.js';
import { useBoot } from '../boot/BootContext.js';

export interface DataServices {
  appPreferences: AppPreferencesRepo;
  privacy: PrivacyApiClient;
  /**
   * `createPushRepo` bindet die Nutzer-ID schon beim Bauen ein (anders als die
   * uebrigen Repositories hier, die sie je Aufruf nehmen) -- deshalb braucht
   * dieser Provider als einziger `useAuth()`, um sie zu liefern.
   */
  push: PushRepo;
  events: EventRepo;
  eventQueue: {
    enqueue(calendarId: string, mutation: EventMutation): Promise<void>;
    flush(): Promise<FlushSummary>;
    pending(calendarId: string): Promise<EventMutation[]>;
  };
  expenseBudgets: ExpenseBudgetsRepo;
  expenseCategories: ExpenseCategoriesRepo;
  expenseSettlements: ExpenseSettlementsRepo;
  expenseSplits: ExpenseSplitsRepo;
  expenses: SharedExpenseRepo;
  notesTodoGroups: NotesTodoGroupsRepo;
  notesTodos: NotesTodosRepo;
  recurringEventExceptions: RecurringEventExceptionsRepo;
  recurringSeries: RecurringSeriesRepo;
  subscribeToEvents(
    calendarId: string,
    onInvalidation: (invalidation: EventRealtimeInvalidation) => void,
  ): EventRealtimeSubscription;
  weekPlan: WeekPlanRepo;
}

export const DataContext = createContext<DataServices | null>(null);

export function DataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { config, outbox } = useBoot();
  const { session } = useAuth();
  // Ohne Sitzung entsteht trotzdem ein Repository -- es wird schlicht nie mit
  // Wirkung aufgerufen, bevor jemand angemeldet ist. Ein `null` haette jeden
  // Aufrufer gezwungen, dieselbe Abwesenheit erneut zu behandeln.
  const userId = session.status === 'signed-in' ? session.identity.userId : '';
  const services = useMemo<DataServices>(() => {
    const client = getSupabaseClient({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
    });
    return {
      appPreferences: createSupabaseAppPreferencesRepo(client),
      privacy: createPrivacyApi({
        supabaseUrl: config.supabaseUrl,
        anonKey: config.supabaseAnonKey,
        getAccessToken: async () => (await client.auth.getSession()).data.session?.access_token ?? null,
      }),
      push: createPushRepo(client, userId),
      events: createSupabaseEventRepo(client),
      eventQueue: {
        async enqueue(calendarId, mutation) {
          await outbox.enqueue('events', calendarId, mutation);
        },
        flush: () => outbox.flush(),
        pending: async (calendarId) => {
          const records = await outbox.peek<EventMutation>('events', calendarId);
          return records.map((record) => record.mutation);
        },
      },
      expenseBudgets: createSupabaseExpenseBudgetsRepo(client),
      expenseCategories: createSupabaseExpenseCategoriesRepo(client),
      expenseSettlements: createSupabaseExpenseSettlementsRepo(client),
      expenseSplits: createSupabaseExpenseSplitsRepo(client),
      expenses: createSupabaseSharedExpenseRepo(client),
      notesTodoGroups: createSupabaseNotesTodoGroupsRepo(client),
      notesTodos: createSupabaseNotesTodosRepo(client),
      recurringEventExceptions: createSupabaseRecurringEventExceptionsRepo(client),
      recurringSeries: createSupabaseRecurringSeriesRepo(client),
      subscribeToEvents: (calendarId, onInvalidation) =>
        subscribeToEventRealtime(client, calendarId, onInvalidation),
      weekPlan: createSupabaseWeekPlanRepo(client),
    };
  }, [config.supabaseAnonKey, config.supabaseUrl, outbox, userId]);

  useEffect(() => {
    outbox.registerExecutor(
      'events',
      createEventOutboxExecutor({
        eventRepo: services.events,
        recurringEventExceptionsRepo: services.recurringEventExceptions,
        recurringSeriesRepo: services.recurringSeries,
      }),
    );
  }, [outbox, services]);

  return <DataContext.Provider value={services}>{children}</DataContext.Provider>;
}

export function useData(): DataServices {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData braucht einen DataProvider im Baum');
  return value;
}
