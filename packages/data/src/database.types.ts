/**
 * Ralia database schema, hand-derived from `Ralia_Opus/migrations/*.sql` plus the
 * column usage in `Ralia_Opus/public/js/*.js`.
 *
 * Why hand-derived and not `supabase gen types`: the base `profiles` and
 * `events` tables were created in the Supabase dashboard, not by a migration in
 * the repo, and the PostgREST OpenAPI endpoint that would reveal them requires a
 * `service_role` key. Generating types needs a privileged credential this
 * project does not carry.
 *
 * Nullability policy: every column not provably `NOT NULL` from a migration is
 * typed nullable. An over-nullable type costs a check; an under-nullable one
 * hides a runtime crash.
 *
 * TODO(SP9): once a service-role key is available in CI, replace this file with
 * `supabase gen types typescript` output and diff it against this to confirm.
 */

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

/** Whose event/item this is, from the *owning* row's perspective. */
export type BelongsTo = 'user1' | 'user2' | 'both';

export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type EventType = 'default' | 'birthday' | 'anniversary';

export type PlanTier = 'free' | 'pro';

export type ItemType = 'todo' | 'note';

export type WorkflowStatus = 'open' | 'in_progress' | 'waiting';

export type TaskCadence = 'daily' | 'weekly' | 'monthly';

export type TargetMode = 'count' | 'hours';

export type SplitType = 'single' | 'shared';

export type WeekPlanEntryType = 'meal' | 'task';

/**
 * There is deliberately no `all_day` column.
 *
 * Ralia 1.x derives all-day from the data:
 *   `start_date === end_date && isMidnight(start_time) && isMidnight(end_time)`
 * Adding a column would diverge from every row already in production, so the
 * derivation is reproduced in `@ralia/core` instead.
 */
