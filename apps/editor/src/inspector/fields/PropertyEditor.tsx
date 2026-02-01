/**
 * PropertyEditor - Auto-generates appropriate field editor based on property descriptor.
 * 
 * This component reads the PropertyDescriptor from component metadata and renders
 * the correct field type (text, select, color, etc.).
 */

import type { PropertyDescriptor } from '@deckhand/components';
import type { Asset } from '@deckhand/schema';
import { TextField } from './TextField';
import { SelectField } from './SelectField';
import { NumberField } from './NumberField';
import { CheckboxField } from './CheckboxField';
import { ColorField } from './ColorField';
import { AssetPickerField } from './AssetPickerField';

/** Rich text span type matching the schema */
interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

/** Convert rich text array to plain string for display */
function richTextToString(content: RichTextSpan[]): string {
  if (!Array.isArray(content)) return '';
  return content.map(span => span.text).join('');
}

/** Convert plain string to rich text array */
function stringToRichText(text: string): RichTextSpan[] {
  return [{ text }];
}

interface PropertyEditorProps {
  /** Property key name */
  name: string;
  /** Property descriptor from component metadata */
  descriptor: PropertyDescriptor;
  /** Current value */
  value: unknown;
  /** Called when value changes */
  onChange: (value: unknown) => void;
  /** Assets map for asset picker (required for 'asset' type) */
  assets?: Record<string, Asset>;
}

export function PropertyEditor({
  name,
  descriptor,
  value,
  onChange,
  assets,
}: PropertyEditorProps) {
  const { type, label, placeholder, options, min, max, step, description } = descriptor;

  switch (type) {
    case 'string':
      return (
        <TextField
          label={label}
          value={(value as string) ?? (descriptor.default as string) ?? ''}
          onChange={onChange}
          placeholder={placeholder}
        />
      );

    case 'text':
      return (
        <TextField
          label={label}
          value={(value as string) ?? (descriptor.default as string) ?? ''}
          onChange={onChange}
          placeholder={placeholder}
          multiline
        />
      );

    case 'number':
      return (
        <NumberField
          label={label}
          value={(value as number) ?? (descriptor.default as number) ?? 0}
          onChange={onChange}
          min={min}
          max={max}
          step={step}
          placeholder={placeholder}
        />
      );

    case 'boolean':
      return (
        <CheckboxField
          label={label}
          value={(value as boolean) ?? (descriptor.default as boolean) ?? false}
          onChange={onChange}
          description={description}
        />
      );

    case 'enum':
      // Normalize options to { value, label } format
      const normalizedOptions = (options || []).map((opt) =>
        typeof opt === 'string' ? { value: opt, label: opt } : opt
      );
      return (
        <SelectField
          label={label}
          value={(value as string) ?? (descriptor.default as string) ?? ''}
          options={normalizedOptions}
          onChange={onChange}
        />
      );

    case 'color':
      return (
        <ColorField
          label={label}
          value={(value as string) ?? (descriptor.default as string) ?? ''}
          onChange={onChange}
        />
      );

    case 'alignment':
      return (
        <SelectField
          label={label}
          value={(value as string) ?? (descriptor.default as string) ?? 'left'}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={onChange}
        />
      );

    case 'richtext':
      // Convert rich text array to plain string for editing
      // When saved, convert back to rich text array (loses formatting for now)
      // TODO: Implement proper rich text editor that preserves formatting
      return (
        <TextField
          label={label}
          value={richTextToString(value as RichTextSpan[])}
          onChange={(text) => onChange(stringToRichText(text as string))}
          placeholder={placeholder}
          multiline
        />
      );

    case 'asset':
      return (
        <AssetPickerField
          label={label}
          value={(value as string) ?? ''}
          assets={assets ?? {}}
          onChange={(v) => onChange(v)}
        />
      );

    case 'spacing':
      // For now, fall back to text input
      // TODO: Implement spacing editor (margin/padding)
      return (
        <TextField
          label={label}
          value={(value as string) ?? ''}
          onChange={onChange}
          placeholder="e.g., 1rem or 16px"
        />
      );

    default:
      // Unknown type - render as text
      return (
        <TextField
          label={label}
          value={String(value ?? '')}
          onChange={onChange}
        />
      );
  }
}
