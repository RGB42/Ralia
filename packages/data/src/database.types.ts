/**
 * Kuratierte Sicht auf das Datenbankschema.
 *
 * Die Wahrheit steht in [`database.generated.ts`](./database.generated.ts) und
 * kommt aus der Introspektion der laufenden Datenbank. Diese Datei fuegt zwei
 * Dinge hinzu, die ein Generator nicht liefern kann:
 *
 *   1. **Lesbare Namen** — `ProfilesRow` statt
 *      `Database['public']['Tables']['profiles']['Row']`. Alle *abgeleitet*,
 *      nicht abgetippt: eine Spalte, die in der Datenbank verschwindet, laesst
 *      hier den Typecheck fallen, statt still weiterzuexistieren.
 *   2. **Fach-Unions** — `belongs_to` ist in Postgres `text` mit CHECK. Der
 *      Generator sieht davon nur `string`. Die Unions unten tragen jeweils dazu,
 *      *woher* sie stammen: CHECK-Constraint, beobachtete Werte oder Altcode.
 *
 * Warum die Unions nicht in die Zeilentypen eingesetzt sind: eine Zeile aus der
 * Datenbank ist erst `string`. Sie als `BelongsTo` zu deklarieren waere eine
 * Behauptung ueber Daten, die niemand geprueft hat — der Typ wuerde eine
 * Gewissheit vorspiegeln, die eine alte Zeile oder eine Handaenderung bricht.
 * Verengt wird deshalb in der Repository-Schicht, an einer Stelle, mit Ruecksicht
 * auf unerwartete Werte.
 *
 * Vorgeschichte: bis 2026-08-05 war diese Datei von Hand aus den Migrationen
 * abgeleitet, weil das Generieren ein privilegiertes Credential brauchte. Das
 * hat drei Tabellen falsch beschrieben — `profiles` hatte zwei Spalten, die es
 * nie gab, `events` fehlten vier, `event_reminder_jobs` war groesstenteils
 * erfunden — und den Parameternamen von `set_shared_anniversary` verfehlt.
 * Deshalb steht hier jetzt nichts mehr, was nicht abgeleitet ist.
 */

export type { Database, Json } from './database.generated.js';

import type { Database } from './database.generated.js';

type PublicSchema = Database['public'];

/** Zeilentyp einer Tabelle. */
export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row'];
/** Was ein Insert verlangt und was Defaults uebernehmen. */
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update'];

/** Argumente und Rueckgabe einer Datenbankfunktion. */
export type FunctionArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T] extends { Args: infer A } ? A : never;

// ---------------------------------------------------------------------------
// Zeilentypen — durchweg abgeleitet
// ---------------------------------------------------------------------------

/**
 * Es gibt bewusst keine `all_day`-Spalte.
 *
 * Ralia 1.x leitet ganztaegig aus den Daten ab:
 *   `start_date === end_date && isMidnight(start_time) && isMidnight(end_time)`
 * Eine Spalte wuerde von jeder Zeile abweichen, die schon in Produktion liegt;
 * die Ableitung liegt darum in `@ralia/core`.
 */
export type EventsRow = Tables<'events'>;
export type ProfilesRow = Tables<'profiles'>;
export type RecurringEventExceptionsRow = Tables<'recurring_event_exceptions'>;
export type NotesTodosRow = Tables<'notes_todos'>;
export type NotesTodoGroupsRow = Tables<'notes_todo_groups'>;
export type RecurringTasksRow = Tables<'recurring_tasks'>;
export type RecurringTaskLogsRow = Tables<'recurring_task_logs'>;
export type WeekPlansRow = Tables<'week_plans'>;
export type SharedExpensesRow = Tables<'shared_expenses'>;
export type PushSubscriptionsRow = Tables<'push_subscriptions'>;
export type SentEventRemindersRow = Tables<'sent_event_reminders'>;
export type EventReminderJobsRow = Tables<'event_reminder_jobs'>;
export type AppPreferencesRow = Tables<'app_preferences'>;
export type DataExportRequestsRow = Tables<'data_export_requests'>;
export type ExpenseBudgetsRow = Tables<'expense_budgets'>;
export type ExpenseCategoriesRow = Tables<'expense_categories'>;
export type ExpenseSettlementsRow = Tables<'expense_settlements'>;
export type ExpenseSplitsRow = Tables<'expense_splits'>;

// ---------------------------------------------------------------------------
// Fach-Unions
// ---------------------------------------------------------------------------

/**
 * Erklaert eine Union zur Verengung einer Spalte — und laesst tsc das pruefen.
 *
 * `TUnion extends TColumn` ist die eigentliche Arbeit: die Bedingung wird schon
 * bei der *Deklaration* der Union geprueft, nicht irgendwo weiter unten. Wuerde
 * `belongs_to` in der Datenbank zu einem Integer, passte kein Literal mehr und
 * die Zeile schlaegt im Typecheck fehl — statt beim ersten Lesezugriff in
 * Produktion. Reine Typebene, im Bundle landet davon nichts.
 *
 * Die Spalte steht zuerst, damit sie beim Lesen zuerst auffaellt: sie ist die
 * Tatsache, die Union ist unsere Deutung.
 */
type NarrowOf<TColumn, TUnion extends TColumn> = TUnion;

