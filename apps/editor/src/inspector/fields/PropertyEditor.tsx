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
  /** Override placeholder from descriptor */
  placeholder?: string;
  /** Show a clear button to reset to default */
  allowClear?: boolean;
  /** Called when clear button is clicked */
  onClear?: () => void;
}

export function PropertyEditor({
  name,
  descriptor,
  value,
  onChange,
  assets,
  placeholder: placeholderOverride,
  allowClear,
  onClear,
}: PropertyEditorProps) {
  const { type, label, placeholder, options, min, max, step, description, compact } = descriptor;

  switch (type) {
    case 'string':
      return (
        <TextField
          label={label}
          value={(value as string) ?? (descriptor.default as string) ?? ''}
          onChange={onChange}
          placeholder={placeholderOverride ?? placeholder}
          compact={compact}
          allowClear={allowClear}
          onClear={onClear}
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
          compact={compact}
        />
      );

    case 'boolean':
      return (
        <CheckboxField
          label={label}
          value={(value as boolean) ?? (descriptor.default as boolean) ?? false}
          onChange={onChange}
          description={compact ? undefined : description}
          compact={compact}
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
          compact={compact}
        />
      );

    case 'color':
      return (
        <ColorField
          label={label}
          value={(value as string) ?? (descriptor.default as string) ?? ''}
          onChange={onChange}
          compact={compact}
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
          compact={compact}
        />
      );

    case 'richtext':
      // Legacy — treat as plain text
      return (
        <TextField
          label={label}
          value={String(value ?? '')}
          onChange={onChange}
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
