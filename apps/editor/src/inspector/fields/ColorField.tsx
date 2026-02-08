import { useCallback, useState, useRef, useEffect } from 'react';
import './ColorField.css';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Placeholder shown when value is empty (e.g., "Inherited") */
  placeholder?: string;
  /** Show a clear button to reset to empty/inherited */
  allowClear?: boolean;
  compact?: boolean;
}

export function ColorField({ label, value, onChange, placeholder, allowClear = true, compact }: ColorFieldProps) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      onChange(localValue);
    }
  }, [localValue, value, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      setLocalValue(value);
      e.currentTarget.blur();
    }
  }, [value]);

  const handleColorChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue);
  }, [onChange]);

  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  const handleClear = useCallback(() => {
    setLocalValue('');
    onChange('');
  }, [onChange]);

  const hasValue = localValue.length > 0;

  return (
    <div className="inspector-field color-field" data-compact={compact || undefined}>
      <label className="inspector-field-label">{label}</label>
      <div className="color-field-inputs">
        <input
          type="color"
          className="color-field-picker"
          value={localValue.startsWith('#') ? localValue : '#000000'}
          onChange={handleColorChange}
        />
        <input
          ref={inputRef}
          type="text"
          className="color-field-text"
          value={localValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          placeholder={placeholder}
        />
        {allowClear && hasValue && (
          <button
            type="button"
            className="color-field-clear"
            onClick={handleClear}
            title="Reset to inherited"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
