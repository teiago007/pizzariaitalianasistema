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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      cash_register_movements: {
        Row: {
          amount: number
          created_at: string
          created_by: string
          id: string
          note: string | null
          shift_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Insert: {
          amount: number
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          shift_id: string
          type: Database["public"]["Enums"]["cash_movement_type"]
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          shift_id?: string
          type?: Database["public"]["Enums"]["cash_movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "cash_register_movements_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "cash_register_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_register_shifts: {
        Row: {
          closed_at: string | null
          closed_by: string | null
          closing_balance: number | null
          created_at: string
          id: string
          note: string | null
          opened_at: string
          opened_by: string
          opening_balance: number
          updated_at: string
        }
        Insert: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          note?: string | null
          opened_at?: string
          opened_by: string
          opening_balance?: number
          updated_at?: string
        }
        Update: {
          closed_at?: string | null
          closed_by?: string | null
          closing_balance?: number | null
          created_at?: string
          id?: string
          note?: string | null
          opened_at?: string
          opened_by?: string
          opening_balance?: number
          updated_at?: string
        }
        Relationships: []
      }
      drink_sizes: {
        Row: {
          available: boolean
          created_at: string
          display_order: number
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          display_order?: number
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      order_daily_counters: {
        Row: {
          last_seq: number
          order_date: string
          updated_at: string
        }
        Insert: {
          last_seq?: number
          order_date: string
          updated_at?: string
        }
        Update: {
          last_seq?: number
          order_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          change_for: number | null
          created_at: string
          created_by_user_id: string | null
          customer_address: string
          customer_complement: string | null
          customer_name: string
          customer_neighborhood: string | null
          customer_number: string | null
          customer_phone: string
          customer_reference: string | null
          customer_street: string | null
          id: string
          items: Json
          needs_change: boolean | null
          order_origin: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pix_transaction_id: string | null
          seq_of_day: number | null
          status: Database["public"]["Enums"]["order_status"]
          table_number: string | null
          total: number
          updated_at: string
        }
        Insert: {
          change_for?: number | null
          created_at?: string
          created_by_user_id?: string | null
          customer_address: string
          customer_complement?: string | null
          customer_name: string
          customer_neighborhood?: string | null
          customer_number?: string | null
          customer_phone: string
          customer_reference?: string | null
          customer_street?: string | null
          id?: string
          items: Json
          needs_change?: boolean | null
          order_origin?: string | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          pix_transaction_id?: string | null
          seq_of_day?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: string | null
          total: number
          updated_at?: string
        }
        Update: {
          change_for?: number | null
          created_at?: string
          created_by_user_id?: string | null
          customer_address?: string
          customer_complement?: string | null
          customer_name?: string
          customer_neighborhood?: string | null
          customer_number?: string | null
          customer_phone?: string
          customer_reference?: string | null
          customer_street?: string | null
          id?: string
          items?: Json
          needs_change?: boolean | null
          order_origin?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          pix_transaction_id?: string | null
          seq_of_day?: number | null
          status?: Database["public"]["Enums"]["order_status"]
          table_number?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      pizza_borders: {
        Row: {
          available: boolean
          created_at: string
          id: string
          name: string
          price: number
          price_g: number | null
          price_gg: number | null
          price_m: number | null
          price_p: number | null
        }
        Insert: {
          available?: boolean
          created_at?: string
          id?: string
          name: string
          price?: number
          price_g?: number | null
          price_gg?: number | null
          price_m?: number | null
          price_p?: number | null
        }
        Update: {
          available?: boolean
          created_at?: string
          id?: string
          name?: string
          price?: number
          price_g?: number | null
          price_gg?: number | null
          price_m?: number | null
          price_p?: number | null
        }
        Relationships: []
      }
      pizza_categories: {
        Row: {
          available: boolean
          created_at: string
          description: string | null
          display_order: number
          id: string
          name: string
          price_g: number | null
          price_gg: number | null
          price_m: number | null
          price_p: number | null
          updated_at: string
        }
        Insert: {
          available?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name: string
          price_g?: number | null
          price_gg?: number | null
          price_m?: number | null
          price_p?: number | null
          updated_at?: string
        }
        Update: {
          available?: boolean
          created_at?: string
          description?: string | null
          display_order?: number
          id?: string
          name?: string
          price_g?: number | null
          price_gg?: number | null
          price_m?: number | null
          price_p?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      pizza_flavors: {
        Row: {
          available: boolean
          category_id: string | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          ingredients: string[] | null
          name: string
          price_g: number
          price_gg: number
          price_m: number
          price_p: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string[] | null
          name: string
          price_g?: number
          price_gg?: number
          price_m?: number
          price_p?: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          category_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string[] | null
          name?: string
          price_g?: number
          price_gg?: number
          price_m?: number
          price_p?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pizza_flavors_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "pizza_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      pizzeria_settings: {
        Row: {
          accent_color: string
          address: string
          created_at: string
          id: string
          is_open: boolean
          logo_url: string | null
          name: string
          pix_key: string | null
          pix_name: string | null
          primary_color: string
          secondary_color: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          accent_color?: string
          address?: string
          created_at?: string
          id?: string
          is_open?: boolean
          logo_url?: string | null
          name?: string
          pix_key?: string | null
          pix_name?: string | null
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          whatsapp?: string
        }
        Update: {
          accent_color?: string
          address?: string
          created_at?: string
          id?: string
          is_open?: boolean
          logo_url?: string | null
          name?: string
          pix_key?: string | null
          pix_name?: string | null
          primary_color?: string
          secondary_color?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          available: boolean
          category: string
          created_at: string
          description: string | null
          drink_size_id: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string
        }
        Insert: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string | null
          drink_size_id?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          updated_at?: string
        }
        Update: {
          available?: boolean
          category?: string
          created_at?: string
          description?: string | null
          drink_size_id?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_drink_size_id_fkey"
            columns: ["drink_size_id"]
            isOneToOne: false
            referencedRelation: "drink_sizes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      store_exceptions: {
        Row: {
          close_time: string | null
          created_at: string
          exception_date: string
          id: string
          is_closed: boolean
          note: string | null
          open_time: string | null
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          exception_date: string
          id?: string
          is_closed?: boolean
          note?: string | null
          open_time?: string | null
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          exception_date?: string
          id?: string
          is_closed?: boolean
          note?: string | null
          open_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      store_hours: {
        Row: {
          close_time: string | null
          created_at: string
          day_of_week: number
          id: string
          is_closed: boolean
          open_time: string | null
          updated_at: string
        }
        Insert: {
          close_time?: string | null
          created_at?: string
          day_of_week: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
          updated_at?: string
        }
        Update: {
          close_time?: string | null
          created_at?: string
          day_of_week?: number
          id?: string
          is_closed?: boolean
          open_time?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      next_order_seq: { Args: { p_date: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "user" | "staff" | "entregador"
      cash_movement_type: "SALE" | "SUPPLY" | "WITHDRAW"
      order_status:
        | "PENDING"
        | "CONFIRMED"
        | "PREPARING"
        | "READY"
        | "DELIVERED"
        | "CANCELLED"
      payment_method: "pix" | "cash" | "card"
      pizza_size: "P" | "M" | "G" | "GG"
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
      app_role: ["admin", "user", "staff", "entregador"],
      cash_movement_type: ["SALE", "SUPPLY", "WITHDRAW"],
      order_status: [
        "PENDING",
        "CONFIRMED",
        "PREPARING",
        "READY",
        "DELIVERED",
        "CANCELLED",
      ],
      payment_method: ["pix", "cash", "card"],
      pizza_size: ["P", "M", "G", "GG"],
    },
  },
} as const
