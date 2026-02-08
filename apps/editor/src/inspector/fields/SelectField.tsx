import './fields.css';

interface SelectOption {
  value: string;
  label: string;
}

interface SelectFieldProps {
  label: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  compact?: boolean;
}

export function SelectField({
  label,
  value,
  options,
  onChange,
  compact,
}: SelectFieldProps) {
  return (
    <div className="inspector-field" data-compact={compact || undefined}>
      <label className="inspector-field-label">{label}</label>
      <select
        className="inspector-field-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
