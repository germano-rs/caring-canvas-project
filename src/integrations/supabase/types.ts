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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      address_geocoding_cache: {
        Row: {
          bairro: string | null
          cidade: string
          created_at: string
          id: string
          latitude: number
          longitude: number
          rua: string | null
          uf: string
        }
        Insert: {
          bairro?: string | null
          cidade: string
          created_at?: string
          id?: string
          latitude: number
          longitude: number
          rua?: string | null
          uf: string
        }
        Update: {
          bairro?: string | null
          cidade?: string
          created_at?: string
          id?: string
          latitude?: number
          longitude?: number
          rua?: string | null
          uf?: string
        }
        Relationships: []
      }
      geocoding_cache: {
        Row: {
          bairro: string | null
          cep: string
          created_at: string | null
          latitude: number
          longitude: number
          rua: string | null
        }
        Insert: {
          bairro?: string | null
          cep: string
          created_at?: string | null
          latitude: number
          longitude: number
          rua?: string | null
        }
        Update: {
          bairro?: string | null
          cep?: string
          created_at?: string | null
          latitude?: number
          longitude?: number
          rua?: string | null
        }
        Relationships: []
      }
      health_events: {
        Row: {
          ano_notificacao: string | null
          bairro: string | null
          cep: string | null
          created_at: string | null
          data_nascimento: string | null
          event_date: string
          event_type: string | null
          gestante: string | null
          id: string
          id_unidade: string | null
          latitude: number
          location_found: boolean
          logradouro: string | null
          longitude: number
          numero_notificacao: string | null
          raw_data: Json
          row_hash: string
          rua: string | null
          sexo: string | null
          spreadsheet_id: string
          tipo_notificacao: string | null
        }
        Insert: {
          ano_notificacao?: string | null
          bairro?: string | null
          cep?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          event_date: string
          event_type?: string | null
          gestante?: string | null
          id?: string
          id_unidade?: string | null
          latitude: number
          location_found?: boolean
          logradouro?: string | null
          longitude: number
          numero_notificacao?: string | null
          raw_data: Json
          row_hash: string
          rua?: string | null
          sexo?: string | null
          spreadsheet_id: string
          tipo_notificacao?: string | null
        }
        Update: {
          ano_notificacao?: string | null
          bairro?: string | null
          cep?: string | null
          created_at?: string | null
          data_nascimento?: string | null
          event_date?: string
          event_type?: string | null
          gestante?: string | null
          id?: string
          id_unidade?: string | null
          latitude?: number
          location_found?: boolean
          logradouro?: string | null
          longitude?: number
          numero_notificacao?: string | null
          raw_data?: Json
          row_hash?: string
          rua?: string | null
          sexo?: string | null
          spreadsheet_id?: string
          tipo_notificacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "health_events_spreadsheet_id_fkey"
            columns: ["spreadsheet_id"]
            isOneToOne: false
            referencedRelation: "spreadsheet_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_panels: {
        Row: {
          config_id: string | null
          created_at: string | null
          filters: Json
          id: string
          is_comparison: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          config_id?: string | null
          created_at?: string | null
          filters?: Json
          id?: string
          is_comparison?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          config_id?: string | null
          created_at?: string | null
          filters?: Json
          id?: string
          is_comparison?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_panels_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "spreadsheet_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      spreadsheet_configs: {
        Row: {
          auto_geocode: boolean
          column_mapping: Json
          created_at: string | null
          id: string
          last_sync_at: string | null
          name: string
          updated_at: string | null
          url: string
        }
        Insert: {
          auto_geocode?: boolean
          column_mapping?: Json
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name: string
          updated_at?: string | null
          url: string
        }
        Update: {
          auto_geocode?: boolean
          column_mapping?: Json
          created_at?: string | null
          id?: string
          last_sync_at?: string | null
          name?: string
          updated_at?: string | null
          url?: string
        }
        Relationships: []
      }
      sync_job_items: {
        Row: {
          attempts: number | null
          created_at: string | null
          error: string | null
          id: string
          job_id: string | null
          row_data: Json
          row_hash: string
          spreadsheet_id: string | null
          status: string
        }
        Insert: {
          attempts?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_id?: string | null
          row_data: Json
          row_hash: string
          spreadsheet_id?: string | null
          status?: string
        }
        Update: {
          attempts?: number | null
          created_at?: string | null
          error?: string | null
          id?: string
          job_id?: string | null
          row_data?: Json
          row_hash?: string
          spreadsheet_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_job_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "sync_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_job_items_spreadsheet_id_fkey"
            columns: ["spreadsheet_id"]
            isOneToOne: false
            referencedRelation: "spreadsheet_configs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          created_at: string | null
          error: string | null
          failed_rows: number | null
          finished_at: string | null
          id: string
          imported_rows: number | null
          processed_rows: number | null
          spreadsheet_id: string | null
          started_at: string | null
          status: string
          total_rows: number | null
        }
        Insert: {
          created_at?: string | null
          error?: string | null
          failed_rows?: number | null
          finished_at?: string | null
          id?: string
          imported_rows?: number | null
          processed_rows?: number | null
          spreadsheet_id?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
        }
        Update: {
          created_at?: string | null
          error?: string | null
          failed_rows?: number | null
          finished_at?: string | null
          id?: string
          imported_rows?: number | null
          processed_rows?: number | null
          spreadsheet_id?: string | null
          started_at?: string | null
          status?: string
          total_rows?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_spreadsheet_id_fkey"
            columns: ["spreadsheet_id"]
            isOneToOne: false
            referencedRelation: "spreadsheet_configs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_job_progress: {
        Args: { f_inc: number; i_inc: number; job_id: string; p_inc: number }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
