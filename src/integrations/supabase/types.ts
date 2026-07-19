export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          agent_id: string | null
          airline: string | null
          branch_id: string | null
          cost: number | null
          cost_currency: string | null
          created_at: string
          day_date: string
          description: string | null
          end_date: string | null
          end_time: string | null
          flight_number: string | null
          formatted_address: string | null
          from_city: string | null
          from_country: string | null
          id: string
          lat: number | null
          lng: number | null
          location: string | null
          map_url: string | null
          notes: string | null
          objectives: string | null
          place_id: string | null
          resting_type: string | null
          school_id: string | null
          start_time: string | null
          title: string
          to_city: string | null
          to_country: string | null
          transport_mode: string | null
          trip_id: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          user_id: string
          visit_notes: string | null
        }
        Insert: {
          agent_id?: string | null
          airline?: string | null
          branch_id?: string | null
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          day_date: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          flight_number?: string | null
          formatted_address?: string | null
          from_city?: string | null
          from_country?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          map_url?: string | null
          notes?: string | null
          objectives?: string | null
          place_id?: string | null
          resting_type?: string | null
          school_id?: string | null
          start_time?: string | null
          title: string
          to_city?: string | null
          to_country?: string | null
          transport_mode?: string | null
          trip_id: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id: string
          visit_notes?: string | null
        }
        Update: {
          agent_id?: string | null
          airline?: string | null
          branch_id?: string | null
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          day_date?: string
          description?: string | null
          end_date?: string | null
          end_time?: string | null
          flight_number?: string | null
          formatted_address?: string | null
          from_city?: string | null
          from_country?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          location?: string | null
          map_url?: string | null
          notes?: string | null
          objectives?: string | null
          place_id?: string | null
          resting_type?: string | null
          school_id?: string | null
          start_time?: string | null
          title?: string
          to_city?: string | null
          to_country?: string | null
          transport_mode?: string | null
          trip_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id?: string
          visit_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "agent_branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_comments: {
        Row: {
          activity_id: string
          body: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          body: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          body?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_comments_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_branches: {
        Row: {
          address: string | null
          agency_name: string | null
          agent_id: string
          branch_name: string | null
          city: string | null
          contact_email: string | null
          contact_first_name: string | null
          contact_last_name: string | null
          contact_phone: string | null
          contact_position: string | null
          country: string | null
          created_at: string
          formatted_address: string | null
          id: string
          in_country_trading_name: string | null
          lat: number | null
          lng: number | null
          place_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          agency_name?: string | null
          agent_id: string
          branch_name?: string | null
          city?: string | null
          contact_email?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          country?: string | null
          created_at?: string
          formatted_address?: string | null
          id?: string
          in_country_trading_name?: string | null
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          agency_name?: string | null
          agent_id?: string
          branch_name?: string | null
          city?: string | null
          contact_email?: string | null
          contact_first_name?: string | null
          contact_last_name?: string | null
          contact_phone?: string | null
          contact_position?: string | null
          country?: string | null
          created_at?: string
          formatted_address?: string | null
          id?: string
          in_country_trading_name?: string | null
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_branches_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_documents: {
        Row: {
          agent_id: string
          category: Database["public"]["Enums"]["agent_doc_category"]
          content_type: string | null
          file_name: string | null
          file_path: string
          id: string
          renewal_cycle: number
          size_bytes: number | null
          title: string | null
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          agent_id: string
          category: Database["public"]["Enums"]["agent_doc_category"]
          content_type?: string | null
          file_name?: string | null
          file_path: string
          id?: string
          renewal_cycle?: number
          size_bytes?: number | null
          title?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          agent_id?: string
          category?: Database["public"]["Enums"]["agent_doc_category"]
          content_type?: string | null
          file_name?: string | null
          file_path?: string
          id?: string
          renewal_cycle?: number
          size_bytes?: number | null
          title?: string | null
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "agent_documents_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_onboarding: {
        Row: {
          agent_id: string
          approved_at: string | null
          approved_by: string | null
          contact_email: string
          created_at: string
          declared_branches: number | null
          id: string
          rejection_comment: string | null
          started_by: string
          status: string
          submitted_for_approval_at: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          approved_at?: string | null
          approved_by?: string | null
          contact_email: string
          created_at?: string
          declared_branches?: number | null
          id?: string
          rejection_comment?: string | null
          started_by: string
          status?: string
          submitted_for_approval_at?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          approved_at?: string | null
          approved_by?: string | null
          contact_email?: string
          created_at?: string
          declared_branches?: number | null
          id?: string
          rejection_comment?: string | null
          started_by?: string
          status?: string
          submitted_for_approval_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_onboarding_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: true
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_onboarding_checklist: {
        Row: {
          auto: boolean
          created_at: string
          done: boolean
          done_at: string | null
          done_by: string | null
          id: string
          item_key: string
          label: string
          onboarding_id: string
          order_index: number
          phase: string
          updated_at: string
        }
        Insert: {
          auto?: boolean
          created_at?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          item_key: string
          label: string
          onboarding_id: string
          order_index?: number
          phase?: string
          updated_at?: string
        }
        Update: {
          auto?: boolean
          created_at?: string
          done?: boolean
          done_at?: string | null
          done_by?: string | null
          id?: string
          item_key?: string
          label?: string
          onboarding_id?: string
          order_index?: number
          phase?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_onboarding_checklist_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "agent_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_references: {
        Row: {
          agent_id: string
          created_at: string
          done: boolean
          email: string
          id: string
          institution: string | null
          name: string
          request_form_instance_id: string | null
          request_sent_at: string | null
          role: string | null
          sent_via: string | null
          submission_id: string | null
          updated_at: string
        }
        Insert: {
          agent_id: string
          created_at?: string
          done?: boolean
          email: string
          id?: string
          institution?: string | null
          name: string
          request_form_instance_id?: string | null
          request_sent_at?: string | null
          role?: string | null
          sent_via?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Update: {
          agent_id?: string
          created_at?: string
          done?: boolean
          email?: string
          id?: string
          institution?: string | null
          name?: string
          request_form_instance_id?: string | null
          request_sent_at?: string | null
          role?: string | null
          sent_via?: string | null
          submission_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_references_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_references_request_form_instance_id_fkey"
            columns: ["request_form_instance_id"]
            isOneToOne: false
            referencedRelation: "form_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_references_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "form_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      agents: {
        Row: {
          account_manager: string | null
          agent_code: string | null
          agreement_end_date: string | null
          agreement_start_date: string | null
          countries_of_operation: string[]
          created_at: string
          hq_address: string | null
          hq_country: string | null
          id: string
          legal_name: string | null
          main_contact_email: string | null
          main_contact_name: string | null
          main_contact_phone: string | null
          status: Database["public"]["Enums"]["agent_status"]
          trading_name: string
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          account_manager?: string | null
          agent_code?: string | null
          agreement_end_date?: string | null
          agreement_start_date?: string | null
          countries_of_operation?: string[]
          created_at?: string
          hq_address?: string | null
          hq_country?: string | null
          id?: string
          legal_name?: string | null
          main_contact_email?: string | null
          main_contact_name?: string | null
          main_contact_phone?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          trading_name: string
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          account_manager?: string | null
          agent_code?: string | null
          agreement_end_date?: string | null
          agreement_start_date?: string | null
          countries_of_operation?: string[]
          created_at?: string
          hq_address?: string | null
          hq_country?: string | null
          id?: string
          legal_name?: string | null
          main_contact_email?: string | null
          main_contact_name?: string | null
          main_contact_phone?: string | null
          status?: Database["public"]["Enums"]["agent_status"]
          trading_name?: string
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          created_at: string
          currency: string
          cycle_end_month: number
          cycle_end_year: number
          cycle_start_month: number
          cycle_start_year: number
          id: number
          logo_path: string | null
          logo_url: string | null
          sender_subdomain: string | null
          theme_accent: string | null
          theme_mode: string
          theme_primary: string | null
          theme_sidebar: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          cycle_end_month?: number
          cycle_end_year?: number
          cycle_start_month?: number
          cycle_start_year?: number
          id?: number
          logo_path?: string | null
          logo_url?: string | null
          sender_subdomain?: string | null
          theme_accent?: string | null
          theme_mode?: string
          theme_primary?: string | null
          theme_sidebar?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          cycle_end_month?: number
          cycle_end_year?: number
          cycle_start_month?: number
          cycle_start_year?: number
          id?: number
          logo_path?: string | null
          logo_url?: string | null
          sender_subdomain?: string | null
          theme_accent?: string | null
          theme_mode?: string
          theme_primary?: string | null
          theme_sidebar?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cycle_settings: {
        Row: {
          created_at: string
          cycle_end_month: number
          cycle_end_year: number
          cycle_start_month: number
          cycle_start_year: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          cycle_end_month?: number
          cycle_end_year?: number
          cycle_start_month?: number
          cycle_start_year?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          cycle_end_month?: number
          cycle_end_year?: number
          cycle_start_month?: number
          cycle_start_year?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      discovery_jobs: {
        Row: {
          agent_id: string | null
          created_at: string
          error: string | null
          found_count: number
          id: string
          kind: string
          processed_count: number
          status: string
          total_count: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          error?: string | null
          found_count?: number
          id?: string
          kind?: string
          processed_count?: number
          status?: string
          total_count?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          error?: string | null
          found_count?: number
          id?: string
          kind?: string
          processed_count?: number
          status?: string
          total_count?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "discovery_jobs_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      document_permissions: {
        Row: {
          agent_id: string
          granted_at: string
          granted_by: string | null
          user_id: string
        }
        Insert: {
          agent_id: string
          granted_at?: string
          granted_by?: string | null
          user_id: string
        }
        Update: {
          agent_id?: string
          granted_at?: string
          granted_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_permissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      emails_log: {
        Row: {
          body_preview: string | null
          error: string | null
          from_email: string | null
          id: string
          related_agent_id: string | null
          reply_to: string | null
          sent_at: string
          sent_by: string | null
          status: string
          subject: string | null
          template: string | null
          to_email: string
        }
        Insert: {
          body_preview?: string | null
          error?: string | null
          from_email?: string | null
          id?: string
          related_agent_id?: string | null
          reply_to?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          to_email: string
        }
        Update: {
          body_preview?: string | null
          error?: string | null
          from_email?: string | null
          id?: string
          related_agent_id?: string | null
          reply_to?: string | null
          sent_at?: string
          sent_by?: string | null
          status?: string
          subject?: string | null
          template?: string | null
          to_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "emails_log_related_agent_id_fkey"
            columns: ["related_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      event_cities: {
        Row: {
          city: string
          country: string
          created_at: string
          id: string
        }
        Insert: {
          city: string
          country: string
          created_at?: string
          id?: string
        }
        Update: {
          city?: string
          country?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      events_catalog: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_cycle: string | null
          cities: string[]
          cost: number | null
          countries: string[]
          created_at: string
          created_by: string | null
          currency: string
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: string
          title: string
          traveller_id: string | null
          updated_at: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_cycle?: string | null
          cities?: string[]
          cost?: number | null
          countries?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: string
          title: string
          traveller_id?: string | null
          updated_at?: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_cycle?: string | null
          cities?: string[]
          cost?: number | null
          countries?: string[]
          created_at?: string
          created_by?: string | null
          currency?: string
          end_date?: string
          id?: string
          notes?: string | null
          start_date?: string
          status?: string
          title?: string
          traveller_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      form_instances: {
        Row: {
          activity_id: string | null
          country_code: string | null
          created_at: string
          created_by: string
          event_date: string | null
          form_type: Database["public"]["Enums"]["form_type"]
          id: string
          name: string
          related_agent_id: string | null
          related_reference_id: string | null
          template_id: string
          token: string | null
          updated_at: string
        }
        Insert: {
          activity_id?: string | null
          country_code?: string | null
          created_at?: string
          created_by: string
          event_date?: string | null
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          name: string
          related_agent_id?: string | null
          related_reference_id?: string | null
          template_id: string
          token?: string | null
          updated_at?: string
        }
        Update: {
          activity_id?: string | null
          country_code?: string | null
          created_at?: string
          created_by?: string
          event_date?: string | null
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          name?: string
          related_agent_id?: string | null
          related_reference_id?: string | null
          template_id?: string
          token?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_instances_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_instances_related_agent_id_fkey"
            columns: ["related_agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_instances_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_submissions: {
        Row: {
          activity_id: string
          created_at: string
          data: Json
          id: string
          instance_id: string | null
          submitter_name: string | null
          submitter_phone: string | null
          template_id: string
          user_id: string | null
        }
        Insert: {
          activity_id: string
          created_at?: string
          data?: Json
          id?: string
          instance_id?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          template_id: string
          user_id?: string | null
        }
        Update: {
          activity_id?: string
          created_at?: string
          data?: Json
          id?: string
          instance_id?: string | null
          submitter_name?: string | null
          submitter_phone?: string | null
          template_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_instance_id_fkey"
            columns: ["instance_id"]
            isOneToOne: false
            referencedRelation: "form_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          activity_type: Database["public"]["Enums"]["activity_type"] | null
          created_at: string
          created_by: string
          description: string | null
          fields: Json
          form_type: Database["public"]["Enums"]["form_type"]
          id: string
          name: string
          parts: Json
          updated_at: string
        }
        Insert: {
          activity_type?: Database["public"]["Enums"]["activity_type"] | null
          created_at?: string
          created_by: string
          description?: string | null
          fields?: Json
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          name: string
          parts?: Json
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"] | null
          created_at?: string
          created_by?: string
          description?: string | null
          fields?: Json
          form_type?: Database["public"]["Enums"]["form_type"]
          id?: string
          name?: string
          parts?: Json
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          read_at: string | null
          title: string
          trip_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title: string
          trip_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          read_at?: string | null
          title?: string
          trip_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      onboarding_checklist_templates: {
        Row: {
          auto_tick_rule: string | null
          created_at: string
          description: string | null
          id: string
          is_system: boolean
          item_key: string
          label: string
          order_index: number
          phase: string
          updated_at: string
        }
        Insert: {
          auto_tick_rule?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          item_key: string
          label: string
          order_index?: number
          phase?: string
          updated_at?: string
        }
        Update: {
          auto_tick_rule?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_system?: boolean
          item_key?: string
          label?: string
          order_index?: number
          phase?: string
          updated_at?: string
        }
        Relationships: []
      }
      pending_submissions: {
        Row: {
          agent_id: string | null
          created_at: string
          id: string
          payload: Json
          reviewed_at: string | null
          reviewed_by: string | null
          source: string | null
          source_url: string | null
          status: string
          submitter_email: string | null
          submitter_name: string | null
          type: string
        }
        Insert: {
          agent_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
          type: string
        }
        Update: {
          agent_id?: string | null
          created_at?: string
          id?: string
          payload?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          source?: string | null
          source_url?: string | null
          status?: string
          submitter_email?: string | null
          submitter_name?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_submissions_agent_id_fkey"
            columns: ["agent_id"]
            isOneToOne: false
            referencedRelation: "agents"
            referencedColumns: ["id"]
          },
        ]
      }
      planned_activities: {
        Row: {
          academic_support: string
          actual_cost_reminder_sent_at: string | null
          actual_events_cost: number | null
          actual_hotel_cost: number | null
          actual_subsistence_cost: number | null
          actual_travel_cost: number | null
          archived: boolean
          archived_at: string | null
          archived_cycle: string | null
          countries: string[]
          created_at: string
          end_date: string
          event_ids: string[]
          event_types: string[]
          events_cost: number | null
          hotel_cost: number | null
          id: string
          notes: string | null
          objectives: string | null
          reminder_sent_at: string | null
          start_date: string
          status: string
          subsistence_cost: number | null
          title: string
          travel_cost: number | null
          traveller_id: string | null
          trip_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          academic_support?: string
          actual_cost_reminder_sent_at?: string | null
          actual_events_cost?: number | null
          actual_hotel_cost?: number | null
          actual_subsistence_cost?: number | null
          actual_travel_cost?: number | null
          archived?: boolean
          archived_at?: string | null
          archived_cycle?: string | null
          countries?: string[]
          created_at?: string
          end_date: string
          event_ids?: string[]
          event_types?: string[]
          events_cost?: number | null
          hotel_cost?: number | null
          id?: string
          notes?: string | null
          objectives?: string | null
          reminder_sent_at?: string | null
          start_date: string
          status?: string
          subsistence_cost?: number | null
          title: string
          travel_cost?: number | null
          traveller_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          academic_support?: string
          actual_cost_reminder_sent_at?: string | null
          actual_events_cost?: number | null
          actual_hotel_cost?: number | null
          actual_subsistence_cost?: number | null
          actual_travel_cost?: number | null
          archived?: boolean
          archived_at?: string | null
          archived_cycle?: string | null
          countries?: string[]
          created_at?: string
          end_date?: string
          event_ids?: string[]
          event_types?: string[]
          events_cost?: number | null
          hotel_cost?: number | null
          id?: string
          notes?: string | null
          objectives?: string | null
          reminder_sent_at?: string | null
          start_date?: string
          status?: string
          subsistence_cost?: number | null
          title?: string
          travel_cost?: number | null
          traveller_id?: string | null
          trip_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "planned_activities_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          can_manage_agents: boolean
          can_manage_schools: boolean
          can_manage_templates: boolean
          can_manage_users: boolean
          can_view_all_trips: boolean
          created_at: string
          discovery_banner_dismissed_at: string | null
          email: string | null
          email_local_part: string | null
          full_name: string | null
          id: string
          line_manager_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          can_manage_agents?: boolean
          can_manage_schools?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_trips?: boolean
          created_at?: string
          discovery_banner_dismissed_at?: string | null
          email?: string | null
          email_local_part?: string | null
          full_name?: string | null
          id: string
          line_manager_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          can_manage_agents?: boolean
          can_manage_schools?: boolean
          can_manage_templates?: boolean
          can_manage_users?: boolean
          can_view_all_trips?: boolean
          created_at?: string
          discovery_banner_dismissed_at?: string | null
          email?: string | null
          email_local_part?: string | null
          full_name?: string | null
          id?: string
          line_manager_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_line_manager_id_fkey"
            columns: ["line_manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      schools: {
        Row: {
          address: string | null
          campus_image_url: string | null
          city: string
          country: string
          created_at: string
          formatted_address: string | null
          general_email: string | null
          general_phone: string | null
          id: string
          last_synced_at: string | null
          lat: number | null
          level: Database["public"]["Enums"]["school_level"]
          lng: number | null
          name: string
          notes: string | null
          notion_page_id: string | null
          place_id: string | null
          primary_contact_email: string | null
          primary_contact_name: string | null
          primary_contact_phone: string | null
          primary_contact_position: string | null
          properties: Json
          secondary_contact_email: string | null
          secondary_contact_name: string | null
          secondary_contact_phone: string | null
          status: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          campus_image_url?: string | null
          city: string
          country: string
          created_at?: string
          formatted_address?: string | null
          general_email?: string | null
          general_phone?: string | null
          id?: string
          last_synced_at?: string | null
          lat?: number | null
          level?: Database["public"]["Enums"]["school_level"]
          lng?: number | null
          name: string
          notes?: string | null
          notion_page_id?: string | null
          place_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_position?: string | null
          properties?: Json
          secondary_contact_email?: string | null
          secondary_contact_name?: string | null
          secondary_contact_phone?: string | null
          status?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          campus_image_url?: string | null
          city?: string
          country?: string
          created_at?: string
          formatted_address?: string | null
          general_email?: string | null
          general_phone?: string | null
          id?: string
          last_synced_at?: string | null
          lat?: number | null
          level?: Database["public"]["Enums"]["school_level"]
          lng?: number | null
          name?: string
          notes?: string | null
          notion_page_id?: string | null
          place_id?: string | null
          primary_contact_email?: string | null
          primary_contact_name?: string | null
          primary_contact_phone?: string | null
          primary_contact_position?: string | null
          properties?: Json
          secondary_contact_email?: string | null
          secondary_contact_name?: string | null
          secondary_contact_phone?: string | null
          status?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      trip_approvals: {
        Row: {
          created_at: string
          decided_at: string | null
          decision: string
          id: string
          manager_id: string
          note: string | null
          requested_by: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          decided_at?: string | null
          decision?: string
          id?: string
          manager_id: string
          note?: string | null
          requested_by: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          decided_at?: string | null
          decision?: string
          id?: string
          manager_id?: string
          note?: string | null
          requested_by?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_approvals_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_countries: {
        Row: {
          country: string
          created_at: string
          end_date: string
          id: string
          sort_order: number
          start_date: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          country: string
          created_at?: string
          end_date: string
          id?: string
          sort_order?: number
          start_date: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          country?: string
          created_at?: string
          end_date?: string
          id?: string
          sort_order?: number
          start_date?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_countries_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_hotels: {
        Row: {
          address: string | null
          check_in_date: string
          check_in_time: string | null
          check_out_date: string
          check_out_time: string | null
          cost: number | null
          cost_currency: string | null
          created_at: string
          formatted_address: string | null
          id: string
          lat: number | null
          lng: number | null
          map_url: string | null
          name: string
          notes: string | null
          place_id: string | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          check_in_date: string
          check_in_time?: string | null
          check_out_date: string
          check_out_time?: string | null
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          map_url?: string | null
          name: string
          notes?: string | null
          place_id?: string | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          check_in_date?: string
          check_in_time?: string | null
          check_out_date?: string
          check_out_time?: string | null
          cost?: number | null
          cost_currency?: string | null
          created_at?: string
          formatted_address?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          map_url?: string | null
          name?: string
          notes?: string | null
          place_id?: string | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_hotels_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_reports: {
        Row: {
          content_md: string
          created_at: string
          id: string
          model: string | null
          trip_id: string
          user_id: string
        }
        Insert: {
          content_md: string
          created_at?: string
          id?: string
          model?: string | null
          trip_id: string
          user_id: string
        }
        Update: {
          content_md?: string
          created_at?: string
          id?: string
          model?: string | null
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_reports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          archived: boolean
          archived_at: string | null
          archived_cycle: string | null
          checklist: Json
          created_at: string
          destinations: string[]
          end_date: string
          id: string
          notes: string | null
          objectives: string | null
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          archived?: boolean
          archived_at?: string | null
          archived_cycle?: string | null
          checklist?: Json
          created_at?: string
          destinations?: string[]
          end_date: string
          id?: string
          notes?: string | null
          objectives?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          archived?: boolean
          archived_at?: string | null
          archived_cycle?: string | null
          checklist?: Json
          created_at?: string
          destinations?: string[]
          end_date?: string
          id?: string
          notes?: string | null
          objectives?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      get_public_form_instance: {
        Args: { p_id: string }
        Returns: {
          activity_id: string
          country_code: string
          event_date: string
          id: string
          name: string
          template_description: string
          template_fields: Json
          template_id: string
          template_name: string
        }[]
      }
      get_user_display: {
        Args: { _ids: string[] }
        Returns: {
          avatar_url: string
          full_name: string
          id: string
        }[]
      }
      has_capability: {
        Args: { _cap: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_line_manager_of: {
        Args: { _manager: string; _user: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      activity_type:
        | "travel"
        | "agent_visit"
        | "school_visit"
        | "recruitment_event"
        | "resting_day"
        | "other"
        | "hotel"
      agent_doc_category:
        | "british_council"
        | "company_registration"
        | "supporting"
      agent_status:
        | "active"
        | "inactive"
        | "prospect"
        | "onboarding"
        | "pending_approval"
      app_role: "admin" | "member" | "manager"
      form_type:
        | "activity"
        | "agent_signup"
        | "reference_request"
        | "agent_branch"
        | "other"
      school_level: "high_school" | "university" | "language_school" | "other"
      trip_status:
        | "planning"
        | "active"
        | "completed"
        | "confirmed"
        | "submitted"
        | "approved"
        | "canceled"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_type: [
        "travel",
        "agent_visit",
        "school_visit",
        "recruitment_event",
        "resting_day",
        "other",
        "hotel",
      ],
      agent_doc_category: [
        "british_council",
        "company_registration",
        "supporting",
      ],
      agent_status: [
        "active",
        "inactive",
        "prospect",
        "onboarding",
        "pending_approval",
      ],
      app_role: ["admin", "member", "manager"],
      form_type: [
        "activity",
        "agent_signup",
        "reference_request",
        "agent_branch",
        "other",
      ],
      school_level: ["high_school", "university", "language_school", "other"],
      trip_status: [
        "planning",
        "active",
        "completed",
        "confirmed",
        "submitted",
        "approved",
        "canceled",
      ],
    },
  },
} as const
