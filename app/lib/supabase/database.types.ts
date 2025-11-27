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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  elfaroukgroup: {
    Tables: {
      branch_stocks: {
        Row: {
          branch_id: string | null
          branch_name: string
          created_at: string | null
          id: string
          min_stock_threshold: number | null
          product_id: string
          stock: number | null
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          branch_name: string
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id: string
          stock?: number | null
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          branch_name?: string
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id?: string
          stock?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branch_stocks_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "branch_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string
          allow_variants: boolean
          created_at: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          name_en: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          address: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          name_en?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          name_en?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "branches_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cart_items: {
        Row: {
          created_at: string | null
          id: string
          price: number
          product_id: string
          quantity: number
          selected_color: string | null
          selected_shape: string | null
          selected_size: string | null
          session_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          price?: number
          product_id: string
          quantity?: number
          selected_color?: string | null
          selected_shape?: string | null
          selected_size?: string | null
          session_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          price?: number
          product_id?: string
          quantity?: number
          selected_color?: string | null
          selected_shape?: string | null
          selected_size?: string | null
          session_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      cashbox_entries: {
        Row: {
          amount: number
          branch_id: string
          created_at: string | null
          description: string | null
          entry_type: string
          id: string
          reference_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          created_at?: string | null
          description?: string | null
          entry_type: string
          id?: string
          reference_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          created_at?: string | null
          description?: string | null
          entry_type?: string
          id?: string
          reference_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashbox_entries_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashbox_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "cashbox_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_en: string | null
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_en?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_currencies: {
        Row: {
          created_at: string | null
          currency_name: string
          id: string
          is_active: boolean | null
          updated_at: string | null
          usage_count: number | null
        }
        Insert: {
          created_at?: string | null
          currency_name: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Update: {
          created_at?: string | null
          currency_name?: string
          id?: string
          is_active?: boolean | null
          updated_at?: string | null
          usage_count?: number | null
        }
        Relationships: []
      }
      customer_groups: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          customer_id: string
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          reference_number: string | null
          updated_at: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          customer_id?: string
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "customer_payments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          account_balance: number | null
          address: string | null
          backup_phone: string | null
          category: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          loyalty_points: number | null
          name: string
          notes: string | null
          phone: string | null
          rank: string | null
          tax_id: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          account_balance?: number | null
          address?: string | null
          backup_phone?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          loyalty_points?: number | null
          name: string
          notes?: string | null
          phone?: string | null
          rank?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          account_balance?: number | null
          address?: string | null
          backup_phone?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          loyalty_points?: number | null
          name?: string
          notes?: string | null
          phone?: string | null
          rank?: string | null
          tax_id?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customers_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "customer_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          branch_id: string
          category: string
          created_at: string | null
          description: string
          id: string
          receipt_url: string | null
          user_id: string
        }
        Insert: {
          amount: number
          branch_id: string
          category?: string
          created_at?: string | null
          description: string
          id?: string
          receipt_url?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          branch_id?: string
          category?: string
          created_at?: string | null
          description?: string
          id?: string
          receipt_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "expenses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: []
      }
      inventory: {
        Row: {
          audit_status: string | null
          branch_id: string | null
          id: string
          last_updated: string | null
          min_stock: number | null
          product_id: string
          quantity: number
          warehouse_id: string | null
        }
        Insert: {
          audit_status?: string | null
          branch_id?: string | null
          id?: string
          last_updated?: string | null
          min_stock?: number | null
          product_id: string
          quantity?: number
          warehouse_id?: string | null
        }
        Update: {
          audit_status?: string | null
          branch_id?: string | null
          id?: string
          last_updated?: string | null
          min_stock?: number | null
          product_id?: string
          quantity?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string | null
          discount: number | null
          id: string
          is_prepared: boolean | null
          notes: string | null
          order_id: string
          prepared_at: string | null
          prepared_by: string | null
          product_id: string
          quantity: number
          unit_price: number
        }
        Insert: {
          created_at?: string | null
          discount?: number | null
          id?: string
          is_prepared?: boolean | null
          notes?: string | null
          order_id: string
          prepared_at?: string | null
          prepared_by?: string | null
          product_id: string
          quantity?: number
          unit_price: number
        }
        Update: {
          created_at?: string | null
          discount?: number | null
          id?: string
          is_prepared?: boolean | null
          notes?: string | null
          order_id?: string
          prepared_at?: string | null
          prepared_by?: string | null
          product_id?: string
          quantity?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          branch_id: string | null
          created_at: string | null
          customer_address: string | null
          customer_id: string | null
          customer_name: string
          customer_phone: string
          delivery_type: string | null
          id: string
          invoice_type: Database["elfaroukgroup"]["Enums"]["invoice_type_enum"] | null
          notes: string | null
          order_number: string
          shipping_amount: number | null
          status: string | null
          subtotal_amount: number | null
          time: string | null
          total_amount: number
          updated_at: string | null
          user_id: string | null
          user_session: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name: string
          customer_phone: string
          delivery_type?: string | null
          id?: string
          invoice_type?: Database["elfaroukgroup"]["Enums"]["invoice_type_enum"] | null
          notes?: string | null
          order_number: string
          shipping_amount?: number | null
          status?: string | null
          subtotal_amount?: number | null
          time?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
          user_session?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          customer_address?: string | null
          customer_id?: string | null
          customer_name?: string
          customer_phone?: string
          delivery_type?: string | null
          id?: string
          invoice_type?: Database["elfaroukgroup"]["Enums"]["invoice_type_enum"] | null
          notes?: string | null
          order_number?: string
          shipping_amount?: number | null
          status?: string | null
          subtotal_amount?: number | null
          time?: string | null
          total_amount?: number
          updated_at?: string | null
          user_id?: string | null
          user_session?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_cost_tracking: {
        Row: {
          average_cost: number
          created_at: string | null
          has_purchase_history: boolean | null
          id: string
          last_purchase_date: string | null
          last_purchase_price: number | null
          product_id: string | null
          total_cost: number
          total_quantity_purchased: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          average_cost?: number
          created_at?: string | null
          has_purchase_history?: boolean | null
          id?: string
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          product_id?: string | null
          total_cost?: number
          total_quantity_purchased?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          average_cost?: number
          created_at?: string | null
          has_purchase_history?: boolean | null
          id?: string
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          product_id?: string | null
          total_cost?: number
          total_quantity_purchased?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_cost_tracking_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_display_settings: {
        Row: {
          created_at: string | null
          display_mode: string
          id: string
          selected_branches: string[] | null
          selected_warehouses: string[] | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          display_mode?: string
          id?: string
          selected_branches?: string[] | null
          selected_warehouses?: string[] | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          display_mode?: string
          id?: string
          selected_branches?: string[] | null
          selected_warehouses?: string[] | null
          updated_at?: string | null
        }
        Relationships: []
      }
      product_images: {
        Row: {
          alt_text: string | null
          created_at: string | null
          id: string
          image_url: string
          product_id: string
          sort_order: number | null
        }
        Insert: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url: string
          product_id: string
          sort_order?: number | null
        }
        Update: {
          alt_text?: string | null
          created_at?: string | null
          id?: string
          image_url?: string
          product_id?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_location_thresholds: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          min_stock_threshold: number
          product_id: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          min_stock_threshold?: number
          product_id: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          min_stock_threshold?: number
          product_id?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_location_thresholds_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_thresholds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_location_thresholds_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      product_ratings: {
        Row: {
          created_at: string | null
          customer_email: string | null
          customer_id: string | null
          customer_name: string | null
          helpful_count: number | null
          id: string
          is_approved: boolean | null
          is_featured: boolean | null
          is_verified_purchase: boolean | null
          product_id: string
          rating: number
          review_text: string | null
          review_title: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          helpful_count?: number | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          is_verified_purchase?: boolean | null
          product_id: string
          rating: number
          review_text?: string | null
          review_title?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          customer_email?: string | null
          customer_id?: string | null
          customer_name?: string | null
          helpful_count?: number | null
          id?: string
          is_approved?: boolean | null
          is_featured?: boolean | null
          is_verified_purchase?: boolean | null
          product_id?: string
          rating?: number
          review_text?: string | null
          review_title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_ratings_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_ratings_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_size_group_items: {
        Row: {
          created_at: string | null
          id: string
          product_id: string
          size_group_id: string
          size_name: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          product_id: string
          size_group_id: string
          size_name: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          product_id?: string
          size_group_id?: string
          size_name?: string
          sort_order?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_size_group_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_size_group_items_size_group_id_fkey"
            columns: ["size_group_id"]
            isOneToOne: false
            referencedRelation: "product_size_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      product_size_groups: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_sizes: {
        Row: {
          created_at: string | null
          id: string
          is_available: boolean | null
          min_stock: number | null
          price_adjustment: number | null
          product_id: string
          size_category: string | null
          size_code: string | null
          size_name: string
          size_value: string | null
          sort_order: number | null
          stock_quantity: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          min_stock?: number | null
          price_adjustment?: number | null
          product_id: string
          size_category?: string | null
          size_code?: string | null
          size_name: string
          size_value?: string | null
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_available?: boolean | null
          min_stock?: number | null
          price_adjustment?: number | null
          product_id?: string
          size_category?: string | null
          size_code?: string | null
          size_name?: string
          size_value?: string | null
          sort_order?: number | null
          stock_quantity?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_sizes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_variants: {
        Row: {
          barcode: string | null
          branch_id: string
          color_hex: string | null
          color_name: string | null
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          product_id: string
          quantity: number
          updated_at: string | null
          variant_type: string
        }
        Insert: {
          barcode?: string | null
          branch_id: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name: string
          product_id: string
          quantity?: number
          updated_at?: string | null
          variant_type: string
        }
        Update: {
          barcode?: string | null
          branch_id?: string
          color_hex?: string | null
          color_name?: string | null
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          product_id?: string
          quantity?: number
          updated_at?: string | null
          variant_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          barcodes: string[] | null
          branch: string | null
          category_id: string | null
          cost_price: number
          created_at: string | null
          description: string | null
          description_en: string | null
          discount_amount: number | null
          discount_end_date: string | null
          discount_percentage: number | null
          discount_start_date: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          is_featured: boolean | null
          is_hidden: boolean | null
          location: string | null
          main_image_url: string | null
          max_stock: number | null
          min_stock: number | null
          name: string
          name_en: string | null
          price: number
          price1: number | null
          price2: number | null
          price3: number | null
          price4: number | null
          product_code: string | null
          rating: number | null
          rating_count: number | null
          status: string | null
          stock: number | null
          sub_image_url: string | null
          suggested_products: string[] | null
          tax_price: number | null
          unit: string | null
          updated_at: string | null
          video_url: string | null
          warehouse: string | null
          wholesale_price: number | null
        }
        Insert: {
          barcode?: string | null
          barcodes?: string[] | null
          branch?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          discount_amount?: number | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          location?: string | null
          main_image_url?: string | null
          max_stock?: number | null
          min_stock?: number | null
          name: string
          name_en?: string | null
          price?: number
          price1?: number | null
          price2?: number | null
          price3?: number | null
          price4?: number | null
          product_code?: string | null
          rating?: number | null
          rating_count?: number | null
          status?: string | null
          stock?: number | null
          sub_image_url?: string | null
          suggested_products?: string[] | null
          tax_price?: number | null
          unit?: string | null
          updated_at?: string | null
          video_url?: string | null
          warehouse?: string | null
          wholesale_price?: number | null
        }
        Update: {
          barcode?: string | null
          barcodes?: string[] | null
          branch?: string | null
          category_id?: string | null
          cost_price?: number
          created_at?: string | null
          description?: string | null
          description_en?: string | null
          discount_amount?: number | null
          discount_end_date?: string | null
          discount_percentage?: number | null
          discount_start_date?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          is_featured?: boolean | null
          is_hidden?: boolean | null
          location?: string | null
          main_image_url?: string | null
          max_stock?: number | null
          min_stock?: number | null
          name?: string
          name_en?: string | null
          price?: number
          price1?: number | null
          price2?: number | null
          price3?: number | null
          price4?: number | null
          product_code?: string | null
          rating?: number | null
          rating_count?: number | null
          status?: string | null
          stock?: number | null
          sub_image_url?: string | null
          suggested_products?: string[] | null
          tax_price?: number | null
          unit?: string | null
          updated_at?: string | null
          video_url?: string | null
          warehouse?: string | null
          wholesale_price?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoice_items: {
        Row: {
          created_at: string | null
          discount_amount: number | null
          id: string
          notes: string | null
          product_id: string | null
          purchase_invoice_id: string | null
          quantity: number
          tax_amount: number | null
          total_price: number
          unit_purchase_price: number
          updated_at: string | null
          variant_id: string | null
        }
        Insert: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          purchase_invoice_id?: string | null
          quantity: number
          tax_amount?: number | null
          total_price: number
          unit_purchase_price: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Update: {
          created_at?: string | null
          discount_amount?: number | null
          id?: string
          notes?: string | null
          product_id?: string | null
          purchase_invoice_id?: string | null
          quantity?: number
          tax_amount?: number | null
          total_price?: number
          unit_purchase_price?: number
          updated_at?: string | null
          variant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_invoice_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoice_items_purchase_invoice_id_fkey"
            columns: ["purchase_invoice_id"]
            isOneToOne: false
            referencedRelation: "purchase_invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_invoices: {
        Row: {
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          discount_amount: number | null
          id: string
          invoice_date: string
          invoice_number: string
          invoice_type:
            | Database["elfaroukgroup"]["Enums"]["purchase_invoice_type_enum"]
            | null
          is_active: boolean | null
          net_amount: number
          notes: string | null
          payment_status: string | null
          record_id: string | null
          supplier_id: string | null
          tax_amount: number | null
          time: string | null
          total_amount: number
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number: string
          invoice_type?:
            | Database["elfaroukgroup"]["Enums"]["purchase_invoice_type_enum"]
            | null
          is_active?: boolean | null
          net_amount?: number
          notes?: string | null
          payment_status?: string | null
          record_id?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          discount_amount?: number | null
          id?: string
          invoice_date?: string
          invoice_number?: string
          invoice_type?:
            | Database["elfaroukgroup"]["Enums"]["purchase_invoice_type_enum"]
            | null
          is_active?: boolean | null
          net_amount?: number
          notes?: string | null
          payment_status?: string | null
          record_id?: string | null
          supplier_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_purchase_invoices_record_id"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_invoices_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      records: {
        Row: {
          branch_id: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "safes_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          cost_price: number
          created_at: string | null
          discount: number | null
          id: string
          notes: string | null
          product_id: string
          quantity: number
          sale_id: string
          unit_price: number
        }
        Insert: {
          cost_price?: number
          created_at?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          product_id: string
          quantity?: number
          sale_id: string
          unit_price: number
        }
        Update: {
          cost_price?: number
          created_at?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
          branch_id: string
          cashier_id: string | null
          created_at: string | null
          customer_id: string | null
          discount_amount: number | null
          id: string
          invoice_number: string
          invoice_type:
            | Database["elfaroukgroup"]["Enums"]["sales_invoice_type_enum"]
            | null
          is_updated: boolean | null
          notes: string | null
          payment_method: string
          profit: number | null
          record_id: string | null
          tax_amount: number | null
          time: string | null
          total_amount: number
          update_history: Json | null
        }
        Insert: {
          branch_id: string
          cashier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number: string
          invoice_type?:
            | Database["elfaroukgroup"]["Enums"]["sales_invoice_type_enum"]
            | null
          is_updated?: boolean | null
          notes?: string | null
          payment_method?: string
          profit?: number | null
          record_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          update_history?: Json | null
        }
        Update: {
          branch_id?: string
          cashier_id?: string | null
          created_at?: string | null
          customer_id?: string | null
          discount_amount?: number | null
          id?: string
          invoice_number?: string
          invoice_type?:
            | Database["elfaroukgroup"]["Enums"]["sales_invoice_type_enum"]
            | null
          is_updated?: boolean | null
          notes?: string | null
          payment_method?: string
          profit?: number | null
          record_id?: string | null
          tax_amount?: number | null
          time?: string | null
          total_amount?: number
          update_history?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_sales_record_id"
            columns: ["record_id"]
            isOneToOne: false
            referencedRelation: "records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_areas: {
        Row: {
          created_at: string | null
          id: string
          name: string
          price: number
          shipping_governorate_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          price: number
          shipping_governorate_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          shipping_governorate_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_areas_shipping_governorate_id_fkey"
            columns: ["shipping_governorate_id"]
            isOneToOne: false
            referencedRelation: "shipping_governorates"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_companies: {
        Row: {
          created_at: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      shipping_governorates: {
        Row: {
          created_at: string | null
          id: string
          name: string
          price: number | null
          shipping_company_id: string
          type: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          price?: number | null
          shipping_company_id: string
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          price?: number | null
          shipping_company_id?: string
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_governorates_shipping_company_id_fkey"
            columns: ["shipping_company_id"]
            isOneToOne: false
            referencedRelation: "shipping_companies"
            referencedColumns: ["id"]
          },
        ]
      }
      store_categories: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_en: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_en?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_en?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      store_category_products: {
        Row: {
          added_at: string | null
          added_by: string | null
          id: string
          product_id: string | null
          sort_order: number | null
          store_category_id: string | null
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          product_id?: string | null
          sort_order?: number | null
          store_category_id?: string | null
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          id?: string
          product_id?: string | null
          sort_order?: number | null
          store_category_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_category_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_category_products_store_category_id_fkey"
            columns: ["store_category_id"]
            isOneToOne: false
            referencedRelation: "store_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_groups: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_groups_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "supplier_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      supplier_payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          notes: string | null
          payment_date: string | null
          payment_method: string | null
          reference_number: string | null
          supplier_id: string
          updated_at: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          supplier_id: string
          updated_at?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          notes?: string | null
          payment_date?: string | null
          payment_method?: string | null
          reference_number?: string | null
          supplier_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplier_payments_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          account_balance: number | null
          address: string | null
          category: string | null
          city: string | null
          company_name: string | null
          contact_person: string | null
          country: string | null
          created_at: string | null
          credit_limit: number | null
          email: string | null
          group_id: string | null
          id: string
          is_active: boolean | null
          last_purchase: string | null
          name: string
          notes: string | null
          phone: string | null
          rank: string | null
          tax_id: string | null
          total_purchases: number | null
          updated_at: string | null
        }
        Insert: {
          account_balance?: number | null
          address?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          last_purchase?: string | null
          name: string
          notes?: string | null
          phone?: string | null
          rank?: string | null
          tax_id?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Update: {
          account_balance?: number | null
          address?: string | null
          category?: string | null
          city?: string | null
          company_name?: string | null
          contact_person?: string | null
          country?: string | null
          created_at?: string | null
          credit_limit?: number | null
          email?: string | null
          group_id?: string | null
          id?: string
          is_active?: boolean | null
          last_purchase?: string | null
          name?: string
          notes?: string | null
          phone?: string | null
          rank?: string | null
          tax_id?: string | null
          total_purchases?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          settings_data: Json
          updated_at: string | null
          version: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          settings_data?: Json
          updated_at?: string | null
          version?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          settings_data?: Json
          updated_at?: string | null
          version?: string | null
        }
        Relationships: []
      }
      user_column_preferences: {
        Row: {
          created_at: string | null
          id: string
          preferences: Json
          report_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          preferences?: Json
          report_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          preferences?: Json
          report_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_preferences: {
        Row: {
          created_at: string | null
          id: number
          preferences: Json
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: number
          preferences?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: number
          preferences?: Json
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          branch_id: string | null
          created_at: string | null
          email: string | null
          full_name: string
          id: string
          is_active: boolean | null
          is_admin: boolean
          phone: string | null
          role: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          is_admin?: boolean
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          branch_id?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          is_admin?: boolean
          phone?: string | null
          role?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_user_profiles_branch"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          parent_role: string | null
          permissions: string[] | null
          price_level: number | null
          role_type: string
          updated_at: string | null
          user_count: number | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_role?: string | null
          permissions?: string[] | null
          price_level?: number | null
          role_type?: string
          updated_at?: string | null
          user_count?: number | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_role?: string | null
          permissions?: string[] | null
          price_level?: number | null
          role_type?: string
          updated_at?: string | null
          user_count?: number | null
        }
        Relationships: []
      }
      warehouse_stocks: {
        Row: {
          created_at: string | null
          id: string
          min_stock_threshold: number | null
          product_id: string
          stock: number | null
          updated_at: string | null
          warehouse_id: string | null
          warehouse_name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id: string
          stock?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
          warehouse_name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          min_stock_threshold?: number | null
          product_id?: string
          stock?: number | null
          updated_at?: string | null
          warehouse_id?: string | null
          warehouse_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_stocks_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_stocks_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string
          allow_variants: boolean
          created_at: string | null
          id: string
          is_active: boolean | null
          manager_id: string | null
          name: string
          name_en: string | null
          phone: string
          updated_at: string | null
        }
        Insert: {
          address: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name: string
          name_en?: string | null
          phone: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          allow_variants?: boolean
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          manager_id?: string | null
          name?: string
          name_en?: string | null
          phone?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "current_user_role"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "warehouses_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      current_user_role: {
        Row: {
          full_name: string | null
          is_active: boolean | null
          is_admin: boolean | null
          role: string | null
          user_id: string | null
        }
        Insert: {
          full_name?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          role?: string | null
          user_id?: string | null
        }
        Update: {
          full_name?: string | null
          is_active?: boolean | null
          is_admin?: boolean | null
          role?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      adjust_inventory_quantity: {
        Args: {
          p_adjustment: number
          p_branch_id: string
          p_product_id: string
        }
        Returns: {
          branch_id: string
          id: string
          last_updated: string
          product_id: string
          quantity: number
        }[]
      }
      create_admin_user: {
        Args: {
          admin_email: string
          admin_name: string
          admin_password: string
        }
        Returns: string
      }
      create_invoice: {
        Args: {
          p_branch_id: string
          p_next_status?: string
          p_notes?: string
          p_order_number: string
          p_paid_amount: number
          p_record_id: string
        }
        Returns: Json
      }
      demote_admin_to_user: {
        Args: { user_id: string }
        Returns: boolean
      }
      generate_invoice_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      generate_order_number: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_low_stock_products: {
        Args: { p_branch_id?: string }
        Returns: {
          branch_id: string
          branch_name: string
          current_quantity: number
          min_stock: number
          product_id: string
          product_name: string
        }[]
      }
      is_admin_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      promote_user_to_admin: {
        Args: { user_id: string }
        Returns: boolean
      }
      transfer_stock: {
        Args:
          | {
              p_from_branch_id: string
              p_product_id: string
              p_quantity: number
              p_to_branch_id: string
            }
          | {
              p_from_branch_id: string
              p_product_id: string
              p_quantity: number
              p_to_branch_id: string
              p_user_id: string
            }
        Returns: boolean
      }
      update_inventory_quantity: {
        Args: {
          input_branch_id: string
          input_product_id: string
          input_quantity: number
        }
        Returns: {
          inv_branch_id: string
          inv_last_updated: string
          inv_product_id: string
          inv_quantity: number
          inventory_id: string
        }[]
      }
    }
    Enums: {
      invoice_type_enum: "Sale" | "Purchase" | "Sale Return" | "Purchase Return"
      purchase_invoice_type_enum: "Purchase Invoice" | "Purchase Return"
      sales_invoice_type_enum: "Sale Invoice" | "Sale Return"
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
      invoice_type_enum: ["Sale", "Purchase", "Sale Return", "Purchase Return"],
      purchase_invoice_type_enum: ["Purchase Invoice", "Purchase Return"],
      sales_invoice_type_enum: ["Sale Invoice", "Sale Return"],
    },
  },
} as const