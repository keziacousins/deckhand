import type { StartPoint } from '@deckhand/schema';
import { TextField } from '../fields';

interface StartPointPropertiesSectionProps {
  startPoint: StartPoint;
  onUpdateStartPoint?: (startPointId: string, updates: Partial<Pick<StartPoint, 'name'>>) => void;
  onDeleteStartPoint?: (startPointId: string) => void;
}

export function StartPointPropertiesSection({
  startPoint,
  onUpdateStartPoint,
  onDeleteStartPoint,
}: StartPointPropertiesSectionProps) {
  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Start Point</div>
      <div className="inspector-section-content">
        <TextField
          label="Name"
          value={startPoint.name}
          onChange={(value) => onUpdateStartPoint?.(startPoint.id, { name: value })}
          placeholder="e.g., Introduction"
        />
        {onDeleteStartPoint && (
          <div className="inspector-field">
            <button
              className="inspector-delete-button"
              onClick={() => onDeleteStartPoint(startPoint.id)}
            >
              Delete Start Point
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
