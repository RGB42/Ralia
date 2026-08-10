import {
  createSupabaseAppPreferencesRepo,
  createEventOutboxExecutor,
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
  type EventRepo,
  type ExpenseBudgetsRepo,
  type ExpenseCategoriesRepo,
  type ExpenseSettlementsRepo,
  type ExpenseSplitsRepo,
  type NotesTodoGroupsRepo,
  type NotesTodosRepo,
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
import { useBoot } from '../boot/BootContext.js';

export interface DataServices {
  appPreferences: AppPreferencesRepo;
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
  const services = useMemo<DataServices>(() => {
    const client = getSupabaseClient({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
    });
    return {
      appPreferences: createSupabaseAppPreferencesRepo(client),
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
  }, [config.supabaseAnonKey, config.supabaseUrl, outbox]);

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
