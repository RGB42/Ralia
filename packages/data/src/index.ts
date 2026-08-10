/**
 * @ralia/data — everything that talks to the Ralia backend.
 *
 * The backend is treated as immutable: the same Supabase project, the same
 * schema, the same `app-api` edge function that Ralia 1.x uses. This package is
 * the only place allowed to know about it.
 */

export {
  AppApi,
  AppApiError,
  DEFAULT_APP_API_FUNCTION,
  normalizePath,
  stripLegacyApiPrefix,
  type AppApiOptions,
} from './app-api.js';

export {
  calendarMembers,
  computeCalendarId,
  displayBelongsTo,
  isPairedCalendarId,
} from './calendar-id.js';

export {
  getSupabaseClient,
  resetSupabaseClient,
  type ClientOptions,
  type RaliaSupabaseClient,
} from './client.js';

export {
  BOOTSTRAP_ANON_KEY,
  SUPABASE_URL,
  bootstrapConfig,
  loadRuntimeConfig,
  mergeRuntimeConfig,
  type RuntimeConfig,
} from './config.js';

// --- Anmeldung (SP1) ---------------------------------------------------------

export { cleanCallbackUrl, parseAuthCallback, type AuthCallback } from './auth/auth-callback.js';

export {
  IDENTITY_SNAPSHOT_MAX_AGE_MS,
  IDENTITY_STORAGE_KEY,
  clearIdentitySnapshot,
  readIdentitySnapshot,
  writeIdentitySnapshot,
  type IdentitySnapshot,
} from './auth/identity-snapshot.js';

export {
  INVITE_CODE_ALPHABET,
  INVITE_CODE_LENGTH,
  createProfileWithInviteCode,
  generateInviteCode,
  isUniqueViolation,
  normalizeInviteCode,
} from './auth/invite-code.js';

export {
  getMailLinkClient,
  resetMailLinkClient,
  type MailLinkClientOptions,
} from './auth/mail-link-client.js';

export {
  LEGACY_AUTH_KEYS,
  authErrorKey,
  clearAuthData,
  restoreSession,
  type Identity,
  type RestoreDeps,
  type SessionState,
} from './auth/session.js';

export {
  PARTNER_ERROR_KEYS,
  createPartnerRepo,
  partnerErrorKey,
  type PartnerRepo,
  type PartnerResult,
  type RpcCall,
} from './repositories/partner-repo.js';

export {
  browserTimeZone,
  createProfileRepo,
  type AuthenticatedUser,
  type ProfileGateway,
  type ProfileRepo,
} from './repositories/profile-repo.js';

export {
  EventRepoError,
  createEventRepo,
  createSupabaseEventRepo,
  normalizeEventRepoError,
  type CreateEventInput,
  type EventDateRange,
  type EventGateway,
  type EventRepo,
  type EventRepoErrorKind,
  type EventRepoOperation,
  type UpdateEventInput,
} from './repositories/event-repo.js';

export {
  createSharedExpenseRepo,
  createSupabaseSharedExpenseRepo,
  parseExpenseAmount,
  type DecimalInput,
  type SharedExpenseCreateInput,
  type SharedExpenseGateway,
  type SharedExpenseRepo,
  type SharedExpenseUpdateInput,
} from './repositories/shared-expense-repo.js';

export {
  createSupabaseWeekPlanRepo,
  createWeekPlanRepo,
  type WeekPlanCreateInput,
  type WeekPlanGateway,
  type WeekPlanRepo,
  type WeekPlanUpdateInput,
} from './repositories/week-plan-repo.js';

export {
  createNotesTodoGroupsRepo,
  createSupabaseNotesTodoGroupsRepo,
  type CreateNotesTodoGroupInput,
  type DeleteNotesTodoGroupInput,
  type NotesTodoGroupsGateway,
  type NotesTodoGroupsRepo,
  type RenameNotesTodoGroupInput,
} from './repositories/notes-todo-groups-repo.js';

export {
  createNotesTodosRepo,
  createSupabaseNotesTodosRepo,
  type CreateNotesTodoInput,
  type DeleteNotesTodoInput,
  type NotesTodo,
  type NotesTodosGateway,
  type NotesTodosRepo,
  type ReorderNotesTodosInput,
  type ToggleNotesTodoInput,
  type UpdateNotesTodoInput,
} from './repositories/notes-todos-repo.js';

export {
  RepositoryError,
  type GatewayResult,
  type RepositoryErrorCode,
  type RepositoryGatewayError,
} from './repositories/repository-error.js';

export {
  DEFAULT_APP_PREFERENCES,
  createAppPreferencesRepo,
  createSupabaseAppPreferencesRepo,
  type AppLocale,
  type AppPreferences,
  type AppPreferencesGateway,
  type AppPreferencesRepo,
  type AppWeekStart,
  type NotificationSettings,
  type UpdateAppPreferencesInput,
} from './repositories/app-preferences-repo.js';

export {
  createExpenseBudgetsRepo,
  createSupabaseExpenseBudgetsRepo,
  type CreateExpenseBudgetInput,
  type DeleteExpenseBudgetInput,
  type ExpenseBudgetsGateway,
  type ExpenseBudgetsRepo,
  type UpdateExpenseBudgetInput,
} from './repositories/expense-budgets-repo.js';

export {
  EXPENSE_CATEGORY_NAME_MAX_LENGTH,
  createExpenseCategoriesRepo,
  createSupabaseExpenseCategoriesRepo,
  type CreateExpenseCategoryInput,
  type DeleteExpenseCategoryInput,
  type ExpenseCategoriesGateway,
  type ExpenseCategoriesRepo,
  type UpdateExpenseCategoryInput,
} from './repositories/expense-categories-repo.js';

export {
  createExpenseSettlementsRepo,
  createSupabaseExpenseSettlementsRepo,
  type CreateExpenseSettlementInput,
  type DeleteExpenseSettlementInput,
  type ExpenseSettlementDateRange,
  type ExpenseSettlementsGateway,
  type ExpenseSettlementsRepo,
} from './repositories/expense-settlements-repo.js';

export {
  createExpenseSplitsRepo,
  createSupabaseExpenseSplitsRepo,
  type CreateExpenseSplitInput,
  type DeleteExpenseSplitInput,
  type ExpenseSplitsGateway,
  type ExpenseSplitsRepo,
  type UpdateExpenseSplitInput,
} from './repositories/expense-splits-repo.js';

export {
  MAX_EXPENSE_AMOUNT_CENTS,
  expenseAmountToCents,
  normalizeExpenseAmount,
  type ExpenseAmountInput,
} from './repositories/expense-money.js';

export type {
  AssignedTo,
  AppPreferencesRow,
  BelongsTo,
  Database,
  EventReminderJobsRow,
  EventType,
  EventsRow,
  ExpenseBudgetsRow,
  ExpenseCategoriesRow,
  ExpenseSettlementsRow,
  ExpenseSplitsRow,
  FunctionArgs,
  ItemType,
  Json,
  NotesTodoGroupsRow,
  NotesTodosRow,
  PlanStatus,
  PlanTier,
  ProfilesRow,
  PushSubscriptionsRow,
  RecurrenceType,
  RecurringEventExceptionsRow,
  RecurringTaskLogsRow,
  RecurringTasksRow,
  ReminderJobStatus,
  SentEventRemindersRow,
  SharedExpensesRow,
  SplitType,
  Tables,
  TablesInsert,
  TablesUpdate,
  TargetMode,
  TaskCadence,
  WeekPlanEntryType,
  WeekPlansRow,
  WorkflowStatus,
} from './database.types.js';
