import {
  createSupabaseAppPreferencesRepo,
  createSupabaseEventRepo,
  createSupabaseExpenseBudgetsRepo,
  createSupabaseExpenseCategoriesRepo,
  createSupabaseExpenseSettlementsRepo,
  createSupabaseExpenseSplitsRepo,
  createSupabaseNotesTodoGroupsRepo,
  createSupabaseNotesTodosRepo,
  createSupabaseSharedExpenseRepo,
  createSupabaseWeekPlanRepo,
  getSupabaseClient,
  type AppPreferencesRepo,
  type EventRepo,
  type ExpenseBudgetsRepo,
  type ExpenseCategoriesRepo,
  type ExpenseSettlementsRepo,
  type ExpenseSplitsRepo,
  type NotesTodoGroupsRepo,
  type NotesTodosRepo,
  type SharedExpenseRepo,
  type WeekPlanRepo,
} from '@ralia/data';
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useBoot } from '../boot/BootContext.js';

export interface DataServices {
  appPreferences: AppPreferencesRepo;
  events: EventRepo;
  expenseBudgets: ExpenseBudgetsRepo;
  expenseCategories: ExpenseCategoriesRepo;
  expenseSettlements: ExpenseSettlementsRepo;
  expenseSplits: ExpenseSplitsRepo;
  expenses: SharedExpenseRepo;
  notesTodoGroups: NotesTodoGroupsRepo;
  notesTodos: NotesTodosRepo;
  weekPlan: WeekPlanRepo;
}

export const DataContext = createContext<DataServices | null>(null);

export function DataProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const { config } = useBoot();
  const services = useMemo<DataServices>(() => {
    const client = getSupabaseClient({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
    });
    return {
      appPreferences: createSupabaseAppPreferencesRepo(client),
      events: createSupabaseEventRepo(client),
      expenseBudgets: createSupabaseExpenseBudgetsRepo(client),
      expenseCategories: createSupabaseExpenseCategoriesRepo(client),
      expenseSettlements: createSupabaseExpenseSettlementsRepo(client),
      expenseSplits: createSupabaseExpenseSplitsRepo(client),
      expenses: createSupabaseSharedExpenseRepo(client),
      notesTodoGroups: createSupabaseNotesTodoGroupsRepo(client),
      notesTodos: createSupabaseNotesTodosRepo(client),
      weekPlan: createSupabaseWeekPlanRepo(client),
    };
  }, [config.supabaseAnonKey, config.supabaseUrl]);

  return <DataContext.Provider value={services}>{children}</DataContext.Provider>;
}

export function useData(): DataServices {
  const value = useContext(DataContext);
  if (!value) throw new Error('useData braucht einen DataProvider im Baum');
  return value;
}
