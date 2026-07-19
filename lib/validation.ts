import { z } from 'zod';
import type { WidgetField } from '@/lib/types';

/**
 * Build a zod schema for a submission's `fields` object FROM the widget's
 * fields_json. `.strict()` rejects unknown keys, so a garbage payload fails at
 * the boundary (-> 400) before any DB or enrichment work.
 */
function fieldSchema(f: WidgetField): z.ZodTypeAny {
  let base: z.ZodTypeAny;
  switch (f.type) {
    case 'email':
      base = z.string().email();
      break;
    case 'url':
      base = z.string().url();
      break;
    case 'number':
      base = z.string().regex(/^-?\d+(?:\.\d+)?$/, 'must be a number');
      break;
    case 'tel':
      base = z.string().min(3).max(32);
      break;
    case 'textarea':
      base = z.string().min(1).max(5000);
      break;
    default:
      base = z.string().min(1).max(1000);
  }

  if (f.required) return base;
  // Optional: accept an empty string or omission, otherwise validate.
  return z.union([z.literal(''), base]).optional();
}

export function buildSubmissionSchema(
  fields: WidgetField[],
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of fields) shape[f.name] = fieldSchema(f);
  return z.object(shape).strict();
}
