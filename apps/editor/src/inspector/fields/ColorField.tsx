import { useCallback, useState, useRef, useEffect } from 'react';
import './ColorField.css';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({ label, value, onChange }: ColorFieldProps) {
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

  return (
    <div className="inspector-field color-field">
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
          className="inspector-field-input color-field-text"
          value={localValue}
          onChange={handleTextChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        />
      </div>
    </div>
  );
}
