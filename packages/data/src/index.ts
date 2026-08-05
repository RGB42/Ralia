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
