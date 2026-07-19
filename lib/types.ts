export type WidgetType = 'popover' | 'signup' | 'cta';
export type WidgetStatus = 'active' | 'paused' | 'archived';
export type WidgetFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'number'
  | 'url';

export interface WidgetField {
  name: string;
  label: string;
  type: WidgetFieldType;
  required?: boolean;
}

export interface Widget {
  id: string;
  org_id: string;
  type: WidgetType;
  name: string;
  copy_json: Record<string, unknown>;
  fields_json: WidgetField[];
  targeting_json: Record<string, unknown>;
  allowed_origins: string[] | null;
  webhook_url: string | null;
  status: WidgetStatus;
  created_at: string;
  updated_at: string;
}

/** The public, non-sensitive projection served to embedding sites (Phase 3). */
export interface PublicWidgetConfig {
  type: WidgetType;
  copy: Record<string, unknown>;
  fields: WidgetField[];
  targeting: Record<string, unknown>;
}

export interface GeoResult {
  country: string;
  region: string;
  city: string;
}

export interface Submission {
  id: string;
  widget_id: string;
  org_id: string;
  fields_json: Record<string, unknown>;
  ip_hash: string;
  geo_json: GeoResult | null;
  geo_provider_used: string;
  is_spam: boolean;
  created_at: string;
}
