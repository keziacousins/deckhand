import { useCallback } from 'react';
import './fields.css';

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
}: TextFieldProps) {
  // Select all text on focus
  const handleFocus = useCallback((e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.select();
  }, []);

  return (
    <div className="inspector-field">
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
        <input
          type="text"
          className="inspector-field-input"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={handleFocus}
          placeholder={placeholder}
        />
      )}
    </div>
  );
}
