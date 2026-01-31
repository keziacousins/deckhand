import type { InspectorSectionProps } from '../types';
import type { TitleComponent } from '@deckhand/schema';
import { TextField, SelectField } from '../fields';

export function TitlePropertiesSection({ context }: InspectorSectionProps) {
  const { selectedComponent, onUpdate, selection } = context;
  if (!selectedComponent || selectedComponent.type !== 'deck-title') return null;
  if (!selection.slideId || !selection.componentId) return null;

  const component = selectedComponent as TitleComponent;
  const { slideId, componentId } = selection;

  const updateProp = (field: string, value: unknown) => {
    onUpdate({ type: 'component', slideId, componentId, field, value });
  };

  return (
    <div className="inspector-section">
      <div className="inspector-section-header">Title</div>
      <div className="inspector-section-content">
        <TextField
          label="Text"
          value={component.props.text}
          onChange={(value) => updateProp('text', value)}
        />
        <SelectField
          label="Level"
          value={component.props.level ?? '1'}
          options={[
            { value: '1', label: 'Heading 1' },
            { value: '2', label: 'Heading 2' },
            { value: '3', label: 'Heading 3' },
          ]}
          onChange={(value) => updateProp('level', value)}
        />
        <SelectField
          label="Alignment"
          value={component.props.align ?? 'center'}
          options={[
            { value: 'left', label: 'Left' },
            { value: 'center', label: 'Center' },
            { value: 'right', label: 'Right' },
          ]}
          onChange={(value) => updateProp('align', value)}
        />
      </div>
    </div>
  );
}
