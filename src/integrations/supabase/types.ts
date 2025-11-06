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
      deliveries: {
        Row: {
          adjusted_amount: number | null
          created_at: string
          delivery_date: string
          driver_id: string | null
          id: string
          notes: string | null
          production_order_id: string | null
          route_id: string | null
          status: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          adjusted_amount?: number | null
          created_at?: string
          delivery_date: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          production_order_id?: string | null
          route_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          adjusted_amount?: number | null
          created_at?: string
          delivery_date?: string
          driver_id?: string | null
          id?: string
          notes?: string | null
          production_order_id?: string | null
          route_id?: string | null
          status?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_route_id_fkey"
            columns: ["route_id"]
            isOneToOne: false
            referencedRelation: "routes"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_items: {
        Row: {
          adjusted_total: number | null
          created_at: string
          customer_id: string
          delivered_quantity: number | null
          delivery_id: string
          id: string
          line_total: number | null
          planned_quantity: number
          product_code: string
          unit_price: number | null
          updated_at: string
          waste_quantity: number | null
        }
        Insert: {
          adjusted_total?: number | null
          created_at?: string
          customer_id: string
          delivered_quantity?: number | null
          delivery_id: string
          id?: string
          line_total?: number | null
          planned_quantity?: number
          product_code: string
          unit_price?: number | null
          updated_at?: string
          waste_quantity?: number | null
        }
        Update: {
          adjusted_total?: number | null
          created_at?: string
          customer_id?: string
          delivered_quantity?: number | null
          delivery_id?: string
          id?: string
          line_total?: number | null
          planned_quantity?: number
          product_code?: string
          unit_price?: number | null
          updated_at?: string
          waste_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_patterns: {
        Row: {
          avg_order_quantity: number | null
          avg_waste_rate: number | null
          calculated_at: string | null
          customer_id: string | null
          id: string
          last_order_date: string | null
          order_frequency: number | null
          price_sensitivity: string | null
          product_code: string
          total_ordered: number | null
        }
        Insert: {
          avg_order_quantity?: number | null
          avg_waste_rate?: number | null
          calculated_at?: string | null
          customer_id?: string | null
          id?: string
          last_order_date?: string | null
          order_frequency?: number | null
          price_sensitivity?: string | null
          product_code: string
          total_ordered?: number | null
        }
        Update: {
          avg_order_quantity?: number | null
          avg_waste_rate?: number | null
          calculated_at?: string | null
          customer_id?: string | null
          id?: string
          last_order_date?: string | null
          order_frequency?: number | null
          price_sensitivity?: string | null
          product_code?: string
          total_ordered?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_patterns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          adjusted_total: number
          created_at: string
          customer_id: string
          delivery_id: string
          id: string
          invoice_date: string
          invoice_number: string
          printed_at: string | null
          status: string
          subtotal: number
          tax: number | null
          total: number
          updated_at: string
          waste_adjustment: number | null
        }
        Insert: {
          adjusted_total: number
          created_at?: string
          customer_id: string
          delivery_id: string
          id?: string
          invoice_date: string
          invoice_number: string
          printed_at?: string | null
          status?: string
          subtotal: number
          tax?: number | null
          total: number
          updated_at?: string
          waste_adjustment?: number | null
        }
        Update: {
          adjusted_total?: number
          created_at?: string
          customer_id?: string
          delivery_id?: string
          id?: string
          invoice_date?: string
          invoice_number?: string
          printed_at?: string | null
          status?: string
          subtotal?: number
          tax?: number | null
          total?: number
          updated_at?: string
          waste_adjustment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      market_price_snapshots: {
        Row: {
          calculated_wholesale: number | null
          confidence_score: number | null
          created_at: string
          id: string
          import_source_country: string | null
          market_avg: number | null
          market_high: number | null
          market_low: number | null
          metadata: Json | null
          product_code: string
          product_name: string | null
          region: string | null
          retail_price_found: number | null
          scraped_at: string | null
          seasonal_factor: string | null
          snapshot_date: string
          source: string | null
          source_url: string | null
          supply_demand_index: number | null
          wholesale_conversion_factor: number | null
        }
        Insert: {
          calculated_wholesale?: number | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          import_source_country?: string | null
          market_avg?: number | null
          market_high?: number | null
          market_low?: number | null
          metadata?: Json | null
          product_code: string
          product_name?: string | null
          region?: string | null
          retail_price_found?: number | null
          scraped_at?: string | null
          seasonal_factor?: string | null
          snapshot_date?: string
          source?: string | null
          source_url?: string | null
          supply_demand_index?: number | null
          wholesale_conversion_factor?: number | null
        }
        Update: {
          calculated_wholesale?: number | null
          confidence_score?: number | null
          created_at?: string
          id?: string
          import_source_country?: string | null
          market_avg?: number | null
          market_high?: number | null
          market_low?: number | null
          metadata?: Json | null
          product_code?: string
          product_name?: string | null
          region?: string | null
          retail_price_found?: number | null
          scraped_at?: string | null
          seasonal_factor?: string | null
          snapshot_date?: string
          source?: string | null
          source_url?: string | null
          supply_demand_index?: number | null
          wholesale_conversion_factor?: number | null
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
      predictions: {
        Row: {
          accuracy_score: number | null
          actual_quantity: number | null
          actual_waste: number | null
          based_on_days: number | null
          confidence_score: number | null
          created_at: string
          customer_id: string
          id: string
          predicted_quantity: number
          prediction_date: string
          product_code: string
        }
        Insert: {
          accuracy_score?: number | null
          actual_quantity?: number | null
          actual_waste?: number | null
          based_on_days?: number | null
          confidence_score?: number | null
          created_at?: string
          customer_id: string
          id?: string
          predicted_quantity: number
          prediction_date: string
          product_code: string
        }
        Update: {
          accuracy_score?: number | null
          actual_quantity?: number | null
          actual_waste?: number | null
          based_on_days?: number | null
          confidence_score?: number | null
          created_at?: string
          customer_id?: string
          id?: string
          predicted_quantity?: number
          prediction_date?: string
          product_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "predictions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_recommendations: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          confidence_score: string | null
          created_at: string | null
          current_retail_price: number | null
          current_wholesale_price: number
          data_sources: Json | null
          expected_margin_change: number | null
          expected_profit_impact: number | null
          id: string
          product_code: string
          product_name: string
          reasoning: string
          recommended_retail_price: number | null
          recommended_wholesale_price: number
          status: string | null
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          confidence_score?: string | null
          created_at?: string | null
          current_retail_price?: number | null
          current_wholesale_price: number
          data_sources?: Json | null
          expected_margin_change?: number | null
          expected_profit_impact?: number | null
          id?: string
          product_code: string
          product_name: string
          reasoning: string
          recommended_retail_price?: number | null
          recommended_wholesale_price: number
          status?: string | null
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          confidence_score?: string | null
          created_at?: string | null
          current_retail_price?: number | null
          current_wholesale_price?: number
          data_sources?: Json | null
          expected_margin_change?: number | null
          expected_profit_impact?: number | null
          id?: string
          product_code?: string
          product_name?: string
          reasoning?: string
          recommended_retail_price?: number | null
          recommended_wholesale_price?: number
          status?: string | null
        }
        Relationships: []
      }
      product_price_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          changed_by_email: string | null
          created_at: string
          id: string
          new_price_usd_per_unit: number | null
          new_price_xcg_per_unit: number | null
          old_price_usd_per_unit: number | null
          old_price_xcg_per_unit: number | null
          product_code: string
          product_id: string
          product_name: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_price_usd_per_unit?: number | null
          new_price_xcg_per_unit?: number | null
          old_price_usd_per_unit?: number | null
          old_price_xcg_per_unit?: number | null
          product_code: string
          product_id: string
          product_name: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          changed_by_email?: string | null
          created_at?: string
          id?: string
          new_price_usd_per_unit?: number | null
          new_price_xcg_per_unit?: number | null
          old_price_usd_per_unit?: number | null
          old_price_xcg_per_unit?: number | null
          product_code?: string
          product_id?: string
          product_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_price_history_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      production_items: {
        Row: {
          actual_quantity: number | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          predicted_quantity: number
          product_code: string
          production_order_id: string
          updated_at: string
        }
        Insert: {
          actual_quantity?: number | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          predicted_quantity?: number
          product_code: string
          production_order_id: string
          updated_at?: string
        }
        Update: {
          actual_quantity?: number | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          predicted_quantity?: number
          product_code?: string
          production_order_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "production_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_items_production_order_id_fkey"
            columns: ["production_order_id"]
            isOneToOne: false
            referencedRelation: "production_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_orders: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_date: string
          id: string
          notes: string | null
          order_date: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_date: string
          id?: string
          notes?: string | null
          order_date: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_date?: string
          id?: string
          notes?: string | null
          order_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          case_size: string | null
          code: string
          created_at: string
          empty_case_weight: number | null
          gross_weight_per_unit: number | null
          id: string
          name: string
          netto_weight_per_unit: number | null
          pack_size: number
          price_usd: number | null
          price_usd_per_unit: number | null
          price_xcg: number | null
          price_xcg_per_unit: number | null
          retail_price_usd_per_unit: number | null
          retail_price_xcg_per_unit: number | null
          supplier_id: string | null
          unit: string | null
          updated_at: string
          weight: number | null
          wholesale_price_usd_per_unit: number | null
          wholesale_price_xcg_per_unit: number | null
        }
        Insert: {
          case_size?: string | null
          code: string
          created_at?: string
          empty_case_weight?: number | null
          gross_weight_per_unit?: number | null
          id?: string
          name: string
          netto_weight_per_unit?: number | null
          pack_size: number
          price_usd?: number | null
          price_usd_per_unit?: number | null
          price_xcg?: number | null
          price_xcg_per_unit?: number | null
          retail_price_usd_per_unit?: number | null
          retail_price_xcg_per_unit?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
          wholesale_price_usd_per_unit?: number | null
          wholesale_price_xcg_per_unit?: number | null
        }
        Update: {
          case_size?: string | null
          code?: string
          created_at?: string
          empty_case_weight?: number | null
          gross_weight_per_unit?: number | null
          id?: string
          name?: string
          netto_weight_per_unit?: number | null
          pack_size?: number
          price_usd?: number | null
          price_usd_per_unit?: number | null
          price_xcg?: number | null
          price_xcg_per_unit?: number | null
          retail_price_usd_per_unit?: number | null
          retail_price_xcg_per_unit?: number | null
          supplier_id?: string | null
          unit?: string | null
          updated_at?: string
          weight?: number | null
          wholesale_price_usd_per_unit?: number | null
          wholesale_price_xcg_per_unit?: number | null
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
      role_permissions: {
        Row: {
          can_create: boolean
          can_delete: boolean
          can_update: boolean
          can_view: boolean
          created_at: string
          id: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          can_create?: boolean
          can_delete?: boolean
          can_update?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          resource: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          can_create?: boolean
          can_delete?: boolean
          can_update?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["app_role"]
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
      settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      supplier_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number | null
          product_code: string
          quantity: number
          supplier_order_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number | null
          product_code: string
          quantity?: number
          supplier_order_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number | null
          product_code?: string
          quantity?: number
          supplier_order_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_order_items_supplier_order_id_fkey"
            columns: ["supplier_order_id"]
            isOneToOne: false
            referencedRelation: "supplier_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_orders: {
        Row: {
          actual_delivery_date: string | null
          created_at: string
          created_by: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          order_date: string
          order_number: string
          status: string
          supplier_id: string
          total_amount: number | null
          updated_at: string
        }
        Insert: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number: string
          status?: string
          supplier_id: string
          total_amount?: number | null
          updated_at?: string
        }
        Update: {
          actual_delivery_date?: string | null
          created_at?: string
          created_by?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          status?: string
          supplier_id?: string
          total_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
      waste_records: {
        Row: {
          created_at: string
          customer_id: string
          delivery_id: string
          id: string
          product_code: string
          recorded_at: string
          recorded_by: string | null
          waste_quantity: number
          waste_reason: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          delivery_id: string
          id?: string
          product_code: string
          recorded_at?: string
          recorded_by?: string | null
          waste_quantity: number
          waste_reason?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          delivery_id?: string
          id?: string
          product_code?: string
          recorded_at?: string
          recorded_by?: string | null
          waste_quantity?: number
          waste_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "waste_records_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "waste_records_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
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
      app_role:
        | "admin"
        | "management"
        | "driver"
        | "production"
        | "logistics"
        | "accounting"
        | "manager"
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
      app_role: [
        "admin",
        "management",
        "driver",
        "production",
        "logistics",
        "accounting",
        "manager",
      ],
    },
  },
} as const
