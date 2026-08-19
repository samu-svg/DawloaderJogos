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
        Row: { created_at: string; display_name: string; id: string };
        Insert: { created_at?: string; display_name: string; id: string };
        Update: { display_name?: string };
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { source_kind: "hosted" | "external" };
    CompositeTypes: { [_ in never]: never };
  };
};

export type PortfolioRow = Database["public"]["Tables"]["portfolios"]["Row"];
export type EntryRow = Database["public"]["Tables"]["entries"]["Row"];
export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type SourceKind = Database["public"]["Enums"]["source_kind"];
