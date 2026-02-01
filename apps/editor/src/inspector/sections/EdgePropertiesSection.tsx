import type { Edge, TransitionType, DEFAULT_TRANSITION_DURATION } from '@deckhand/schema';
import { SelectField, NumberField } from '../fields';

const TRANSITION_OPTIONS: { value: TransitionType; label: string }[] = [
  { value: 'instant', label: 'Instant' },
  { value: 'slide-left', label: 'Slide Left' },
  { value: 'slide-right', label: 'Slide Right' },
  { value: 'slide-up', label: 'Slide Up' },
  { value: 'slide-down', label: 'Slide Down' },
  { value: 'cross-fade', label: 'Cross Fade' },
  { value: 'fade-through-black', label: 'Fade Through Black' },
];

interface EdgePropertiesSectionProps {
  edge: Edge;
  deckDefaultTransition?: TransitionType;
  deckDefaultDuration?: number;
  onUpdateEdge: (edgeId: string, updates: Partial<Pick<Edge, 'transition' | 'transitionDuration'>>) => void;
  onDeleteEdge: (edgeId: string) => void;
}

export function EdgePropertiesSection({
  edge,
  deckDefaultTransition = 'instant',
  deckDefaultDuration = 0.3,
  onUpdateEdge,
  onDeleteEdge,
}: EdgePropertiesSectionProps) {
  const effectiveTransition = edge.transition ?? deckDefaultTransition;
  const effectiveDuration = edge.transitionDuration ?? deckDefaultDuration;
  const hasOverride = edge.transition !== undefined;

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Edge</div>
      <div className="inspector-section-content">
        <SelectField
          label="Transition"
          value={effectiveTransition}
          options={[
            { value: '', label: `Default (${TRANSITION_OPTIONS.find(o => o.value === deckDefaultTransition)?.label ?? 'Instant'})` },
            ...TRANSITION_OPTIONS,
          ]}
          onChange={(value) => {
            if (value === '') {
              // Clear override, use deck default
              onUpdateEdge(edge.id, { transition: undefined, transitionDuration: undefined });
            } else {
              onUpdateEdge(edge.id, { transition: value as TransitionType });
            }
          }}
        />
        {hasOverride && effectiveTransition !== 'instant' && (
          <NumberField
            label="Duration"
            value={effectiveDuration}
            onChange={(value) => onUpdateEdge(edge.id, { transitionDuration: value })}
            min={0}
            max={5}
            step={0.1}
            suffix="s"
          />
        )}
        <div className="inspector-field">
          <button
            className="inspector-delete-button"
            onClick={() => onDeleteEdge(edge.id)}
          >
            Delete Edge
          </button>
        </div>
      </div>
    </div>
  );
}
