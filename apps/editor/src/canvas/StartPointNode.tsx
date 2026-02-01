import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import type { StartPoint } from '@deckhand/schema';
import './StartPointNode.css';

type StartPointNodeData = {
  startPoint: StartPoint;
};

export type StartPointNodeType = Node<StartPointNodeData, 'startPoint'>;

export const StartPointNode = memo(function StartPointNode({
  data,
  selected,
}: NodeProps<StartPointNodeType>) {
  const { startPoint } = data;

  return (
    <div className={`start-point-node ${selected ? 'selected' : ''}`}>
      <span className="start-point-name">{startPoint.name}</span>
      
      {/* Single source handle - start points can only connect outward */}
      <Handle type="source" position={Position.Right} id="source" />
    </div>
  );
});