export interface EventsRow {
  id: string;
  calendar_id: string;
  created_by: string | null;
  name: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  notes: string | null;
  belongs_to: BelongsTo | null;
  recurrence_type: RecurrenceType | null;
  recurrence_end_date: string | null;
  recurrence_interval: number | null;
  parent_event_id: string | null;
  google_event_id: string | null;
  reminder_enabled: boolean | null;
  reminder_offset_minutes: number | null;
  reminder_offsets: number[] | null;
  event_type: EventType | null;
  is_special_auto: boolean | null;
  special_key: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ProfilesRow {
  id: string;
  name: string | null;
  email: string | null;
  invite_code: string | null;
  partner_id: string | null;
  /** Set by `connect_partner`; mirrors the frontend's `getCalendarId()`. */
  calendar_id: string | null;
  timezone: string | null;
  anniversary_date: string | null;
  plan_tier: PlanTier | null;
  plan_status: string | null;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  pro_expires_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface RecurringEventExceptionsRow {
  id: string;
  calendar_id: string;
  master_event_id: string;
  original_occurrence_date: string;
  created_by: string;
  is_deleted: boolean;
  /** Constraint: null exactly when `is_deleted`, non-null otherwise. */
  override_event_data: Json | null;
  created_at: string;
  updated_at: string;
}

export interface NotesTodosRow {
  id: string;
  calendar_id: string;
  created_by: string;
  group_name: string;
  item_type: ItemType;
  title: string;
  content: string | null;
  is_done: boolean;
  sort_order: number;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  assigned_to: string;
  workflow_status: WorkflowStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotesTodoGroupsRow {
  id: string;
  calendar_id: string;
  created_by: string;
  name: string;
  created_at: string;
}

export interface RecurringTasksRow {
  id: string;
  calendar_id: string;
  created_by: string;
  group_name: string;
  title: string;
  description: string | null;
  cadence: TaskCadence;
  recurrence_interval: number;
  target_mode: TargetMode;
  target_value: number;
  starts_on: string;
  active: boolean;
  sort_order: number;
  assigned_to: string;
  workflow_status: WorkflowStatus;
  created_at: string;
  updated_at: string;
}

export interface RecurringTaskLogsRow {
  id: string;
  task_id: string;
  calendar_id: string;
  created_by: string;
  log_date: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface WeekPlansRow {
  id: string;
  calendar_id: string;
  created_by: string;
  /** Monday of the week. */
  week_start: string;
  /** 0 = Monday … 6 = Sunday. */
  day_of_week: number;
  entry_type: WeekPlanEntryType;
  title: string;
  notes: string | null;
  sort_order: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface SharedExpensesRow {
  id: string;
  calendar_id: string;
  title: string;
  amount: number;
  paid_by: string;
  category: string | null;
  paid_at: string;
  notes: string | null;
  split_type: SplitType | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PushSubscriptionsRow {
  id: number;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SentEventRemindersRow {
  token: string;
  event_id: string;
  recipient_user_id: string;
  sent_at: string;
}

/** Managed by triggers and drained by the pg_cron reminder worker. */
export interface EventReminderJobsRow {
  id: string;
  calendar_id: string;
  event_id: string;
  occurrence_date: string | null;
  recipient_user_id: string;
  offset_minutes: number;
  fire_at: string;
  status: string;
  attempts: number | null;
  last_error: string | null;
  claimed_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type Insertable<TRow, TRequired extends keyof TRow> = Partial<TRow> & Pick<TRow, TRequired>;

export interface Database {
  public: {
    Tables: {
      events: {
        Row: EventsRow;
        Insert: Insertable<EventsRow, 'calendar_id' | 'name' | 'start_date'>;
        Update: Partial<EventsRow>;
      };
      profiles: {
        Row: ProfilesRow;
        Insert: Insertable<ProfilesRow, 'id'>;
        Update: Partial<ProfilesRow>;
      };
      recurring_event_exceptions: {
        Row: RecurringEventExceptionsRow;
        Insert: Insertable<
          RecurringEventExceptionsRow,
          'calendar_id' | 'master_event_id' | 'original_occurrence_date' | 'created_by'
        >;
        Update: Partial<RecurringEventExceptionsRow>;
      };
      notes_todos: {
        Row: NotesTodosRow;
        Insert: Insertable<NotesTodosRow, 'calendar_id' | 'created_by' | 'title'>;
        Update: Partial<NotesTodosRow>;
      };
      notes_todo_groups: {
        Row: NotesTodoGroupsRow;
        Insert: Insertable<NotesTodoGroupsRow, 'calendar_id' | 'created_by' | 'name'>;
        Update: Partial<NotesTodoGroupsRow>;
      };
      recurring_tasks: {
        Row: RecurringTasksRow;
        Insert: Insertable<RecurringTasksRow, 'calendar_id' | 'created_by' | 'title'>;
        Update: Partial<RecurringTasksRow>;
      };
      recurring_task_logs: {
        Row: RecurringTaskLogsRow;
        Insert: Insertable<
          RecurringTaskLogsRow,
          'task_id' | 'calendar_id' | 'created_by' | 'log_date' | 'amount'
        >;
        Update: Partial<RecurringTaskLogsRow>;
      };
      week_plans: {
        Row: WeekPlansRow;
        Insert: Insertable<
          WeekPlansRow,
          'calendar_id' | 'created_by' | 'week_start' | 'day_of_week' | 'entry_type' | 'title'
        >;
        Update: Partial<WeekPlansRow>;
      };
      shared_expenses: {
        Row: SharedExpensesRow;
        Insert: Insertable<SharedExpensesRow, 'calendar_id' | 'title' | 'amount' | 'paid_by'>;
        Update: Partial<SharedExpensesRow>;
      };
      push_subscriptions: {
        Row: PushSubscriptionsRow;
        Insert: Insertable<PushSubscriptionsRow, 'user_id' | 'endpoint' | 'p256dh' | 'auth'>;
        Update: Partial<PushSubscriptionsRow>;
      };
      sent_event_reminders: {
        Row: SentEventRemindersRow;
        Insert: Insertable<SentEventRemindersRow, 'token' | 'event_id' | 'recipient_user_id'>;
        Update: Partial<SentEventRemindersRow>;
      };
      event_reminder_jobs: {
        Row: EventReminderJobsRow;
        Insert: Insertable<
          EventReminderJobsRow,
          'calendar_id' | 'event_id' | 'recipient_user_id' | 'offset_minutes' | 'fire_at'
        >;
        Update: Partial<EventReminderJobsRow>;
      };
    };
    Views: Record<never, never>;
    Functions: {
      /** Links two profiles and writes the shared `calendar_id` onto both. */
      connect_partner: {
        Args: { p_invite_code: string };
        Returns: Json;
      };
      disconnect_partner: {
        Args: Record<never, never>;
        Returns: Json;
      };
      /** Writes `anniversary_date` to both partners' profiles. */
      set_shared_anniversary: {
        Args: { p_anniversary_date: string | null };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
}

/** Convenience aliases for the tables the app reads most. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
