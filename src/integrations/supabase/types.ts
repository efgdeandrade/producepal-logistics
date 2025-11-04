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
      customers: {
        Row: {
          address: string
          city: string | null
          created_at: string
          email: string | null
          id: string
          latitude: number | null
          longitude: number | null
          name: string
          notes: string | null
          phone: string | null
          postal_code: string | null
          updated_at: string
        }
        Insert: {
          address: string
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Update: {
          address?: string
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          postal_code?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          customer_name: string
          id: string
          order_id: string
          po_number: string | null
          product_code: string
          quantity: number
        }
        Insert: {
          created_at?: string
          customer_name: string
          id?: string
          order_id: string
          po_number?: string | null
          product_code: string
          quantity?: number
        }
        Update: {
          created_at?: string
          customer_name?: string
          id?: string
          order_id?: string
          po_number?: string | null
          product_code?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_date: string
          id: string
          notes: string | null
          order_number: string
          placed_by: string
          status: string
          updated_at: string
          user_id: string | null
          week_number: number
        }
        Insert: {
          created_at?: string
          delivery_date: string
          id?: string
          notes?: string | null
          order_number: string
          placed_by: string
          status?: string
          updated_at?: string
          user_id?: string | null
          week_number: number
        }
        Update: {
          created_at?: string
          delivery_date?: string
          id?: string
          notes?: string | null
          order_number?: string
          placed_by?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          week_number?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          code: string
          created_at: string
          id: string
          name: string
          pack_size: number
          price_usd: number | null
          price_xcg: number | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
          weight: number | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          name: string
          pack_size: number
          price_usd?: number | null
          price_xcg?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          name?: string
          pack_size?: number
          price_usd?: number | null
          price_xcg?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      route_stops: {
        Row: {
          arrival_time: string | null
          completion_time: string | null
          created_at: string
          customer_id: string
          delivery_notes: string | null
          id: string
          order_id: string | null
          photo_urls: string[] | null
          route_id: string
          scheduled_time: string | null
          sequence_number: number
          signature_url: string | null
          status: string
          updated_at: string
        }
        Insert: {
          arrival_time?: string | null
          completion_time?: string | null
          created_at?: string
          customer_id: string
          delivery_notes?: string | null
          id?: string
          order_id?: string | null
          photo_urls?: string[] | null
          route_id: string
          scheduled_time?: string | null
          sequence_number: number
          signature_url?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          arrival_time?: string | null
          completion_time?: string | null
          created_at?: string
          customer_id?: string
          delivery_notes?: string | null
          id?: string
          order_id?: string | null
          photo_urls?: string[] | null
          route_id?: string
          scheduled_time?: string | null
          sequence_number?: number
          signature_url?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "route_stops_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "route_stops_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      routes: {
        Row: {
          actual_duration: number | null
          created_at: string
          created_by: string | null
          date: string
          driver_id: string | null
          driver_name: string
          estimated_duration: number | null
          id: string
          notes: string | null
          route_number: string
          status: string
          truck_identifier: string | null
          updated_at: string
        }
        Insert: {
          actual_duration?: number | null
          created_at?: string
          created_by?: string | null
          date: string
          driver_id?: string | null
          driver_name: string
          estimated_duration?: number | null
          id?: string
          notes?: string | null
          route_number: string
          status?: string
          truck_identifier?: string | null
          updated_at?: string
        }
        Update: {
          actual_duration?: number | null
          created_at?: string
          created_by?: string | null
          date?: string
          driver_id?: string | null
          driver_name?: string
          estimated_duration?: number | null
          id?: string
          notes?: string | null
          route_number?: string
          status?: string
          truck_identifier?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
          user_email: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_email: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          user_email?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "management" | "driver" | "production" | "logistics"
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
      app_role: ["admin", "management", "driver", "production", "logistics"],
    },
  },
} as const
