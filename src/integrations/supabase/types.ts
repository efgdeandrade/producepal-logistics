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
      alert_executions: {
        Row: {
          alert_rule_id: string
          created_at: string
          error_message: string | null
          id: string
          notifications_sent: number | null
          status: string
          trigger_data: Json | null
          triggered_by: string
        }
        Insert: {
          alert_rule_id: string
          created_at?: string
          error_message?: string | null
          id?: string
          notifications_sent?: number | null
          status?: string
          trigger_data?: Json | null
          triggered_by: string
        }
        Update: {
          alert_rule_id?: string
          created_at?: string
          error_message?: string | null
          id?: string
          notifications_sent?: number | null
          status?: string
          trigger_data?: Json | null
          triggered_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_executions_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          notification_channels: string[]
          recipients: Json
          trigger_config: Json
          trigger_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          notification_channels?: string[]
          recipients?: Json
          trigger_config?: Json
          trigger_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          notification_channels?: string[]
          recipients?: Json
          trigger_config?: Json
          trigger_type?: string
          updated_at?: string
        }
        Relationships: []
      }
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
          paid_amount: number | null
          paid_date: string | null
          payment_status: string | null
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
          paid_amount?: number | null
          paid_date?: string | null
          payment_status?: string | null
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
          paid_amount?: number | null
          paid_date?: string | null
          payment_status?: string | null
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
      cif_allocations: {
        Row: {
          actual_weight_kg: number
          allocated_costs_json: Json | null
          allocated_shared_costs_usd: number
          allocated_shared_costs_xcg: number
          chargeable_weight_kg: number
          cif_version_id: string
          created_at: string
          id: string
          landed_cost_per_case_usd: number | null
          landed_cost_per_case_xcg: number | null
          landed_cost_per_kg_usd: number | null
          landed_cost_per_kg_xcg: number | null
          landed_cost_per_piece_usd: number | null
          landed_cost_per_piece_xcg: number | null
          landed_total_usd: number
          landed_total_xcg: number
          product_code: string
          product_id: string | null
          qty_cases: number
          qty_pieces: number
          spoilage_usd: number
          supplier_cost_usd: number
          supplier_cost_usd_per_case: number
          supplier_cost_xcg: number
          volumetric_weight_kg: number
        }
        Insert: {
          actual_weight_kg?: number
          allocated_costs_json?: Json | null
          allocated_shared_costs_usd?: number
          allocated_shared_costs_xcg?: number
          chargeable_weight_kg?: number
          cif_version_id: string
          created_at?: string
          id?: string
          landed_cost_per_case_usd?: number | null
          landed_cost_per_case_xcg?: number | null
          landed_cost_per_kg_usd?: number | null
          landed_cost_per_kg_xcg?: number | null
          landed_cost_per_piece_usd?: number | null
          landed_cost_per_piece_xcg?: number | null
          landed_total_usd?: number
          landed_total_xcg?: number
          product_code: string
          product_id?: string | null
          qty_cases?: number
          qty_pieces?: number
          spoilage_usd?: number
          supplier_cost_usd?: number
          supplier_cost_usd_per_case?: number
          supplier_cost_xcg?: number
          volumetric_weight_kg?: number
        }
        Update: {
          actual_weight_kg?: number
          allocated_costs_json?: Json | null
          allocated_shared_costs_usd?: number
          allocated_shared_costs_xcg?: number
          chargeable_weight_kg?: number
          cif_version_id?: string
          created_at?: string
          id?: string
          landed_cost_per_case_usd?: number | null
          landed_cost_per_case_xcg?: number | null
          landed_cost_per_kg_usd?: number | null
          landed_cost_per_kg_xcg?: number | null
          landed_cost_per_piece_usd?: number | null
          landed_cost_per_piece_xcg?: number | null
          landed_total_usd?: number
          landed_total_xcg?: number
          product_code?: string
          product_id?: string | null
          qty_cases?: number
          qty_pieces?: number
          spoilage_usd?: number
          supplier_cost_usd?: number
          supplier_cost_usd_per_case?: number
          supplier_cost_xcg?: number
          volumetric_weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "cif_allocations_cif_version_id_fkey"
            columns: ["cif_version_id"]
            isOneToOne: false
            referencedRelation: "cif_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cif_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_asycuda_records: {
        Row: {
          clearance_date: string | null
          created_at: string
          declaration_date: string | null
          declaration_no: string | null
          duties_amount: number | null
          id: string
          import_order_id: string
          notes: string | null
          taxes_amount: number | null
          updated_at: string
        }
        Insert: {
          clearance_date?: string | null
          created_at?: string
          declaration_date?: string | null
          declaration_no?: string | null
          duties_amount?: number | null
          id?: string
          import_order_id: string
          notes?: string | null
          taxes_amount?: number | null
          updated_at?: string
        }
        Update: {
          clearance_date?: string | null
          created_at?: string
          declaration_date?: string | null
          declaration_no?: string | null
          duties_amount?: number | null
          id?: string
          import_order_id?: string
          notes?: string | null
          taxes_amount?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cif_asycuda_records_import_order_id_fkey"
            columns: ["import_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_change_log: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string
          table_name: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id: string
          table_name: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string
          table_name?: string
        }
        Relationships: []
      }
      cif_components: {
        Row: {
          allocation_basis: string
          amount: number
          amount_usd: number
          approved_at: string | null
          approved_by: string | null
          cif_version_id: string
          component_type: string
          created_at: string
          currency: string
          id: string
          label: string | null
          notes: string | null
          source_document_id: string | null
          status: string
        }
        Insert: {
          allocation_basis?: string
          amount?: number
          amount_usd?: number
          approved_at?: string | null
          approved_by?: string | null
          cif_version_id: string
          component_type: string
          created_at?: string
          currency?: string
          id?: string
          label?: string | null
          notes?: string | null
          source_document_id?: string | null
          status?: string
        }
        Update: {
          allocation_basis?: string
          amount?: number
          amount_usd?: number
          approved_at?: string | null
          approved_by?: string | null
          cif_version_id?: string
          component_type?: string
          created_at?: string
          currency?: string
          id?: string
          label?: string | null
          notes?: string | null
          source_document_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cif_components_cif_version_id_fkey"
            columns: ["cif_version_id"]
            isOneToOne: false
            referencedRelation: "cif_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cif_version_id: string | null
          created_at: string
          document_type: string
          extracted_fields_json: Json | null
          extraction_status: string | null
          id: string
          import_order_id: string | null
          original_filename: string
          storage_path: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cif_version_id?: string | null
          created_at?: string
          document_type: string
          extracted_fields_json?: Json | null
          extraction_status?: string | null
          id?: string
          import_order_id?: string | null
          original_filename: string
          storage_path: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cif_version_id?: string | null
          created_at?: string
          document_type?: string
          extracted_fields_json?: Json | null
          extraction_status?: string | null
          id?: string
          import_order_id?: string | null
          original_filename?: string
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "cif_documents_cif_version_id_fkey"
            columns: ["cif_version_id"]
            isOneToOne: false
            referencedRelation: "cif_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cif_documents_import_order_id_fkey"
            columns: ["import_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_drive_links: {
        Row: {
          created_at: string
          google_drive_folder_id: string | null
          google_drive_folder_url: string | null
          id: string
          import_order_id: string | null
          last_synced_at: string | null
        }
        Insert: {
          created_at?: string
          google_drive_folder_id?: string | null
          google_drive_folder_url?: string | null
          id?: string
          import_order_id?: string | null
          last_synced_at?: string | null
        }
        Update: {
          created_at?: string
          google_drive_folder_id?: string | null
          google_drive_folder_url?: string | null
          id?: string
          import_order_id?: string | null
          last_synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cif_drive_links_import_order_id_fkey"
            columns: ["import_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_pricing_suggestions: {
        Row: {
          cif_allocation_id: string
          cif_version_id: string
          created_at: string
          id: string
          product_code: string
          retail_margin_pct: number
          retail_price_per_case_usd: number | null
          retail_price_per_case_xcg: number | null
          retail_price_per_kg_usd: number | null
          retail_price_per_kg_xcg: number | null
          retail_price_per_piece_usd: number | null
          retail_price_per_piece_xcg: number | null
          wholesale_margin_pct: number
          wholesale_price_per_case_usd: number | null
          wholesale_price_per_case_xcg: number | null
          wholesale_price_per_kg_usd: number | null
          wholesale_price_per_kg_xcg: number | null
          wholesale_price_per_piece_usd: number | null
          wholesale_price_per_piece_xcg: number | null
        }
        Insert: {
          cif_allocation_id: string
          cif_version_id: string
          created_at?: string
          id?: string
          product_code: string
          retail_margin_pct?: number
          retail_price_per_case_usd?: number | null
          retail_price_per_case_xcg?: number | null
          retail_price_per_kg_usd?: number | null
          retail_price_per_kg_xcg?: number | null
          retail_price_per_piece_usd?: number | null
          retail_price_per_piece_xcg?: number | null
          wholesale_margin_pct?: number
          wholesale_price_per_case_usd?: number | null
          wholesale_price_per_case_xcg?: number | null
          wholesale_price_per_kg_usd?: number | null
          wholesale_price_per_kg_xcg?: number | null
          wholesale_price_per_piece_usd?: number | null
          wholesale_price_per_piece_xcg?: number | null
        }
        Update: {
          cif_allocation_id?: string
          cif_version_id?: string
          created_at?: string
          id?: string
          product_code?: string
          retail_margin_pct?: number
          retail_price_per_case_usd?: number | null
          retail_price_per_case_xcg?: number | null
          retail_price_per_kg_usd?: number | null
          retail_price_per_kg_xcg?: number | null
          retail_price_per_piece_usd?: number | null
          retail_price_per_piece_xcg?: number | null
          wholesale_margin_pct?: number
          wholesale_price_per_case_usd?: number | null
          wholesale_price_per_case_xcg?: number | null
          wholesale_price_per_kg_usd?: number | null
          wholesale_price_per_kg_xcg?: number | null
          wholesale_price_per_piece_usd?: number | null
          wholesale_price_per_piece_xcg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cif_pricing_suggestions_cif_allocation_id_fkey"
            columns: ["cif_allocation_id"]
            isOneToOne: false
            referencedRelation: "cif_allocations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cif_pricing_suggestions_cif_version_id_fkey"
            columns: ["cif_version_id"]
            isOneToOne: false
            referencedRelation: "cif_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_variances: {
        Row: {
          actual_version_id: string | null
          created_at: string
          estimate_version_id: string | null
          id: string
          import_order_id: string | null
          summary_notes: string | null
          variance_json: Json
        }
        Insert: {
          actual_version_id?: string | null
          created_at?: string
          estimate_version_id?: string | null
          id?: string
          import_order_id?: string | null
          summary_notes?: string | null
          variance_json?: Json
        }
        Update: {
          actual_version_id?: string | null
          created_at?: string
          estimate_version_id?: string | null
          id?: string
          import_order_id?: string | null
          summary_notes?: string | null
          variance_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cif_variances_actual_version_id_fkey"
            columns: ["actual_version_id"]
            isOneToOne: false
            referencedRelation: "cif_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cif_variances_estimate_version_id_fkey"
            columns: ["estimate_version_id"]
            isOneToOne: false
            referencedRelation: "cif_versions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cif_variances_import_order_id_fkey"
            columns: ["import_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cif_versions: {
        Row: {
          ai_notes: string | null
          allocation_method_default: string
          bank_charges_usd: number
          champion_cost_per_kg: number
          created_at: string
          created_by: string | null
          fx_rate_usd_to_xcg: number
          id: string
          import_order_id: string | null
          is_final: boolean
          local_logistics_xcg: number
          spoilage_mode: string
          spoilage_pct: number
          swissport_cost_per_kg: number
          totals_json: Json | null
          version_no: number
          version_type: string
        }
        Insert: {
          ai_notes?: string | null
          allocation_method_default?: string
          bank_charges_usd?: number
          champion_cost_per_kg?: number
          created_at?: string
          created_by?: string | null
          fx_rate_usd_to_xcg?: number
          id?: string
          import_order_id?: string | null
          is_final?: boolean
          local_logistics_xcg?: number
          spoilage_mode?: string
          spoilage_pct?: number
          swissport_cost_per_kg?: number
          totals_json?: Json | null
          version_no?: number
          version_type: string
        }
        Update: {
          ai_notes?: string | null
          allocation_method_default?: string
          bank_charges_usd?: number
          champion_cost_per_kg?: number
          created_at?: string
          created_by?: string | null
          fx_rate_usd_to_xcg?: number
          id?: string
          import_order_id?: string | null
          is_final?: boolean
          local_logistics_xcg?: number
          spoilage_mode?: string
          spoilage_pct?: number
          swissport_cost_per_kg?: number
          totals_json?: Json | null
          version_no?: number
          version_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cif_versions_import_order_id_fkey"
            columns: ["import_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      cross_department_product_mappings: {
        Row: {
          conversion_factor: number | null
          created_at: string | null
          distribution_product_id: string
          id: string
          import_product_code: string
          updated_at: string | null
        }
        Insert: {
          conversion_factor?: number | null
          created_at?: string | null
          distribution_product_id: string
          id?: string
          import_product_code: string
          updated_at?: string | null
        }
        Update: {
          conversion_factor?: number | null
          created_at?: string | null
          distribution_product_id?: string
          id?: string
          import_product_code?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cross_department_product_mappings_distribution_product_id_fkey"
            columns: ["distribution_product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_product_prices: {
        Row: {
          created_at: string
          created_by: string | null
          custom_price_xcg: number
          customer_id: string
          id: string
          notes: string | null
          product_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          custom_price_xcg: number
          customer_id: string
          id?: string
          notes?: string | null
          product_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          custom_price_xcg?: number
          customer_id?: string
          id?: string
          notes?: string | null
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_product_prices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_product_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
      distribution_ai_match_logs: {
        Row: {
          confidence: string | null
          corrected_product_id: string | null
          created_at: string | null
          customer_id: string | null
          detected_language: string | null
          detected_quantity: number | null
          detected_unit: string | null
          id: string
          interpreted_text: string | null
          is_ignored: boolean | null
          match_source: string | null
          matched_product_id: string | null
          needs_review: boolean | null
          order_id: string | null
          raw_text: string
          reviewed_at: string | null
          reviewed_by: string | null
          was_corrected: boolean | null
        }
        Insert: {
          confidence?: string | null
          corrected_product_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          detected_language?: string | null
          detected_quantity?: number | null
          detected_unit?: string | null
          id?: string
          interpreted_text?: string | null
          is_ignored?: boolean | null
          match_source?: string | null
          matched_product_id?: string | null
          needs_review?: boolean | null
          order_id?: string | null
          raw_text: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          was_corrected?: boolean | null
        }
        Update: {
          confidence?: string | null
          corrected_product_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          detected_language?: string | null
          detected_quantity?: number | null
          detected_unit?: string | null
          id?: string
          interpreted_text?: string | null
          is_ignored?: boolean | null
          match_source?: string | null
          matched_product_id?: string | null
          needs_review?: boolean | null
          order_id?: string | null
          raw_text?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          was_corrected?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_ai_match_logs_corrected_product_id_fkey"
            columns: ["corrected_product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_ai_match_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_ai_match_logs_matched_product_id_fkey"
            columns: ["matched_product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_ai_match_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_assistance_queue: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          created_at: string | null
          id: string
          notes: string | null
          picker_name: string
          picker_queue_id: string | null
          reason: string
          resolved_at: string | null
          status: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          picker_name: string
          picker_queue_id?: string | null
          reason: string
          resolved_at?: string | null
          status?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          picker_name?: string
          picker_queue_id?: string | null
          reason?: string
          resolved_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_assistance_queue_picker_queue_id_fkey"
            columns: ["picker_queue_id"]
            isOneToOne: false
            referencedRelation: "distribution_picker_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_context_words: {
        Row: {
          created_at: string
          examples: string[] | null
          id: string
          is_verified: boolean | null
          language: string | null
          meaning: string
          updated_at: string
          usage_count: number | null
          verified_at: string | null
          verified_by: string | null
          word: string
          word_type: string
        }
        Insert: {
          created_at?: string
          examples?: string[] | null
          id?: string
          is_verified?: boolean | null
          language?: string | null
          meaning: string
          updated_at?: string
          usage_count?: number | null
          verified_at?: string | null
          verified_by?: string | null
          word: string
          word_type: string
        }
        Update: {
          created_at?: string
          examples?: string[] | null
          id?: string
          is_verified?: boolean | null
          language?: string | null
          meaning?: string
          updated_at?: string
          usage_count?: number | null
          verified_at?: string | null
          verified_by?: string | null
          word?: string
          word_type?: string
        }
        Relationships: []
      }
      distribution_conversation_intents: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          intent: string
          is_active: boolean | null
          priority: number | null
          response_template_id: string | null
          trigger_phrases: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          intent: string
          is_active?: boolean | null
          priority?: number | null
          response_template_id?: string | null
          trigger_phrases?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          intent?: string
          is_active?: boolean | null
          priority?: number | null
          response_template_id?: string | null
          trigger_phrases?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_conversation_intents_response_template_id_fkey"
            columns: ["response_template_id"]
            isOneToOne: false
            referencedRelation: "distribution_response_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_conversations: {
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
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_customer_patterns: {
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
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_customer_patterns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_customer_product_mappings: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          customer_id: string
          customer_product_name: string
          customer_sku: string
          id: string
          is_verified: boolean | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          customer_id: string
          customer_product_name: string
          customer_sku: string
          id?: string
          is_verified?: boolean | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          customer_id?: string
          customer_product_name?: string
          customer_sku?: string
          id?: string
          is_verified?: boolean | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_customer_product_mappings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_customer_product_mappings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_customer_schedules: {
        Row: {
          confidence_score: number | null
          created_at: string | null
          customer_id: string | null
          expected_order_days: number[] | null
          id: string
          last_analyzed_at: string | null
          order_time_consistency: number | null
          total_orders_analyzed: number | null
          typical_delivery_type: string | null
          typical_order_hour: number | null
          typical_order_time: string | null
          updated_at: string | null
        }
        Insert: {
          confidence_score?: number | null
          created_at?: string | null
          customer_id?: string | null
          expected_order_days?: number[] | null
          id?: string
          last_analyzed_at?: string | null
          order_time_consistency?: number | null
          total_orders_analyzed?: number | null
          typical_delivery_type?: string | null
          typical_order_hour?: number | null
          typical_order_time?: string | null
          updated_at?: string | null
        }
        Update: {
          confidence_score?: number | null
          created_at?: string | null
          customer_id?: string | null
          expected_order_days?: number[] | null
          id?: string
          last_analyzed_at?: string | null
          order_time_consistency?: number | null
          total_orders_analyzed?: number | null
          typical_delivery_type?: string | null
          typical_order_hour?: number | null
          typical_order_time?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_customer_schedules_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_customers: {
        Row: {
          address: string | null
          created_at: string | null
          customer_type: Database["public"]["Enums"]["customer_type"]
          delivery_zone: string | null
          distance_to_dc_meters: number | null
          id: string
          is_close_proximity: boolean | null
          latitude: number | null
          longitude: number | null
          major_zone_id: string | null
          name: string
          notes: string | null
          preferred_language: string | null
          preferred_payment_method:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          pricing_tier_id: string | null
          quickbooks_customer_id: string | null
          updated_at: string | null
          whatsapp_phone: string
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          delivery_zone?: string | null
          distance_to_dc_meters?: number | null
          id?: string
          is_close_proximity?: boolean | null
          latitude?: number | null
          longitude?: number | null
          major_zone_id?: string | null
          name: string
          notes?: string | null
          preferred_language?: string | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          pricing_tier_id?: string | null
          quickbooks_customer_id?: string | null
          updated_at?: string | null
          whatsapp_phone: string
        }
        Update: {
          address?: string | null
          created_at?: string | null
          customer_type?: Database["public"]["Enums"]["customer_type"]
          delivery_zone?: string | null
          distance_to_dc_meters?: number | null
          id?: string
          is_close_proximity?: boolean | null
          latitude?: number | null
          longitude?: number | null
          major_zone_id?: string | null
          name?: string
          notes?: string | null
          preferred_language?: string | null
          preferred_payment_method?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          pricing_tier_id?: string | null
          quickbooks_customer_id?: string | null
          updated_at?: string | null
          whatsapp_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_customers_major_zone_id_fkey"
            columns: ["major_zone_id"]
            isOneToOne: false
            referencedRelation: "distribution_delivery_zones"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_customers_pricing_tier_id_fkey"
            columns: ["pricing_tier_id"]
            isOneToOne: false
            referencedRelation: "distribution_pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_delivery_zones: {
        Row: {
          center_latitude: number | null
          center_longitude: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          parent_zone_id: string | null
          polygon_coordinates: Json | null
          radius_meters: number | null
          sort_order: number
          updated_at: string
          zone_type: string
        }
        Insert: {
          center_latitude?: number | null
          center_longitude?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          parent_zone_id?: string | null
          polygon_coordinates?: Json | null
          radius_meters?: number | null
          sort_order?: number
          updated_at?: string
          zone_type?: string
        }
        Update: {
          center_latitude?: number | null
          center_longitude?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          parent_zone_id?: string | null
          polygon_coordinates?: Json | null
          radius_meters?: number | null
          sort_order?: number
          updated_at?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_delivery_zones_parent_zone_id_fkey"
            columns: ["parent_zone_id"]
            isOneToOne: false
            referencedRelation: "distribution_delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_invoice_activity: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          invoice_id: string
          performed_by: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id: string
          performed_by?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          invoice_id?: string
          performed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_invoice_activity_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "distribution_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_invoice_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invoice_id: string
          is_ob_eligible: boolean | null
          line_total_xcg: number
          ob_tax_inclusive: number | null
          order_item_id: string | null
          product_id: string | null
          product_name: string
          quantity: number
          unit_price_xcg: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id: string
          is_ob_eligible?: boolean | null
          line_total_xcg: number
          ob_tax_inclusive?: number | null
          order_item_id?: string | null
          product_id?: string | null
          product_name: string
          quantity: number
          unit_price_xcg: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invoice_id?: string
          is_ob_eligible?: boolean | null
          line_total_xcg?: number
          ob_tax_inclusive?: number | null
          order_item_id?: string | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          unit_price_xcg?: number
        }
        Relationships: [
          {
            foreignKeyName: "fnb_invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "distribution_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_invoice_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "distribution_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_invoice_orders: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          order_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          order_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_invoice_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "distribution_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_invoice_orders_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_invoices: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_memo: string | null
          due_date: string
          id: string
          invoice_date: string
          notes: string | null
          ob_tax_amount: number
          quickbooks_invoice_id: string | null
          quickbooks_invoice_number: string | null
          quickbooks_sync_error: string | null
          quickbooks_sync_status: string | null
          quickbooks_synced_at: string | null
          status: string
          subtotal_xcg: number
          total_xcg: number
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_memo?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          notes?: string | null
          ob_tax_amount?: number
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          quickbooks_sync_error?: string | null
          quickbooks_sync_status?: string | null
          quickbooks_synced_at?: string | null
          status?: string
          subtotal_xcg?: number
          total_xcg?: number
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_memo?: string | null
          due_date?: string
          id?: string
          invoice_date?: string
          notes?: string | null
          ob_tax_amount?: number
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          quickbooks_sync_error?: string | null
          quickbooks_sync_status?: string | null
          quickbooks_synced_at?: string | null
          status?: string
          subtotal_xcg?: number
          total_xcg?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_order_anomalies: {
        Row: {
          anomaly_type: string
          created_at: string | null
          customer_id: string | null
          details: Json | null
          detected_at: string | null
          expected_date: string | null
          id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          status: string | null
          suggested_message_en: string | null
          suggested_message_es: string | null
          suggested_message_nl: string | null
          suggested_message_pap: string | null
        }
        Insert: {
          anomaly_type: string
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          detected_at?: string | null
          expected_date?: string | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          suggested_message_en?: string | null
          suggested_message_es?: string | null
          suggested_message_nl?: string | null
          suggested_message_pap?: string | null
        }
        Update: {
          anomaly_type?: string
          created_at?: string | null
          customer_id?: string | null
          details?: Json | null
          detected_at?: string | null
          expected_date?: string | null
          id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          suggested_message_en?: string | null
          suggested_message_es?: string | null
          suggested_message_nl?: string | null
          suggested_message_pap?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_order_anomalies_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_order_items: {
        Row: {
          actual_weight_kg: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string | null
          id: string
          is_cancelled: boolean | null
          is_over_picked: boolean | null
          order_id: string | null
          order_unit: string | null
          picked_at: string | null
          picked_by: string | null
          picked_quantity: number | null
          picked_unit: string | null
          picker_name: string | null
          product_id: string | null
          quantity: number
          short_quantity: number | null
          short_reason: string | null
          shortage_alerted_at: string | null
          shortage_approved_at: string | null
          shortage_approved_by: string | null
          shortage_resolution_notes: string | null
          shortage_resolved_at: string | null
          shortage_resolved_by: string | null
          shortage_status: string | null
          total_xcg: number
          unit_price_xcg: number
        }
        Insert: {
          actual_weight_kg?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          id?: string
          is_cancelled?: boolean | null
          is_over_picked?: boolean | null
          order_id?: string | null
          order_unit?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picked_quantity?: number | null
          picked_unit?: string | null
          picker_name?: string | null
          product_id?: string | null
          quantity: number
          short_quantity?: number | null
          short_reason?: string | null
          shortage_alerted_at?: string | null
          shortage_approved_at?: string | null
          shortage_approved_by?: string | null
          shortage_resolution_notes?: string | null
          shortage_resolved_at?: string | null
          shortage_resolved_by?: string | null
          shortage_status?: string | null
          total_xcg: number
          unit_price_xcg: number
        }
        Update: {
          actual_weight_kg?: number | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string | null
          id?: string
          is_cancelled?: boolean | null
          is_over_picked?: boolean | null
          order_id?: string | null
          order_unit?: string | null
          picked_at?: string | null
          picked_by?: string | null
          picked_quantity?: number | null
          picked_unit?: string | null
          picker_name?: string | null
          product_id?: string | null
          quantity?: number
          short_quantity?: number | null
          short_reason?: string | null
          shortage_alerted_at?: string | null
          shortage_approved_at?: string | null
          shortage_approved_by?: string | null
          shortage_resolution_notes?: string | null
          shortage_resolved_at?: string | null
          shortage_resolved_by?: string | null
          shortage_status?: string | null
          total_xcg?: number
          unit_price_xcg?: number
        }
        Relationships: [
          {
            foreignKeyName: "fnb_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_order_modifications: {
        Row: {
          created_at: string
          id: string
          modification_type: string
          modified_by: string | null
          modified_by_email: string | null
          new_value: Json | null
          notes: string | null
          order_id: string | null
          previous_value: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          modification_type: string
          modified_by?: string | null
          modified_by_email?: string | null
          new_value?: Json | null
          notes?: string | null
          order_id?: string | null
          previous_value?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          modification_type?: string
          modified_by?: string | null
          modified_by_email?: string | null
          new_value?: Json | null
          notes?: string | null
          order_id?: string | null
          previous_value?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_order_modifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_order_sessions: {
        Row: {
          conversation_snapshot: Json | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          customer_phone: string
          detected_language: string | null
          expires_at: string
          id: string
          parsed_items: Json
          reminder_count: number | null
          reminder_sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          conversation_snapshot?: Json | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone: string
          detected_language?: string | null
          expires_at?: string
          id?: string
          parsed_items?: Json
          reminder_count?: number | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          conversation_snapshot?: Json | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          customer_phone?: string
          detected_language?: string | null
          expires_at?: string
          id?: string
          parsed_items?: Json
          reminder_count?: number | null
          reminder_sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "distribution_order_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_orders: {
        Row: {
          assigned_at: string | null
          assignment_locked: boolean
          cancellation_cutoff_hours: number | null
          cod_amount_collected: number | null
          cod_amount_due: number | null
          cod_collected_at: string | null
          cod_notes: string | null
          cod_reconciled_at: string | null
          cod_reconciled_by: string | null
          created_at: string | null
          customer_id: string | null
          customer_phone: string | null
          delivered_at: string | null
          delivery_date: string | null
          delivery_station: string | null
          dre_outreach_id: string | null
          driver_id: string | null
          driver_name: string | null
          has_special_requirements: boolean | null
          id: string
          invoice_id: string | null
          is_pickup: boolean | null
          language_used: string | null
          manual_override_at: string | null
          manual_override_by: string | null
          modification_type: string | null
          notes: string | null
          order_date: string
          order_number: string
          parent_order_id: string | null
          payment_method: string | null
          payment_method_used:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          po_number: string | null
          priority: number | null
          quickbooks_invoice_id: string | null
          quickbooks_invoice_number: string | null
          receipt_extracted_data: Json | null
          receipt_photo_processed_url: string | null
          receipt_photo_url: string | null
          receipt_verified_at: string | null
          receipt_verified_by: string | null
          requested_delivery_time: string | null
          source: string | null
          source_conversation: string | null
          source_email_id: string | null
          standing_order_template_id: string | null
          status: string | null
          total_xcg: number | null
          updated_at: string | null
        }
        Insert: {
          assigned_at?: string | null
          assignment_locked?: boolean
          cancellation_cutoff_hours?: number | null
          cod_amount_collected?: number | null
          cod_amount_due?: number | null
          cod_collected_at?: string | null
          cod_notes?: string | null
          cod_reconciled_at?: string | null
          cod_reconciled_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_station?: string | null
          dre_outreach_id?: string | null
          driver_id?: string | null
          driver_name?: string | null
          has_special_requirements?: boolean | null
          id?: string
          invoice_id?: string | null
          is_pickup?: boolean | null
          language_used?: string | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          modification_type?: string | null
          notes?: string | null
          order_date?: string
          order_number: string
          parent_order_id?: string | null
          payment_method?: string | null
          payment_method_used?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          po_number?: string | null
          priority?: number | null
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          receipt_extracted_data?: Json | null
          receipt_photo_processed_url?: string | null
          receipt_photo_url?: string | null
          receipt_verified_at?: string | null
          receipt_verified_by?: string | null
          requested_delivery_time?: string | null
          source?: string | null
          source_conversation?: string | null
          source_email_id?: string | null
          standing_order_template_id?: string | null
          status?: string | null
          total_xcg?: number | null
          updated_at?: string | null
        }
        Update: {
          assigned_at?: string | null
          assignment_locked?: boolean
          cancellation_cutoff_hours?: number | null
          cod_amount_collected?: number | null
          cod_amount_due?: number | null
          cod_collected_at?: string | null
          cod_notes?: string | null
          cod_reconciled_at?: string | null
          cod_reconciled_by?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_phone?: string | null
          delivered_at?: string | null
          delivery_date?: string | null
          delivery_station?: string | null
          dre_outreach_id?: string | null
          driver_id?: string | null
          driver_name?: string | null
          has_special_requirements?: boolean | null
          id?: string
          invoice_id?: string | null
          is_pickup?: boolean | null
          language_used?: string | null
          manual_override_at?: string | null
          manual_override_by?: string | null
          modification_type?: string | null
          notes?: string | null
          order_date?: string
          order_number?: string
          parent_order_id?: string | null
          payment_method?: string | null
          payment_method_used?:
            | Database["public"]["Enums"]["payment_method_type"]
            | null
          po_number?: string | null
          priority?: number | null
          quickbooks_invoice_id?: string | null
          quickbooks_invoice_number?: string | null
          receipt_extracted_data?: Json | null
          receipt_photo_processed_url?: string | null
          receipt_photo_url?: string | null
          receipt_verified_at?: string | null
          receipt_verified_by?: string | null
          requested_delivery_time?: string | null
          source?: string | null
          source_conversation?: string | null
          source_email_id?: string | null
          standing_order_template_id?: string | null
          status?: string | null
          total_xcg?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "distribution_orders_dre_outreach_id_fkey"
            columns: ["dre_outreach_id"]
            isOneToOne: false
            referencedRelation: "dre_outreach_log"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_orders_parent_order_id_fkey"
            columns: ["parent_order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "distribution_orders_source_email_id_fkey"
            columns: ["source_email_id"]
            isOneToOne: false
            referencedRelation: "email_inbox"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_orders_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "distribution_invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_orders_manual_override_by_fkey"
            columns: ["manual_override_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_orders_manual_override_by_fkey"
            columns: ["manual_override_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_orders_standing_order_template_id_fkey"
            columns: ["standing_order_template_id"]
            isOneToOne: false
            referencedRelation: "distribution_standing_order_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_picker_queue: {
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
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_po_imports: {
        Row: {
          created_at: string | null
          customer_id: string | null
          delivery_date: string | null
          id: string
          imported_by: string | null
          items_imported: number | null
          items_matched: number | null
          items_unmatched: number | null
          order_id: string | null
          po_file_url: string | null
          po_number: string
          raw_extracted_data: Json | null
        }
        Insert: {
          created_at?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          imported_by?: string | null
          items_imported?: number | null
          items_matched?: number | null
          items_unmatched?: number | null
          order_id?: string | null
          po_file_url?: string | null
          po_number: string
          raw_extracted_data?: Json | null
        }
        Update: {
          created_at?: string | null
          customer_id?: string | null
          delivery_date?: string | null
          id?: string
          imported_by?: string | null
          items_imported?: number | null
          items_matched?: number | null
          items_unmatched?: number | null
          order_id?: string | null
          po_file_url?: string | null
          po_number?: string
          raw_extracted_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_po_imports_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_po_imports_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_pricing_tiers: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          is_default: boolean
          name: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          is_default?: boolean
          name?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      distribution_product_aliases: {
        Row: {
          alias: string
          confidence_score: number | null
          created_at: string | null
          id: string
          language: string | null
          product_id: string
          updated_at: string | null
        }
        Insert: {
          alias: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          language?: string | null
          product_id: string
          updated_at?: string | null
        }
        Update: {
          alias?: string
          confidence_score?: number | null
          created_at?: string | null
          id?: string
          language?: string | null
          product_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_product_aliases_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_product_picking_units: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          picking_unit: string
          product_id: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          picking_unit: string
          product_id: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          picking_unit?: string
          product_id?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "distribution_product_picking_units_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_product_tier_prices: {
        Row: {
          created_at: string
          id: string
          price_xcg: number
          product_id: string
          tier_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          price_xcg: number
          product_id: string
          tier_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          price_xcg?: number
          product_id?: string
          tier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_product_tier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_product_tier_prices_tier_id_fkey"
            columns: ["tier_id"]
            isOneToOne: false
            referencedRelation: "distribution_pricing_tiers"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_products: {
        Row: {
          case_weight_kg: number | null
          code: string
          created_at: string | null
          id: string
          is_active: boolean | null
          is_ob_eligible: boolean | null
          is_weight_based: boolean | null
          items_per_case: number | null
          min_order_qty: number | null
          name: string
          name_es: string | null
          name_nl: string | null
          name_pap: string | null
          price_per_case: number | null
          price_per_gram: number | null
          price_per_kg: number | null
          price_per_lb: number | null
          price_per_piece: number | null
          price_per_tros: number | null
          price_xcg: number
          product_description: string | null
          quickbooks_item_id: string | null
          unit: string
          updated_at: string | null
          weight_unit: string | null
        }
        Insert: {
          case_weight_kg?: number | null
          code: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_ob_eligible?: boolean | null
          is_weight_based?: boolean | null
          items_per_case?: number | null
          min_order_qty?: number | null
          name: string
          name_es?: string | null
          name_nl?: string | null
          name_pap?: string | null
          price_per_case?: number | null
          price_per_gram?: number | null
          price_per_kg?: number | null
          price_per_lb?: number | null
          price_per_piece?: number | null
          price_per_tros?: number | null
          price_xcg: number
          product_description?: string | null
          quickbooks_item_id?: string | null
          unit: string
          updated_at?: string | null
          weight_unit?: string | null
        }
        Update: {
          case_weight_kg?: number | null
          code?: string
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_ob_eligible?: boolean | null
          is_weight_based?: boolean | null
          items_per_case?: number | null
          min_order_qty?: number | null
          name?: string
          name_es?: string | null
          name_nl?: string | null
          name_pap?: string | null
          price_per_case?: number | null
          price_per_gram?: number | null
          price_per_kg?: number | null
          price_per_lb?: number | null
          price_per_piece?: number | null
          price_per_tros?: number | null
          price_xcg?: number
          product_description?: string | null
          quickbooks_item_id?: string | null
          unit?: string
          updated_at?: string | null
          weight_unit?: string | null
        }
        Relationships: []
      }
      distribution_response_templates: {
        Row: {
          created_at: string | null
          id: string
          intent: string
          is_active: boolean | null
          template_dutch: string | null
          template_english: string | null
          template_papiamentu: string
          updated_at: string | null
          usage_count: number | null
          variables: string[] | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intent: string
          is_active?: boolean | null
          template_dutch?: string | null
          template_english?: string | null
          template_papiamentu: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: string[] | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intent?: string
          is_active?: boolean | null
          template_dutch?: string | null
          template_english?: string | null
          template_papiamentu?: string
          updated_at?: string | null
          usage_count?: number | null
          variables?: string[] | null
        }
        Relationships: []
      }
      distribution_standing_order_items: {
        Row: {
          created_at: string
          customer_id: string
          default_price_xcg: number | null
          default_quantity: number
          default_unit: string | null
          id: string
          product_id: string
          sort_order: number
          template_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          default_price_xcg?: number | null
          default_quantity?: number
          default_unit?: string | null
          id?: string
          product_id: string
          sort_order?: number
          template_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          default_price_xcg?: number | null
          default_quantity?: number
          default_unit?: string | null
          id?: string
          product_id?: string
          sort_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fnb_standing_order_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_standing_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_standing_order_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "distribution_standing_order_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_standing_order_templates: {
        Row: {
          created_at: string
          created_by: string | null
          day_of_week: number
          id: string
          is_active: boolean
          notes: string | null
          template_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          day_of_week: number
          id?: string
          is_active?: boolean
          notes?: string | null
          template_name?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          day_of_week?: number
          id?: string
          is_active?: boolean
          notes?: string | null
          template_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      distribution_translations: {
        Row: {
          category: string | null
          created_at: string | null
          dutch: string | null
          english: string | null
          grammatical_type: string | null
          id: string
          is_verified: boolean | null
          papiamentu: string
          source: string | null
          spanish: string | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          dutch?: string | null
          english?: string | null
          grammatical_type?: string | null
          id?: string
          is_verified?: boolean | null
          papiamentu: string
          source?: string | null
          spanish?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          category?: string | null
          created_at?: string | null
          dutch?: string | null
          english?: string | null
          grammatical_type?: string | null
          id?: string
          is_verified?: boolean | null
          papiamentu?: string
          source?: string | null
          spanish?: string | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      distribution_unmatched_items: {
        Row: {
          added_as_global_alias: boolean | null
          conversation_id: string | null
          created_at: string | null
          customer_id: string | null
          detected_language: string | null
          detected_quantity: number | null
          detected_unit: string | null
          id: string
          is_resolved: boolean | null
          raw_text: string
          resolved_at: string | null
          resolved_by: string | null
          resolved_product_id: string | null
        }
        Insert: {
          added_as_global_alias?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          detected_language?: string | null
          detected_quantity?: number | null
          detected_unit?: string | null
          id?: string
          is_resolved?: boolean | null
          raw_text: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_product_id?: string | null
        }
        Update: {
          added_as_global_alias?: boolean | null
          conversation_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          detected_language?: string | null
          detected_quantity?: number | null
          detected_unit?: string | null
          id?: string
          is_resolved?: boolean | null
          raw_text?: string
          resolved_at?: string | null
          resolved_by?: string | null
          resolved_product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fnb_unmatched_items_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "distribution_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_unmatched_items_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fnb_unmatched_items_resolved_product_id_fkey"
            columns: ["resolved_product_id"]
            isOneToOne: false
            referencedRelation: "distribution_products"
            referencedColumns: ["id"]
          },
        ]
      }
      distribution_week_generations: {
        Row: {
          generated_at: string
          generated_by: string | null
          id: string
          orders_created: number
          week_start_date: string
        }
        Insert: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          orders_created?: number
          week_start_date: string
        }
        Update: {
          generated_at?: string
          generated_by?: string | null
          id?: string
          orders_created?: number
          week_start_date?: string
        }
        Relationships: []
      }
      dre_channel_members: {
        Row: {
          channel_id: string | null
          created_at: string | null
          id: string
          last_read_at: string | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          last_read_at?: string | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "dre_team_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_direct_messages: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          message_text: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          message_text?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      dre_escalation_queue: {
        Row: {
          ai_summary: string | null
          assigned_department: string | null
          assigned_to: string | null
          context: Json | null
          conversation_id: string
          created_at: string | null
          customer_id: string | null
          escalation_type: string
          id: string
          priority: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          ai_summary?: string | null
          assigned_department?: string | null
          assigned_to?: string | null
          context?: Json | null
          conversation_id: string
          created_at?: string | null
          customer_id?: string | null
          escalation_type: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_summary?: string | null
          assigned_department?: string | null
          assigned_to?: string | null
          context?: Json | null
          conversation_id?: string
          created_at?: string | null
          customer_id?: string | null
          escalation_type?: string
          id?: string
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_escalation_queue_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_outreach_log: {
        Row: {
          anomaly_id: string | null
          created_at: string | null
          customer_id: string | null
          customer_responded: boolean | null
          id: string
          language: string | null
          message_sent: string
          order_generated_id: string | null
          order_revenue: number | null
          outreach_timing: string | null
          outreach_type: string
          response_at: string | null
          sent_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          anomaly_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_responded?: boolean | null
          id?: string
          language?: string | null
          message_sent: string
          order_generated_id?: string | null
          order_revenue?: number | null
          outreach_timing?: string | null
          outreach_type: string
          response_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          anomaly_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_responded?: boolean | null
          id?: string
          language?: string | null
          message_sent?: string
          order_generated_id?: string | null
          order_revenue?: number | null
          outreach_timing?: string | null
          outreach_type?: string
          response_at?: string | null
          sent_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_outreach_log_anomaly_id_fkey"
            columns: ["anomaly_id"]
            isOneToOne: false
            referencedRelation: "distribution_order_anomalies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_outreach_log_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_order_generated"
            columns: ["order_generated_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_response_feedback: {
        Row: {
          conversation_id: string | null
          corrected_by: string
          corrected_response: string | null
          created_at: string
          feedback_notes: string | null
          feedback_type: string | null
          id: string
          message_id: string
          original_response: string
          rating: string
        }
        Insert: {
          conversation_id?: string | null
          corrected_by: string
          corrected_response?: string | null
          created_at?: string
          feedback_notes?: string | null
          feedback_type?: string | null
          id?: string
          message_id: string
          original_response: string
          rating: string
        }
        Update: {
          conversation_id?: string | null
          corrected_by?: string
          corrected_response?: string | null
          created_at?: string
          feedback_notes?: string | null
          feedback_type?: string | null
          id?: string
          message_id?: string
          original_response?: string
          rating?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_response_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_response_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_team_channels: {
        Row: {
          channel_type: string
          created_at: string | null
          created_by: string | null
          department: string | null
          description: string | null
          id: string
          is_archived: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          channel_type?: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          channel_type?: string
          created_at?: string | null
          created_by?: string | null
          department?: string | null
          description?: string | null
          id?: string
          is_archived?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      dre_team_chat: {
        Row: {
          conversation_id: string | null
          created_at: string
          id: string
          message_text: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_text: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          id?: string
          message_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dre_team_chat_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_team_messages: {
        Row: {
          channel_id: string | null
          created_at: string | null
          id: string
          is_pinned: boolean | null
          message_text: string
          message_type: string | null
          metadata: Json | null
          related_conversation_id: string | null
          related_customer_id: string | null
          sender_id: string
          updated_at: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          message_text: string
          message_type?: string | null
          metadata?: Json | null
          related_conversation_id?: string | null
          related_customer_id?: string | null
          sender_id: string
          updated_at?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string | null
          id?: string
          is_pinned?: boolean | null
          message_text?: string
          message_type?: string | null
          metadata?: Json | null
          related_conversation_id?: string | null
          related_customer_id?: string | null
          sender_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dre_team_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "dre_team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dre_team_messages_related_customer_id_fkey"
            columns: ["related_customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      dre_team_presence: {
        Row: {
          active_conversations: number | null
          current_view: string | null
          id: string
          last_seen_at: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          active_conversations?: number | null
          current_view?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          active_conversations?: number | null
          current_view?: string | null
          id?: string
          last_seen_at?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      driver_availability: {
        Row: {
          created_at: string | null
          date: string
          driver_id: string
          end_time: string | null
          id: string
          is_available: boolean | null
          notes: string | null
          start_time: string | null
          updated_at: string | null
          vehicle_capacity: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          driver_id: string
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string | null
          vehicle_capacity?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          driver_id?: string
          end_time?: string | null
          id?: string
          is_available?: boolean | null
          notes?: string | null
          start_time?: string | null
          updated_at?: string | null
          vehicle_capacity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_availability_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallet_transactions: {
        Row: {
          amount: number
          balance_after: number
          balance_before: number
          created_at: string
          deposit_reference: string | null
          driver_id: string
          id: string
          notes: string | null
          order_id: string | null
          payment_method: string | null
          processed_by: string | null
          transaction_type: string
          wallet_id: string
        }
        Insert: {
          amount: number
          balance_after: number
          balance_before: number
          created_at?: string
          deposit_reference?: string | null
          driver_id: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          processed_by?: string | null
          transaction_type: string
          wallet_id: string
        }
        Update: {
          amount?: number
          balance_after?: number
          balance_before?: number
          created_at?: string
          deposit_reference?: string | null
          driver_id?: string
          id?: string
          notes?: string | null
          order_id?: string | null
          payment_method?: string | null
          processed_by?: string | null
          transaction_type?: string
          wallet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_processed_by_fkey"
            columns: ["processed_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "driver_wallets"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_wallets: {
        Row: {
          created_at: string
          current_balance: number
          driver_id: string
          id: string
          last_collection_at: string | null
          last_deposit_at: string | null
          total_collected: number
          total_deposited: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_balance?: number
          driver_id: string
          id?: string
          last_collection_at?: string | null
          last_deposit_at?: string | null
          total_collected?: number
          total_deposited?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_balance?: number
          driver_id?: string
          id?: string
          last_collection_at?: string | null
          last_deposit_at?: string | null
          total_collected?: number
          total_deposited?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_wallets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_wallets_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: true
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_zone_assignments: {
        Row: {
          created_at: string
          date: string
          driver_id: string
          id: string
          is_primary: boolean
          updated_at: string
          zone_id: string
        }
        Insert: {
          created_at?: string
          date: string
          driver_id: string
          id?: string
          is_primary?: boolean
          updated_at?: string
          zone_id: string
        }
        Update: {
          created_at?: string
          date?: string
          driver_id?: string
          id?: string
          is_primary?: boolean
          updated_at?: string
          zone_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "driver_zone_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_zone_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_zone_assignments_zone_id_fkey"
            columns: ["zone_id"]
            isOneToOne: false
            referencedRelation: "distribution_delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      email_confirmation_templates: {
        Row: {
          body_template: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          subject_template: string
          updated_at: string
        }
        Insert: {
          body_template: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          subject_template: string
          updated_at?: string
        }
        Update: {
          body_template?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          subject_template?: string
          updated_at?: string
        }
        Relationships: []
      }
      email_inbox: {
        Row: {
          body_html: string | null
          body_text: string | null
          confirmation_email_sent: boolean | null
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          declined_at: string | null
          declined_by: string | null
          error_message: string | null
          extracted_customer_name: string | null
          extracted_data: Json | null
          extracted_delivery_date: string | null
          extracted_po_number: string | null
          extraction_confidence: number | null
          extraction_notes: string | null
          from_email: string
          from_name: string | null
          id: string
          is_reply: boolean | null
          linked_order_id: string | null
          matched_customer_id: string | null
          message_id: string
          parent_email_id: string | null
          processing_completed_at: string | null
          processing_started_at: string | null
          received_at: string
          reply_message_id: string | null
          reply_sent_at: string | null
          status: string
          subject: string | null
          thread_id: string | null
          to_email: string | null
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          confirmation_email_sent?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          declined_at?: string | null
          declined_by?: string | null
          error_message?: string | null
          extracted_customer_name?: string | null
          extracted_data?: Json | null
          extracted_delivery_date?: string | null
          extracted_po_number?: string | null
          extraction_confidence?: number | null
          extraction_notes?: string | null
          from_email: string
          from_name?: string | null
          id?: string
          is_reply?: boolean | null
          linked_order_id?: string | null
          matched_customer_id?: string | null
          message_id: string
          parent_email_id?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          received_at: string
          reply_message_id?: string | null
          reply_sent_at?: string | null
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_email?: string | null
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          confirmation_email_sent?: boolean | null
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          declined_at?: string | null
          declined_by?: string | null
          error_message?: string | null
          extracted_customer_name?: string | null
          extracted_data?: Json | null
          extracted_delivery_date?: string | null
          extracted_po_number?: string | null
          extraction_confidence?: number | null
          extraction_notes?: string | null
          from_email?: string
          from_name?: string | null
          id?: string
          is_reply?: boolean | null
          linked_order_id?: string | null
          matched_customer_id?: string | null
          message_id?: string
          parent_email_id?: string | null
          processing_completed_at?: string | null
          processing_started_at?: string | null
          received_at?: string
          reply_message_id?: string | null
          reply_sent_at?: string | null
          status?: string
          subject?: string | null
          thread_id?: string | null
          to_email?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_inbox_linked_order_id_fkey"
            columns: ["linked_order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_inbox_matched_customer_id_fkey"
            columns: ["matched_customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_inbox_parent_email_id_fkey"
            columns: ["parent_email_id"]
            isOneToOne: false
            referencedRelation: "email_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      email_inbox_attachments: {
        Row: {
          created_at: string
          email_id: string
          extracted_data: Json | null
          extraction_confidence: number | null
          filename: string
          id: string
          mime_type: string | null
          processed_at: string | null
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          created_at?: string
          email_id: string
          extracted_data?: Json | null
          extraction_confidence?: number | null
          filename: string
          id?: string
          mime_type?: string | null
          processed_at?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string
          extracted_data?: Json | null
          extraction_confidence?: number | null
          filename?: string
          id?: string
          mime_type?: string | null
          processed_at?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_inbox_attachments_email_id_fkey"
            columns: ["email_id"]
            isOneToOne: false
            referencedRelation: "email_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      employee_documents: {
        Row: {
          created_at: string | null
          document_type: string
          employee_id: string
          expiry_date: string | null
          file_path: string
          file_size: number | null
          id: string
          notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string | null
          title: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string | null
          document_type: string
          employee_id: string
          expiry_date?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string | null
          document_type?: string
          employee_id?: string
          expiry_date?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string | null
          title?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          created_at: string | null
          department: string | null
          email: string | null
          emergency_contact_name: string | null
          emergency_contact_phone: string | null
          employee_number: string
          full_name: string
          hire_date: string | null
          hourly_rate: number | null
          id: string
          phone: string | null
          position: string | null
          profile_photo_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number: string
          full_name: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          position?: string | null
          profile_photo_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string | null
          department?: string | null
          email?: string | null
          emergency_contact_name?: string | null
          emergency_contact_phone?: string | null
          employee_number?: string
          full_name?: string
          hire_date?: string | null
          hourly_rate?: number | null
          id?: string
          phone?: string | null
          position?: string | null
          profile_photo_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      export_logs: {
        Row: {
          created_at: string | null
          entity_type: string
          export_type: string
          file_size_bytes: number | null
          filters_applied: Json | null
          id: string
          record_count: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          entity_type: string
          export_type: string
          file_size_bytes?: number | null
          filters_applied?: Json | null
          id?: string
          record_count?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          entity_type?: string
          export_type?: string
          file_size_bytes?: number | null
          filters_applied?: Json | null
          id?: string
          record_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      external_integrations: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          error_message: string | null
          id: string
          is_active: boolean
          last_sync_at: string | null
          name: string
          sync_status: string | null
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          name: string
          sync_status?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          error_message?: string | null
          id?: string
          is_active?: boolean
          last_sync_at?: string | null
          name?: string
          sync_status?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      gmail_credentials: {
        Row: {
          access_token: string
          created_at: string
          email_address: string
          history_id: string | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_sync_at: string | null
          needs_reauth: boolean | null
          refresh_token: string
          token_expiry: string
          updated_at: string
          watch_expiration: string | null
        }
        Insert: {
          access_token: string
          created_at?: string
          email_address: string
          history_id?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          needs_reauth?: boolean | null
          refresh_token: string
          token_expiry: string
          updated_at?: string
          watch_expiration?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string
          email_address?: string
          history_id?: string | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_sync_at?: string | null
          needs_reauth?: boolean | null
          refresh_token?: string
          token_expiry?: string
          updated_at?: string
          watch_expiration?: string | null
        }
        Relationships: []
      }
      import_documents: {
        Row: {
          category: string
          created_at: string | null
          file_name: string
          file_path: string
          file_size: number | null
          file_type: string | null
          id: string
          notes: string | null
          order_id: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          file_type?: string | null
          id?: string
          notes?: string | null
          order_id?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      import_order_driver_assignments: {
        Row: {
          created_at: string | null
          customer_names: string[]
          distribution_customer_ids: string[] | null
          driver_id: string | null
          driver_name: string
          id: string
          include_distribution: boolean | null
          order_id: string
          sequence_number: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_names?: string[]
          distribution_customer_ids?: string[] | null
          driver_id?: string | null
          driver_name: string
          id?: string
          include_distribution?: boolean | null
          order_id: string
          sequence_number?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_names?: string[]
          distribution_customer_ids?: string[] | null
          driver_id?: string | null
          driver_name?: string
          id?: string
          include_distribution?: boolean | null
          order_id?: string
          sequence_number?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_order_driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_order_driver_assignments_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_order_driver_assignments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
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
      market_news_cache: {
        Row: {
          affected_products: string[] | null
          affected_suppliers: string[] | null
          ai_action_items: Json | null
          ai_recommendation: string | null
          country_code: string | null
          created_at: string | null
          expires_at: string | null
          fetched_at: string | null
          financial_impact_direction: string | null
          financial_impact_estimate: number | null
          headline: string
          id: string
          impact_level: string | null
          impact_type: string | null
          published_at: string | null
          source_name: string | null
          source_url: string | null
          summary: string | null
        }
        Insert: {
          affected_products?: string[] | null
          affected_suppliers?: string[] | null
          ai_action_items?: Json | null
          ai_recommendation?: string | null
          country_code?: string | null
          created_at?: string | null
          expires_at?: string | null
          fetched_at?: string | null
          financial_impact_direction?: string | null
          financial_impact_estimate?: number | null
          headline: string
          id?: string
          impact_level?: string | null
          impact_type?: string | null
          published_at?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
        }
        Update: {
          affected_products?: string[] | null
          affected_suppliers?: string[] | null
          ai_action_items?: Json | null
          ai_recommendation?: string | null
          country_code?: string | null
          created_at?: string | null
          expires_at?: string | null
          fetched_at?: string | null
          financial_impact_direction?: string | null
          financial_impact_estimate?: number | null
          headline?: string
          id?: string
          impact_level?: string | null
          impact_type?: string | null
          published_at?: string | null
          source_name?: string | null
          source_url?: string | null
          summary?: string | null
        }
        Relationships: []
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
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          expires_at: string | null
          id: string
          message: string
          metadata: Json | null
          read_at: string | null
          related_entity_id: string | null
          related_entity_type: string | null
          severity: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message: string
          metadata?: Json | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          read_at?: string | null
          related_entity_id?: string | null
          related_entity_type?: string | null
          severity?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          customer_name: string
          customer_notes: string | null
          id: string
          is_from_stock: boolean | null
          order_id: string
          po_number: string | null
          product_code: string
          quantity: number
          sale_price_xcg: number | null
          stock_quantity: number | null
          supplier_cost_usd_per_case: number | null
          units_quantity: number | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          customer_notes?: string | null
          id?: string
          is_from_stock?: boolean | null
          order_id: string
          po_number?: string | null
          product_code: string
          quantity?: number
          sale_price_xcg?: number | null
          stock_quantity?: number | null
          supplier_cost_usd_per_case?: number | null
          units_quantity?: number | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          customer_notes?: string | null
          id?: string
          is_from_stock?: boolean | null
          order_id?: string
          po_number?: string | null
          product_code?: string
          quantity?: number
          sale_price_xcg?: number | null
          stock_quantity?: number | null
          supplier_cost_usd_per_case?: number | null
          units_quantity?: number | null
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
          fx_rate_usd_to_xcg_snapshot: number | null
          id: string
          notes: string | null
          order_number: string
          placed_by: string
          settings_overrides_json: Json | null
          status: string
          updated_at: string
          user_id: string | null
          week_number: number
        }
        Insert: {
          created_at?: string
          delivery_date: string
          fx_rate_usd_to_xcg_snapshot?: number | null
          id?: string
          notes?: string | null
          order_number: string
          placed_by: string
          settings_overrides_json?: Json | null
          status?: string
          updated_at?: string
          user_id?: string | null
          week_number: number
        }
        Update: {
          created_at?: string
          delivery_date?: string
          fx_rate_usd_to_xcg_snapshot?: number | null
          id?: string
          notes?: string | null
          order_number?: string
          placed_by?: string
          settings_overrides_json?: Json | null
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
      product_supplier_prices: {
        Row: {
          cost_price_usd: number
          cost_price_xcg: number
          created_at: string
          id: string
          lead_time_days: number | null
          min_order_qty: number | null
          notes: string | null
          product_id: string
          supplier_id: string
          updated_at: string
        }
        Insert: {
          cost_price_usd?: number
          cost_price_xcg?: number
          created_at?: string
          id?: string
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          product_id: string
          supplier_id: string
          updated_at?: string
        }
        Update: {
          cost_price_usd?: number
          cost_price_xcg?: number
          created_at?: string
          id?: string
          lead_time_days?: number | null
          min_order_qty?: number | null
          notes?: string | null
          product_id?: string
          supplier_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_supplier_prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_supplier_prices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
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
          default_portal: string | null
          email: string
          full_name: string | null
          id: string
          is_fuik_team: boolean | null
          must_change_password: boolean | null
          notification_preferences: Json | null
          team_role: string | null
          updated_at: string
          whatsapp_phone: string | null
        }
        Insert: {
          created_at?: string
          default_portal?: string | null
          email: string
          full_name?: string | null
          id: string
          is_fuik_team?: boolean | null
          must_change_password?: boolean | null
          notification_preferences?: Json | null
          team_role?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Update: {
          created_at?: string
          default_portal?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_fuik_team?: boolean | null
          must_change_password?: boolean | null
          notification_preferences?: Json | null
          team_role?: string | null
          updated_at?: string
          whatsapp_phone?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string | null
          device_info: Json | null
          endpoint: string
          expires_at: string | null
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string | null
          device_info?: Json | null
          endpoint: string
          expires_at?: string | null
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string | null
          device_info?: Json | null
          endpoint?: string
          expires_at?: string | null
          id?: string
          p256dh?: string
          user_id?: string
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
      quickbooks_tokens: {
        Row: {
          access_token: string
          created_at: string | null
          expires_at: string
          id: string
          is_sandbox: boolean | null
          realm_id: string
          refresh_token: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          created_at?: string | null
          expires_at: string
          id?: string
          is_sandbox?: boolean | null
          realm_id: string
          refresh_token: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          created_at?: string | null
          expires_at?: string
          id?: string
          is_sandbox?: boolean | null
          realm_id?: string
          refresh_token?: string
          updated_at?: string | null
        }
        Relationships: []
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
      report_executions: {
        Row: {
          error_message: string | null
          executed_at: string | null
          execution_time_ms: number | null
          file_format: string | null
          file_size_bytes: number | null
          file_url: string | null
          id: string
          metadata: Json | null
          parameters: Json | null
          recipients_sent: string[] | null
          report_id: string | null
          result_data: Json | null
          status: string
        }
        Insert: {
          error_message?: string | null
          executed_at?: string | null
          execution_time_ms?: number | null
          file_format?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          parameters?: Json | null
          recipients_sent?: string[] | null
          report_id?: string | null
          result_data?: Json | null
          status: string
        }
        Update: {
          error_message?: string | null
          executed_at?: string | null
          execution_time_ms?: number | null
          file_format?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          id?: string
          metadata?: Json | null
          parameters?: Json | null
          recipients_sent?: string[] | null
          report_id?: string | null
          result_data?: Json | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_executions_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "scheduled_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          config: Json
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          template_type: string
          updated_at: string | null
        }
        Insert: {
          config: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          template_type: string
          updated_at?: string | null
        }
        Update: {
          config?: Json
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          template_type?: string
          updated_at?: string | null
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
      scheduled_reports: {
        Row: {
          chart_config: Json | null
          created_at: string | null
          created_by: string | null
          description: string | null
          filters: Json | null
          id: string
          is_active: boolean | null
          last_error: string | null
          last_run_at: string | null
          last_run_status: string | null
          name: string
          next_run_at: string | null
          recipients: string[] | null
          report_type: string
          schedule_cron: string
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          chart_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          name: string
          next_run_at?: string | null
          recipients?: string[] | null
          report_type: string
          schedule_cron: string
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          chart_config?: Json | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          filters?: Json | null
          id?: string
          is_active?: boolean | null
          last_error?: string | null
          last_run_at?: string | null
          last_run_status?: string | null
          name?: string
          next_run_at?: string | null
          recipients?: string[] | null
          report_type?: string
          schedule_cron?: string
          timezone?: string | null
          updated_at?: string | null
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
      supplier_cost_config: {
        Row: {
          created_at: string | null
          fixed_cost_per_shipment_usd: number | null
          handling_notes: string | null
          id: string
          is_active: boolean | null
          supplier_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          fixed_cost_per_shipment_usd?: number | null
          handling_notes?: string | null
          id?: string
          is_active?: boolean | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          fixed_cost_per_shipment_usd?: number | null
          handling_notes?: string | null
          id?: string
          is_active?: boolean | null
          supplier_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_cost_config_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: true
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
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
          currency_default: string | null
          email: string | null
          id: string
          incoterms_default: string | null
          lead_time_days: number | null
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
          currency_default?: string | null
          email?: string | null
          id?: string
          incoterms_default?: string | null
          lead_time_days?: number | null
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
          currency_default?: string | null
          email?: string | null
          id?: string
          incoterms_default?: string | null
          lead_time_days?: number | null
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
      team_notification_settings: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          is_active: boolean | null
          notify_on_complaints: boolean | null
          notify_on_escalations: boolean | null
          notify_on_new_orders: boolean | null
          role: string | null
          updated_at: string | null
          user_id: string | null
          whatsapp_phone: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          notify_on_complaints?: boolean | null
          notify_on_escalations?: boolean | null
          notify_on_new_orders?: boolean | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_phone: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          is_active?: boolean | null
          notify_on_complaints?: boolean | null
          notify_on_escalations?: boolean | null
          notify_on_new_orders?: boolean | null
          role?: string | null
          updated_at?: string | null
          user_id?: string | null
          whatsapp_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_notification_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      time_entries: {
        Row: {
          approved_by: string | null
          break_minutes: number | null
          break_started_at: string | null
          clock_in: string
          clock_in_photo_url: string | null
          clock_out: string | null
          clock_out_photo_url: string | null
          created_at: string | null
          employee_id: string
          id: string
          location_lat: number | null
          location_lng: number | null
          notes: string | null
          status: string | null
        }
        Insert: {
          approved_by?: string | null
          break_minutes?: number | null
          break_started_at?: string | null
          clock_in: string
          clock_in_photo_url?: string | null
          clock_out?: string | null
          clock_out_photo_url?: string | null
          created_at?: string | null
          employee_id: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status?: string | null
        }
        Update: {
          approved_by?: string | null
          break_minutes?: number | null
          break_started_at?: string | null
          clock_in?: string
          clock_in_photo_url?: string | null
          clock_out?: string | null
          clock_out_photo_url?: string | null
          created_at?: string | null
          employee_id?: string
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          notes?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "time_entries_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
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
          {
            foreignKeyName: "user_activity_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
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
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
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
      webhook_configs: {
        Row: {
          created_at: string
          created_by: string | null
          events: string[]
          headers: Json | null
          id: string
          is_active: boolean
          last_triggered_at: string | null
          name: string
          retry_count: number
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name: string
          retry_count?: number
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          events?: string[]
          headers?: Json | null
          id?: string
          is_active?: boolean
          last_triggered_at?: string | null
          name?: string
          retry_count?: number
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: []
      }
      webhook_logs: {
        Row: {
          attempt_number: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          event_type: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          webhook_id: string
        }
        Insert: {
          attempt_number?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id: string
        }
        Update: {
          attempt_number?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          event_type?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhook_configs"
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
      whatsapp_conversation_notes: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          is_pinned: boolean
          note_text: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          note_text: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          is_pinned?: boolean
          note_text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          assigned_to: string | null
          created_at: string
          customer_id: string | null
          customer_name: string | null
          detected_language: string | null
          detected_mood: string | null
          id: string
          is_taken_over: boolean
          last_activity_at: string | null
          last_message_direction: string | null
          last_message_text: string | null
          phone_number: string
          priority: string
          status: string
          taken_over_at: string | null
          takeover_reason: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          detected_language?: string | null
          detected_mood?: string | null
          id?: string
          is_taken_over?: boolean
          last_activity_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          phone_number: string
          priority?: string
          status?: string
          taken_over_at?: string | null
          takeover_reason?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          customer_id?: string | null
          customer_name?: string | null
          detected_language?: string | null
          detected_mood?: string | null
          id?: string
          is_taken_over?: boolean
          last_activity_at?: string | null
          last_message_direction?: string | null
          last_message_text?: string | null
          phone_number?: string
          priority?: string
          status?: string
          taken_over_at?: string | null
          takeover_reason?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_health_checks: {
        Row: {
          check_type: string
          created_at: string
          error_code: string | null
          error_message: string | null
          id: string
          phone_number_status: string | null
          response_time_ms: number | null
          status: string
          token_valid: boolean | null
        }
        Insert: {
          check_type?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          phone_number_status?: string | null
          response_time_ms?: number | null
          status: string
          token_valid?: boolean | null
        }
        Update: {
          check_type?: string
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          phone_number_status?: string | null
          response_time_ms?: number | null
          status?: string
          token_valid?: boolean | null
        }
        Relationships: []
      }
      whatsapp_message_templates: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean | null
          is_approved: boolean | null
          language: string
          last_used_at: string | null
          meta_template_name: string
          preview_text: string
          purpose: string
          template_name: string
          updated_at: string
          usage_count: number | null
          variables: Json | null
        }
        Insert: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          language?: string
          last_used_at?: string | null
          meta_template_name: string
          preview_text: string
          purpose: string
          template_name: string
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean | null
          is_approved?: boolean | null
          language?: string
          last_used_at?: string | null
          meta_template_name?: string
          preview_text?: string
          purpose?: string
          template_name?: string
          updated_at?: string
          usage_count?: number | null
          variables?: Json | null
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          created_at: string
          customer_id: string | null
          detected_intent: string | null
          detected_mood: string | null
          direction: string
          error_message: string | null
          id: string
          is_human_response: boolean | null
          message_id: string | null
          message_text: string | null
          message_type: string
          metadata: Json | null
          order_id: string | null
          phone_number: string
          read_at: string | null
          read_by: string | null
          sent_by_user_id: string | null
          status: string
        }
        Insert: {
          created_at?: string
          customer_id?: string | null
          detected_intent?: string | null
          detected_mood?: string | null
          direction: string
          error_message?: string | null
          id?: string
          is_human_response?: boolean | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string
          metadata?: Json | null
          order_id?: string | null
          phone_number: string
          read_at?: string | null
          read_by?: string | null
          sent_by_user_id?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          customer_id?: string | null
          detected_intent?: string | null
          detected_mood?: string | null
          direction?: string
          error_message?: string | null
          id?: string
          is_human_response?: boolean | null
          message_id?: string | null
          message_text?: string | null
          message_type?: string
          metadata?: Json | null
          order_id?: string | null
          phone_number?: string
          read_at?: string | null
          read_by?: string | null
          sent_by_user_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "distribution_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_read_by_fkey"
            columns: ["read_by"]
            isOneToOne: false
            referencedRelation: "profiles_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_template_sends: {
        Row: {
          customer_id: string | null
          error_message: string | null
          id: string
          message_id: string | null
          phone_number: string
          sent_at: string
          status: string | null
          template_id: string | null
          variables_used: Json | null
        }
        Insert: {
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          phone_number: string
          sent_at?: string
          status?: string | null
          template_id?: string | null
          variables_used?: Json | null
        }
        Update: {
          customer_id?: string | null
          error_message?: string | null
          id?: string
          message_id?: string | null
          phone_number?: string
          sent_at?: string
          status?: string | null
          template_id?: string | null
          variables_used?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_template_sends_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "distribution_customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_template_sends_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_message_templates"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      profiles_directory: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_permission: {
        Args: { _action: string; _resource: string }
        Returns: boolean
      }
      claim_initial_admin: { Args: never; Returns: undefined }
      generate_receipt_number: { Args: never; Returns: string }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_cif_edit_role: { Args: { _user_id: string }; Returns: boolean }
      has_cif_view_role: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      merge_distribution_customers: {
        Args: { primary_id: string; secondary_id: string }
        Returns: undefined
      }
      update_user_roles: {
        Args: {
          new_roles: Database["public"]["Enums"]["app_role"][]
          target_user_id: string
        }
        Returns: undefined
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
        | "hr"
        | "interim"
        | "import"
        | "finance"
        | "sales"
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
        "hr",
        "interim",
        "import",
        "finance",
        "sales",
      ],
      customer_type: ["regular", "supermarket", "cod", "credit"],
      payment_method_type: ["cash", "swipe", "transfer", "credit"],
    },
  },
} as const
