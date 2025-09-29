import React, { useState } from "react";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface RankingPreviewDraggableProps {
  options: string[];
  value: string[];
  onChange: (newOrder: string[]) => void;
}

function SortableItem({ id, index }: { id: string; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    background: isDragging ? "#e0f2fe" : "#f3f4f6",
    cursor: "grab",
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center gap-2 p-2 rounded mb-2 shadow-sm" {...attributes} {...listeners}>
      <span className="text-sm text-muted-foreground font-mono w-8 text-right">#{index + 1}</span>
      <span className="flex-1">{id}</span>
      <span className="text-gray-400 cursor-move">↕️</span>
    </div>
  );
}

export const RankingPreviewDraggable: React.FC<RankingPreviewDraggableProps> = ({ options, value, onChange }) => {
  const [items, setItems] = useState<string[]>(value.length ? value : options);
  const sensors = useSensors(useSensor(PointerSensor));

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = items.indexOf(active.id);
      const newIndex = items.indexOf(over.id);
      const newOrder = arrayMove(items, oldIndex, newIndex);
      setItems(newOrder);
      onChange(newOrder);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items} strategy={verticalListSortingStrategy}>
        {items.map((option, idx) => (
          <SortableItem key={option} id={option} index={idx} />
        ))}
      </SortableContext>
    </DndContext>
  );
};
