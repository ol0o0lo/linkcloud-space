import { HolderOutlined } from '@ant-design/icons';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Segmented } from 'antd';
import type { ReactNode } from 'react';
import {
  WORKBENCH_WIDTH_LABELS,
  type WorkbenchWidgetPreference,
  type WorkbenchWidgetWidth,
} from '../layout/model';
import { useStyles } from '../styles';

type SortableWorkbenchWidgetProps = {
  title: string;
  preference: WorkbenchWidgetPreference;
  allowedWidths: readonly WorkbenchWidgetWidth[];
  className?: string;
  onWidthChange?: (width: WorkbenchWidgetWidth) => void;
  children: ReactNode;
};

export function SortableWorkbenchWidget({
  title,
  preference,
  allowedWidths,
  className,
  onWidthChange,
  children,
}: SortableWorkbenchWidgetProps) {
  const { cx, styles } = useStyles();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preference.id });

  return (
    <section
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-testid="workbench-widget"
      data-widget-id={preference.id}
      data-widget-width={preference.width}
      data-dragging={isDragging || undefined}
      className={cx(className, styles.editableWidget)}
    >
      <span
        data-testid={`workbench-editable-${preference.id}`}
        className={styles.editableWidgetLabel}
        aria-hidden="true"
      >
        编辑组件
      </span>
      <div className={styles.widgetEditorControls}>
        <Segmented
          aria-label={`${title}宽度`}
          size="small"
          value={preference.width}
          options={allowedWidths.map((width) => ({
            value: width,
            label: WORKBENCH_WIDTH_LABELS[width],
          }))}
          onChange={(value) =>
            onWidthChange?.(value as WorkbenchWidgetWidth)
          }
        />
        <button
          type="button"
          className={styles.widgetDragHandle}
          aria-label={`拖动 ${title}`}
          {...attributes}
          {...listeners}
        >
          <HolderOutlined />
        </button>
      </div>
      {children}
    </section>
  );
}
