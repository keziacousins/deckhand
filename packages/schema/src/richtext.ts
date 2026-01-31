import { z } from 'zod';

/**
 * Rich text span - inline formatted text
 */
export const RichTextSpanSchema = z.object({
  text: z.string(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  code: z.boolean().optional(),
  href: z.string().url().optional(),
});

export type RichTextSpan = z.infer<typeof RichTextSpanSchema>;

/**
 * Rich text content is an array of spans
 */
export const RichTextSchema = z.array(RichTextSpanSchema);

export type RichText = z.infer<typeof RichTextSchema>;

/**
 * Helper to create plain text (no formatting)
 */
export function plainText(text: string): RichText {
  return [{ text }];
}

/**
 * Helper to convert rich text to plain string
 */
export function richTextToString(content: RichText): string {
  return content.map((span) => span.text).join('');
}
