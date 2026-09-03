/**
 * Gerado a partir do banco. Para atualizar depois de uma migração:
 * npx supabase gen types typescript --project-id fmzluxbbdjldxcxpqxts
 */

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.15" };
  public: {
    Tables: {
      entries: {
        Row: {
          created_at: string;
          destination: string;
          external_url: string | null;
          group_name: string | null;
          id: string;
          is_optional: boolean;
          kind: Database["public"]["Enums"]["source_kind"];
          label: string;
          portfolio_id: string;
          sha256: string | null;
          size_bytes: number;
          sort_order: number;
          storage_key: string | null;
          cover_url: string | null;
        };
        Insert: {
          created_at?: string;
          destination: string;
          external_url?: string | null;
          group_name?: string | null;
          id?: string;
          is_optional?: boolean;
          kind: Database["public"]["Enums"]["source_kind"];
          label: string;
          portfolio_id: string;
          sha256?: string | null;
          size_bytes?: number;
          sort_order?: number;
          storage_key?: string | null;
          cover_url?: string | null;
        };
        Update: {
          destination?: string;
          external_url?: string | null;
          group_name?: string | null;
          is_optional?: boolean;
          kind?: Database["public"]["Enums"]["source_kind"];
          label?: string;
          sha256?: string | null;
          size_bytes?: number;
          sort_order?: number;
          storage_key?: string | null;
          cover_url?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "entries_portfolio_id_fkey";
            columns: ["portfolio_id"];
            isOneToOne: false;
            referencedRelation: "portfolios";
            referencedColumns: ["id"];
          },
        ];
      };
      portfolios: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          is_public: boolean;
          owner_id: string;
          slug: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          is_public?: boolean;
          owner_id: string;
          slug: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          description?: string | null;
          is_public?: boolean;
          slug?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "portfolios_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          display_name: string;
          id: string;
          password_changed_at: string;
          role: "admin" | "editor" | "user";
        };
        Insert: {
          created_at?: string;
          display_name: string;
          id: string;
          password_changed_at?: string;
          role?: "admin" | "editor" | "user";
        };
        Update: {
          display_name?: string;
          password_changed_at?: string;
          role?: "admin" | "editor" | "user";
        };
        Relationships: [];
      };
      user_hds: {
        Row: {
          id: string;
          user_id: string;
          fingerprint: string;
          label: string | null;
          registered_at: string;
          last_used_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          fingerprint: string;
          label?: string | null;
          registered_at?: string;
          last_used_at?: string;
        };
        Update: {
          fingerprint?: string;
          label?: string | null;
          last_used_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string;
          stripe_subscription_id: string | null;
          status: string;
          current_period_end: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          stripe_customer_id: string;
          stripe_subscription_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stripe_customer_id?: string;
          stripe_subscription_id?: string | null;
          status?: string;
          current_period_end?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_tickets: {
        Row: {
          id: string;
          user_id: string;
          user_email: string;
          subject: string;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          user_email: string;
          subject: string;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_email?: string;
          subject?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payment_grants: {
        Row: {
          id: string;
          user_id: string;
          provider: "asaas" | "stripe";
          payment_id: string;
          plan_id: string;
          months: number;
          amount_cents: number;
          status: "granted" | "revoked";
          period_start: string;
          period_end: string;
          revoked_at: string | null;
          revoked_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          provider: "asaas" | "stripe";
          payment_id: string;
          plan_id: string;
          months: number;
          amount_cents: number;
          status?: "granted" | "revoked";
          period_start: string;
          period_end: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: "granted" | "revoked";
          period_start?: string;
          period_end?: string;
          revoked_at?: string | null;
          revoked_reason?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      support_messages: {
        Row: {
          id: string;
          ticket_id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          ticket_id: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          body?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      grant_prepaid_access: {
        Args: {
          p_user_id: string;
          p_provider: string;
          p_payment_id: string;
          p_plan_id: string;
          p_months: number;
          p_amount_cents: number;
          p_customer_ref: string | null;
        };
        Returns: { new_period_end: string | null; was_created: boolean }[];
      };
      revoke_prepaid_access: {
        Args: {
          p_provider: string;
          p_payment_id: string;
          p_reason: string;
        };
        Returns: { new_period_end: string | null; was_revoked: boolean }[];
      };
      sync_prepaid_subscription: {
        Args: { p_user_id: string; p_customer_ref: string | null };
        Returns: string | null;
      };
      sync_card_subscription: {
        Args: {
          p_user_id: string;
          p_customer_id: string;
          p_subscription_id: string | null;
          p_status: string;
          p_period_end: string | null;
        };
        Returns: string | null;
      };
    };
    Enums: { source_kind: "hosted" | "external" };
    CompositeTypes: { [_ in never]: never };
  };
};

export type PortfolioRow = Database["public"]["Tables"]["portfolios"]["Row"];
export type EntryRow = Database["public"]["Tables"]["entries"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type SupportTicketRow = Database["public"]["Tables"]["support_tickets"]["Row"];
export type SupportMessageRow = Database["public"]["Tables"]["support_messages"]["Row"];
export type PaymentGrantRow = Database["public"]["Tables"]["payment_grants"]["Row"];
export type SourceKind = Database["public"]["Enums"]["source_kind"];
