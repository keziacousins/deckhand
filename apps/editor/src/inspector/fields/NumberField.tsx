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
  return (
    <div className="inspector-field">
      <label className="inspector-field-label">{label}</label>
      <input
        type="number"
        className="inspector-field-input"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
      />
    </div>
  );
}
