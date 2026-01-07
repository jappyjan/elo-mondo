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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      group_invite_codes: {
        Row: {
          created_at: string
          group_id: string
          id: string
          invite_code: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          invite_code?: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          invite_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_invite_codes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: true
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          group_id: string
          id: string
          invited_by: string | null
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          group_id: string
          id?: string
          invited_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          player_id: string
          role: Database["public"]["Enums"]["group_role"]
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          player_id: string
          role?: Database["public"]["Enums"]["group_role"]
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          player_id?: string
          role?: Database["public"]["Enums"]["group_role"]
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      live_games: {
        Row: {
          id: string
          group_id: string
          created_by: string
          game_type: Database["public"]["Enums"]["game_type"]
          start_rule: Database["public"]["Enums"]["start_rule"]
          end_rule: Database["public"]["Enums"]["end_rule"]
          status: Database["public"]["Enums"]["game_status"]
          started_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          group_id: string
          created_by: string
          game_type: Database["public"]["Enums"]["game_type"]
          start_rule: Database["public"]["Enums"]["start_rule"]
          end_rule: Database["public"]["Enums"]["end_rule"]
          status?: Database["public"]["Enums"]["game_status"]
          started_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          group_id?: string
          created_by?: string
          game_type?: Database["public"]["Enums"]["game_type"]
          start_rule?: Database["public"]["Enums"]["start_rule"]
          end_rule?: Database["public"]["Enums"]["end_rule"]
          status?: Database["public"]["Enums"]["game_status"]
          started_at?: string
          finished_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_games_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      live_game_players: {
        Row: {
          id: string
          game_id: string
          player_id: string | null
          player_name: string
          is_temporary: boolean
          play_order: number
          starting_score: number
          finished_rank: number | null
        }
        Insert: {
          id?: string
          game_id: string
          player_id?: string | null
          player_name: string
          is_temporary?: boolean
          play_order: number
          starting_score: number
          finished_rank?: number | null
        }
        Update: {
          id?: string
          game_id?: string
          player_id?: string | null
          player_name?: string
          is_temporary?: boolean
          play_order?: number
          starting_score?: number
          finished_rank?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "live_game_players_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "live_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_game_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      game_throws: {
        Row: {
          id: string
          game_id: string
          game_player_id: string
          turn_number: number
          throw_index: number
          segment: number
          multiplier: number
          score: number
          label: string
          created_at: string
        }
        Insert: {
          id?: string
          game_id: string
          game_player_id: string
          turn_number: number
          throw_index: number
          segment: number
          multiplier: number
          score: number
          label: string
          created_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          game_player_id?: string
          turn_number?: number
          throw_index?: number
          segment?: number
          multiplier?: number
          score?: number
          label?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_throws_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "live_games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_throws_game_player_id_fkey"
            columns: ["game_player_id"]
            isOneToOne: false
            referencedRelation: "live_game_players"
            referencedColumns: ["id"]
          },
        ]
      }
      match_participants: {
        Row: {
          created_at: string
          id: string
          is_winner: boolean
          match_id: string
          player_id: string
          rank: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_winner?: boolean
          match_id: string
          player_id: string
          rank: number
        }
        Update: {
          created_at?: string
          id?: string
          is_winner?: boolean
          match_id?: string
          player_id?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_match_participants_match_id"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_match_participants_player_id"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          loser_id: string
          match_type: string
          total_players: number
          winner_id: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          loser_id: string
          match_type?: string
          total_players?: number
          winner_id: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          loser_id?: string
          match_type?: string
          total_players?: number
          winner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_loser_id_fkey"
            columns: ["loser_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_group_invite: { Args: { _invite_id: string }; Returns: string }
      get_player_id_for_user: { Args: { _user_id: string }; Returns: string }
      is_group_admin: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      join_group_by_code: { Args: { _invite_code: string }; Returns: string }
    }
    Enums: {
      game_status: "in_progress" | "completed" | "abandoned"
      game_type: "301" | "501"
      group_role: "admin" | "member"
      start_rule: "straight-in" | "double-in"
      end_rule: "straight-out" | "double-out"
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
      game_status: ["in_progress", "completed", "abandoned"],
      game_type: ["301", "501"],
      group_role: ["admin", "member"],
      start_rule: ["straight-in", "double-in"],
      end_rule: ["straight-out", "double-out"],
    },
  },
} as const
