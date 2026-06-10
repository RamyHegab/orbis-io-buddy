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
          branch_id: string | null
          created_at: string
          day_date: string
          end_time: string | null
          id: string
          location: string | null
          notes: string | null
          school_id: string | null
          start_time: string | null
          title: string
          trip_id: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          agent_id?: string | null
          branch_id?: string | null
          created_at?: string
          day_date: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          school_id?: string | null
          start_time?: string | null
          title: string
          trip_id: string
          type: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          agent_id?: string | null
          branch_id?: string | null
          created_at?: string
          day_date?: string
          end_time?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          school_id?: string | null
          start_time?: string | null
          title?: string
          trip_id?: string
          type?: Database["public"]["Enums"]["activity_type"]
          updated_at?: string
          user_id?: string
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
          id: string
          in_country_trading_name: string | null
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
          id?: string
          in_country_trading_name?: string | null
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
          id?: string
          in_country_trading_name?: string | null
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
      form_submissions: {
        Row: {
          activity_id: string
          created_at: string
          data: Json
          id: string
          template_id: string
          user_id: string
        }
        Insert: {
          activity_id: string
          created_at?: string
          data?: Json
          id?: string
          template_id: string
          user_id: string
        }
        Update: {
          activity_id?: string
          created_at?: string
          data?: Json
          id?: string
          template_id?: string
          user_id?: string
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
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at: string
          created_by: string
          description: string | null
          fields: Json
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          activity_type: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by: string
          description?: string | null
          fields?: Json
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          activity_type?: Database["public"]["Enums"]["activity_type"]
          created_at?: string
          created_by?: string
          description?: string | null
          fields?: Json
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          city: string
          contact_name: string | null
          country: string
          created_at: string
          email: string | null
          id: string
          last_synced_at: string | null
          level: Database["public"]["Enums"]["school_level"]
          name: string
          notes: string | null
          notion_page_id: string | null
          phone: string | null
          properties: Json
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          city: string
          contact_name?: string | null
          country: string
          created_at?: string
          email?: string | null
          id?: string
          last_synced_at?: string | null
          level?: Database["public"]["Enums"]["school_level"]
          name: string
          notes?: string | null
          notion_page_id?: string | null
          phone?: string | null
          properties?: Json
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          city?: string
          contact_name?: string | null
          country?: string
          created_at?: string
          email?: string | null
          id?: string
          last_synced_at?: string | null
          level?: Database["public"]["Enums"]["school_level"]
          name?: string
          notes?: string | null
          notion_page_id?: string | null
          phone?: string | null
          properties?: Json
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          created_at: string
          destinations: string[]
          end_date: string
          id: string
          notes: string | null
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destinations?: string[]
          end_date: string
          id?: string
          notes?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          destinations?: string[]
          end_date?: string
          id?: string
          notes?: string | null
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      agent_status: "active" | "inactive" | "prospect"
      app_role: "admin" | "member"
      school_level: "high_school" | "university" | "language_school" | "other"
      trip_status: "planning" | "active" | "completed"
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
      ],
      agent_status: ["active", "inactive", "prospect"],
      app_role: ["admin", "member"],
      school_level: ["high_school", "university", "language_school", "other"],
      trip_status: ["planning", "active", "completed"],
    },
  },
} as const
