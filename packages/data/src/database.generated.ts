/**
 * GENERIERT — NICHT VON HAND AENDERN.
 *
 * Quelle: Supabase-Projekt `nyvripddydrzvfuateea`, Introspektion der laufenden
 * Datenbank am 2026-08-10. PostgREST 14.4.
 *
 * Neu erzeugen:
 *   npx supabase gen types typescript --project-id nyvripddydrzvfuateea
 * oder, ohne Access-Token, ueber den Supabase-MCP-Server
 * (`generate_typescript_types`) — der benutzt die bestehende Verbindung.
 *
 * Diese Datei ist die Wahrheit ueber das Schema. `database.types.ts` leitet
 * seine kuratierten Typen daraus ab und laesst sich von tsc gegenpruefen; die
 * Verengungen dort (BelongsTo, PlanTier, …) sind CHECK-Constraints, die ein
 * Generator nicht sehen kann.
 *
 * Enthaelt zwei Dinge, die nicht zur App gehoeren und hier nur stehen, weil sie
 * im selben Schema liegen: `crawled_events` (fremdes Projekt an derselben
 * Datenbank) und die `dblink_*`-Funktionen der Extension.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.4';
  };
  public: {
    Tables: {
      app_preferences: {
        Row: {
          created_at: string;
          locale: string;
          notification_settings: Json;
          solo_mode: boolean;
          updated_at: string;
          user_id: string;
          week_start: string;
        };
        Insert: {
          created_at?: string;
          locale?: string;
          notification_settings?: Json;
          solo_mode?: boolean;
          updated_at?: string;
          user_id: string;
          week_start?: string;
        };
        Update: {
          created_at?: string;
          locale?: string;
          notification_settings?: Json;
          solo_mode?: boolean;
          updated_at?: string;
          user_id?: string;
          week_start?: string;
        };
        Relationships: [];
      };
      crawled_events: {
        Row: {
          accessibility_info: string | null;
          address: string | null;
          age_restriction: string | null;
          category: string | null;
          city: string | null;
          country: string | null;
          crawled_at: string | null;
          crawler_source: string | null;
          created_at: string | null;
          currency: string | null;
          dedup_key: string;
          description: string | null;
          end_date: string;
          end_time: string | null;
          gallery_images: string[] | null;
          id: string;
          image_url: string | null;
          info_url: string | null;
          is_all_day: boolean | null;
          last_seen_at: string | null;
          latitude: number | null;
          location_name: string | null;
          longitude: number | null;
          organizer_email: string | null;
          organizer_name: string | null;
          organizer_phone: string | null;
          organizer_website: string | null;
          postal_code: string | null;
          price: string | null;
          price_details: string | null;
          recurrence_rule: string | null;
          registration_deadline: string | null;
          registration_required: boolean | null;
          short_description: string | null;
          source: string;
          source_url: string;
          start_date: string;
          start_time: string | null;
          status: string | null;
          subcategory: string | null;
          subtitle: string | null;
          tags: string[] | null;
          target_audience: string[] | null;
          ticket_url: string | null;
          timezone: string | null;
          title: string;
          updated_at: string | null;
          visibility: string | null;
        };
        Insert: {
          accessibility_info?: string | null;
          address?: string | null;
          age_restriction?: string | null;
          category?: string | null;
          city?: string | null;
          country?: string | null;
          crawled_at?: string | null;
          crawler_source?: string | null;
          created_at?: string | null;
          currency?: string | null;
          dedup_key: string;
          description?: string | null;
          end_date: string;
          end_time?: string | null;
          gallery_images?: string[] | null;
          id?: string;
          image_url?: string | null;
          info_url?: string | null;
          is_all_day?: boolean | null;
          last_seen_at?: string | null;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          organizer_email?: string | null;
          organizer_name?: string | null;
          organizer_phone?: string | null;
          organizer_website?: string | null;
          postal_code?: string | null;
          price?: string | null;
          price_details?: string | null;
          recurrence_rule?: string | null;
          registration_deadline?: string | null;
          registration_required?: boolean | null;
          short_description?: string | null;
          source?: string;
          source_url?: string;
          start_date: string;
          start_time?: string | null;
          status?: string | null;
          subcategory?: string | null;
          subtitle?: string | null;
          tags?: string[] | null;
          target_audience?: string[] | null;
          ticket_url?: string | null;
          timezone?: string | null;
          title?: string;
          updated_at?: string | null;
          visibility?: string | null;
        };
        Update: {
          accessibility_info?: string | null;
          address?: string | null;
          age_restriction?: string | null;
          category?: string | null;
          city?: string | null;
          country?: string | null;
          crawled_at?: string | null;
          crawler_source?: string | null;
          created_at?: string | null;
          currency?: string | null;
          dedup_key?: string;
          description?: string | null;
          end_date?: string;
          end_time?: string | null;
          gallery_images?: string[] | null;
          id?: string;
          image_url?: string | null;
          info_url?: string | null;
          is_all_day?: boolean | null;
          last_seen_at?: string | null;
          latitude?: number | null;
          location_name?: string | null;
          longitude?: number | null;
          organizer_email?: string | null;
          organizer_name?: string | null;
          organizer_phone?: string | null;
          organizer_website?: string | null;
          postal_code?: string | null;
          price?: string | null;
          price_details?: string | null;
          recurrence_rule?: string | null;
          registration_deadline?: string | null;
          registration_required?: boolean | null;
          short_description?: string | null;
          source?: string;
          source_url?: string;
          start_date?: string;
          start_time?: string | null;
          status?: string | null;
          subcategory?: string | null;
          subtitle?: string | null;
          tags?: string[] | null;
          target_audience?: string[] | null;
          ticket_url?: string | null;
          timezone?: string | null;
          title?: string;
          updated_at?: string | null;
          visibility?: string | null;
        };
        Relationships: [];
      };
      event_reminder_jobs: {
        Row: {
          attempts: number;
          calendar_id: string;
          created_at: string;
          event_id: string;
          event_name: string;
          event_start_at: string;
          id: string;
          last_error: string | null;
          location: string | null;
          locked_at: string | null;
          occurrence_date: string;
          recipient_user_id: string;
          remind_at: string;
          reminder_offset_minutes: number;
          sent_at: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          calendar_id: string;
          created_at?: string;
          event_id: string;
          event_name: string;
          event_start_at: string;
          id?: string;
          last_error?: string | null;
          location?: string | null;
          locked_at?: string | null;
          occurrence_date: string;
          recipient_user_id: string;
          remind_at: string;
          reminder_offset_minutes: number;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          calendar_id?: string;
          created_at?: string;
          event_id?: string;
          event_name?: string;
          event_start_at?: string;
          id?: string;
          last_error?: string | null;
          location?: string | null;
          locked_at?: string | null;
          occurrence_date?: string;
          recipient_user_id?: string;
          remind_at?: string;
          reminder_offset_minutes?: number;
          sent_at?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'event_reminder_jobs_event_id_fkey';
            columns: ['event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'event_reminder_jobs_recipient_user_id_fkey';
            columns: ['recipient_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      events: {
        Row: {
          belongs_to: string;
          calendar_id: string;
          category: string | null;
          created_at: string | null;
          created_by: string | null;
          end_date: string;
          end_time: string;
          event_type: string | null;
          extended_data: Json | null;
          google_event_id: string | null;
          id: string;
          is_special_auto: boolean | null;
          location: string | null;
          name: string;
          notes: string | null;
          parent_event_id: string | null;
          recurrence_end_date: string | null;
          recurrence_interval: number | null;
          recurrence_type: string | null;
          reminder_enabled: boolean | null;
          reminder_offset_minutes: number | null;
          reminder_offsets: number[] | null;
          short_description: string | null;
          special_key: string | null;
          start_date: string;
          start_time: string;
          subtitle: string | null;
          updated_at: string | null;
        };
        Insert: {
          belongs_to: string;
          calendar_id: string;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          end_date: string;
          end_time: string;
          event_type?: string | null;
          extended_data?: Json | null;
          google_event_id?: string | null;
          id?: string;
          is_special_auto?: boolean | null;
          location?: string | null;
          name: string;
          notes?: string | null;
          parent_event_id?: string | null;
          recurrence_end_date?: string | null;
          recurrence_interval?: number | null;
          recurrence_type?: string | null;
          reminder_enabled?: boolean | null;
          reminder_offset_minutes?: number | null;
          reminder_offsets?: number[] | null;
          short_description?: string | null;
          special_key?: string | null;
          start_date: string;
          start_time: string;
          subtitle?: string | null;
          updated_at?: string | null;
        };
        Update: {
          belongs_to?: string;
          calendar_id?: string;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          end_date?: string;
          end_time?: string;
          event_type?: string | null;
          extended_data?: Json | null;
          google_event_id?: string | null;
          id?: string;
          is_special_auto?: boolean | null;
          location?: string | null;
          name?: string;
          notes?: string | null;
          parent_event_id?: string | null;
          recurrence_end_date?: string | null;
          recurrence_interval?: number | null;
          recurrence_type?: string | null;
          reminder_enabled?: boolean | null;
          reminder_offset_minutes?: number | null;
          reminder_offsets?: number[] | null;
          short_description?: string | null;
          special_key?: string | null;
          start_date?: string;
          start_time?: string;
          subtitle?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'events_parent_event_id_fkey';
            columns: ['parent_event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_budgets: {
        Row: {
          amount: number;
          calendar_id: string;
          created_at: string;
          created_by: string;
          id: string;
          month_start: string;
          updated_at: string;
        };
        Insert: {
          amount: number;
          calendar_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          month_start: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          month_start?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_categories: {
        Row: {
          calendar_id: string;
          color: string | null;
          created_at: string;
          created_by: string;
          id: string;
          monthly_limit: number | null;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          calendar_id: string;
          color?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          monthly_limit?: number | null;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          calendar_id?: string;
          color?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          monthly_limit?: number | null;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      expense_settlements: {
        Row: {
          amount: number;
          calendar_id: string;
          created_at: string;
          created_by: string;
          from_user_id: string;
          id: string;
          notes: string | null;
          settled_at: string;
          to_user_id: string;
        };
        Insert: {
          amount: number;
          calendar_id: string;
          created_at?: string;
          created_by: string;
          from_user_id: string;
          id?: string;
          notes?: string | null;
          settled_at?: string;
          to_user_id: string;
        };
        Update: {
          amount?: number;
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          from_user_id?: string;
          id?: string;
          notes?: string | null;
          settled_at?: string;
          to_user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_settlements_from_user_id_fkey';
            columns: ['from_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_settlements_to_user_id_fkey';
            columns: ['to_user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      expense_splits: {
        Row: {
          amount: number;
          created_at: string;
          expense_id: string;
          id: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          expense_id: string;
          id?: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          expense_id?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expense_splits_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'shared_expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_splits_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      notes_todo_groups: {
        Row: {
          calendar_id: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
        };
        Insert: {
          calendar_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          name: string;
        };
        Update: {
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          name?: string;
        };
        Relationships: [];
      };
      notes_todos: {
        Row: {
          assigned_to: string;
          calendar_id: string;
          category: string | null;
          completed_at: string | null;
          content: string | null;
          created_at: string;
          created_by: string;
          group_name: string;
          id: string;
          is_done: boolean;
          item_type: string;
          quantity: number | null;
          sort_order: number;
          title: string;
          unit: string | null;
          updated_at: string;
          workflow_status: string;
        };
        Insert: {
          assigned_to?: string;
          calendar_id: string;
          category?: string | null;
          completed_at?: string | null;
          content?: string | null;
          created_at?: string;
          created_by: string;
          group_name?: string;
          id?: string;
          is_done?: boolean;
          item_type?: string;
          quantity?: number | null;
          sort_order?: number;
          title: string;
          unit?: string | null;
          updated_at?: string;
          workflow_status?: string;
        };
        Update: {
          assigned_to?: string;
          calendar_id?: string;
          category?: string | null;
          completed_at?: string | null;
          content?: string | null;
          created_at?: string;
          created_by?: string;
          group_name?: string;
          id?: string;
          is_done?: boolean;
          item_type?: string;
          quantity?: number | null;
          sort_order?: number;
          title?: string;
          unit?: string | null;
          updated_at?: string;
          workflow_status?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          anniversary_date: string | null;
          created_at: string | null;
          email: string | null;
          id: string;
          invite_code: string | null;
          ls_customer_id: string | null;
          ls_subscription_id: string | null;
          name: string | null;
          partner_id: string | null;
          plan_status: string | null;
          plan_tier: string | null;
          pro_expires_at: string | null;
          timezone: string | null;
        };
        Insert: {
          anniversary_date?: string | null;
          created_at?: string | null;
          email?: string | null;
          id: string;
          invite_code?: string | null;
          ls_customer_id?: string | null;
          ls_subscription_id?: string | null;
          name?: string | null;
          partner_id?: string | null;
          plan_status?: string | null;
          plan_tier?: string | null;
          pro_expires_at?: string | null;
          timezone?: string | null;
        };
        Update: {
          anniversary_date?: string | null;
          created_at?: string | null;
          email?: string | null;
          id?: string;
          invite_code?: string | null;
          ls_customer_id?: string | null;
          ls_subscription_id?: string | null;
          name?: string | null;
          partner_id?: string | null;
          plan_status?: string | null;
          plan_tier?: string | null;
          pro_expires_at?: string | null;
          timezone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_partner_id_fkey';
            columns: ['partner_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          id: number;
          is_active: boolean;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          id?: number;
          is_active?: boolean;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          id?: number;
          is_active?: boolean;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      recurring_event_exceptions: {
        Row: {
          calendar_id: string;
          created_at: string;
          created_by: string;
          id: string;
          is_deleted: boolean;
          master_event_id: string;
          original_occurrence_date: string;
          override_event_data: Json | null;
          updated_at: string;
        };
        Insert: {
          calendar_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          is_deleted?: boolean;
          master_event_id: string;
          original_occurrence_date: string;
          override_event_data?: Json | null;
          updated_at?: string;
        };
        Update: {
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_deleted?: boolean;
          master_event_id?: string;
          original_occurrence_date?: string;
          override_event_data?: Json | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recurring_event_exceptions_master_event_id_fkey';
            columns: ['master_event_id'];
            isOneToOne: false;
            referencedRelation: 'events';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_task_logs: {
        Row: {
          amount: number;
          calendar_id: string;
          created_at: string;
          created_by: string;
          id: string;
          log_date: string;
          note: string | null;
          task_id: string;
        };
        Insert: {
          amount: number;
          calendar_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          log_date: string;
          note?: string | null;
          task_id: string;
        };
        Update: {
          amount?: number;
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          log_date?: string;
          note?: string | null;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recurring_task_logs_task_id_fkey';
            columns: ['task_id'];
            isOneToOne: false;
            referencedRelation: 'recurring_tasks';
            referencedColumns: ['id'];
          },
        ];
      };
      recurring_tasks: {
        Row: {
          active: boolean;
          assigned_to: string;
          cadence: string;
          calendar_id: string;
          created_at: string;
          created_by: string;
          description: string | null;
          group_name: string;
          id: string;
          recurrence_interval: number;
          sort_order: number;
          starts_on: string;
          target_mode: string;
          target_value: number;
          title: string;
          updated_at: string;
          workflow_status: string;
        };
        Insert: {
          active?: boolean;
          assigned_to?: string;
          cadence?: string;
          calendar_id: string;
          created_at?: string;
          created_by: string;
          description?: string | null;
          group_name?: string;
          id?: string;
          recurrence_interval?: number;
          sort_order?: number;
          starts_on?: string;
          target_mode?: string;
          target_value?: number;
          title: string;
          updated_at?: string;
          workflow_status?: string;
        };
        Update: {
          active?: boolean;
          assigned_to?: string;
          cadence?: string;
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          description?: string | null;
          group_name?: string;
          id?: string;
          recurrence_interval?: number;
          sort_order?: number;
          starts_on?: string;
          target_mode?: string;
          target_value?: number;
          title?: string;
          updated_at?: string;
          workflow_status?: string;
        };
        Relationships: [];
      };
      sent_event_reminders: {
        Row: {
          event_id: string;
          recipient_user_id: string;
          sent_at: string;
          token: string;
        };
        Insert: {
          event_id: string;
          recipient_user_id: string;
          sent_at?: string;
          token: string;
        };
        Update: {
          event_id?: string;
          recipient_user_id?: string;
          sent_at?: string;
          token?: string;
        };
        Relationships: [];
      };
      shared_expenses: {
        Row: {
          amount: number;
          calendar_id: string;
          category: string | null;
          created_at: string | null;
          id: string;
          notes: string | null;
          paid_at: string;
          paid_by: string;
          split_type: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          amount: number;
          calendar_id: string;
          category?: string | null;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          paid_at?: string;
          paid_by: string;
          split_type?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          amount?: number;
          calendar_id?: string;
          category?: string | null;
          created_at?: string | null;
          id?: string;
          notes?: string | null;
          paid_at?: string;
          paid_by?: string;
          split_type?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'shared_expenses_paid_by_fkey';
            columns: ['paid_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      week_plans: {
        Row: {
          assigned_to: string;
          calendar_id: string;
          completed_at: string | null;
          created_at: string | null;
          created_by: string;
          day_of_week: number;
          entry_type: string;
          id: string;
          is_done: boolean;
          notes: string | null;
          sort_order: number | null;
          title: string;
          updated_at: string | null;
          week_start: string;
        };
        Insert: {
          assigned_to?: string;
          calendar_id: string;
          completed_at?: string | null;
          created_at?: string | null;
          created_by: string;
          day_of_week: number;
          entry_type: string;
          id?: string;
          is_done?: boolean;
          notes?: string | null;
          sort_order?: number | null;
          title: string;
          updated_at?: string | null;
          week_start: string;
        };
        Update: {
          assigned_to?: string;
          calendar_id?: string;
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string;
          day_of_week?: number;
          entry_type?: string;
          id?: string;
          is_done?: boolean;
          notes?: string | null;
          sort_order?: number | null;
          title?: string;
          updated_at?: string | null;
          week_start?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      claim_due_event_reminder_jobs: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          calendar_id: string;
          created_at: string;
          event_id: string;
          event_name: string;
          event_start_at: string;
          id: string;
          last_error: string | null;
          location: string | null;
          locked_at: string | null;
          occurrence_date: string;
          recipient_user_id: string;
          remind_at: string;
          reminder_offset_minutes: number;
          sent_at: string | null;
          status: string;
          updated_at: string;
        }[];
        SetofOptions: {
          from: '*';
          to: 'event_reminder_jobs';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      connect_partner: { Args: { p_invite_code: string }; Returns: Json };
      dblink: { Args: { '': string }; Returns: Record<string, unknown>[] };
      dblink_cancel_query: { Args: { '': string }; Returns: string };
      dblink_close: { Args: { '': string }; Returns: string };
      dblink_connect: { Args: { '': string }; Returns: string };
      dblink_connect_u: { Args: { '': string }; Returns: string };
      dblink_current_query: { Args: never; Returns: string };
      dblink_disconnect:
        { Args: never; Returns: string } | { Args: { '': string }; Returns: string };
      dblink_error_message: { Args: { '': string }; Returns: string };
      dblink_exec: { Args: { '': string }; Returns: string };
      dblink_fdw_validator: {
        Args: { catalog: unknown; options: string[] };
        Returns: undefined;
      };
      dblink_get_connections: { Args: never; Returns: string[] };
      dblink_get_notify:
        | { Args: { conname: string }; Returns: Record<string, unknown>[] }
        | { Args: never; Returns: Record<string, unknown>[] };
      dblink_get_pkey: {
        Args: { '': string };
        Returns: Database['public']['CompositeTypes']['dblink_pkey_results'][];
        SetofOptions: {
          from: '*';
          to: 'dblink_pkey_results';
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      dblink_get_result: {
        Args: { '': string };
        Returns: Record<string, unknown>[];
      };
      dblink_is_busy: { Args: { '': string }; Returns: number };
      delete_notes_todo_group: {
        Args: {
          p_calendar_id: string;
          p_group_id: string;
          p_group_name: string;
        };
        Returns: string;
      };
      disconnect_partner: { Args: never; Returns: undefined };
      event_reminder_recipients: {
        Args: { p_belongs_to: string; p_calendar_id: string };
        Returns: {
          user_id: string;
        }[];
      };
      generate_invite_code: { Args: never; Returns: string };
      get_runtime_secret: { Args: { secret_name: string }; Returns: string };
      invoke_reminder_worker: { Args: never; Returns: number };
      mark_event_reminder_job_failed: {
        Args: { p_error?: string; p_job_id: string };
        Returns: undefined;
      };
      mark_event_reminder_job_sent: {
        Args: { p_job_id: string };
        Returns: undefined;
      };
      rebuild_all_event_reminder_jobs: { Args: never; Returns: number };
      rebuild_event_reminder_jobs: {
        Args: { p_event_id: string };
        Returns: number;
      };
      rename_notes_todo_group: {
        Args: {
          p_calendar_id: string;
          p_current_name: string;
          p_group_id: string;
          p_new_name: string;
        };
        Returns: {
          calendar_id: string;
          created_at: string;
          created_by: string;
          id: string;
          name: string;
        };
        SetofOptions: {
          from: '*';
          to: 'notes_todo_groups';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reorder_notes_todos: {
        Args: {
          p_calendar_id: string;
          p_group_name: string;
          p_positions: Json;
          p_updated_at?: string;
        };
        Returns: number;
      };
      set_shared_anniversary: { Args: { p_date: string }; Returns: undefined };
      split_recurring_event_future: {
        Args: {
          p_delete_future: boolean;
          p_event_data: Json;
          p_master_event_id: string;
          p_original_occurrence_date: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      dblink_pkey_results: {
        position: number | null;
        colname: string | null;
      };
    };
  };
};
