/**
 * Hand-written types mirroring the LIVE production schema of Supabase project
 * nyvripddydrzvfuateea (introspected directly against prod, not just the
 * migrations/ history in Ralia_Opus, which drifted from what's actually deployed).
 *
 * Keep this in sync with reality — when in doubt, verify against the DB, not docs.
 */

export type BelongsTo = 'user1' | 'user2' | 'both';
export type RecurrenceType = 'daily' | 'weekly' | 'monthly' | 'yearly' | null;
export type EventType = 'default' | 'birthday' | 'anniversary';
export type PlanTier = 'free' | 'pro';
export type PlanStatus = 'inactive' | 'active' | 'cancelled' | 'past_due' | string;

export interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  invite_code: string | null;
  partner_id: string | null;
  created_at: string;
  timezone: string | null;
  anniversary_date: string | null; // date
  plan_tier: PlanTier;
  plan_status: PlanStatus;
  ls_customer_id: string | null;
  ls_subscription_id: string | null;
  pro_expires_at: string | null; // timestamptz
}

export interface EventRow {
  id: string;
  calendar_id: string;
  name: string;
  location: string | null;
  start_date: string; // date YYYY-MM-DD
  start_time: string; // time HH:MM:SS
  end_date: string;
  end_time: string;
  notes: string | null;
  belongs_to: BelongsTo;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  recurrence_type: RecurrenceType;
  recurrence_end_date: string | null;
  parent_event_id: string | null;
  google_event_id: string | null;
  recurrence_interval: number | null;
  reminder_enabled: boolean | null;
  reminder_offset_minutes: number | null;
  reminder_offsets: number[] | null;
  event_type: EventType | null;
  is_special_auto: boolean | null;
  special_key: string | null;
  subtitle: string | null;
  short_description: string | null;
  extended_data: Record<string, unknown> | null;
  category: string | null;
}

export interface RecurringEventException {
  id: string;
  calendar_id: string;
  master_event_id: string;
  original_occurrence_date: string; // date
  created_by: string;
  is_deleted: boolean;
  override_event_data: Partial<EventRow> | null;
  created_at: string;
  updated_at: string;
}

export interface NotesTodoGroup {
  id: string;
  calendar_id: string;
  created_by: string;
  name: string;
  created_at: string;
}

export type TodoItemType = 'todo' | 'note';
export type TodoAssignedTo = 'user1' | 'user2' | 'both';
export type TodoWorkflowStatus = 'open' | 'in_progress' | 'waiting' | 'done' | string;

export interface NotesTodo {
  id: string;
  calendar_id: string;
  created_by: string;
  group_name: string; // free text, NOT a FK to notes_todo_groups.id — kept in sync by app logic
  item_type: TodoItemType;
  title: string;
  content: string | null;
  is_done: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  quantity: number | null;
  unit: string | null;
  category: string | null;
  assigned_to: TodoAssignedTo;
  workflow_status: TodoWorkflowStatus;
  completed_at: string | null;
}

export type TaskCadence = 'daily' | 'weekly' | 'monthly' | string;
export type TaskTargetMode = 'count' | 'hours' | string;

export interface RecurringTask {
  id: string;
  calendar_id: string;
  created_by: string;
  group_name: string;
  title: string;
  description: string | null;
  cadence: TaskCadence;
  recurrence_interval: number;
  target_mode: TaskTargetMode;
  target_value: number;
  starts_on: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  assigned_to: TodoAssignedTo;
  workflow_status: TodoWorkflowStatus;
}

export interface RecurringTaskLog {
  id: string;
  task_id: string;
  calendar_id: string;
  created_by: string;
  log_date: string;
  amount: number;
  note: string | null;
  created_at: string;
}

export interface PushSubscription {
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

export type ExpenseSplitType = 'single' | 'shared';

export interface SharedExpense {
  id: string;
  calendar_id: string;
  title: string;
  amount: number;
  paid_by: string;
  category: string | null;
  paid_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  split_type: ExpenseSplitType;
}

export interface WeekPlan {
  id: string;
  calendar_id: string;
  created_by: string;
  week_start: string; // Monday, date
  day_of_week: number; // 0-6
  entry_type: string;
  title: string;
  notes: string | null;
  sort_order: number | null;
  created_at: string;
  updated_at: string;
}

/** Row shape returned by connect_partner(p_invite_code) — mirrors `profiles` (to_jsonb(v_target)). */
export type ConnectPartnerResult = Profile;
