import { z } from 'zod';

/** Admin-side widget CRUD input validation (distinct from the per-widget
 *  submission schema in lib/validation.ts, which is built from fields_json). */

export const widgetFieldSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-zA-Z0-9_]+$/, 'field name must be alphanumeric/underscore'),
  label: z.string().min(1).max(200),
  type: z.enum(['text', 'email', 'tel', 'textarea', 'number', 'url']),
  required: z.boolean().optional(),
});

export const createWidgetSchema = z.object({
  type: z.enum(['popover', 'signup', 'cta']),
  name: z.string().min(1).max(200),
  copy_json: z.record(z.unknown()).optional(),
  fields_json: z.array(widgetFieldSchema).max(50).optional(),
  targeting_json: z.record(z.unknown()).optional(),
  allowed_origins: z.array(z.string().min(1)).nullable().optional(),
  webhook_url: z.string().url().nullable().optional(),
  status: z.enum(['active', 'paused', 'archived']).optional(),
});

export const updateWidgetSchema = createWidgetSchema.partial();

export type CreateWidgetInput = z.infer<typeof createWidgetSchema>;
export type UpdateWidgetInput = z.infer<typeof updateWidgetSchema>;
