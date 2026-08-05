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

export type {
  AssignedTo,
  BelongsTo,
  Database,
  EventReminderJobsRow,
  EventType,
  EventsRow,
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