/** Nicht-nullbarer Typ einer Spalte. */
type Col<TRow, TKey extends keyof TRow> = NonNullable<TRow[TKey]>;

/**
 * Wem ein Termin oder Eintrag gehoert, aus Sicht der *besitzenden* Zeile.
 *
 * Belegt durch `events_belongs_to_check`: ARRAY['user1','user2','both'].
 * Die Spalte ist NOT NULL — es gibt kein „unbekannt".
 */
export type BelongsTo = NarrowOf<Col<EventsRow, 'belongs_to'>, 'user1' | 'user2' | 'both'>;

/** Belegt durch `events_recurrence_type_check`; NULL ist ausdruecklich erlaubt. */
export type RecurrenceType = NarrowOf<
  Col<EventsRow, 'recurrence_type'>,
  'daily' | 'weekly' | 'monthly' | 'yearly'
>;

/**
 * Kein CHECK auf der Spalte. Belegt durch die Bestandsdaten am 2026-08-05:
 * `default` (671), `birthday` (30), `anniversary` (1) — und durch
 * `syncAutomaticSpecialEvents()` in Ralia_Opus, das genau diese drei schreibt.
 */
export type EventType = NarrowOf<
  Col<EventsRow, 'event_type'>,
  'default' | 'birthday' | 'anniversary'
>;

/** Kein CHECK. Bestandsdaten am 2026-08-05: `free` (5), `pro` (8). */
export type PlanTier = NarrowOf<Col<ProfilesRow, 'plan_tier'>, 'free' | 'pro'>;

/**
 * Bewusst *keine* Union, obwohl der Bestand nur `active` und `inactive` zeigt:
 * die Werte kommen aus den LemonSqueezy-Webhooks, also von aussen. Was der
 * Anbieter morgen sendet (`past_due`, `cancelled`, …), darf keinen Typfehler
 * ausloesen, sondern muss in SP6 als unbekannter Zustand behandelt werden.
 */
export type PlanStatus = Col<ProfilesRow, 'plan_status'>;

/**
 * Kein CHECK. Der Bestand kennt nur `todo` (92 Zeilen); `note` steht in
 * Ralia_Opus (`todo-notes.js`) als zweite Form und ist in der Oberflaeche
 * erreichbar, kommt in den Daten aber noch nicht vor.
 */
export type ItemType = NarrowOf<Col<NotesTodosRow, 'item_type'>, 'todo' | 'note'>;

/** Belegt durch `notes_todos_workflow_status_check` und dasselbe CHECK auf `recurring_tasks`. */
export type WorkflowStatus = NarrowOf<
  Col<NotesTodosRow, 'workflow_status'> & Col<RecurringTasksRow, 'workflow_status'>,
  'open' | 'in_progress' | 'waiting'
>;

/** Kein CHECK. Bestand: `weekly`. Die drei Stufen stammen aus `recurring-tasks` in Ralia_Opus. */
export type TaskCadence = NarrowOf<
  Col<RecurringTasksRow, 'cadence'>,
  'daily' | 'weekly' | 'monthly'
>;

/** Kein CHECK. Bestand: `count`. `hours` ist die zweite Form in Ralia_Opus. */
export type TargetMode = NarrowOf<Col<RecurringTasksRow, 'target_mode'>, 'count' | 'hours'>;

/** Belegt durch `shared_expenses_split_type_check`. */
export type SplitType = NarrowOf<Col<SharedExpensesRow, 'split_type'>, 'single' | 'shared'>;

/** Belegt durch `week_plans_entry_type_check`. */
export type WeekPlanEntryType = NarrowOf<Col<WeekPlansRow, 'entry_type'>, 'meal' | 'task'>;

/** Belegt durch `event_reminder_jobs_status_check`. */
export type ReminderJobStatus = NarrowOf<
  Col<EventReminderJobsRow, 'status'>,
  'pending' | 'processing' | 'sent' | 'failed' | 'canceled'
>;

/** Belegt durch `data_export_requests_status_check`. */
export type DataExportRequestStatus = NarrowOf<
  Col<DataExportRequestsRow, 'status'>,
  'pending' | 'approved' | 'rejected'
>;

/**
 * `notes_todos.assigned_to` und `recurring_tasks.assigned_to` tragen entweder
 * eine User-UUID oder das Wort `both`. Kein CHECK, keine Fremdschluessel —
 * die Semantik steckt allein im Altcode, deshalb bleibt der Typ weit.
 */
export type AssignedTo = Col<NotesTodosRow, 'assigned_to'>;

/**
 * Die Spalten, auf denen die App aufsetzt, als ausdrueckliche Zusage.
 *
 * Verschwindet eine davon aus der Datenbank, faellt der Typecheck hier — an
 * einer Stelle, die erklaert warum. Genau das hat gefehlt, als diese Datei von
 * Hand gepflegt wurde: `profiles.calendar_id` und `profiles.updated_at` standen
 * jahrelang im Typ und haben in der Datenbank nie existiert.
 */
export type ProfileEssentials = Pick<
  ProfilesRow,
  'id' | 'name' | 'email' | 'invite_code' | 'partner_id' | 'anniversary_date' | 'timezone'
>;
export type EventEssentials = Pick<
  EventsRow,
  'id' | 'calendar_id' | 'name' | 'start_date' | 'start_time' | 'belongs_to' | 'created_by'
>;
