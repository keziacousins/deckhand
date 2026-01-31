import { useState, useCallback, useEffect } from 'react';
import './fields.css';

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  placeholder,
}: NumberFieldProps) {
  // Local state for editing - allows empty string while typing
  const [localValue, setLocalValue] = useState(String(value));

  // Sync local value when prop changes (from external updates)
  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  // Select all text on focus
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    e.target.select();
  }, []);

  // Update local value while typing (no validation)
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalValue(e.target.value);
  }, []);

  // Validate and commit on blur
  const handleBlur = useCallback(() => {
    let num = parseFloat(localValue);
    if (isNaN(num)) {
      num = min ?? 0;
    }
    if (min !== undefined && num < min) num = min;
    if (max !== undefined && num > max) num = max;
    setLocalValue(String(num));
    if (num !== value) {
      onChange(num);
    }
  }, [localValue, value, onChange, min, max]);

  // Commit on Enter key
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  }, []);

  return (
    <div className="inspector-field">
      <label className="inspector-field-label">{label}</label>
      <input
        type="text"
        inputMode="numeric"
        className="inspector-field-input"
        value={localValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
      />
    </div>
  );
}
