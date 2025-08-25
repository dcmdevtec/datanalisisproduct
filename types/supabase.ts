export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          name: string
          role: "admin" | "supervisor" | "surveyor" | "client"
          status: "active" | "inactive"
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name: string
          role: "admin" | "supervisor" | "surveyor" | "client"
          status?: "active" | "inactive"
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string
          role?: "admin" | "supervisor" | "surveyor" | "client"
          status?: "active" | "inactive"
          metadata?: Json
          created_at?: string
          updated_at?: string
        }
      }
      surveys: {
        Row: {
          id: string
          title: string
          description: string | null
          status: "draft" | "active" | "completed" | "archived"
          deadline: string | null
          settings: Json
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
          settings?: Json
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
          settings?: Json
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      questions: {
        Row: {
          id: string
          survey_id: string
          type: "text" | "multiple_choice" | "checkbox" | "scale" | "date" | "time"
          text: string
          options: Json
          required: boolean
          order_num: number
          settings: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          survey_id: string
          type: "text" | "multiple_choice" | "checkbox" | "scale" | "date" | "time"
          text: string
          options?: Json
          required?: boolean
          order_num: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          survey_id?: string
          type?: "text" | "multiple_choice" | "checkbox" | "scale" | "date" | "time"
          text?: string
          options?: Json
          required?: boolean
          order_num?: number
          settings?: Json
          created_at?: string
          updated_at?: string
        }
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
      }
      responses: {
        Row: {
          id: string
          survey_id: string
          respondent_id: string | null
          assignment_id: string | null
          location: Json | null
          metadata: Json
          completed_at: string
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
          completed_at: string
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
          completed_at?: string
          created_at?: string
          updated_at?: string
        }
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
      }
      messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string | null
          is_broadcast: boolean
          content: string
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id?: string | null
          is_broadcast?: boolean
          content: string
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string | null
          is_broadcast?: boolean
          content?: string
          read?: boolean
          created_at?: string
        }
      }
    }
  }
}
