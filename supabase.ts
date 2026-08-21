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
    PostgrestVersion: "14.5"
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
      announcements: {
        Row: {
          content: string | null
          createdAt: string
          expiresAt: string | null
          id: string
          imageUrl: string | null
          isPublished: boolean
          postedBy: string
          publishedAt: string | null
          title: string
          type: Database["public"]["Enums"]["announcementType"]
        }
        Insert: {
          content?: string | null
          createdAt?: string
          expiresAt?: string | null
          id?: string
          imageUrl?: string | null
          isPublished?: boolean
          postedBy: string
          publishedAt?: string | null
          title: string
          type?: Database["public"]["Enums"]["announcementType"]
        }
        Update: {
          content?: string | null
          createdAt?: string
          expiresAt?: string | null
          id?: string
          imageUrl?: string | null
          isPublished?: boolean
          postedBy?: string
          publishedAt?: string | null
          title?: string
          type?: Database["public"]["Enums"]["announcementType"]
        }
        Relationships: [
          {
            foreignKeyName: "announcements_postedBy_fkey"
            columns: ["postedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      chatLogs: {
        Row: {
          createdAt: string
          id: string
          message: string
          senderType: Database["public"]["Enums"]["senderType"]
          userId: string
        }
        Insert: {
          createdAt?: string
          id?: string
          message: string
          senderType: Database["public"]["Enums"]["senderType"]
          userId: string
        }
        Update: {
          createdAt?: string
          id?: string
          message?: string
          senderType?: Database["public"]["Enums"]["senderType"]
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatLogs_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      debtRecords: {
        Row: {
          amount: number
          createdAt: string
          debtType: Database["public"]["Enums"]["debtType"]
          dueDate: string | null
          id: string
          note: string | null
          orderId: string | null
          productId: number | null
          recordedBy: string | null
          status: Database["public"]["Enums"]["debtStatus"]
          updatedAt: string
          userId: string
        }
        Insert: {
          amount: number
          createdAt?: string
          debtType: Database["public"]["Enums"]["debtType"]
          dueDate?: string | null
          id?: string
          note?: string | null
          orderId?: string | null
          productId?: number | null
          recordedBy?: string | null
          status?: Database["public"]["Enums"]["debtStatus"]
          updatedAt?: string
          userId: string
        }
        Update: {
          amount?: number
          createdAt?: string
          debtType?: Database["public"]["Enums"]["debtType"]
          dueDate?: string | null
          id?: string
          note?: string | null
          orderId?: string | null
          productId?: number | null
          recordedBy?: string | null
          status?: Database["public"]["Enums"]["debtStatus"]
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtRecords_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtRecords_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtRecords_recordedBy_fkey"
            columns: ["recordedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtRecords_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      debtTransactions: {
        Row: {
          amount: number
          createdAt: string
          debtRecordId: string
          id: string
          note: string | null
          recordedBy: string | null
          transactionType: string
        }
        Insert: {
          amount: number
          createdAt?: string
          debtRecordId: string
          id?: string
          note?: string | null
          recordedBy?: string | null
          transactionType: string
        }
        Update: {
          amount?: number
          createdAt?: string
          debtRecordId?: string
          id?: string
          note?: string | null
          recordedBy?: string | null
          transactionType?: string
        }
        Relationships: [
          {
            foreignKeyName: "debtTransactions_debtRecordId_fkey"
            columns: ["debtRecordId"]
            isOneToOne: false
            referencedRelation: "debtRecords"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debtTransactions_recordedBy_fkey"
            columns: ["recordedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveryCheckpoints: {
        Row: {
          checkpointName: string
          createdAt: string
          id: string
          isSynced: boolean
          lat: number | null
          lng: number | null
          orderId: string
          scannedAt: string
        }
        Insert: {
          checkpointName: string
          createdAt?: string
          id?: string
          isSynced?: boolean
          lat?: number | null
          lng?: number | null
          orderId: string
          scannedAt?: string
        }
        Update: {
          checkpointName?: string
          createdAt?: string
          id?: string
          isSynced?: boolean
          lat?: number | null
          lng?: number | null
          orderId?: string
          scannedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveryCheckpoints_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveryTracking: {
        Row: {
          currentLat: number | null
          currentLng: number | null
          destLat: number | null
          destLng: number | null
          driverId: string | null
          estimatedMinutes: number | null
          id: string
          lastKnownAt: string | null
          lastKnownLat: number | null
          lastKnownLng: number | null
          lastSyncedAt: string | null
          orderId: string
          signalLostAt: string | null
          status: Database["public"]["Enums"]["deliveryStatus"]
          updatedAt: string
        }
        Insert: {
          currentLat?: number | null
          currentLng?: number | null
          destLat?: number | null
          destLng?: number | null
          driverId?: string | null
          estimatedMinutes?: number | null
          id?: string
          lastKnownAt?: string | null
          lastKnownLat?: number | null
          lastKnownLng?: number | null
          lastSyncedAt?: string | null
          orderId: string
          signalLostAt?: string | null
          status?: Database["public"]["Enums"]["deliveryStatus"]
          updatedAt?: string
        }
        Update: {
          currentLat?: number | null
          currentLng?: number | null
          destLat?: number | null
          destLng?: number | null
          driverId?: string | null
          estimatedMinutes?: number | null
          id?: string
          lastKnownAt?: string | null
          lastKnownLat?: number | null
          lastKnownLng?: number | null
          lastSyncedAt?: string | null
          orderId?: string
          signalLostAt?: string | null
          status?: Database["public"]["Enums"]["deliveryStatus"]
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveryTracking_driverId_fkey"
            columns: ["driverId"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveryTracking_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          address: string | null
          authId: string | null
          avatarUrl: string | null
          createdAt: string
          email: string
          id: string
          isActive: boolean
          name: string
          role: Database["public"]["Enums"]["employeeRole"]
          tel: string | null
          thaiId: string | null
          updatedAt: string
        }
        Insert: {
          address?: string | null
          authId?: string | null
          avatarUrl?: string | null
          createdAt?: string
          email: string
          id?: string
          isActive?: boolean
          name: string
          role?: Database["public"]["Enums"]["employeeRole"]
          tel?: string | null
          thaiId?: string | null
          updatedAt?: string
        }
        Update: {
          address?: string | null
          authId?: string | null
          avatarUrl?: string | null
          createdAt?: string
          email?: string
          id?: string
          isActive?: boolean
          name?: string
          role?: Database["public"]["Enums"]["employeeRole"]
          tel?: string | null
          thaiId?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      inventoryLog: {
        Row: {
          createdAt: string
          createdBy: string | null
          id: string
          inventoryProductId: string
          note: string | null
          orderId: string | null
          orderItemId: string | null
          quantityOnHandAfter: number
          quantityOnHandBefore: number
          quantityOnHandChange: number
          quantityReservedAfter: number
          quantityReservedBefore: number
          quantityReservedChange: number
          transactionType: string
          updatedAt: string
          updatedBy: string | null
        }
        Insert: {
          createdAt?: string
          createdBy?: string | null
          id?: string
          inventoryProductId: string
          note?: string | null
          orderId?: string | null
          orderItemId?: string | null
          quantityOnHandAfter: number
          quantityOnHandBefore: number
          quantityOnHandChange?: number
          quantityReservedAfter: number
          quantityReservedBefore: number
          quantityReservedChange?: number
          transactionType: string
          updatedAt?: string
          updatedBy?: string | null
        }
        Update: {
          createdAt?: string
          createdBy?: string | null
          id?: string
          inventoryProductId?: string
          note?: string | null
          orderId?: string | null
          orderItemId?: string | null
          quantityOnHandAfter?: number
          quantityOnHandBefore?: number
          quantityOnHandChange?: number
          quantityReservedAfter?: number
          quantityReservedBefore?: number
          quantityReservedChange?: number
          transactionType?: string
          updatedAt?: string
          updatedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventoryLog_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventoryLog_inventoryProductId_fkey"
            columns: ["inventoryProductId"]
            isOneToOne: false
            referencedRelation: "inventoryProducts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventoryLog_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventoryLog_orderItemId_fkey"
            columns: ["orderItemId"]
            isOneToOne: false
            referencedRelation: "orderItems"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventoryLog_updatedBy_fkey"
            columns: ["updatedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      inventoryProducts: {
        Row: {
          createdAt: string
          createdBy: string | null
          id: string
          itemCondition: string
          minimumStock: number
          productId: number
          quantityAvailable: number | null
          quantityOnHand: number
          quantityReserved: number
          stockStatus: string | null
          updatedAt: string
          updatedBy: string | null
        }
        Insert: {
          createdAt?: string
          createdBy?: string | null
          id?: string
          itemCondition?: string
          minimumStock?: number
          productId: number
          quantityAvailable?: number | null
          quantityOnHand?: number
          quantityReserved?: number
          stockStatus?: string | null
          updatedAt?: string
          updatedBy?: string | null
        }
        Update: {
          createdAt?: string
          createdBy?: string | null
          id?: string
          itemCondition?: string
          minimumStock?: number
          productId?: number
          quantityAvailable?: number | null
          quantityOnHand?: number
          quantityReserved?: number
          stockStatus?: string | null
          updatedAt?: string
          updatedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventoryProducts_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventoryProducts_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventoryProducts_updatedBy_fkey"
            columns: ["updatedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      orderItems: {
        Row: {
          createdAt: string
          createdBy: string | null
          id: string
          orderId: string
          productId: number
          productNameSnapshot: string
          quantity: number
          saleType: string
          totalPrice: number | null
          unitPrice: number
          updatedAt: string
          updatedBy: string | null
        }
        Insert: {
          createdAt?: string
          createdBy?: string | null
          id?: string
          orderId: string
          productId: number
          productNameSnapshot: string
          quantity?: number
          saleType: string
          totalPrice?: number | null
          unitPrice: number
          updatedAt?: string
          updatedBy?: string | null
        }
        Update: {
          createdAt?: string
          createdBy?: string | null
          id?: string
          orderId?: string
          productId?: number
          productNameSnapshot?: string
          quantity?: number
          saleType?: string
          totalPrice?: number | null
          unitPrice?: number
          updatedAt?: string
          updatedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orderItems_createdBy_fkey"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orderItems_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orderItems_productId_fkey"
            columns: ["productId"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orderItems_updatedBy_fkey"
            columns: ["updatedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          createdAt: string
          deliveryAddress: string | null
          deliveryLat: number | null
          deliveryLng: number | null
          id: string
          note: string | null
          paymentMethod: Database["public"]["Enums"]["paymentMethod"] | null
          paymentStatus: Database["public"]["Enums"]["paymentStatus"]
          status: Database["public"]["Enums"]["orderStatus"]
          totalAmount: number
          updatedAt: string
          userId: string
        }
        Insert: {
          createdAt?: string
          deliveryAddress?: string | null
          deliveryLat?: number | null
          deliveryLng?: number | null
          id?: string
          note?: string | null
          paymentMethod?: Database["public"]["Enums"]["paymentMethod"] | null
          paymentStatus?: Database["public"]["Enums"]["paymentStatus"]
          status?: Database["public"]["Enums"]["orderStatus"]
          totalAmount?: number
          updatedAt?: string
          userId: string
        }
        Update: {
          createdAt?: string
          deliveryAddress?: string | null
          deliveryLat?: number | null
          deliveryLng?: number | null
          id?: string
          note?: string | null
          paymentMethod?: Database["public"]["Enums"]["paymentMethod"] | null
          paymentStatus?: Database["public"]["Enums"]["paymentStatus"]
          status?: Database["public"]["Enums"]["orderStatus"]
          totalAmount?: number
          updatedAt?: string
          userId?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          createdAt: string
          id: string
          method: Database["public"]["Enums"]["paymentMethod"]
          orderId: string
          status: Database["public"]["Enums"]["paymentStatus"]
          verifiedAt: string | null
          verifiedBy: string | null
        }
        Insert: {
          amount: number
          createdAt?: string
          id?: string
          method: Database["public"]["Enums"]["paymentMethod"]
          orderId: string
          status?: Database["public"]["Enums"]["paymentStatus"]
          verifiedAt?: string | null
          verifiedBy?: string | null
        }
        Update: {
          amount?: number
          createdAt?: string
          id?: string
          method?: Database["public"]["Enums"]["paymentMethod"]
          orderId?: string
          status?: Database["public"]["Enums"]["paymentStatus"]
          verifiedAt?: string | null
          verifiedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payments_orderId_fkey"
            columns: ["orderId"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_verifiedBy_fkey"
            columns: ["verifiedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brandId: number
          createdAt: string
          createdBy: string
          exchangePrice: number | null
          id: number
          imageUrl: string | null
          isActive: boolean
          name: string
          refillPrice: number | null
          sellPrice: number
          size: number | null
          typeId: number
          unitId: number
          updatedAt: string | null
          updatedBy: string | null
        }
        Insert: {
          brandId: number
          createdAt?: string
          createdBy: string
          exchangePrice?: number | null
          id?: number
          imageUrl?: string | null
          isActive: boolean
          name: string
          refillPrice?: number | null
          sellPrice?: number
          size?: number | null
          typeId: number
          unitId: number
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Update: {
          brandId?: number
          createdAt?: string
          createdBy?: string
          exchangePrice?: number | null
          id?: number
          imageUrl?: string | null
          isActive?: boolean
          name?: string
          refillPrice?: number | null
          sellPrice?: number
          size?: number | null
          typeId?: number
          unitId?: number
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "FK_products_brand"
            columns: ["brandId"]
            isOneToOne: false
            referencedRelation: "productsBrand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FK_products_createdBy"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FK_products_type"
            columns: ["typeId"]
            isOneToOne: false
            referencedRelation: "productsType"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FK_products_unit"
            columns: ["unitId"]
            isOneToOne: false
            referencedRelation: "productsUnit"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FK_products_updatedBy"
            columns: ["updatedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      productsBrand: {
        Row: {
          createdAt: string
          createdBy: string
          id: number
          name: string
          updatedAt: string | null
          updatedBy: string | null
        }
        Insert: {
          createdAt?: string
          createdBy: string
          id?: number
          name: string
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Update: {
          createdAt?: string
          createdBy?: string
          id?: number
          name?: string
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "FK_productsBrand_createdBy"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FK_productsBrand_updatedBy"
            columns: ["updatedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      productsType: {
        Row: {
          createdAt: string
          createdBy: string
          id: number
          name: string
          updatedAt: string | null
          updatedBy: string | null
        }
        Insert: {
          createdAt?: string
          createdBy: string
          id?: number
          name: string
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Update: {
          createdAt?: string
          createdBy?: string
          id?: number
          name?: string
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "FK_productsType_createdBy"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FK_productsType_updatedBy"
            columns: ["updatedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      productsUnit: {
        Row: {
          createdAt: string
          createdBy: string
          id: number
          unit: string
          updatedAt: string | null
          updatedBy: string | null
        }
        Insert: {
          createdAt?: string
          createdBy: string
          id?: number
          unit: string
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Update: {
          createdAt?: string
          createdBy?: string
          id?: number
          unit?: string
          updatedAt?: string | null
          updatedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "FK_productsUnit_createdBy"
            columns: ["createdBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "FK_productsUnit_updatedBy"
            columns: ["updatedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      transferSlips: {
        Row: {
          createdAt: string
          id: string
          paymentId: string
          rejectReason: string | null
          slipImageUrl: string
          status: Database["public"]["Enums"]["slipStatus"]
          userId: string
          verifiedAt: string | null
          verifiedBy: string | null
        }
        Insert: {
          createdAt?: string
          id?: string
          paymentId: string
          rejectReason?: string | null
          slipImageUrl: string
          status?: Database["public"]["Enums"]["slipStatus"]
          userId: string
          verifiedAt?: string | null
          verifiedBy?: string | null
        }
        Update: {
          createdAt?: string
          id?: string
          paymentId?: string
          rejectReason?: string | null
          slipImageUrl?: string
          status?: Database["public"]["Enums"]["slipStatus"]
          userId?: string
          verifiedAt?: string | null
          verifiedBy?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transferSlips_paymentId_fkey"
            columns: ["paymentId"]
            isOneToOne: false
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferSlips_userId_fkey"
            columns: ["userId"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferSlips_verifiedBy_fkey"
            columns: ["verifiedBy"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          address: string | null
          authId: string | null
          avatarUrl: string | null
          contactName: string | null
          createdAt: string
          customerType: string
          email: string | null
          id: string
          isActive: boolean
          lineDisplayName: string | null
          lineUserId: string
          name: string
          phone: string | null
          shopName: string | null
          updatedAt: string
        }
        Insert: {
          address?: string | null
          authId?: string | null
          avatarUrl?: string | null
          contactName?: string | null
          createdAt?: string
          customerType?: string
          email?: string | null
          id?: string
          isActive?: boolean
          lineDisplayName?: string | null
          lineUserId: string
          name: string
          phone?: string | null
          shopName?: string | null
          updatedAt?: string
        }
        Update: {
          address?: string | null
          authId?: string | null
          avatarUrl?: string | null
          contactName?: string | null
          createdAt?: string
          customerType?: string
          email?: string | null
          id?: string
          isActive?: boolean
          lineDisplayName?: string | null
          lineUserId?: string
          name?: string
          phone?: string | null
          shopName?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      workAttendance: {
        Row: {
          checkInTime: string
          checkOutTime: string | null
          createdAt: string
          employeeId: string
          id: string
          note: string | null
          workDate: string
        }
        Insert: {
          checkInTime?: string
          checkOutTime?: string | null
          createdAt?: string
          employeeId: string
          id?: string
          note?: string | null
          workDate?: string
        }
        Update: {
          checkInTime?: string
          checkOutTime?: string | null
          createdAt?: string
          employeeId?: string
          id?: string
          note?: string | null
          workDate?: string
        }
        Relationships: [
          {
            foreignKeyName: "workAttendance_employeeId_fkey"
            columns: ["employeeId"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      create_inventory_as_admin: {
        Args: {
          p_item_condition: string
          p_minimum_stock: number
          p_note: string
          p_product_id: number
          p_quantity_on_hand: number
          p_stock_status: string
        }
        Returns: Json
      }
      create_inventory_with_log: {
        Args: {
          p_admin_id: string
          p_item_condition: string
          p_minimum_stock: number
          p_note: string
          p_product_id: number
          p_quantity_on_hand: number
          p_stock_status: string
        }
        Returns: Json
      }
      currentemployeerole: {
        Args: never
        Returns: Database["public"]["Enums"]["employeeRole"]
      }
      currentuserisassigneddriver: {
        Args: { p_customer_id: string }
        Returns: boolean
      }
      currentuserisdriverfororder: {
        Args: { p_order_id: string }
        Returns: boolean
      }
      currentuserownsorder: { Args: { p_order_id: string }; Returns: boolean }
      delete_inventory_as_admin: {
        Args: { p_inventory_id: string }
        Returns: Json
      }
      delete_inventory_with_logs: {
        Args: { p_inventory_id: string }
        Returns: Json
      }
      fulfill_order_and_deduct_inventory: {
        Args: { p_admin_id: string; p_order_id: string }
        Returns: Json
      }
      fulfill_order_as_admin: { Args: { p_order_id: string }; Returns: Json }
      record_partial_qr_payment: {
        Args: {
          p_admin_id: string
          p_note: string
          p_paid_amount: number
          p_payment_id: string
          p_slip_id: string
        }
        Returns: Json
      }
      record_partial_qr_payment_as_admin: {
        Args: {
          p_note: string
          p_paid_amount: number
          p_payment_id: string
          p_slip_id: string
        }
        Returns: Json
      }
      reject_qr_payment_slip: {
        Args: {
          p_admin_id: string
          p_payment_id: string
          p_reason: string
          p_slip_id: string
        }
        Returns: Json
      }
      reject_qr_payment_slip_as_admin: {
        Args: { p_payment_id: string; p_reason: string; p_slip_id: string }
        Returns: Json
      }
      update_inventory_as_admin: {
        Args: {
          p_inventory_id: string
          p_item_condition: string
          p_minimum_stock: number
          p_note: string
          p_quantity_on_hand: number
          p_stock_status: string
        }
        Returns: Json
      }
      update_inventory_with_log: {
        Args: {
          p_admin_id: string
          p_inventory_id: string
          p_item_condition: string
          p_minimum_stock: number
          p_note: string
          p_quantity_on_hand: number
          p_stock_status: string
        }
        Returns: Json
      }
      verify_qr_payment: {
        Args: { p_admin_id: string; p_payment_id: string; p_slip_id: string }
        Returns: Json
      }
      verify_qr_payment_as_admin: {
        Args: { p_payment_id: string; p_slip_id: string }
        Returns: Json
      }
    }
    Enums: {
      announcementType: "promotion" | "announcement"
      debtStatus: "pending" | "partial" | "paid"
      debtType: "cart" | "money"
      deliveryStatus: "pending" | "inTransit" | "delivered"
      employeeRole: "admin" | "employee" | "superAdmin"
      orderStatus:
        | "pending"
        | "preparing"
        | "delivering"
        | "delivered"
        | "cancelled"
      paymentMethod: "qrScan" | "cash" | "pendingPayment" | "pendingCart"
      paymentStatus: "pending" | "paid" | "verified" | "rejected"
      senderType: "user" | "bot"
      slipStatus: "pending" | "verified" | "rejected"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      announcementType: ["promotion", "announcement"],
      debtStatus: ["pending", "partial", "paid"],
      debtType: ["cart", "money"],
      deliveryStatus: ["pending", "inTransit", "delivered"],
      employeeRole: ["admin", "employee", "superAdmin"],
      orderStatus: [
        "pending",
        "preparing",
        "delivering",
        "delivered",
        "cancelled",
      ],
      paymentMethod: ["qrScan", "cash", "pendingPayment", "pendingCart"],
      paymentStatus: ["pending", "paid", "verified", "rejected"],
      senderType: ["user", "bot"],
      slipStatus: ["pending", "verified", "rejected"],
    },
  },
} as const
