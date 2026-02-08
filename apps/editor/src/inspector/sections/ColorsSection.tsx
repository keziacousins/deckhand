import type { InspectorSectionProps } from '../types';
import { ColorField } from '../fields/ColorField';
import { Section } from '../components/Section';
import { useInspectorExpansion } from '../context/InspectorExpansionContext';

const SECTION_ID = 'colors';

export function ColorsSection({ context, stickyIndex = 0 }: InspectorSectionProps) {
  const { selectedSlide, onUpdate, selection } = context;
  const { isExpanded } = useInspectorExpansion();
  
  if (!selectedSlide || !selection.slideId) return null;

  const slideId = selection.slideId;
  const style = selectedSlide.style ?? {};
  
  const colorCount = [style.background, style.textPrimary, style.textSecondary, style.accent]
    .filter(Boolean).length;
  const subtitle = colorCount > 0 ? `${colorCount} override${colorCount > 1 ? 's' : ''}` : undefined;

  const handleStyleChange = (field: string, value: string) => {
    onUpdate({
      type: 'slide',
      slideId,
      field: 'style',
      value: { [field]: value || undefined },
    });
  };

  return (
    <Section id={SECTION_ID} name="Colors" stickyIndex={stickyIndex} meta={subtitle}>
      <ColorField
        label="Background"
        value={style.background ?? ''}
        onChange={(value) => handleStyleChange('background', value)}
        placeholder="Inherited"
      />
      <ColorField
        label="Text Primary"
        value={style.textPrimary ?? ''}
        onChange={(value) => handleStyleChange('textPrimary', value)}
        placeholder="Inherited"
      />
      <ColorField
        label="Text Secondary"
        value={style.textSecondary ?? ''}
        onChange={(value) => handleStyleChange('textSecondary', value)}
        placeholder="Inherited"
      />
      <ColorField
        label="Accent"
        value={style.accent ?? ''}
        onChange={(value) => handleStyleChange('accent', value)}
        placeholder="Inherited"
      />
    </Section>
  );
}
