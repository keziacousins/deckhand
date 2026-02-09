import { useCallback } from 'react';
import './fields.css';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  compact?: boolean;
  /** Show a clear button when value is non-empty */
  allowClear?: boolean;
  /** Called when clear button is clicked (defaults to onChange('')) */
  onClear?: () => void;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  compact,
  allowClear,
  onClear,
}: TextFieldProps) {
  // Select all text on focus
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.select();
  }, []);

  const handleClear = useCallback(() => {
    if (onClear) {
      onClear();
    } else {
      onChange('');
    }
  }, [onClear, onChange]);

  const hasValue = value.length > 0;

  return (
    <div className="inspector-field" data-compact={compact || undefined}>
      <label className="inspector-field-label">{label}</label>
      {multiline ? (
        <textarea
          className="inspector-field-input inspector-field-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
        />
      ) : (
        <div className="text-field-wrapper">
          <input
            type="text"
            className="inspector-field-input text-field-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={handleFocus}
            placeholder={placeholder}
          />
          {allowClear && hasValue && (
            <button
              type="button"
              className="text-field-clear"
              onClick={handleClear}
              title="Reset to default"
            >
              ×
            </button>
          )}
        </div>
      )}
    </div>
  );
}
