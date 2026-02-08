import './fields.css';

interface CheckboxFieldProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  description?: string;
  compact?: boolean;
}

export function CheckboxField({
  label,
  value,
  onChange,
  description,
  compact,
}: CheckboxFieldProps) {
  return (
    <div className="inspector-field inspector-field-checkbox" data-compact={compact || undefined}>
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
