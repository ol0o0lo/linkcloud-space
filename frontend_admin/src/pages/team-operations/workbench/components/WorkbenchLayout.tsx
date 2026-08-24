import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import { useState } from 'react';
import type {
  WorkbenchLayoutPreference,
  WorkbenchWidgetPreference,
  WorkbenchWidgetDefinition,
  WorkbenchWidgetWidth,
} from '../layout/model';
import { useStyles } from '../styles';
import { SortableWorkbenchWidget } from './SortableWorkbenchWidget';

type WorkbenchLayoutProps = {
  layout: WorkbenchLayoutPreference;
  definitions?: readonly WorkbenchWidgetDefinition[];
  editing?: boolean;
  mobile?: boolean;
  renderWidget: (preference: WorkbenchWidgetPreference) => ReactNode;
  onReorder?: (activeId: string, overId: string) => void;
  onWidthChange?: (widgetId: string, width: WorkbenchWidgetWidth) => void;
};

function EditableWorkbenchLayout({
  layout,
  definitions = [],
  renderWidget,
  onReorder,
  onWidthChange,
}: WorkbenchLayoutProps) {
  const { cx, styles } = useStyles();
  const [activeId, setActiveId] = useState<string>();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const widthClassNames = {
    1: styles.widgetWidth1,
    2: styles.widgetWidth2,
    3: styles.widgetWidth3,
  } as const;
  const visibleLayout = layout.filter((item) => item.visible);
  const definitionsById = new Map(definitions.map((item) => [item.id, item]));

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }) => setActiveId(String(active.id))}
      onDragCancel={() => setActiveId(undefined)}
      onDragEnd={({ active, over }) => {
        setActiveId(undefined);
        if (over && active.id !== over.id) {
          onReorder?.(String(active.id), String(over.id));
        }
      }}
    >
      <SortableContext
        items={visibleLayout.map((item) => item.id)}
        strategy={rectSortingStrategy}
      >
        <div className={styles.widgetGrid}>
          {visibleLayout.map((item) => {
            const definition = definitionsById.get(item.id);
            return (
              <SortableWorkbenchWidget
                key={item.id}
                title={definition?.title || item.id}
                preference={item}
                allowedWidths={definition?.allowedWidths || [item.width]}
                className={cx(
                  styles.widgetCell,
                  widthClassNames[item.width],
                )}
                onWidthChange={(width) => onWidthChange?.(item.id, width)}
              >
                {renderWidget(item)}
              </SortableWorkbenchWidget>
            );
          })}
        </div>
      </SortableContext>
      <DragOverlay>
        {activeId ? (
          <div className={styles.widgetDragOverlay} aria-hidden="true">
            {definitionsById.get(activeId)?.title || activeId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function WorkbenchLayout(props: WorkbenchLayoutProps) {
  const { cx, styles } = useStyles();
  if (props.editing && !props.mobile) {
    return <EditableWorkbenchLayout {...props} />;
  }

  const widthClassNames = {
    1: styles.widgetWidth1,
    2: styles.widgetWidth2,
    3: styles.widgetWidth3,
  } as const;

  return (
    <div className={styles.widgetGrid}>
      {props.layout
        .filter((item) => item.visible)
        .map((item) => (
          <section
            key={item.id}
            data-testid="workbench-widget"
            data-widget-id={item.id}
            data-widget-width={item.width}
            className={cx(styles.widgetCell, widthClassNames[item.width])}
          >
            {props.renderWidget(item)}
          </section>
        ))}
    </div>
  );
}
