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
    PostgrestVersion: "14.18"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      technician_trunk_inventory: {
        Row: {
          id: string
          technician_id: string
          spare_part_id: string
          quantity_on_hand: number
          quantity_reserved: number
          min_trunk_threshold: number
          last_reconciled_at: string | null
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          technician_id: string
          spare_part_id: string
          quantity_on_hand?: number
          quantity_reserved?: number
          min_trunk_threshold?: number
          last_reconciled_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          technician_id?: string
          spare_part_id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          min_trunk_threshold?: number
          last_reconciled_at?: string | null
          updated_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_trunk_inventory_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_trunk_inventory_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      technician_trunk_movements: {
        Row: {
          id: string
          technician_id: string
          spare_part_id: string
          movement_type: string
          quantity: number
          balance_before: number
          balance_after: number
          warehouse_id: string | null
          service_ticket_id: string | null
          service_visit_id: string | null
          reconciliation_id: string | null
          reason: string
          idempotency_key: string | null
          performed_by: string
          created_at: string
        }
        Insert: {
          id?: string
          technician_id: string
          spare_part_id: string
          movement_type: string
          quantity: number
          balance_before: number
          balance_after: number
          warehouse_id?: string | null
          service_ticket_id?: string | null
          service_visit_id?: string | null
          reconciliation_id?: string | null
          reason: string
          idempotency_key?: string | null
          performed_by: string
          created_at?: string
        }
        Update: {
          id?: string
          technician_id?: string
          spare_part_id?: string
          movement_type?: string
          quantity?: number
          balance_before?: number
          balance_after?: number
          warehouse_id?: string | null
          service_ticket_id?: string | null
          service_visit_id?: string | null
          reconciliation_id?: string | null
          reason?: string
          idempotency_key?: string | null
          performed_by?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_trunk_movements_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_trunk_movements_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      technician_van_reconciliations: {
        Row: {
          id: string
          reconciliation_number: string
          technician_id: string
          total_items_counted: number
          discrepancy_count: number
          status: string
          technician_notes: string | null
          review_notes: string | null
          reviewed_by: string | null
          reviewed_at: string | null
          submitted_at: string
          created_at: string
        }
        Insert: {
          id?: string
          reconciliation_number: string
          technician_id: string
          total_items_counted?: number
          discrepancy_count?: number
          status?: string
          technician_notes?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          reconciliation_number?: string
          technician_id?: string
          total_items_counted?: number
          discrepancy_count?: number
          status?: string
          technician_notes?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          reviewed_at?: string | null
          submitted_at?: string
          created_at?: string
        }
        Relationships: []
      }
      technician_van_reconciliation_lines: {
        Row: {
          id: string
          reconciliation_id: string
          spare_part_id: string
          system_quantity: number
          physical_count: number
          variance: number
          reason: string | null
          created_at: string
        }
        Insert: {
          id?: string
          reconciliation_id: string
          spare_part_id: string
          system_quantity: number
          physical_count: number
          variance: number
          reason?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          reconciliation_id?: string
          spare_part_id?: string
          system_quantity?: number
          physical_count?: number
          variance?: number
          reason?: string | null
          created_at?: string
        }
        Relationships: []
      }
      technician_defective_cores: {
        Row: {
          id: string
          core_tag_number: string
          technician_id: string
          service_ticket_id: string | null
          service_visit_id: string | null
          item_type: 'SPARE_PART_CORE' | 'WHOLE_TV_UNIT'
          spare_part_id: string | null
          product_unit_id: string | null
          serial_number: string | null
          barcode: string | null
          defect_symptom: string
          custody_status: string
          harvested_at: string
          quarantine_warehouse_id: string | null
          quarantine_notes: string | null
          core_credit_amount: number
          is_warranty_covered: boolean
          idempotency_key: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          core_tag_number: string
          technician_id: string
          service_ticket_id?: string | null
          service_visit_id?: string | null
          item_type: 'SPARE_PART_CORE' | 'WHOLE_TV_UNIT'
          spare_part_id?: string | null
          product_unit_id?: string | null
          serial_number?: string | null
          barcode?: string | null
          defect_symptom: string
          custody_status?: string
          harvested_at?: string
          quarantine_warehouse_id?: string | null
          quarantine_notes?: string | null
          core_credit_amount?: number
          is_warranty_covered?: boolean
          idempotency_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          core_tag_number?: string
          technician_id?: string
          service_ticket_id?: string | null
          service_visit_id?: string | null
          item_type?: 'SPARE_PART_CORE' | 'WHOLE_TV_UNIT'
          spare_part_id?: string | null
          product_unit_id?: string | null
          serial_number?: string | null
          barcode?: string | null
          defect_symptom?: string
          custody_status?: string
          harvested_at?: string
          quarantine_warehouse_id?: string | null
          quarantine_notes?: string | null
          core_credit_amount?: number
          is_warranty_covered?: boolean
          idempotency_key?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_defective_cores_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_defective_cores_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_defective_cores_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          }
        ]
      }
      rma_reverse_manifests: {
        Row: {
          id: string
          manifest_number: string
          technician_id: string
          destination_warehouse_id: string
          status: string
          total_items_count: number
          received_items_count: number
          discrepant_items_count: number
          carrier_tracking_number: string | null
          technician_notes: string | null
          warehouse_intake_notes: string | null
          dispatched_at: string | null
          received_at: string | null
          reconciled_at: string | null
          received_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          manifest_number: string
          technician_id: string
          destination_warehouse_id: string
          status?: string
          total_items_count?: number
          received_items_count?: number
          discrepant_items_count?: number
          carrier_tracking_number?: string | null
          technician_notes?: string | null
          warehouse_intake_notes?: string | null
          dispatched_at?: string | null
          received_at?: string | null
          reconciled_at?: string | null
          received_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          manifest_number?: string
          technician_id?: string
          destination_warehouse_id?: string
          status?: string
          total_items_count?: number
          received_items_count?: number
          discrepant_items_count?: number
          carrier_tracking_number?: string | null
          technician_notes?: string | null
          warehouse_intake_notes?: string | null
          dispatched_at?: string | null
          received_at?: string | null
          reconciled_at?: string | null
          received_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rma_reverse_manifests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rma_reverse_manifests_destination_warehouse_id_fkey"
            columns: ["destination_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          }
        ]
      }
      rma_reverse_manifest_items: {
        Row: {
          id: string
          manifest_id: string
          defective_core_id: string
          item_status: string
          received_condition: string | null
          received_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          manifest_id: string
          defective_core_id: string
          item_status?: string
          received_condition?: string | null
          received_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          manifest_id?: string
          defective_core_id?: string
          item_status?: string
          received_condition?: string | null
          received_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rma_reverse_manifest_items_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "rma_reverse_manifests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rma_reverse_manifest_items_defective_core_id_fkey"
            columns: ["defective_core_id"]
            isOneToOne: false
            referencedRelation: "technician_defective_cores"
            referencedColumns: ["id"]
          }
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      communication_logs: {
        Row: {
          channel: string
          created_at: string | null
          created_by: string | null
          customer_id: string | null
          delivered_at: string | null
          failure_reason: string | null
          id: string
          message_body: string
          message_type: string
          product_unit_id: string | null
          provider_message_id: string | null
          provider_name: string | null
          recipient: string
          sale_id: string | null
          sales_return_id: string | null
          sent_at: string | null
          service_ticket_id: string | null
          status: string
          subject: string | null
          template_id: string | null
          updated_at: string | null
          warranty_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          message_body: string
          message_type: string
          product_unit_id?: string | null
          provider_message_id?: string | null
          provider_name?: string | null
          recipient: string
          sale_id?: string | null
          sales_return_id?: string | null
          sent_at?: string | null
          service_ticket_id?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
          warranty_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          created_by?: string | null
          customer_id?: string | null
          delivered_at?: string | null
          failure_reason?: string | null
          id?: string
          message_body?: string
          message_type?: string
          product_unit_id?: string | null
          provider_message_id?: string | null
          provider_name?: string | null
          recipient?: string
          sale_id?: string | null
          sales_return_id?: string | null
          sent_at?: string | null
          service_ticket_id?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
          updated_at?: string | null
          warranty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "communication_logs_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_sales_return_id_fkey"
            columns: ["sales_return_id"]
            isOneToOne: false
            referencedRelation: "sales_returns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "communication_logs_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "communication_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "communication_logs_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      communication_templates: {
        Row: {
          channel: string
          created_at: string | null
          event_type: string
          id: string
          is_active: boolean
          message_body: string
          subject: string | null
          template_key: string
          template_name: string
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          event_type: string
          id?: string
          is_active?: boolean
          message_body: string
          subject?: string | null
          template_key: string
          template_name: string
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          event_type?: string
          id?: string
          is_active?: boolean
          message_body?: string
          subject?: string | null
          template_key?: string
          template_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      customer_communication_preferences: {
        Row: {
          created_at: string | null
          customer_id: string
          email_enabled: boolean
          id: string
          invoice_updates_enabled: boolean
          rma_updates_enabled: boolean
          service_updates_enabled: boolean
          sms_enabled: boolean
          updated_at: string | null
          warranty_updates_enabled: boolean
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string | null
          customer_id: string
          email_enabled?: boolean
          id?: string
          invoice_updates_enabled?: boolean
          rma_updates_enabled?: boolean
          service_updates_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string | null
          warranty_updates_enabled?: boolean
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string | null
          customer_id?: string
          email_enabled?: boolean
          id?: string
          invoice_updates_enabled?: boolean
          rma_updates_enabled?: boolean
          service_updates_enabled?: boolean
          sms_enabled?: boolean
          updated_at?: string | null
          warranty_updates_enabled?: boolean
          whatsapp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "customer_communication_preferences_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          created_at: string
          customer_code: string
          email: string | null
          full_name: string
          id: string
          is_active: boolean
          notes: string | null
          phone: string
          postal_code: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          customer_code: string
          email?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          created_at?: string
          customer_code?: string
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          phone?: string
          postal_code?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      dealer_consignment_movements: {
        Row: {
          consignment_id: string | null
          created_at: string | null
          dealer_id: string
          id: string
          movement_type: string
          new_consignment_status: string | null
          new_ownership_type: string | null
          notes: string | null
          performed_by: string | null
          previous_consignment_status: string | null
          previous_ownership_type: string | null
          product_unit_id: string
          reason: string | null
          reference_number: string | null
        }
        Insert: {
          consignment_id?: string | null
          created_at?: string | null
          dealer_id: string
          id?: string
          movement_type: string
          new_consignment_status?: string | null
          new_ownership_type?: string | null
          notes?: string | null
          performed_by?: string | null
          previous_consignment_status?: string | null
          previous_ownership_type?: string | null
          product_unit_id: string
          reason?: string | null
          reference_number?: string | null
        }
        Update: {
          consignment_id?: string | null
          created_at?: string | null
          dealer_id?: string
          id?: string
          movement_type?: string
          new_consignment_status?: string | null
          new_ownership_type?: string | null
          notes?: string | null
          performed_by?: string | null
          previous_consignment_status?: string | null
          previous_ownership_type?: string | null
          product_unit_id?: string
          reason?: string | null
          reference_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "dealer_consignment_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_aging"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_inventory"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_reconciliation"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      dealer_consignment_stock: {
        Row: {
          consignment_status: string
          created_at: string | null
          dealer_id: string
          discrepancy_notes: string | null
          discrepancy_reason: string | null
          dispatched_at: string
          dispatched_by: string | null
          from_warehouse_id: string | null
          id: string
          notes: string | null
          ownership_type: string
          product_unit_id: string
          recalled_at: string | null
          received_at: string | null
          received_by: string | null
          returned_at: string | null
          settlement_date: string | null
          settlement_reference: string | null
          settlement_status: string
          sold_at: string | null
          updated_at: string | null
        }
        Insert: {
          consignment_status?: string
          created_at?: string | null
          dealer_id: string
          discrepancy_notes?: string | null
          discrepancy_reason?: string | null
          dispatched_at?: string
          dispatched_by?: string | null
          from_warehouse_id?: string | null
          id?: string
          notes?: string | null
          ownership_type?: string
          product_unit_id: string
          recalled_at?: string | null
          received_at?: string | null
          received_by?: string | null
          returned_at?: string | null
          settlement_date?: string | null
          settlement_reference?: string | null
          settlement_status?: string
          sold_at?: string | null
          updated_at?: string | null
        }
        Update: {
          consignment_status?: string
          created_at?: string | null
          dealer_id?: string
          discrepancy_notes?: string | null
          discrepancy_reason?: string | null
          dispatched_at?: string
          dispatched_by?: string | null
          from_warehouse_id?: string | null
          id?: string
          notes?: string | null
          ownership_type?: string
          product_unit_id?: string
          recalled_at?: string | null
          received_at?: string | null
          received_by?: string | null
          returned_at?: string | null
          settlement_date?: string | null
          settlement_reference?: string | null
          settlement_status?: string
          sold_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dispatched_by_fkey"
            columns: ["dispatched_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: true
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dealers: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string
          credit_limit: number
          dealer_code: string
          dealer_name: string
          dealer_type: string
          email: string | null
          gst_number: string | null
          id: string
          is_active: boolean
          legal_name: string | null
          notes: string | null
          payment_terms: string | null
          phone: string | null
          pincode: string | null
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number
          dealer_code: string
          dealer_name: string
          dealer_type?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string
          credit_limit?: number
          dealer_code?: string
          dealer_name?: string
          dealer_type?: string
          email?: string | null
          gst_number?: string | null
          id?: string
          is_active?: boolean
          legal_name?: string | null
          notes?: string | null
          payment_terms?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      inventory_transactions: {
        Row: {
          created_at: string
          from_warehouse_id: string | null
          id: string
          movement_reason: string | null
          new_status: string
          performed_by: string | null
          previous_status: string | null
          product_unit_id: string
          reference_note: string | null
          to_warehouse_id: string | null
          transaction_type: string
        }
        Insert: {
          created_at?: string
          from_warehouse_id?: string | null
          id?: string
          movement_reason?: string | null
          new_status: string
          performed_by?: string | null
          previous_status?: string | null
          product_unit_id: string
          reference_note?: string | null
          to_warehouse_id?: string | null
          transaction_type: string
        }
        Update: {
          created_at?: string
          from_warehouse_id?: string | null
          id?: string
          movement_reason?: string | null
          new_status?: string
          performed_by?: string | null
          previous_status?: string | null
          product_unit_id?: string
          reference_note?: string | null
          to_warehouse_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transactions_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_transactions_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_transactions_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transactions_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_transactions_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "inventory_transactions_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      media_attachments: {
        Row: {
          attachment_type: string
          customer_id: string | null
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          original_file_name: string
          product_unit_id: string | null
          sale_id: string | null
          service_ticket_id: string | null
          service_update_id: string | null
          service_visit_id: string | null
          storage_bucket: string
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
          warranty_id: string | null
        }
        Insert: {
          attachment_type: string
          customer_id?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_file_name: string
          product_unit_id?: string | null
          sale_id?: string | null
          service_ticket_id?: string | null
          service_update_id?: string | null
          service_visit_id?: string | null
          storage_bucket?: string
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
          warranty_id?: string | null
        }
        Update: {
          attachment_type?: string
          customer_id?: string | null
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          original_file_name?: string
          product_unit_id?: string | null
          sale_id?: string | null
          service_ticket_id?: string | null
          service_update_id?: string | null
          service_visit_id?: string | null
          storage_bucket?: string
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
          warranty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_attachments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "media_attachments_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_service_update_id_fkey"
            columns: ["service_update_id"]
            isOneToOne: false
            referencedRelation: "service_updates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_service_visit_id_fkey"
            columns: ["service_visit_id"]
            isOneToOne: false
            referencedRelation: "service_visits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_attachments_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          inventory_enabled: boolean
          rma_enabled: boolean
          sales_enabled: boolean
          service_enabled: boolean
          sms_enabled: boolean
          spare_parts_enabled: boolean
          updated_at: string
          user_id: string
          warranty_enabled: boolean
          whatsapp_enabled: boolean
        }
        Insert: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          inventory_enabled?: boolean
          rma_enabled?: boolean
          sales_enabled?: boolean
          service_enabled?: boolean
          sms_enabled?: boolean
          spare_parts_enabled?: boolean
          updated_at?: string
          user_id: string
          warranty_enabled?: boolean
          whatsapp_enabled?: boolean
        }
        Update: {
          created_at?: string
          email_enabled?: boolean
          id?: string
          in_app_enabled?: boolean
          inventory_enabled?: boolean
          rma_enabled?: boolean
          sales_enabled?: boolean
          service_enabled?: boolean
          sms_enabled?: boolean
          spare_parts_enabled?: boolean
          updated_at?: string
          user_id?: string
          warranty_enabled?: boolean
          whatsapp_enabled?: boolean
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_url: string | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          message: string
          notification_type: string
          read_at: string | null
          recipient_user_id: string
          severity: string
          title: string
        }
        Insert: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message: string
          notification_type: string
          read_at?: string | null
          recipient_user_id: string
          severity?: string
          title: string
        }
        Update: {
          action_url?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          message?: string
          notification_type?: string
          read_at?: string | null
          recipient_user_id?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          notes: string | null
          paid_at: string | null
          payment_method: string
          payment_reference: string | null
          payment_status: string
          sale_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method: string
          payment_reference?: string | null
          payment_status?: string
          sale_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          notes?: string | null
          paid_at?: string | null
          payment_method?: string
          payment_reference?: string | null
          payment_status?: string
          sale_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      product_models: {
        Row: {
          brand_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model_code: string
          model_name: string
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model_code: string
          model_name: string
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model_code?: string
          model_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_models_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
      }
      product_units: {
        Row: {
          barcode: string
          created_at: string
          dealer_id: string | null
          id: string
          notes: string | null
          ownership_type: string
          purchase_cost: number | null
          received_at: string
          serial_number: string
          sold_at: string | null
          status: string
          updated_at: string
          variant_id: string
          warehouse_id: string | null
        }
        Insert: {
          barcode: string
          created_at?: string
          dealer_id?: string | null
          id?: string
          notes?: string | null
          ownership_type?: string
          purchase_cost?: number | null
          received_at?: string
          serial_number: string
          sold_at?: string | null
          status?: string
          updated_at?: string
          variant_id: string
          warehouse_id?: string | null
        }
        Update: {
          barcode?: string
          created_at?: string
          dealer_id?: string | null
          id?: string
          notes?: string | null
          ownership_type?: string
          purchase_cost?: number | null
          received_at?: string
          serial_number?: string
          sold_at?: string | null
          status?: string
          updated_at?: string
          variant_id?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "product_units_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "product_units_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_units_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_units_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "sales_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_units_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "product_units_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["product_variant_id"]
          },
          {
            foreignKeyName: "product_units_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "product_units_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "product_units_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          bluetooth: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          model_id: string
          product_code: string
          product_name: string
          screen_size: number
          tv_type: string
          updated_at: string
          voice_remote: boolean
        }
        Insert: {
          bluetooth?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model_id: string
          product_code: string
          product_name: string
          screen_size: number
          tv_type: string
          updated_at?: string
          voice_remote?: boolean
        }
        Update: {
          bluetooth?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          model_id?: string
          product_code?: string
          product_name?: string
          screen_size?: number
          tv_type?: string
          updated_at?: string
          voice_remote?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "product_models"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          dealer_id: string | null
          employee_code: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          dealer_id?: string | null
          employee_code?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          dealer_id?: string | null
          employee_code?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "profiles_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_order_items: {
        Row: {
          created_at: string
          id: string
          line_total: number
          notes: string | null
          ordered_quantity: number
          product_variant_id: string
          purchase_order_id: string
          received_quantity: number
          tax_amount: number
          tax_rate: number
          unit_cost: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          line_total?: number
          notes?: string | null
          ordered_quantity: number
          product_variant_id: string
          purchase_order_id: string
          received_quantity?: number
          tax_amount?: number
          tax_rate?: number
          unit_cost: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          line_total?: number
          notes?: string | null
          ordered_quantity?: number
          product_variant_id?: string
          purchase_order_id?: string
          received_quantity?: number
          tax_amount?: number
          tax_rate?: number
          unit_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "sales_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["product_variant_id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["purchase_order_id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cancellation_reason: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          created_at: string
          created_by: string | null
          currency: string
          expected_delivery_date: string | null
          id: string
          notes: string | null
          po_date: string
          po_number: string
          status: string
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
          vendor_id: string
          warehouse_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id: string
          warehouse_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cancellation_reason?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          po_date?: string
          po_number?: string
          status?: string
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
          vendor_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_orders_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_receiving_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "purchase_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipt_items: {
        Row: {
          accepted_quantity: number
          created_at: string
          expected_quantity: number
          id: string
          notes: string | null
          product_variant_id: string
          purchase_order_item_id: string
          purchase_receipt_id: string
          received_quantity: number
          rejected_quantity: number
          rejection_reason: string | null
          updated_at: string
        }
        Insert: {
          accepted_quantity?: number
          created_at?: string
          expected_quantity?: number
          id?: string
          notes?: string | null
          product_variant_id: string
          purchase_order_item_id: string
          purchase_receipt_id: string
          received_quantity?: number
          rejected_quantity?: number
          rejection_reason?: string | null
          updated_at?: string
        }
        Update: {
          accepted_quantity?: number
          created_at?: string
          expected_quantity?: number
          id?: string
          notes?: string | null
          product_variant_id?: string
          purchase_order_item_id?: string
          purchase_receipt_id?: string
          received_quantity?: number
          rejected_quantity?: number
          rejection_reason?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipt_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "sales_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_product_variant_id_fkey"
            columns: ["product_variant_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["product_variant_id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_purchase_order_item_id_fkey"
            columns: ["purchase_order_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipt_items_purchase_receipt_id_fkey"
            columns: ["purchase_receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_receipts: {
        Row: {
          created_at: string
          delivery_note_number: string | null
          id: string
          notes: string | null
          purchase_order_id: string
          receipt_number: string
          received_at: string
          received_by: string | null
          status: string
          updated_at: string
          vendor_id: string
          vendor_invoice_reference: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          delivery_note_number?: string | null
          id?: string
          notes?: string | null
          purchase_order_id: string
          receipt_number: string
          received_at?: string
          received_by?: string | null
          status?: string
          updated_at?: string
          vendor_id: string
          vendor_invoice_reference?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string
          delivery_note_number?: string | null
          id?: string
          notes?: string | null
          purchase_order_id?: string
          receipt_number?: string
          received_at?: string
          received_by?: string | null
          status?: string
          updated_at?: string
          vendor_id?: string
          vendor_invoice_reference?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "purchase_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_receipts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_receiving_performance"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "purchase_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "purchase_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "purchase_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          created_at: string
          discount_amount: number
          id: string
          product_unit_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount_amount?: number
          id?: string
          product_unit_id: string
          quantity?: number
          sale_id: string
          unit_price: number
        }
        Update: {
          created_at?: string
          discount_amount?: number
          id?: string
          product_unit_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string
          dealer_id: string | null
          discount_amount: number
          id: string
          notes: string | null
          payment_status: string
          sale_date: string
          sale_number: string
          sale_status: string
          sold_by: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          dealer_id?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          payment_status?: string
          sale_date?: string
          sale_number: string
          sale_status?: string
          sold_by?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          dealer_id?: string | null
          discount_amount?: number
          id?: string
          notes?: string | null
          payment_status?: string
          sale_date?: string
          sale_number?: string
          sale_status?: string
          sold_by?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_sold_by_fkey"
            columns: ["sold_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      sales_returns: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          dealer_id: string | null
          id: string
          inspection_condition: string
          notes: string | null
          outcome: string
          product_unit_id: string
          refund_amount: number
          refund_method: string
          refund_status: string
          return_number: string
          return_reason: string
          sale_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          dealer_id?: string | null
          id?: string
          inspection_condition?: string
          notes?: string | null
          outcome?: string
          product_unit_id: string
          refund_amount?: number
          refund_method?: string
          refund_status?: string
          return_number: string
          return_reason: string
          sale_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          dealer_id?: string | null
          id?: string
          inspection_condition?: string
          notes?: string | null
          outcome?: string
          product_unit_id?: string
          refund_amount?: number
          refund_method?: string
          refund_status?: string
          return_number?: string
          return_reason?: string
          sale_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_returns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_returns_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "sales_returns_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_returns_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      service_center_pincodes: {
        Row: {
          city: string | null
          created_at: string
          district: string | null
          id: string
          is_active: boolean
          pincode: string
          service_center_id: string
          state: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          is_active?: boolean
          pincode: string
          service_center_id: string
          state?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          district?: string | null
          id?: string
          is_active?: boolean
          pincode?: string
          service_center_id?: string
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_center_pincodes_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_center_workload"
            referencedColumns: ["service_center_id"]
          },
          {
            foreignKeyName: "service_center_pincodes_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_center_pincodes_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_territory_coverage"
            referencedColumns: ["service_center_id"]
          },
        ]
      }
      service_center_technicians: {
        Row: {
          active_from: string
          active_to: string | null
          created_at: string
          id: string
          is_primary: boolean
          profile_id: string
          service_center_id: string
          specialization: string | null
          status: string | null
          technician_code: string | null
          territory: string | null
        }
        Insert: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          profile_id: string
          service_center_id: string
          specialization?: string | null
          status?: string | null
          technician_code?: string | null
          territory?: string | null
        }
        Update: {
          active_from?: string
          active_to?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          profile_id?: string
          service_center_id?: string
          specialization?: string | null
          status?: string | null
          technician_code?: string | null
          territory?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_center_technicians_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_center_technicians_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_center_workload"
            referencedColumns: ["service_center_id"]
          },
          {
            foreignKeyName: "service_center_technicians_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_center_technicians_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_territory_coverage"
            referencedColumns: ["service_center_id"]
          },
        ]
      }
      service_centers: {
        Row: {
          address: string | null
          center_code: string
          center_name: string
          center_type: string
          city: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          is_active: boolean
          latitude: number | null
          longitude: number | null
          notes: string | null
          phone: string | null
          pincode: string | null
          state: string | null
          updated_at: string
          warehouse_id: string | null
        }
        Insert: {
          address?: string | null
          center_code: string
          center_name: string
          center_type: string
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Update: {
          address?: string | null
          center_code?: string
          center_name?: string
          center_type?: string
          city?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_active?: boolean
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          phone?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_centers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "service_centers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "service_centers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      service_costs: {
        Row: {
          amount: number
          cost_type: string
          created_at: string
          description: string | null
          id: string
          service_ticket_id: string
          warranty_covered: boolean
        }
        Insert: {
          amount: number
          cost_type: string
          created_at?: string
          description?: string | null
          id?: string
          service_ticket_id: string
          warranty_covered?: boolean
        }
        Update: {
          amount?: number
          cost_type?: string
          created_at?: string
          description?: string | null
          id?: string
          service_ticket_id?: string
          warranty_covered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_costs_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "service_costs_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_diagnosis: {
        Row: {
          action_taken: string | null
          actual_cost: number | null
          diagnosed_at: string
          diagnosed_by: string | null
          diagnosis: string
          estimated_cost: number | null
          fault_found: string | null
          id: string
          service_ticket_id: string
          technician_notes: string | null
        }
        Insert: {
          action_taken?: string | null
          actual_cost?: number | null
          diagnosed_at?: string
          diagnosed_by?: string | null
          diagnosis: string
          estimated_cost?: number | null
          fault_found?: string | null
          id?: string
          service_ticket_id: string
          technician_notes?: string | null
        }
        Update: {
          action_taken?: string | null
          actual_cost?: number | null
          diagnosed_at?: string
          diagnosed_by?: string | null
          diagnosis?: string
          estimated_cost?: number | null
          fault_found?: string | null
          id?: string
          service_ticket_id?: string
          technician_notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_diagnosis_diagnosed_by_fkey"
            columns: ["diagnosed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_diagnosis_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: true
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "service_diagnosis_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: true
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_parts: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          part_code: string | null
          part_name: string
          quantity: number
          requested_at: string | null
          requested_by: string | null
          service_ticket_id: string
          spare_part_id: string | null
          status: string | null
          unit_cost: number
          warranty_covered: boolean
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          part_code?: string | null
          part_name: string
          quantity?: number
          requested_at?: string | null
          requested_by?: string | null
          service_ticket_id: string
          spare_part_id?: string | null
          status?: string | null
          unit_cost?: number
          warranty_covered?: boolean
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          part_code?: string | null
          part_name?: string
          quantity?: number
          requested_at?: string | null
          requested_by?: string | null
          service_ticket_id?: string
          spare_part_id?: string | null
          status?: string | null
          unit_cost?: number
          warranty_covered?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_parts_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_parts_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_parts_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "service_parts_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_parts_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_parts_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_consumption"
            referencedColumns: ["spare_part_id"]
          },
          {
            foreignKeyName: "service_parts_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_stock_summary"
            referencedColumns: ["spare_part_id"]
          },
        ]
      }
      service_tickets: {
        Row: {
          assigned_at: string | null
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          customer_id: string
          dealer_id: string | null
          id: string
          issue_category: string | null
          issue_description: string
          notes: string | null
          opened_at: string
          priority: string
          product_unit_id: string
          resolved_at: string | null
          service_center_id: string | null
          service_type: string
          started_at: string | null
          status: string
          ticket_number: string
          updated_at: string
          warranty_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id: string
          dealer_id?: string | null
          id?: string
          issue_category?: string | null
          issue_description: string
          notes?: string | null
          opened_at?: string
          priority?: string
          product_unit_id: string
          resolved_at?: string | null
          service_center_id?: string | null
          service_type?: string
          started_at?: string | null
          status?: string
          ticket_number: string
          updated_at?: string
          warranty_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          dealer_id?: string | null
          id?: string
          issue_category?: string | null
          issue_description?: string
          notes?: string | null
          opened_at?: string
          priority?: string
          product_unit_id?: string
          resolved_at?: string | null
          service_center_id?: string | null
          service_type?: string
          started_at?: string | null
          status?: string
          ticket_number?: string
          updated_at?: string
          warranty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "service_tickets_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "service_tickets_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_center_workload"
            referencedColumns: ["service_center_id"]
          },
          {
            foreignKeyName: "service_tickets_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_service_center_id_fkey"
            columns: ["service_center_id"]
            isOneToOne: false
            referencedRelation: "service_territory_coverage"
            referencedColumns: ["service_center_id"]
          },
          {
            foreignKeyName: "service_tickets_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      service_updates: {
        Row: {
          created_at: string
          created_by: string | null
          description: string
          id: string
          new_status: string | null
          previous_status: string | null
          service_ticket_id: string
          update_type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          service_ticket_id: string
          update_type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          new_status?: string | null
          previous_status?: string | null
          service_ticket_id?: string
          update_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_updates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_updates_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "service_updates_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      service_visits: {
        Row: {
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_confirmation_otp: string | null
          customer_confirmed_at: string | null
          customer_notes: string | null
          customer_signature_data: string | null
          id: string
          latitude: number | null
          longitude: number | null
          otp_expires_at: string | null
          scheduled_at: string
          service_ticket_id: string
          started_at: string | null
          status: string
          technician_id: string
          technician_notes: string | null
          updated_at: string
          visit_type: string
        }
        Insert: {
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_confirmation_otp?: string | null
          customer_confirmed_at?: string | null
          customer_notes?: string | null
          customer_signature_data?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          otp_expires_at?: string | null
          scheduled_at: string
          service_ticket_id: string
          started_at?: string | null
          status?: string
          technician_id: string
          technician_notes?: string | null
          updated_at?: string
          visit_type?: string
        }
        Update: {
          arrived_at?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_confirmation_otp?: string | null
          customer_confirmed_at?: string | null
          customer_notes?: string | null
          customer_signature_data?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          otp_expires_at?: string | null
          scheduled_at?: string
          service_ticket_id?: string
          started_at?: string | null
          status?: string
          technician_id?: string
          technician_notes?: string | null
          updated_at?: string
          visit_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_visits_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_visits_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "service_visits_service_ticket_id_fkey"
            columns: ["service_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_visits_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_compatibility: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          spare_part_id: string
          variant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          spare_part_id: string
          variant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          spare_part_id?: string
          variant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_compatibility_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_compatibility_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_consumption"
            referencedColumns: ["spare_part_id"]
          },
          {
            foreignKeyName: "spare_part_compatibility_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_stock_summary"
            referencedColumns: ["spare_part_id"]
          },
          {
            foreignKeyName: "spare_part_compatibility_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "inventory_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "spare_part_compatibility_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "product_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_compatibility_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "sales_by_product_variant"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "spare_part_compatibility_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_inventory"
            referencedColumns: ["variant_id"]
          },
          {
            foreignKeyName: "spare_part_compatibility_variant_id_fkey"
            columns: ["variant_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["product_variant_id"]
          },
        ]
      }
      spare_part_inventory: {
        Row: {
          id: string
          quantity_on_hand: number
          quantity_reserved: number
          reorder_level: number
          spare_part_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          reorder_level?: number
          spare_part_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          quantity_on_hand?: number
          quantity_reserved?: number
          reorder_level?: number
          spare_part_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_inventory_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_inventory_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_consumption"
            referencedColumns: ["spare_part_id"]
          },
          {
            foreignKeyName: "spare_part_inventory_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_stock_summary"
            referencedColumns: ["spare_part_id"]
          },
          {
            foreignKeyName: "spare_part_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "spare_part_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "spare_part_inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_part_transactions: {
        Row: {
          created_at: string
          from_warehouse_id: string | null
          id: string
          performed_by: string | null
          quantity: number
          reference_note: string | null
          reference_ticket_id: string | null
          spare_part_id: string
          to_warehouse_id: string | null
          transaction_type: string
          unit_cost: number | null
        }
        Insert: {
          created_at?: string
          from_warehouse_id?: string | null
          id?: string
          performed_by?: string | null
          quantity: number
          reference_note?: string | null
          reference_ticket_id?: string | null
          spare_part_id: string
          to_warehouse_id?: string | null
          transaction_type: string
          unit_cost?: number | null
        }
        Update: {
          created_at?: string
          from_warehouse_id?: string | null
          id?: string
          performed_by?: string | null
          quantity?: number
          reference_note?: string | null
          reference_ticket_id?: string | null
          spare_part_id?: string
          to_warehouse_id?: string | null
          transaction_type?: string
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "spare_part_transactions_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "spare_part_transactions_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "spare_part_transactions_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_transactions_performed_by_fkey"
            columns: ["performed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_transactions_reference_ticket_id_fkey"
            columns: ["reference_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_ticket_cost_detail"
            referencedColumns: ["service_ticket_id"]
          },
          {
            foreignKeyName: "spare_part_transactions_reference_ticket_id_fkey"
            columns: ["reference_ticket_id"]
            isOneToOne: false
            referencedRelation: "service_tickets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_transactions_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "spare_part_transactions_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_consumption"
            referencedColumns: ["spare_part_id"]
          },
          {
            foreignKeyName: "spare_part_transactions_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts_stock_summary"
            referencedColumns: ["spare_part_id"]
          },
          {
            foreignKeyName: "spare_part_transactions_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "stock_by_warehouse"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "spare_part_transactions_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["warehouse_id"]
          },
          {
            foreignKeyName: "spare_part_transactions_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      spare_parts: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          part_code: string
          part_name: string
          reorder_level: number
          selling_price: number
          standard_cost: number
          unit_of_measure: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          part_code: string
          part_name: string
          reorder_level?: number
          selling_price?: number
          standard_cost?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          part_code?: string
          part_name?: string
          reorder_level?: number
          selling_price?: number
          standard_cost?: number
          unit_of_measure?: string
          updated_at?: string
        }
        Relationships: []
      }
      vendor_contacts: {
        Row: {
          contact_name: string
          created_at: string
          designation: string | null
          email: string | null
          id: string
          is_primary: boolean
          notes: string | null
          phone: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          phone?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          notes?: string | null
          phone?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_receiving_performance"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      vendor_returns: {
        Row: {
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          product_unit_id: string
          purchase_order_id: string | null
          purchase_receipt_id: string | null
          requested_by: string | null
          return_number: string
          return_reason: string
          returned_at: string | null
          status: string
          vendor_id: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_unit_id: string
          purchase_order_id?: string | null
          purchase_receipt_id?: string | null
          requested_by?: string | null
          return_number: string
          return_reason: string
          returned_at?: string | null
          status?: string
          vendor_id: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          product_unit_id?: string
          purchase_order_id?: string | null
          purchase_receipt_id?: string | null
          requested_by?: string | null
          return_number?: string
          return_reason?: string
          returned_at?: string | null
          status?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_returns_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_returns_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_returns_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["purchase_order_id"]
          },
          {
            foreignKeyName: "vendor_returns_purchase_receipt_id_fkey"
            columns: ["purchase_receipt_id"]
            isOneToOne: false
            referencedRelation: "purchase_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_returns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_returns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_discrepancy_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_returns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_history"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_returns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_purchase_summary"
            referencedColumns: ["vendor_id"]
          },
          {
            foreignKeyName: "vendor_returns_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vw_vendor_receiving_performance"
            referencedColumns: ["vendor_id"]
          },
        ]
      }
      vendors: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          country: string
          created_at: string
          created_by: string | null
          display_name: string
          email: string | null
          gstin: string | null
          id: string
          legal_name: string
          notes: string | null
          payment_terms: string
          phone: string | null
          pincode: string | null
          state: string | null
          status: string
          tax_identifier: string | null
          updated_at: string
          vendor_code: string
          vendor_type: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          display_name: string
          email?: string | null
          gstin?: string | null
          id?: string
          legal_name: string
          notes?: string | null
          payment_terms?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          tax_identifier?: string | null
          updated_at?: string
          vendor_code: string
          vendor_type?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          country?: string
          created_at?: string
          created_by?: string | null
          display_name?: string
          email?: string | null
          gstin?: string | null
          id?: string
          legal_name?: string
          notes?: string | null
          payment_terms?: string
          phone?: string | null
          pincode?: string | null
          state?: string | null
          status?: string
          tax_identifier?: string | null
          updated_at?: string
          vendor_code?: string
          vendor_type?: string
        }
        Relationships: []
      }
      warehouses: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          created_at: string
          id: string
          is_active: boolean
          notes: string | null
          pincode: string | null
          state: string | null
          updated_at: string
          warehouse_code: string
          warehouse_name: string
          warehouse_type: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          warehouse_code: string
          warehouse_name: string
          warehouse_type: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          pincode?: string | null
          state?: string | null
          updated_at?: string
          warehouse_code?: string
          warehouse_name?: string
          warehouse_type?: string
        }
        Relationships: []
      }
      warranties: {
        Row: {
          created_at: string
          customer_id: string
          dealer_id: string | null
          id: string
          notes: string | null
          product_unit_id: string
          registered_at: string
          registered_by: string | null
          registration_method: string
          sale_id: string
          status: string
          updated_at: string
          warranty_end_date: string
          warranty_number: string
          warranty_period_months: number
          warranty_start_date: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          dealer_id?: string | null
          id?: string
          notes?: string | null
          product_unit_id: string
          registered_at?: string
          registered_by?: string | null
          registration_method?: string
          sale_id: string
          status?: string
          updated_at?: string
          warranty_end_date: string
          warranty_number: string
          warranty_period_months?: number
          warranty_start_date: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          dealer_id?: string | null
          id?: string
          notes?: string | null
          product_unit_id?: string
          registered_at?: string
          registered_by?: string | null
          registration_method?: string
          sale_id?: string
          status?: string
          updated_at?: string
          warranty_end_date?: string
          warranty_number?: string
          warranty_period_months?: number
          warranty_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "warranties_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "warranties_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: true
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_registered_by_fkey"
            columns: ["registered_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_extensions: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          extension_days: number
          extension_number: string
          extension_reason: string
          id: string
          new_end_date: string
          notes: string | null
          previous_end_date: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          updated_at: string
          warranty_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          extension_days: number
          extension_number: string
          extension_reason: string
          id?: string
          new_end_date: string
          notes?: string | null
          previous_end_date: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          updated_at?: string
          warranty_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          extension_days?: number
          extension_number?: string
          extension_reason?: string
          id?: string
          new_end_date?: string
          notes?: string | null
          previous_end_date?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          updated_at?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_extensions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_extensions_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_extensions_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_extensions_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      warranty_registration_logs: {
        Row: {
          barcode: string | null
          created_at: string
          id: string
          message: string | null
          product_unit_id: string | null
          registration_method: string
          result: string
          warranty_id: string | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string
          id?: string
          message?: string | null
          product_unit_id?: string | null
          registration_method?: string
          result: string
          warranty_id?: string | null
        }
        Update: {
          barcode?: string | null
          created_at?: string
          id?: string
          message?: string | null
          product_unit_id?: string | null
          registration_method?: string
          result?: string
          warranty_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_registration_logs_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_registration_logs_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_registration_logs_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      warranty_transfers: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          from_customer_id: string
          id: string
          notes: string | null
          product_unit_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          to_customer_id: string
          transfer_number: string
          transfer_reason: string
          transfer_status: string
          updated_at: string
          warranty_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          from_customer_id: string
          id?: string
          notes?: string | null
          product_unit_id: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          to_customer_id: string
          transfer_number: string
          transfer_reason: string
          transfer_status?: string
          updated_at?: string
          warranty_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          from_customer_id?: string
          id?: string
          notes?: string | null
          product_unit_id?: string
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          to_customer_id?: string
          transfer_number?: string
          transfer_reason?: string
          transfer_status?: string
          updated_at?: string
          warranty_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warranty_transfers_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_from_customer_id_fkey"
            columns: ["from_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_to_customer_id_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      core_refurbishment_work_orders: {
        Row: {
          id: string
          work_order_number: string
          defective_core_id: string
          assigned_engineer_id: string | null
          status: string
          rail_12v_tested: boolean
          rail_24v_tested: boolean
          rail_5v_tested: boolean
          burn_in_duration_hours: number
          burn_in_passed: boolean
          optical_panel_passed: boolean
          audio_chassis_passed: boolean
          diagnostics_notes: string | null
          labor_minutes: number
          certified_by: string | null
          certified_at: string | null
          restocked_warehouse_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          work_order_number: string
          defective_core_id: string
          assigned_engineer_id?: string | null
          status?: string
          rail_12v_tested?: boolean
          rail_24v_tested?: boolean
          rail_5v_tested?: boolean
          burn_in_duration_hours?: number
          burn_in_passed?: boolean
          optical_panel_passed?: boolean
          audio_chassis_passed?: boolean
          diagnostics_notes?: string | null
          labor_minutes?: number
          certified_by?: string | null
          certified_at?: string | null
          restocked_warehouse_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          work_order_number?: string
          defective_core_id?: string
          assigned_engineer_id?: string | null
          status?: string
          rail_12v_tested?: boolean
          rail_24v_tested?: boolean
          rail_5v_tested?: boolean
          burn_in_duration_hours?: number
          burn_in_passed?: boolean
          optical_panel_passed?: boolean
          audio_chassis_passed?: boolean
          diagnostics_notes?: string | null
          labor_minutes?: number
          certified_by?: string | null
          certified_at?: string | null
          restocked_warehouse_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_refurbishment_work_orders_defective_core_id_fkey"
            columns: ["defective_core_id"]
            isOneToOne: false
            referencedRelation: "technician_defective_cores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_refurbishment_work_orders_assigned_engineer_id_fkey"
            columns: ["assigned_engineer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_refurbishment_work_orders_restocked_warehouse_id_fkey"
            columns: ["restocked_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          }
        ]
      }
      core_refurbishment_parts_used: {
        Row: {
          id: string
          work_order_id: string
          spare_part_id: string | null
          part_description: string
          quantity: number
          unit_cost: number
          created_at: string
        }
        Insert: {
          id?: string
          work_order_id: string
          spare_part_id?: string | null
          part_description: string
          quantity?: number
          unit_cost?: number
          created_at?: string
        }
        Update: {
          id?: string
          work_order_id?: string
          spare_part_id?: string | null
          part_description?: string
          quantity?: number
          unit_cost?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_refurbishment_parts_used_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "core_refurbishment_work_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "core_refurbishment_parts_used_spare_part_id_fkey"
            columns: ["spare_part_id"]
            isOneToOne: false
            referencedRelation: "spare_parts"
            referencedColumns: ["id"]
          }
        ]
      }
      core_scrap_disposition_records: {
        Row: {
          id: string
          scrap_batch_number: string
          recycler_vendor_name: string
          authorized_cpcb_id: string | null
          total_cores_count: number
          total_weight_kg: number
          salvage_credit_realized: number
          disposition_notes: string | null
          disposed_by: string | null
          disposed_at: string
          created_at: string
        }
        Insert: {
          id?: string
          scrap_batch_number: string
          recycler_vendor_name: string
          authorized_cpcb_id?: string | null
          total_cores_count?: number
          total_weight_kg?: number
          salvage_credit_realized?: number
          disposition_notes?: string | null
          disposed_by?: string | null
          disposed_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          scrap_batch_number?: string
          recycler_vendor_name?: string
          authorized_cpcb_id?: string | null
          total_cores_count?: number
          total_weight_kg?: number
          salvage_credit_realized?: number
          disposition_notes?: string | null
          disposed_by?: string | null
          disposed_at?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "core_scrap_disposition_records_disposed_by_fkey"
            columns: ["disposed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      crm_overview: {
        Row: {
          active_warranties: number | null
          completed_sales: number | null
          completed_sales_amount: number | null
          open_service_tickets: number | null
          products_damaged: number | null
          products_in_service: number | null
          products_in_stock: number | null
          products_reserved: number | null
          products_returned: number | null
          products_sold: number | null
          total_customers: number | null
          total_product_units: number | null
          total_sales: number | null
          total_service_tickets: number | null
          total_warranties: number | null
        }
        Relationships: []
      }
      dealer_sales_summary: {
        Row: {
          city: string | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          dealer_type: string | null
          state: string | null
          total_orders: number | null
          total_outstanding_value: number | null
          total_paid_value: number | null
          total_sales_value: number | null
          total_warranties_registered: number | null
        }
        Relationships: []
      }
      inventory_by_product_variant: {
        Row: {
          bluetooth: boolean | null
          brand_name: string | null
          model_name: string | null
          product_code: string | null
          product_name: string | null
          screen_size: number | null
          status: string | null
          tv_type: string | null
          unit_count: number | null
          variant_id: string | null
          voice_remote: boolean | null
        }
        Relationships: []
      }
      inventory_summary: {
        Row: {
          status: string | null
          unit_count: number | null
        }
        Relationships: []
      }
      sales_by_product_variant: {
        Row: {
          bluetooth: boolean | null
          brand_name: string | null
          gross_sales: number | null
          model_name: string | null
          net_sales: number | null
          product_code: string | null
          product_name: string | null
          screen_size: number | null
          total_discount: number | null
          tv_type: string | null
          units_sold: number | null
          variant_id: string | null
          voice_remote: boolean | null
        }
        Relationships: []
      }
      sales_summary_by_date: {
        Row: {
          gross_sales: number | null
          net_sales: number | null
          sale_date: string | null
          sales_count: number | null
          total_discount: number | null
          units_sold: number | null
        }
        Relationships: []
      }
      service_center_workload: {
        Row: {
          active_tickets: number | null
          assigned_technicians_count: number | null
          center_code: string | null
          center_name: string | null
          center_type: string | null
          city: string | null
          closed_tickets: number | null
          resolved_tickets: number | null
          service_center_id: string | null
          state: string | null
          total_tickets: number | null
          urgent_open_tickets: number | null
        }
        Relationships: []
      }
      service_cost_summary: {
        Row: {
          cost_entry_count: number | null
          cost_type: string | null
          customer_payable_cost: number | null
          total_cost: number | null
          warranty_covered_cost: number | null
        }
        Relationships: []
      }
      service_parts_summary: {
        Row: {
          part_code: string | null
          part_name: string | null
          total_part_cost: number | null
          total_quantity: number | null
          usage_count: number | null
          warranty_covered_part_cost: number | null
        }
        Relationships: []
      }
      service_territory_coverage: {
        Row: {
          center_code: string | null
          center_email: string | null
          center_name: string | null
          center_phone: string | null
          center_type: string | null
          city: string | null
          coverage_active: boolean | null
          coverage_id: string | null
          district: string | null
          pincode: string | null
          service_center_id: string | null
          state: string | null
        }
        Relationships: []
      }
      service_ticket_cost_detail: {
        Row: {
          barcode: string | null
          customer_code: string | null
          customer_id: string | null
          customer_name: string | null
          customer_payable_cost: number | null
          priority: string | null
          product_unit_id: string | null
          serial_number: string | null
          service_ticket_id: string | null
          service_type: string | null
          status: string | null
          ticket_number: string | null
          total_service_cost: number | null
          warranty_covered_cost: number | null
        }
        Relationships: [
          {
            foreignKeyName: "service_tickets_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_tickets_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      service_ticket_priority_summary: {
        Row: {
          priority: string | null
          ticket_count: number | null
        }
        Relationships: []
      }
      service_ticket_summary: {
        Row: {
          status: string | null
          ticket_count: number | null
        }
        Relationships: []
      }
      service_ticket_type_summary: {
        Row: {
          service_type: string | null
          ticket_count: number | null
        }
        Relationships: []
      }
      spare_parts_consumption: {
        Row: {
          category: string | null
          chargeable_cost: number | null
          part_code: string | null
          part_name: string | null
          spare_part_id: string | null
          total_cost: number | null
          total_quantity_used: number | null
          usage_count: number | null
          warranty_covered_cost: number | null
        }
        Relationships: []
      }
      spare_parts_stock_summary: {
        Row: {
          category: string | null
          global_reorder_level: number | null
          part_code: string | null
          part_name: string | null
          selling_price: number | null
          spare_part_id: string | null
          standard_cost: number | null
          stock_health_status: string | null
          total_quantity_available: number | null
          total_quantity_on_hand: number | null
          total_quantity_reserved: number | null
          unit_of_measure: string | null
        }
        Relationships: []
      }
      stock_by_warehouse: {
        Row: {
          city: string | null
          damaged_units: number | null
          in_service_units: number | null
          in_stock_units: number | null
          reserved_units: number | null
          returned_units: number | null
          sold_units: number | null
          state: string | null
          total_units: number | null
          warehouse_code: string | null
          warehouse_id: string | null
          warehouse_name: string | null
          warehouse_type: string | null
        }
        Relationships: []
      }
      vw_dealer_consignment_aging: {
        Row: {
          aging_bracket: string | null
          barcode: string | null
          consignment_id: string | null
          consignment_status: string | null
          days_at_dealer: number | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          dispatched_at: string | null
          model_name: string | null
          product_unit_id: string | null
          received_at: string | null
          serial_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: true
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dealer_consignment_inventory: {
        Row: {
          barcode: string | null
          consignment_id: string | null
          consignment_status: string | null
          days_at_dealer: number | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          discrepancy_notes: string | null
          discrepancy_reason: string | null
          dispatched_at: string | null
          from_warehouse_name: string | null
          model_name: string | null
          ownership_type: string | null
          product_code: string | null
          product_unit_id: string | null
          product_unit_status: string | null
          purchase_cost: number | null
          recalled_at: string | null
          received_at: string | null
          screen_size: number | null
          serial_number: string | null
          settlement_date: string | null
          settlement_reference: string | null
          settlement_status: string | null
          sold_at: string | null
          tv_type: string | null
          variant_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: true
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dealer_consignment_movements: {
        Row: {
          barcode: string | null
          consignment_id: string | null
          created_at: string | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          model_name: string | null
          movement_id: string | null
          movement_type: string | null
          new_consignment_status: string | null
          new_ownership_type: string | null
          notes: string | null
          performed_by_name: string | null
          performed_by_role: string | null
          previous_consignment_status: string | null
          previous_ownership_type: string | null
          product_unit_id: string | null
          reason: string | null
          reference_number: string | null
          serial_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "dealer_consignment_stock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_aging"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_inventory"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_consignment_id_fkey"
            columns: ["consignment_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_reconciliation"
            referencedColumns: ["consignment_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_movements_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dealer_consignment_reconciliation: {
        Row: {
          barcode: string | null
          consignment_id: string | null
          consignment_status: string | null
          days_since_dispatch: number | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          discrepancy_notes: string | null
          discrepancy_reason: string | null
          dispatched_at: string | null
          model_name: string | null
          product_unit_id: string | null
          received_at: string | null
          reconciliation_category: string | null
          serial_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealer_sales_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "dealers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_consignment_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_inventory_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_rma_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_sales_performance"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_service_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_dealer_id_fkey"
            columns: ["dealer_id"]
            isOneToOne: false
            referencedRelation: "vw_dealer_warranty_summary"
            referencedColumns: ["dealer_id"]
          },
          {
            foreignKeyName: "dealer_consignment_stock_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: true
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_dealer_consignment_summary: {
        Row: {
          available_cost_value: number | null
          available_units: number | null
          city: string | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          dealer_type: string | null
          dispatched_units: number | null
          disputed_units: number | null
          pending_settlement_units: number | null
          recalled_units: number | null
          returned_units: number | null
          settled_units: number | null
          sold_units: number | null
          state: string | null
          total_consignment_units: number | null
          total_cost_value: number | null
        }
        Relationships: []
      }
      vw_dealer_inventory_summary: {
        Row: {
          damaged_count: number | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          in_service_count: number | null
          in_stock_count: number | null
          reserved_count: number | null
          returned_count: number | null
          sold_count: number | null
          total_assigned_units: number | null
        }
        Relationships: []
      }
      vw_dealer_rma_summary: {
        Row: {
          approved_returns: number | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          pending_returns: number | null
          rejected_returns: number | null
          total_returns: number | null
        }
        Relationships: []
      }
      vw_dealer_sales_performance: {
        Row: {
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          dealer_type: string | null
          last_sale_at: string | null
          total_sales_amount: number | null
          total_sales_count: number | null
          total_units_sold: number | null
        }
        Relationships: []
      }
      vw_dealer_service_summary: {
        Row: {
          closed_tickets: number | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          in_progress_tickets: number | null
          open_tickets: number | null
          resolved_tickets: number | null
          total_tickets: number | null
        }
        Relationships: []
      }
      vw_dealer_warranty_summary: {
        Row: {
          active_warranties: number | null
          dealer_code: string | null
          dealer_id: string | null
          dealer_name: string | null
          expired_warranties: number | null
          total_warranties: number | null
          void_warranties: number | null
        }
        Relationships: []
      }
      vw_vendor_discrepancy_summary: {
        Row: {
          product_code: string | null
          product_name: string | null
          product_variant_id: string | null
          rejection_reasons: string | null
          total_accepted: number | null
          total_expected: number | null
          total_received: number | null
          total_rejected: number | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
      vw_vendor_purchase_history: {
        Row: {
          line_total: number | null
          ordered_quantity: number | null
          po_date: string | null
          po_number: string | null
          po_status: string | null
          product_code: string | null
          product_name: string | null
          purchase_order_id: string | null
          received_quantity: number | null
          unit_cost: number | null
          vendor_code: string | null
          vendor_id: string | null
          vendor_name: string | null
          warehouse_id: string | null
          warehouse_name: string | null
        }
        Relationships: []
      }
      vw_vendor_purchase_summary: {
        Row: {
          total_purchase_orders: number | null
          total_purchase_value: number | null
          total_units_ordered: number | null
          total_units_received: number | null
          vendor_code: string | null
          vendor_id: string | null
          vendor_name: string | null
          vendor_status: string | null
          vendor_type: string | null
        }
        Relationships: []
      }
      vw_vendor_receiving_performance: {
        Row: {
          rejection_rate_percentage: number | null
          total_accepted_units: number | null
          total_receipts: number | null
          total_rejected_units: number | null
          vendor_code: string | null
          vendor_id: string | null
          vendor_name: string | null
        }
        Relationships: []
      }
      vw_warranty_extensions_summary: {
        Row: {
          approval_status: string | null
          approved_at: string | null
          approved_by_name: string | null
          barcode: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          extension_days: number | null
          extension_id: string | null
          extension_number: string | null
          extension_reason: string | null
          new_end_date: string | null
          previous_end_date: string | null
          product_unit_id: string | null
          requested_at: string | null
          requested_by_name: string | null
          serial_number: string | null
          warranty_id: string | null
          warranty_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: true
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_extensions_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_extensions_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      vw_warranty_transfers_summary: {
        Row: {
          approved_at: string | null
          approved_by_name: string | null
          barcode: string | null
          completed_at: string | null
          from_customer_id: string | null
          from_customer_name: string | null
          from_customer_phone: string | null
          product_unit_id: string | null
          requested_at: string | null
          requested_by_name: string | null
          serial_number: string | null
          to_customer_id: string | null
          to_customer_name: string | null
          to_customer_phone: string | null
          transfer_id: string | null
          transfer_number: string | null
          transfer_reason: string | null
          transfer_status: string | null
          warranty_id: string | null
          warranty_number: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranty_transfers_from_customer_id_fkey"
            columns: ["from_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: false
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_to_customer_id_fkey"
            columns: ["to_customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranties"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranty_transfers_warranty_id_fkey"
            columns: ["warranty_id"]
            isOneToOne: false
            referencedRelation: "warranty_expiration_report"
            referencedColumns: ["warranty_id"]
          },
        ]
      }
      warranty_expiration_report: {
        Row: {
          barcode: string | null
          customer_code: string | null
          customer_id: string | null
          customer_name: string | null
          customer_phone: string | null
          expiration_category: string | null
          product_unit_id: string | null
          registration_method: string | null
          sale_id: string | null
          serial_number: string | null
          status: string | null
          warranty_end_date: string | null
          warranty_id: string | null
          warranty_number: string | null
          warranty_period_months: number | null
          warranty_start_date: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warranties_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_product_unit_id_fkey"
            columns: ["product_unit_id"]
            isOneToOne: true
            referencedRelation: "product_units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warranties_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_registration_summary: {
        Row: {
          registration_count: number | null
          registration_method: string | null
        }
        Relationships: []
      }
      warranty_summary: {
        Row: {
          status: string | null
          warranty_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      bootstrap_super_admin: { Args: { target_email: string }; Returns: Json }
      clean_phase65_test_logs: { Args: never; Returns: undefined }
      clean_test_notifications: { Args: never; Returns: undefined }
      create_notification: {
        Args: {
          p_action_url?: string
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_notification_type: string
          p_recipient_user_id: string
          p_severity?: string
          p_title: string
        }
        Returns: string
      }
      create_product_unit: {
        Args: {
          p_barcode?: string
          p_notes?: string
          p_purchase_cost?: number
          p_serial_number: string
          p_status?: string
          p_variant_id: string
          p_warehouse_id: string
        }
        Returns: Json
      }
      create_role_notifications: {
        Args: {
          p_action_url?: string
          p_entity_id?: string
          p_entity_type?: string
          p_message: string
          p_notification_type: string
          p_roles: string[]
          p_severity?: string
          p_title: string
        }
        Returns: number
      }
      create_sales_order: {
        Args: {
          p_customer_id: string
          p_dealer_id?: string
          p_discount_amount?: number
          p_notes?: string
          p_payment_method?: string
          p_payment_ref?: string
          p_payment_status?: string
          p_product_unit_id: string
          p_sale_number?: string
          p_unit_price: number
        }
        Returns: Json
      }
      fn_admin_manage_dealer_user: {
        Args: {
          p_dealer_id: string
          p_is_active?: boolean
          p_profile_id: string
        }
        Returns: Json
      }
      fn_approve_purchase_order: {
        Args: { p_notes?: string; p_po_id: string }
        Returns: Json
      }
      fn_approve_warranty_extension: {
        Args: {
          p_approved_by: string
          p_extension_id: string
          p_notes?: string
        }
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          extension_days: number
          extension_number: string
          extension_reason: string
          id: string
          new_end_date: string
          notes: string | null
          previous_end_date: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          updated_at: string
          warranty_id: string
        }
        SetofOptions: {
          from: "*"
          to: "warranty_extensions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_approve_warranty_transfer: {
        Args: { p_approved_by: string; p_notes?: string; p_transfer_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          from_customer_id: string
          id: string
          notes: string | null
          product_unit_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          to_customer_id: string
          transfer_number: string
          transfer_reason: string
          transfer_status: string
          updated_at: string
          warranty_id: string
        }
        SetofOptions: {
          from: "*"
          to: "warranty_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_assign_product_units_to_dealer: {
        Args: {
          p_dealer_id: string
          p_notes?: string
          p_product_unit_ids: string[]
        }
        Returns: Json
      }
      fn_assign_technician_to_ticket: {
        Args: {
          p_assigned_by: string
          p_technician_id: string
          p_ticket_id: string
        }
        Returns: {
          assigned_at: string | null
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          customer_id: string
          dealer_id: string | null
          id: string
          issue_category: string | null
          issue_description: string
          notes: string | null
          opened_at: string
          priority: string
          product_unit_id: string
          resolved_at: string | null
          service_center_id: string | null
          service_type: string
          started_at: string | null
          status: string
          ticket_number: string
          updated_at: string
          warranty_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "service_tickets"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_cancel_purchase_order: {
        Args: { p_po_id: string; p_reason: string }
        Returns: Json
      }
      fn_create_purchase_order: {
        Args: {
          p_expected_delivery_date: string
          p_items: Json
          p_notes: string
          p_vendor_id: string
          p_warehouse_id: string
        }
        Returns: Json
      }
      fn_create_vendor_return: {
        Args: {
          p_notes?: string
          p_product_unit_id: string
          p_return_reason: string
          p_vendor_id: string
        }
        Returns: Json
      }
      fn_dealer_acknowledge_consignment_receipt: {
        Args: {
          p_action: string
          p_consignment_id: string
          p_discrepancy_reason?: string
          p_notes?: string
        }
        Returns: Json
      }
      fn_dealer_create_rma_request: {
        Args: {
          p_customer_id: string
          p_inspection_condition?: string
          p_product_unit_id: string
          p_return_reason: string
          p_sale_id: string
        }
        Returns: Json
      }
      fn_dealer_create_sale_order: {
        Args: {
          p_customer_id: string
          p_notes?: string
          p_product_unit_id: string
          p_unit_price?: number
        }
        Returns: Json
      }
      fn_dealer_create_service_ticket: {
        Args: {
          p_customer_id: string
          p_issue_category?: string
          p_issue_description: string
          p_priority?: string
          p_product_unit_id: string
        }
        Returns: Json
      }
      fn_dispatch_consignment_to_dealer: {
        Args: {
          p_dealer_id: string
          p_notes?: string
          p_product_unit_ids: string[]
          p_warehouse_id: string
        }
        Returns: Json
      }
      fn_generate_visit_otp: { Args: { p_visit_id: string }; Returns: Json }
      fn_recall_consignment_stock: {
        Args: {
          p_product_unit_ids: string[]
          p_reason?: string
          p_to_warehouse_id: string
        }
        Returns: Json
      }
      fn_receive_purchase_goods: {
        Args: {
          p_delivery_note_number: string
          p_notes?: string
          p_po_id: string
          p_received_items: Json
          p_serials_barcodes: Json
          p_vendor_invoice_reference: string
        }
        Returns: Json
      }
      fn_reconcile_dealer_consignment: {
        Args: {
          p_dealer_id: string
          p_discrepant_unit_ids?: string[]
          p_notes?: string
          p_verified_unit_ids?: string[]
        }
        Returns: Json
      }
      fn_reject_warranty_extension: {
        Args: {
          p_extension_id: string
          p_reason: string
          p_rejected_by: string
        }
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          extension_days: number
          extension_number: string
          extension_reason: string
          id: string
          new_end_date: string
          notes: string | null
          previous_end_date: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          updated_at: string
          warranty_id: string
        }
        SetofOptions: {
          from: "*"
          to: "warranty_extensions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_reject_warranty_transfer: {
        Args: { p_reason: string; p_rejected_by: string; p_transfer_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          from_customer_id: string
          id: string
          notes: string | null
          product_unit_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          to_customer_id: string
          transfer_number: string
          transfer_reason: string
          transfer_status: string
          updated_at: string
          warranty_id: string
        }
        SetofOptions: {
          from: "*"
          to: "warranty_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_request_service_part_usage: {
        Args: {
          p_performed_by: string
          p_quantity: number
          p_spare_part_id: string
          p_ticket_id: string
          p_warehouse_id: string
          p_warranty_covered: boolean
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          notes: string | null
          part_code: string | null
          part_name: string
          quantity: number
          requested_at: string | null
          requested_by: string | null
          service_ticket_id: string
          spare_part_id: string | null
          status: string | null
          unit_cost: number
          warranty_covered: boolean
        }
        SetofOptions: {
          from: "*"
          to: "service_parts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_request_warranty_extension: {
        Args: {
          p_extension_days: number
          p_notes?: string
          p_reason: string
          p_requested_by?: string
          p_warranty_id: string
        }
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          extension_days: number
          extension_number: string
          extension_reason: string
          id: string
          new_end_date: string
          notes: string | null
          previous_end_date: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          updated_at: string
          warranty_id: string
        }
        SetofOptions: {
          from: "*"
          to: "warranty_extensions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_request_warranty_transfer: {
        Args: {
          p_notes?: string
          p_reason: string
          p_requested_by?: string
          p_to_customer_id: string
          p_warranty_id: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          from_customer_id: string
          id: string
          notes: string | null
          product_unit_id: string
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          to_customer_id: string
          transfer_number: string
          transfer_reason: string
          transfer_status: string
          updated_at: string
          warranty_id: string
        }
        SetofOptions: {
          from: "*"
          to: "warranty_transfers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_schedule_service_visit: {
        Args: {
          p_created_by: string
          p_customer_notes: string
          p_scheduled_at: string
          p_technician_id: string
          p_ticket_id: string
          p_visit_type: string
        }
        Returns: {
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_confirmation_otp: string | null
          customer_confirmed_at: string | null
          customer_notes: string | null
          customer_signature_data: string | null
          id: string
          latitude: number | null
          longitude: number | null
          otp_expires_at: string | null
          scheduled_at: string
          service_ticket_id: string
          started_at: string | null
          status: string
          technician_id: string
          technician_notes: string | null
          updated_at: string
          visit_type: string
        }
        SetofOptions: {
          from: "*"
          to: "service_visits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_submit_purchase_order: {
        Args: { p_notes?: string; p_po_id: string }
        Returns: Json
      }
      fn_transfer_dealer_consignment_stock: {
        Args: {
          p_from_dealer_id: string
          p_product_unit_ids: string[]
          p_reason?: string
          p_to_dealer_id: string
        }
        Returns: Json
      }
      fn_update_consignment_settlement: {
        Args: {
          p_consignment_ids: string[]
          p_notes?: string
          p_settlement_reference?: string
          p_settlement_status: string
        }
        Returns: Json
      }
      fn_update_visit_status: {
        Args: {
          p_latitude?: number
          p_longitude?: number
          p_new_status: string
          p_technician_notes: string
          p_updated_by?: string
          p_visit_id: string
        }
        Returns: {
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_confirmation_otp: string | null
          customer_confirmed_at: string | null
          customer_notes: string | null
          customer_signature_data: string | null
          id: string
          latitude: number | null
          longitude: number | null
          otp_expires_at: string | null
          scheduled_at: string
          service_ticket_id: string
          started_at: string | null
          status: string
          technician_id: string
          technician_notes: string | null
          updated_at: string
          visit_type: string
        }
        SetofOptions: {
          from: "*"
          to: "service_visits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fn_record_visit_location: {
        Args: {
          p_accuracy?: number | null
          p_event_type: string
          p_gps_error_reason?: string | null
          p_is_gps_available?: boolean | null
          p_latitude?: number | null
          p_longitude?: number | null
          p_visit_id: string
        }
        Returns: {
          accuracy: number | null
          captured_at: string
          created_at: string
          event_type: string
          gps_error_reason: string | null
          id: string
          is_gps_available: boolean
          latitude: number | null
          longitude: number | null
          service_visit_id: string
          technician_id: string
        }
      }
      fn_submit_visit_customer_signature: {
        Args: {
          p_signature_data: string
          p_visit_id: string
        }
        Returns: {
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_confirmation_otp: string | null
          customer_confirmed_at: string | null
          customer_notes: string | null
          customer_signature_data: string | null
          id: string
          latitude: number | null
          longitude: number | null
          otp_expires_at: string | null
          scheduled_at: string
          service_ticket_id: string
          started_at: string | null
          status: string
          technician_id: string
          technician_notes: string | null
          updated_at: string
          visit_type: string
        }
      }
      fn_issue_spare_part_to_technician: {
        Args: {
          p_idempotency_key?: string | null
          p_quantity: number
          p_reason?: string | null
          p_spare_part_id: string
          p_technician_id: string
          p_warehouse_id: string
        }
        Returns: {
          created_at: string
          id: string
          last_reconciled_at: string | null
          min_trunk_threshold: number
          quantity_on_hand: number
          quantity_reserved: number
          spare_part_id: string
          technician_id: string
          updated_at: string
        }
      }
      fn_consume_technician_trunk_part: {
        Args: {
          p_idempotency_key?: string | null
          p_quantity: number
          p_spare_part_id: string
          p_technician_notes?: string | null
          p_ticket_id: string
          p_visit_id: string
          p_warranty_covered?: boolean
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          part_code: string
          part_name: string
          quantity: number
          requested_at: string | null
          requested_by: string | null
          service_ticket_id: string
          spare_part_id: string
          status: string | null
          unit_cost: number
          warranty_covered: boolean | null
        }
      }
      fn_return_technician_part: {
        Args: {
          p_idempotency_key?: string | null
          p_quantity: number
          p_reason?: string | null
          p_spare_part_id: string
          p_technician_id: string
          p_warehouse_id: string
        }
        Returns: {
          created_at: string
          id: string
          last_reconciled_at: string | null
          min_trunk_threshold: number
          quantity_on_hand: number
          quantity_reserved: number
          spare_part_id: string
          technician_id: string
          updated_at: string
        }
      }
      fn_record_damaged_or_lost_part: {
        Args: {
          p_idempotency_key?: string | null
          p_quantity: number
          p_reason: string
          p_spare_part_id: string
          p_status_type: string
          p_technician_id: string
        }
        Returns: {
          created_at: string
          id: string
          last_reconciled_at: string | null
          min_trunk_threshold: number
          quantity_on_hand: number
          quantity_reserved: number
          spare_part_id: string
          technician_id: string
          updated_at: string
        }
      }
      fn_submit_van_reconciliation: {
        Args: {
          p_items: Json
          p_technician_id: string
          p_technician_notes?: string | null
        }
        Returns: {
          created_at: string
          discrepancy_count: number
          id: string
          reconciliation_number: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          technician_id: string
          technician_notes: string | null
          total_items_counted: number
        }
      }
      fn_review_van_reconciliation: {
        Args: {
          p_action: string
          p_reconciliation_id: string
          p_review_notes?: string | null
        }
        Returns: {
          created_at: string
          discrepancy_count: number
          id: string
          reconciliation_number: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          submitted_at: string
          technician_id: string
          technician_notes: string | null
          total_items_counted: number
        }
      }
      fn_harvest_defective_core: {
        Args: {
          p_barcode?: string | null
          p_core_credit_eligible?: boolean
          p_defect_symptom: string
          p_estimated_core_value?: number
          p_item_type: string
          p_notes?: string | null
          p_product_unit_id?: string | null
          p_serial_number?: string | null
          p_spare_part_id?: string | null
          p_technician_id: string
          p_ticket_id?: string | null
          p_visit_id?: string | null
        }
        Returns: {
          barcode: string | null
          core_credit_amount: number | null
          core_credit_eligible: boolean
          core_tag_number: string
          created_at: string
          custody_status: string
          defect_symptom: string
          estimated_core_value: number | null
          harvested_at: string
          id: string
          inspection_notes: string | null
          item_type: string
          product_unit_id: string | null
          qa_inspected_at: string | null
          qa_inspected_by: string | null
          qa_passed: boolean | null
          reverse_manifest_id: string | null
          serial_number: string | null
          service_ticket_id: string | null
          service_visit_id: string | null
          spare_part_id: string | null
          technician_id: string
          updated_at: string
        }
      }
      fn_create_rma_reverse_manifest: {
        Args: {
          p_carrier_tracking_number?: string | null
          p_defective_core_ids: string[]
          p_destination_warehouse_id: string
          p_technician_id: string
          p_technician_notes?: string | null
        }
        Returns: {
          carrier_tracking_number: string | null
          created_at: string
          destination_warehouse_id: string
          discrepant_items_count: number
          dispatched_at: string | null
          id: string
          manifest_number: string
          received_at: string | null
          received_by: string | null
          received_items_count: number
          reconciled_at: string | null
          status: string
          technician_id: string
          technician_notes: string | null
          total_items_count: number
          updated_at: string
          warehouse_intake_notes: string | null
        }
      }
      fn_receive_rma_reverse_manifest: {
        Args: {
          p_items: Json
          p_manifest_id: string
          p_received_by?: string | null
          p_warehouse_intake_notes?: string | null
        }
        Returns: {
          carrier_tracking_number: string | null
          created_at: string
          destination_warehouse_id: string
          discrepant_items_count: number
          dispatched_at: string | null
          id: string
          manifest_number: string
          received_at: string | null
          received_by: string | null
          received_items_count: number
          reconciled_at: string | null
          status: string
          technician_id: string
          technician_notes: string | null
          total_items_count: number
          updated_at: string
          warehouse_intake_notes: string | null
        }
      }
      fn_inspect_and_settle_defective_core: {
        Args: {
          p_action: string
          p_condition_grading?: string | null
          p_core_credit_amount?: number
          p_defective_core_id: string
          p_inspection_notes?: string | null
          p_qa_passed?: boolean
        }
        Returns: {
          barcode: string | null
          core_credit_amount: number | null
          core_credit_eligible: boolean
          core_tag_number: string
          created_at: string
          custody_status: string
          defect_symptom: string
          estimated_core_value: number | null
          harvested_at: string
          id: string
          inspection_notes: string | null
          item_type: string
          product_unit_id: string | null
          qa_inspected_at: string | null
          qa_inspected_by: string | null
          qa_passed: boolean | null
          reverse_manifest_id: string | null
          serial_number: string | null
          service_ticket_id: string | null
          service_visit_id: string | null
          spare_part_id: string | null
          updated_at: string
        }
      }
      fn_create_refurb_work_order: {
        Args: {
          p_assigned_engineer_id?: string | null
          p_core_id: string
          p_notes?: string | null
        }
        Returns: {
          assigned_engineer_id: string | null
          audio_chassis_passed: boolean
          burn_in_duration_hours: number
          burn_in_passed: boolean
          certified_at: string | null
          certified_by: string | null
          created_at: string
          defective_core_id: string
          diagnostics_notes: string | null
          id: string
          labor_minutes: number
          optical_panel_passed: boolean
          rail_12v_tested: boolean
          rail_24v_tested: boolean
          rail_5v_tested: boolean
          restocked_warehouse_id: string | null
          status: string
          updated_at: string
          work_order_number: string
        }
      }
      fn_log_refurb_bench_test: {
        Args: {
          p_audio_chassis_passed?: boolean
          p_burn_in_duration_hours: number
          p_diagnostics_notes?: string | null
          p_labor_minutes?: number
          p_optical_panel_passed?: boolean
          p_rail_12v_tested: boolean
          p_rail_24v_tested: boolean
          p_rail_5v_tested: boolean
          p_work_order_id: string
        }
        Returns: {
          assigned_engineer_id: string | null
          audio_chassis_passed: boolean
          burn_in_duration_hours: number
          burn_in_passed: boolean
          certified_at: string | null
          certified_by: string | null
          created_at: string
          defective_core_id: string
          diagnostics_notes: string | null
          id: string
          labor_minutes: number
          optical_panel_passed: boolean
          rail_12v_tested: boolean
          rail_24v_tested: boolean
          rail_5v_tested: boolean
          restocked_warehouse_id: string | null
          status: string
          updated_at: string
          work_order_number: string
        }
      }
      fn_certify_and_restock_refurb_item: {
        Args: {
          p_destination_warehouse_id: string
          p_notes?: string | null
          p_work_order_id: string
        }
        Returns: Json
      }
      fn_scrap_defective_cores_batch: {
        Args: {
          p_authorized_cpcb_id?: string | null
          p_core_ids: string[]
          p_disposition_notes?: string | null
          p_recycler_vendor_name: string
          p_salvage_credit_realized?: number
          p_total_weight_kg?: number
        }
        Returns: {
          authorized_cpcb_id: string | null
          created_at: string
          disposed_at: string
          disposed_by: string | null
          disposition_notes: string | null
          id: string
          recycler_vendor_name: string
          salvage_credit_realized: number
          scrap_batch_number: string
          total_cores_count: number
          total_weight_kg: number
        }
      }
      fn_verify_visit_otp_and_complete: {
        Args: {
          p_entered_otp: string
          p_technician_id: string
          p_visit_id: string
        }
        Returns: {
          arrived_at: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_confirmation_otp: string | null
          customer_confirmed_at: string | null
          customer_notes: string | null
          customer_signature_data: string | null
          id: string
          latitude: number | null
          longitude: number | null
          otp_expires_at: string | null
          scheduled_at: string
          service_ticket_id: string
          started_at: string | null
          status: string
          technician_id: string
          technician_notes: string | null
          updated_at: string
          visit_type: string
        }
        SetofOptions: {
          from: "*"
          to: "service_visits"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      generate_automated_alerts: {
        Args: never
        Returns: {
          expiring_warranties_alerts: number
          low_spare_parts_alerts: number
        }[]
      }
      generate_product_unit_barcode: { Args: never; Returns: string }
      get_current_user_dealer_id: { Args: never; Returns: string }
      get_current_user_role: { Args: never; Returns: string }
      get_or_create_customer_comm_preferences: {
        Args: { p_customer_id: string }
        Returns: {
          created_at: string | null
          customer_id: string
          email_enabled: boolean
          id: string
          invoice_updates_enabled: boolean
          rma_updates_enabled: boolean
          service_updates_enabled: boolean
          sms_enabled: boolean
          updated_at: string | null
          warranty_updates_enabled: boolean
          whatsapp_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "customer_communication_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_or_create_notification_preferences: {
        Args: { p_user_id?: string }
        Returns: {
          created_at: string
          email_enabled: boolean
          id: string
          in_app_enabled: boolean
          inventory_enabled: boolean
          rma_enabled: boolean
          sales_enabled: boolean
          service_enabled: boolean
          sms_enabled: boolean
          spare_parts_enabled: boolean
          updated_at: string
          user_id: string
          warranty_enabled: boolean
          whatsapp_enabled: boolean
        }
        SetofOptions: {
          from: "*"
          to: "notification_preferences"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_product_unit_detail: { Args: { p_identifier: string }; Returns: Json }
      get_product_unit_history: { Args: { p_unit_id: string }; Returns: Json }
      get_unread_notification_count: { Args: never; Returns: number }
      initiate_warehouse_transfer: {
        Args: {
          p_reason?: string
          p_to_warehouse_id: string
          p_unit_id: string
        }
        Returns: Json
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      process_sales_return: {
        Args: {
          p_inspection_condition?: string
          p_notes?: string
          p_outcome?: string
          p_reason: string
          p_refund_amount?: number
          p_refund_method?: string
          p_sale_id: string
          p_unit_id: string
        }
        Returns: Json
      }
      receive_warehouse_transfer: {
        Args: { p_notes?: string; p_unit_id: string }
        Returns: Json
      }
      register_customer_warranty: {
        Args: {
          p_barcode: string
          p_customer_address?: string
          p_customer_email?: string
          p_customer_name: string
          p_customer_phone: string
          p_registration_method?: string
        }
        Returns: Json
      }
      remove_test_records: {
        Args: { p_sale_id: string; p_unit_id: string }
        Returns: string
      }
      render_communication_template: {
        Args: { p_context: Json; p_template_body: string }
        Returns: string
      }
      verify_tv_barcode_for_warranty: {
        Args: { p_barcode: string }
        Returns: Json
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
