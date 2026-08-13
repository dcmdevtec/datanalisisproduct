export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Views: Record<string, { Row: Record<string, unknown>; Relationships: never[] }>
    Functions: Record<string, { Args: Record<string, unknown>; Returns: unknown }>
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: "admin" | "supervisor" | "surveyor" | "client" | "coordinator"
          status: "active" | "inactive"
          metadata: Json
          coordinator_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role: "admin" | "supervisor" | "surveyor" | "client" | "coordinator"
          status?: "active" | "inactive"
          metadata?: Json
          coordinator_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: "admin" | "supervisor" | "surveyor" | "client" | "coordinator"
          status?: "active" | "inactive"
          metadata?: Json
          coordinator_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      companies: {
        Row: {
          id: string
          name: string
          description: string | null
          status: "active" | "inactive"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          status?: "active" | "inactive"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          status?: "active" | "inactive"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          description: string | null
          company_id: string | null
          status: "active" | "inactive" | "archived"
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          company_id?: string | null
          status?: "active" | "inactive" | "archived"
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          company_id?: string | null
          status?: "active" | "inactive" | "archived"
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      surveyors: {
        Row: {
          id: string
          user_id: string | null
          name: string
          email: string
          phone_number: string | null
          status: "active" | "inactive"
          supervisor_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          name: string
          email: string
          phone_number?: string | null
          status?: "active" | "inactive"
          supervisor_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          name?: string
          email?: string
          phone_number?: string | null
          status?: "active" | "inactive"
          supervisor_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      surveys: {
        Row: {
          id: string
          title: string
          description: string | null
          status: "draft" | "active" | "completed" | "archived"
          deadline: string | null
          start_date: string | null
          settings: Json
          logo: string | null
          project_id: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          status?: "draft" | "active" | "completed" | "archived"
          deadline?: string | null
          start_date?: string | null
          settings?: Json
          logo?: string | null
          project_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          description?: string | null
          status?: "draft" | "active" | "completed" | "archived"
          deadline?: string | null
          start_date?: string | null
          settings?: Json
          logo?: string | null
          project_id?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          id: string
          survey_id: string
          title: string
          description: string | null
          order_num: number
          skip_logic: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          title: string
          description?: string | null
          order_num: number
          skip_logic?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          title?: string
          description?: string | null
          order_num?: number
          skip_logic?: Json | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          survey_id: string
          section_id: string | null
          type: string
          text: string
          file_url: string | null
          options: Json
          required: boolean
          order_num: number
          config: Json | null
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          section_id?: string | null
          type: string
          text: string
          file_url?: string | null
          options?: Json
          required?: boolean
          order_num: number
          config?: Json | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          section_id?: string | null
          type?: string
          text?: string
          file_url?: string | null
          options?: Json
          required?: boolean
          order_num?: number
          config?: Json | null
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          id: string
          name: string
          description: string | null
          geometry: unknown
          status: "active" | "inactive"
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          geometry?: unknown
          status?: "active" | "inactive"
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          geometry?: unknown
          status?: "active" | "inactive"
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      assignments: {
        Row: {
          id: string
          survey_id: string
          surveyor_id: string
          zone_id: string | null
          status: "pending" | "in_progress" | "completed" | "cancelled"
          assigned_by: string | null
          deadline: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          surveyor_id: string
          zone_id?: string | null
          status?: "pending" | "in_progress" | "completed" | "cancelled"
          assigned_by?: string | null
          deadline?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          surveyor_id?: string
          zone_id?: string | null
          status?: "pending" | "in_progress" | "completed" | "cancelled"
          assigned_by?: string | null
          deadline?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      survey_surveyor_zones: {
        Row: {
          id: string
          survey_id: string
          surveyor_id: string
          zone_id: string | null
          status: "active" | "inactive" | "completed"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          surveyor_id: string
          zone_id?: string | null
          status?: "active" | "inactive" | "completed"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          surveyor_id?: string
          zone_id?: string | null
          status?: "active" | "inactive" | "completed"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      responses: {
        Row: {
          id: string
          survey_id: string
          respondent_id: string | null
          assignment_id: string | null
          location: Json | null
          metadata: Json
          status: string | null
          outcome: "efectiva" | "incidencia" | "abandonada" | null
          incidence_type: string | null
          respondent_name: string | null
          respondent_document_type: string | null
          respondent_document_number: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          respondent_id?: string | null
          assignment_id?: string | null
          location?: Json | null
          metadata?: Json
          status?: string | null
          outcome?: "efectiva" | "incidencia" | "abandonada" | null
          incidence_type?: string | null
          respondent_name?: string | null
          respondent_document_type?: string | null
          respondent_document_number?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          respondent_id?: string | null
          assignment_id?: string | null
          location?: Json | null
          metadata?: Json
          status?: string | null
          outcome?: "efectiva" | "incidencia" | "abandonada" | null
          incidence_type?: string | null
          respondent_name?: string | null
          respondent_document_type?: string | null
          respondent_document_number?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      answers: {
        Row: {
          id: string
          response_id: string
          question_id: string
          value: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          response_id: string
          question_id: string
          value: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          response_id?: string
          question_id?: string
          value?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_files: {
        Row: {
          id: string
          answer_id: string
          type: "audio" | "image" | "video"
          local_path: string | null
          remote_url: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          answer_id: string
          type: "audio" | "image" | "video"
          local_path?: string | null
          remote_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          answer_id?: string
          type?: "audio" | "image" | "video"
          local_path?: string | null
          remote_url?: string | null
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      sync_records: {
        Row: {
          id: string
          user_id: string
          type: "upload" | "download"
          status: "success" | "failed"
          items: number
          details: Json
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          type: "upload" | "download"
          status: "success" | "failed"
          items?: number
          details?: Json
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          type?: "upload" | "download"
          status?: "success" | "failed"
          items?: number
          details?: Json
          created_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string | null
          content: string
          message_type: "direct" | "broadcast"
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id?: string | null
          content: string
          message_type?: "direct" | "broadcast"
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string | null
          content?: string
          message_type?: "direct" | "broadcast"
          read?: boolean
          created_at?: string
        }
        Relationships: []
      }
      surveyor_locations: {
        Row: {
          id: string
          surveyor_id: string
          latitude: number
          longitude: number
          accuracy: number | null
          battery_level: number | null
          is_charging: boolean | null
          app_version: string | null
          device_info: Json | null
          active_survey_id: string | null
          is_foreground: boolean | null
          status: string | null
          is_in_zone: boolean | null
          current_zone_id: string | null
          recorded_at: string
          created_at: string
        }
        Insert: {
          id?: string
          surveyor_id: string
          latitude: number
          longitude: number
          accuracy?: number | null
          battery_level?: number | null
          is_charging?: boolean | null
          app_version?: string | null
          device_info?: Json | null
          active_survey_id?: string | null
          is_foreground?: boolean | null
          status?: string | null
          is_in_zone?: boolean | null
          current_zone_id?: string | null
          recorded_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          surveyor_id?: string
          latitude?: number
          longitude?: number
          accuracy?: number | null
          battery_level?: number | null
          is_charging?: boolean | null
          app_version?: string | null
          device_info?: Json | null
          active_survey_id?: string | null
          is_foreground?: boolean | null
          status?: string | null
          is_in_zone?: boolean | null
          current_zone_id?: string | null
          recorded_at?: string
          created_at?: string
        }
        Relationships: []
      }
      public_respondents: {
        Row: {
          id: string
          survey_id: string
          document_type: string
          document_number: string
          full_name: string | null
          email: string | null
          phone: string | null
          address: string | null
          company: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          document_type: string
          document_number: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          company?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          document_type?: string
          document_number?: string
          full_name?: string | null
          email?: string | null
          phone?: string | null
          address?: string | null
          company?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      assigned_surveyors: {
        Row: {
          id: string
          zone_id: string
          surveyor_id: string
          status: "active" | "inactive"
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          zone_id: string
          surveyor_id: string
          status?: "active" | "inactive"
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          zone_id?: string
          surveyor_id?: string
          status?: "active" | "inactive"
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
  }
}
