import './fields.css';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

export function ColorField({
  label,
  value,
  onChange,
}: ColorFieldProps) {
  return (
    <div className="inspector-field">
      <label className="inspector-field-label">{label}</label>
      <div className="inspector-color-wrapper">
        <input
          type="color"
          className="inspector-color-input"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
        <input
          type="text"
          className="inspector-field-input inspector-color-text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
        />
      </div>
    </div>
  );
}
