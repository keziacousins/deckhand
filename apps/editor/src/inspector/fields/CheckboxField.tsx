import './fields.css';

interface CheckboxFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
}

export function CheckboxField({
  label,
  value,
  onChange,
  description,
}: CheckboxFieldProps) {
  return (
    <div className="inspector-field inspector-field-checkbox">
      <label className="inspector-checkbox-label">
        <input
          type="checkbox"
          className="inspector-checkbox-input"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="inspector-checkbox-text">{label}</span>
      </label>
      {description && (
        <span className="inspector-field-description">{description}</span>
      )}
    </div>
  );
}
