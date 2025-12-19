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
      bill_approvals: {
        Row: {
          approved_at: string | null
          approver_id: string
          approver_role: string
          bill_id: string
          comments: string | null
          created_at: string
          id: string
          signature_url: string | null
          status: string
        }
        Insert: {
          approved_at?: string | null
          approver_id: string
          approver_role: string
          bill_id: string
          comments?: string | null
          created_at?: string
          id?: string
          signature_url?: string | null
          status?: string
        }
        Update: {
          approved_at?: string | null
          approver_id?: string
          approver_role?: string
          bill_id?: string
          comments?: string | null
          created_at?: string
          id?: string
          signature_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "bill_approvals_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_line_items: {
        Row: {
          account_code: string | null
          amount: number
          bill_id: string
          created_at: string
          description: string
          id: string
          product_id: string | null
        }
        Insert: {
          account_code?: string | null
          amount: number
          bill_id: string
          created_at?: string
          description: string
          id?: string
          product_id?: string | null
        }
        Update: {
          account_code?: string | null
          amount?: number
          bill_id?: string
          created_at?: string
          description?: string
          id?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_line_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bill_line_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      bills: {
        Row: {
          amount: number
          bill_date: string
          bill_number: string
          created_at: string
          currency: string
          due_date: string | null
          google_drive_file_id: string | null
          google_drive_url: string | null
          id: string
          notes: string | null
          ocr_data: Json | null
          pdf_url: string | null
          status: string
          updated_at: string
          vendor_id: string | null
          vendor_name: string
        }
        Insert: {
          amount: number
          bill_date: string
          bill_number: string
          created_at?: string
          currency?: string
          due_date?: string | null
          google_drive_file_id?: string | null
          google_drive_url?: string | null
          id?: string
          notes?: string | null
          ocr_data?: Json | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_name: string
        }
        Update: {
          amount?: number
          bill_date?: string
          bill_number?: string
          created_at?: string
          currency?: string
          due_date?: string | null
          google_drive_file_id?: string | null
          google_drive_url?: string | null
          id?: string
          notes?: string | null
          ocr_data?: Json | null
          pdf_url?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string | null
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "bills_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_allocation_decisions: {
        Row: {
          actual_profit_xcg: number | null
          ai_reasoning: Json | null
          chosen_method: string
          confidence_level: string | null
          created_at: string
          decision_date: string
          id: string
          market_context: Json | null
          order_id: string | null
          predicted_profit_xcg: number | null
          recommended_method: string
          strategic_insights: Json | null
          total_cost_usd: number | null
          total_freight_usd: number | null
          total_products: number
          total_weight_kg: number | null
          updated_at: string
        }
        Insert: {
          actual_profit_xcg?: number | null
          ai_reasoning?: Json | null
          chosen_method: string
          confidence_level?: string | null
          created_at?: string
          decision_date?: string
          id?: string
          market_context?: Json | null
          order_id?: string | null
          predicted_profit_xcg?: number | null
          recommended_method: string
          strategic_insights?: Json | null
          total_cost_usd?: number | null
          total_freight_usd?: number | null
          total_products: number
          total_weight_kg?: number | null
          updated_at?: string
        }
        Update: {
          actual_profit_xcg?: number | null
          ai_reasoning?: Json | null
          chosen_method?: string
          confidence_level?: string | null
          created_at?: string
          decision_date?: string
          id?: string
          market_context?: Json | null
          order_id?: string | null
          predicted_profit_xcg?: number | null
          recommended_method?: string
          strategic_insights?: Json | null
          total_cost_usd?: number | null
          total_freight_usd?: number | null
          total_products?: number
          total_weight_kg?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cif_allocation_decisions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_calculations: {
        Row: {
          bank_charges_usd: number | null
          calculation_name: string
          calculation_type: string
          created_at: string
          created_by: string
          exchange_rate: number
          freight_champion_cost: number | null
          freight_exterior_per_kg: number
          freight_local_per_kg: number
          id: string
          labor_xcg: number | null
          limiting_factor: string | null
          local_logistics_usd: number | null
          notes: string | null
          products: Json
          results: Json
          selected_distribution_method: string | null
          swissport_cost: number | null
          total_chargeable_weight: number | null
          total_pallets: number | null
          updated_at: string
        }
        Insert: {
          bank_charges_usd?: number | null
          calculation_name: string
          calculation_type: string
          created_at?: string
          created_by: string
          exchange_rate: number
          freight_champion_cost?: number | null
          freight_exterior_per_kg: number
          freight_local_per_kg: number
          id?: string
          labor_xcg?: number | null
          limiting_factor?: string | null
          local_logistics_usd?: number | null
          notes?: string | null
          products: Json
          results: Json
          selected_distribution_method?: string | null
          swissport_cost?: number | null
          total_chargeable_weight?: number | null
          total_pallets?: number | null
          updated_at?: string
        }
        Update: {
          bank_charges_usd?: number | null
          calculation_name?: string
          calculation_type?: string
          created_at?: string
          created_by?: string
          exchange_rate?: number
          freight_champion_cost?: number | null
          freight_exterior_per_kg?: number
          freight_local_per_kg?: number
          id?: string
          labor_xcg?: number | null
          limiting_factor?: string | null
          local_logistics_usd?: number | null
          notes?: string | null
          products?: Json
          results?: Json
          selected_distribution_method?: string | null
          swissport_cost?: number | null
          total_chargeable_weight?: number | null
          total_pallets?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cif_estimates: {
        Row: {
          actual_cif_xcg: number | null
          actual_freight_exterior_usd: number | null
          actual_freight_local_usd: number | null
          actual_other_costs_usd: number | null
          actual_total_freight_usd: number | null
          actual_weight_kg: number
          chargeable_weight_kg: number
          created_at: string | null
          estimated_cif_xcg: number | null
          estimated_date: string | null
          estimated_freight_exterior_usd: number | null
          estimated_freight_local_usd: number | null
          estimated_other_costs_usd: number | null
          estimated_total_freight_usd: number | null
          id: string
          order_id: string | null
          pallet_utilization_percentage: number | null
          pallets_used: number | null
          product_code: string
          updated_at: string | null
          variance_amount_usd: number | null
          variance_percentage: number | null
          volumetric_weight_kg: number
          weight_type_used: string | null
        }
        Insert: {
          actual_cif_xcg?: number | null
          actual_freight_exterior_usd?: number | null
          actual_freight_local_usd?: number | null
          actual_other_costs_usd?: number | null
          actual_total_freight_usd?: number | null
          actual_weight_kg: number
          chargeable_weight_kg: number
          created_at?: string | null
          estimated_cif_xcg?: number | null
          estimated_date?: string | null
          estimated_freight_exterior_usd?: number | null
          estimated_freight_local_usd?: number | null
          estimated_other_costs_usd?: number | null
          estimated_total_freight_usd?: number | null
          id?: string
          order_id?: string | null
          pallet_utilization_percentage?: number | null
          pallets_used?: number | null
          product_code: string
          updated_at?: string | null
          variance_amount_usd?: number | null
          variance_percentage?: number | null
          volumetric_weight_kg: number
          weight_type_used?: string | null
        }
        Update: {
          actual_cif_xcg?: number | null
          actual_freight_exterior_usd?: number | null
          actual_freight_local_usd?: number | null
          actual_other_costs_usd?: number | null
          actual_total_freight_usd?: number | null
          actual_weight_kg?: number
          chargeable_weight_kg?: number
          created_at?: string | null
          estimated_cif_xcg?: number | null
          estimated_date?: string | null
          estimated_freight_exterior_usd?: number | null
          estimated_freight_local_usd?: number | null
          estimated_other_costs_usd?: number | null
          estimated_total_freight_usd?: number | null
          id?: string
          order_id?: string | null
          pallet_utilization_percentage?: number | null
          pallets_used?: number | null
          product_code?: string
          updated_at?: string | null
          variance_amount_usd?: number | null
          variance_percentage?: number | null
          volumetric_weight_kg?: number
          weight_type_used?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cif_estimates_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_learning_patterns: {
        Row: {
          adjustment_factor: number | null
          avg_variance_percentage: number | null
          confidence_score: number | null
          created_at: string | null
          id: string
          last_calculated: string | null
          pattern_key: string
          pattern_type: string
          sample_size: number | null
          std_deviation: number | null
        }
        Insert: {
          adjustment_factor?: number | null
          avg_variance_percentage?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_calculated?: string | null
          pattern_key: string
          pattern_type: string
          sample_size?: number | null
          std_deviation?: number | null
        }
        Update: {
          adjustment_factor?: number | null
          avg_variance_percentage?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_calculated?: string | null
          pattern_key?: string
          pattern_type?: string
          sample_size?: number | null
          std_deviation?: number | null
        }
        Relationships: []
      }
      cif_product_performance: {
        Row: {
          actual_margin_xcg: number | null
          allocation_method: string
          cif_per_unit_xcg: number | null
          competitive_gap_percentage: number | null
          created_at: string
          decision_id: string | null
          freight_allocated_usd: number | null
          id: string
          market_position: string | null
          predicted_margin_percentage: number | null
          predicted_margin_xcg: number | null
          product_code: string
          product_name: string
          quantity: number
          waste_quantity: number | null
          wholesale_price_xcg: number | null
        }
        Insert: {
          actual_margin_xcg?: number | null
          allocation_method: string
          cif_per_unit_xcg?: number | null
          competitive_gap_percentage?: number | null
          created_at?: string
          decision_id?: string | null
          freight_allocated_usd?: number | null
          id?: string
          market_position?: string | null
          predicted_margin_percentage?: number | null
          predicted_margin_xcg?: number | null
          product_code: string
          product_name: string
          quantity: number
          waste_quantity?: number | null
          wholesale_price_xcg?: number | null
        }
        Update: {
          actual_margin_xcg?: number | null
          allocation_method?: string
          cif_per_unit_xcg?: number | null
          competitive_gap_percentage?: number | null
          created_at?: string
          decision_id?: string | null
          freight_allocated_usd?: number | null
          id?: string
          market_position?: string | null
          predicted_margin_percentage?: number | null
          predicted_margin_xcg?: number | null
          product_code?: string
          product_name?: string
          quantity?: number
          waste_quantity?: number | null
          wholesale_price_xcg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cif_product_performance_decision_id_fkey"
            columns: ["decision_id"]
            isOneToOne: false
            referencedRelation: "cif_allocation_decisions"
            referencedColumns: ["id"]
          },
        ]
      }
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
          pricing_tier: string
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
          pricing_tier?: string
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
          pricing_tier?: string
          updated_at?: string
        }
        Relationships: []
      }
      day_order_template_items: {
        Row: {
          created_at: string
          customer_id: string
          customer_name: string
          default_quantity: number
          id: string
          product_code: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          customer_name: string
          default_quantity?: number
          id?: string
          product_code: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          customer_name?: string
          default_quantity?: number
          id?: string
          product_code?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_order_template_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_order_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "day_order_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      day_order_templates: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          id: string
          is_active: boolean
          name: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week: number
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
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
      fnb_conversations: {
        Row: {
          created_at: string | null
          customer_id: string | null
          detected_language: string | null
          direction: string
          id: string
          message_id: string | null
          message_text: string
          order_id: string | null
          parsed_intent: string | null
          parsed_items: Json | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          detected_language?: string | null
          direction: string
          id?: string
          message_id?: string | null
          message_text: string
          order_id?: string | null
          parsed_intent?: string | null
          parsed_items?: Json | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          detected_language?: string | null
          direction?: string
          id?: string
          message_id?: string | null
          message_text?: string
          order_id?: string | null
          parsed_intent?: string | null
          parsed_items?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "fnb_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "fnb_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fnb_customer_patterns: {
        Row: {
          avg_quantity: number | null
          customer_id: string | null
          day_of_week_preference: number[] | null
          id: string
          last_ordered_at: string | null
          order_count: number | null
          product_id: string | null
          total_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          avg_quantity?: number | null
          customer_id?: string | null
          day_of_week_preference?: number[] | null
          id?: string
          last_ordered_at?: string | null
          order_count?: number | null
          product_id?: string | null
          total_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          avg_quantity?: number | null
          customer_id?: string | null
          day_of_week_preference?: number[] | null
          id?: string
          last_ordered_at?: string | null
          order_count?: number | null
          product_id?: string | null
          total_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_customer_patterns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "fnb_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_customer_patterns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fnb_products"
            referencedColumns: ["id"]
          },
        ]
      }
      fnb_customers: {
        Row: {
          address: string | null
          created_at: string | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          delivery_zone: string | null
          id: string
          name: string
          notes: string | null
          preferred_language: string | null
          quickbooks_customer_id: string | null
          updated_at: string | null
          whatsapp_phone: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          delivery_zone?: string | null
          id?: string
          name: string
          notes?: string | null
          preferred_language?: string | null
          quickbooks_customer_id?: string | null
          updated_at?: string | null
          whatsapp_phone: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          delivery_zone?: string | null
          id?: string
          name?: string
          notes?: string | null
          preferred_language?: string | null
          quickbooks_customer_id?: string | null
          updated_at?: string | null
          whatsapp_phone?: string
        }
        Relationships: []
      }
      fnb_delivery_zones: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      fnb_order_items: {
        Row: {
          created_at: string | null
          id: string
          order_id: string | null
          picked_at: string | null
          picked_by: string | null
          picked_quantity: number | null
          product_id: string | null
          quantity: number
          short_quantity: number | null
          short_reason: string | null
          shortage_approved_at: string | null
          shortage_approved_by: string | null
          shortage_status: string | null
          total_xcg: number
          unit_price_xcg: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picked_quantity?: number | null
          product_id?: string | null
          quantity: number
          short_quantity?: number | null
          short_reason?: string | null
          shortage_approved_at?: string | null
          shortage_approved_by?: string | null
          shortage_status?: string | null
          total_xcg: number
          unit_price_xcg: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picked_quantity?: number | null
          product_id?: string | null
          quantity?: number
          short_quantity?: number | null
          short_reason?: string | null
          shortage_approved_at?: string | null
          shortage_approved_by?: string | null
          shortage_status?: string | null
          total_xcg?: number
          unit_price_xcg?: number
        }
        Relationships: [
          {
            foreignKeyName: "fnb_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "fnb_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "fnb_products"
            referencedColumns: ["id"]
          },
        ]
      }
      fnb_orders: {
        Row: {
          assigned_at: string | null
          cod_amount_collected: number | null
          cod_amount_due: number | null
          cod_collected_at: string | null
          cod_notes: string | null
          cod_reconciled_at: string | null
          cod_reconciled_by: string | null
          created_at: string | null
          customer_id: string | null
          delivered_at: string | null
          delivery_date: string | null
          driver_id: string | null
          driver_name: string | null
          id: string
          language_used: string | null
          notes: string | null
          order_date: string
          order_number: string
          payment_method: string | null
          payment_method_used:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          quickbooks_invoice_id: string | null
          quickbooks_invoice_number: string | null
          receipt_extracted_data: Json | null
          receipt_photo_processed_url: string | null
          receipt_photo_url: string | null
          receipt_verified_at: string | null
          receipt_verified_by: string | null
          status: string | null
          total_xcg: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          cod_amount_collected?: number | null
          cod_amount_due?: number | null
          cod_collected_at?: string | null
          cod_notes?: string | null
          cod_reconciled_at?: string | null
          cod_reconciled_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_date?: string | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          language_used?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          payment_method?: string | null
          payment_method_used?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          receipt_extracted_data?: Json | null
          receipt_photo_processed_url?: string | null
          receipt_photo_url?: string | null
          receipt_verified_at?: string | null
          receipt_verified_by?: string | null
          status?: string | null
          total_xcg?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          cod_amount_collected?: number | null
          cod_amount_due?: number | null
          cod_collected_at?: string | null
          cod_notes?: string | null
          cod_reconciled_at?: string | null
          cod_reconciled_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          delivery_date?: string | null
          driver_id?: string | null
          driver_name?: string | null
          id?: string
          language_used?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          payment_method?: string | null
          payment_method_used?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          receipt_extracted_data?: Json | null
          receipt_photo_processed_url?: string | null
          receipt_photo_url?: string | null
          receipt_verified_at?: string | null
          receipt_verified_by?: string | null
          status?: string | null
          total_xcg?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "fnb_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      fnb_picker_queue: {
        Row: {
          claimed_at: string | null
          claimed_by: string | null
          completed_at: string | null
          created_at: string | null
          expected_weight_kg: number | null
          id: string
          order_id: string | null
          pick_start_time: string | null
          picker_name: string | null
          priority: number | null
          status: string | null
          verified_weight_kg: number | null
        }
        Insert: {
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          expected_weight_kg?: number | null
          id?: string
          order_id?: string | null
          pick_start_time?: string | null
          picker_name?: string | null
          priority?: number | null
          status?: string | null
          verified_weight_kg?: number | null
        }
        Update: {
          claimed_at?: string | null
          claimed_by?: string | null
          completed_at?: string | null
          created_at?: string | null
          expected_weight_kg?: number | null
          id?: string
          order_id?: string | null
          pick_start_time?: string | null
          picker_name?: string | null
          priority?: number | null
          status?: string | null
          verified_weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_picker_queue_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "fnb_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fnb_products: {
        Row: {
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          min_order_qty: number | null
          name: string
          name_es: string | null
          name_nl: string | null
          name_pap: string | null
          price_xcg: number
          quickbooks_item_id: string | null
          unit: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_order_qty?: number | null
          name: string
          name_es?: string | null
          name_nl?: string | null
          name_pap?: string | null
          price_xcg: number
          quickbooks_item_id?: string | null
          unit: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          min_order_qty?: number | null
          name?: string
          name_es?: string | null
          name_nl?: string | null
          name_pap?: string | null
          price_xcg?: number
          quickbooks_item_id?: string | null
          unit?: string
          updated_at?: string | null
        }
        Relationships: []
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
          customer_notes: string | null
          id: string
          order_id: string
          po_number: string | null
          product_code: string
          quantity: number
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_notes?: string | null
          id?: string
          order_id: string
          po_number?: string | null
          product_code: string
          quantity?: number
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_notes?: string | null
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
      pallet_configuration_history: {
        Row: {
          actual_pallets: number | null
          actual_utilization_pct: number | null
          ai_recommendations: Json | null
          configuration_data: Json | null
          created_at: string | null
          estimated_pallets: number
          estimated_utilization_pct: number
          id: string
          limiting_factor: string | null
          order_id: string | null
          recommendation_accuracy: number | null
          supplier_id: string | null
        }
        Insert: {
          actual_pallets?: number | null
          actual_utilization_pct?: number | null
          ai_recommendations?: Json | null
          configuration_data?: Json | null
          created_at?: string | null
          estimated_pallets: number
          estimated_utilization_pct: number
          id?: string
          limiting_factor?: string | null
          order_id?: string | null
          recommendation_accuracy?: number | null
          supplier_id?: string | null
        }
        Update: {
          actual_pallets?: number | null
          actual_utilization_pct?: number | null
          ai_recommendations?: Json | null
          configuration_data?: Json | null
          created_at?: string | null
          estimated_pallets?: number
          estimated_utilization_pct?: number
          id?: string
          limiting_factor?: string | null
          order_id?: string | null
          recommendation_accuracy?: number | null
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pallet_configuration_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pallet_configuration_history_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      pallet_configurations: {
        Row: {
          configuration_date: string | null
          created_at: string | null
          id: string
          limiting_factor: string | null
          max_height_cm: number | null
          order_id: string | null
          pallet_length_cm: number | null
          pallet_weight_kg: number | null
          pallet_width_cm: number | null
          recommendations: Json | null
          total_actual_weight_kg: number | null
          total_chargeable_weight_kg: number | null
          total_pallets: number
          total_volumetric_weight_kg: number | null
          utilization_percentage: number | null
        }
        Insert: {
          configuration_date?: string | null
          created_at?: string | null
          id?: string
          limiting_factor?: string | null
          max_height_cm?: number | null
          order_id?: string | null
          pallet_length_cm?: number | null
          pallet_weight_kg?: number | null
          pallet_width_cm?: number | null
          recommendations?: Json | null
          total_actual_weight_kg?: number | null
          total_chargeable_weight_kg?: number | null
          total_pallets: number
          total_volumetric_weight_kg?: number | null
          utilization_percentage?: number | null
        }
        Update: {
          configuration_date?: string | null
          created_at?: string | null
          id?: string
          limiting_factor?: string | null
          max_height_cm?: number | null
          order_id?: string | null
          pallet_length_cm?: number | null
          pallet_weight_kg?: number | null
          pallet_width_cm?: number | null
          recommendations?: Json | null
          total_actual_weight_kg?: number | null
          total_chargeable_weight_kg?: number | null
          total_pallets?: number
          total_volumetric_weight_kg?: number | null
          utilization_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pallet_configurations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          consolidation_group: string | null
          created_at: string
          empty_case_weight: number | null
          gross_weight_per_unit: number | null
          height_cm: number | null
          id: string
          length_cm: number | null
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
          volumetric_weight_kg: number | null
          weight: number | null
          wholesale_price_usd_per_unit: number | null
          wholesale_price_xcg_per_unit: number | null
          width_cm: number | null
        }
        Insert: {
          case_size?: string | null
          code: string
          consolidation_group?: string | null
          created_at?: string
          empty_case_weight?: number | null
          gross_weight_per_unit?: number | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
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
          volumetric_weight_kg?: number | null
          weight?: number | null
          wholesale_price_usd_per_unit?: number | null
          wholesale_price_xcg_per_unit?: number | null
          width_cm?: number | null
        }
        Update: {
          case_size?: string | null
          code?: string
          consolidation_group?: string | null
          created_at?: string
          empty_case_weight?: number | null
          gross_weight_per_unit?: number | null
          height_cm?: number | null
          id?: string
          length_cm?: number | null
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
          volumetric_weight_kg?: number | null
          weight?: number | null
          wholesale_price_usd_per_unit?: number | null
          wholesale_price_xcg_per_unit?: number | null
          width_cm?: number | null
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
          must_change_password: boolean | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          must_change_password?: boolean | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          must_change_password?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      quickbooks_sync_log: {
        Row: {
          bill_id: string
          created_at: string
          error_message: string | null
          id: string
          payment_date: string | null
          payment_status: string | null
          quickbooks_bill_id: string | null
          sync_date: string | null
          sync_status: string
        }
        Insert: {
          bill_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          payment_date?: string | null
          payment_status?: string | null
          quickbooks_bill_id?: string | null
          sync_date?: string | null
          sync_status?: string
        }
        Update: {
          bill_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          payment_date?: string | null
          payment_status?: string | null
          quickbooks_bill_id?: string | null
          sync_date?: string | null
          sync_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "quickbooks_sync_log_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "bills"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_numbers: {
        Row: {
          amount: number
          created_at: string
          customer_id: string | null
          customer_name: string
          delivery_date: string
          generated_at: string
          generated_by: string | null
          id: string
          order_id: string
          order_number: string
          receipt_number: string
        }
        Insert: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          customer_name: string
          delivery_date: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          order_id: string
          order_number: string
          receipt_number: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string | null
          customer_name?: string
          delivery_date?: string
          generated_at?: string
          generated_by?: string | null
          id?: string
          order_id?: string
          order_number?: string
          receipt_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_numbers_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_numbers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
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
          cases_per_pallet: number | null
          contact: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes_pallet_config: string | null
          pallet_height_cm: number | null
          pallet_length_cm: number | null
          pallet_max_height_cm: number | null
          pallet_stacking_pattern: string | null
          pallet_weight_kg: number | null
          pallet_width_cm: number | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          cases_per_pallet?: number | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes_pallet_config?: string | null
          pallet_height_cm?: number | null
          pallet_length_cm?: number | null
          pallet_max_height_cm?: number | null
          pallet_stacking_pattern?: string | null
          pallet_weight_kg?: number | null
          pallet_width_cm?: number | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          cases_per_pallet?: number | null
          contact?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes_pallet_config?: string | null
          pallet_height_cm?: number | null
          pallet_length_cm?: number | null
          pallet_max_height_cm?: number | null
          pallet_stacking_pattern?: string | null
          pallet_weight_kg?: number | null
          pallet_width_cm?: number | null
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
      weight_estimation_accuracy: {
        Row: {
          actual_actual_weight_kg: number | null
          actual_chargeable_weight_kg: number | null
          actual_volumetric_weight_kg: number | null
          created_at: string | null
          estimated_actual_weight_kg: number
          estimated_chargeable_weight_kg: number
          estimated_volumetric_weight_kg: number
          id: string
          order_id: string | null
          product_code: string
          variance_percentage: number | null
          variance_reason: string | null
        }
        Insert: {
          actual_actual_weight_kg?: number | null
          actual_chargeable_weight_kg?: number | null
          actual_volumetric_weight_kg?: number | null
          created_at?: string | null
          estimated_actual_weight_kg: number
          estimated_chargeable_weight_kg: number
          estimated_volumetric_weight_kg: number
          id?: string
          order_id?: string | null
          product_code: string
          variance_percentage?: number | null
          variance_reason?: string | null
        }
        Update: {
          actual_actual_weight_kg?: number | null
          actual_chargeable_weight_kg?: number | null
          actual_volumetric_weight_kg?: number | null
          created_at?: string | null
          estimated_actual_weight_kg?: number
          estimated_chargeable_weight_kg?: number
          estimated_volumetric_weight_kg?: number
          id?: string
          order_id?: string | null
          product_code?: string
          variance_percentage?: number | null
          variance_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "weight_estimation_accuracy_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_learning_patterns: {
        Row: {
          adjustment_factor: number | null
          avg_variance_percentage: number | null
          confidence_score: number | null
          created_at: string | null
          id: string
          last_calculated: string | null
          metadata: Json | null
          pattern_key: string
          pattern_type: string
          sample_size: number | null
          std_deviation: number | null
        }
        Insert: {
          adjustment_factor?: number | null
          avg_variance_percentage?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_calculated?: string | null
          metadata?: Json | null
          pattern_key: string
          pattern_type: string
          sample_size?: number | null
          std_deviation?: number | null
        }
        Update: {
          adjustment_factor?: number | null
          avg_variance_percentage?: number | null
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          last_calculated?: string | null
          metadata?: Json | null
          pattern_key?: string
          pattern_type?: string
          sample_size?: number | null
          std_deviation?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      generate_receipt_number: { Args: never; Returns: string }
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
      customer_type: "regular" | "supermarket" | "cod" | "credit"
      payment_method_type: "cash" | "swipe" | "transfer" | "credit"
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
      customer_type: ["regular", "supermarket", "cod", "credit"],
      payment_method_type: ["cash", "swipe", "transfer", "credit"],
    },
  },
} as const
