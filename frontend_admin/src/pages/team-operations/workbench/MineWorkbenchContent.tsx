import { useMemo } from 'react';
import { WorkbenchLayout } from './components/WorkbenchLayout';
import {
  MineWorkbenchDataProvider,
  useMineWorkbenchData,
} from './data/MineWorkbenchData';
import type {
  WorkbenchLayoutPreference,
  WorkbenchWidgetWidth,
} from './layout/model';
import {
  mineWidgetDefinitions,
  type WorkbenchWidgetRegistration,
} from './registry';
import { useStyles } from './styles';

type MineWorkbenchContentProps = {
  layout: WorkbenchLayoutPreference;
  editing?: boolean;
  mobile?: boolean;
  onReorder?: (activeId: string, overId: string) => void;
  onWidthChange?: (widgetId: string, width: WorkbenchWidgetWidth) => void;
  onDataStatusChange?: (
    isFetching: boolean,
    updatedAt: string | null,
  ) => void;
};

function MineWorkbenchWidgets(
  props: Omit<MineWorkbenchContentProps, 'onDataStatusChange'>,
) {
  useMineWorkbenchData();
  const { styles } = useStyles();
  const definitionsById = new Map<string, WorkbenchWidgetRegistration>(
    mineWidgetDefinitions.map((item) => [item.id, item] as const),
  );

  return (
    <div className={styles.mineWorkbenchTone}>
      <WorkbenchLayout
        layout={props.layout}
        definitions={mineWidgetDefinitions}
        editing={props.editing}
        mobile={props.mobile}
        onReorder={props.onReorder}
        onWidthChange={props.onWidthChange}
        renderWidget={(preference) => {
          const registration = definitionsById.get(preference.id);
          if (!registration) return null;
          const Component = registration.component;
          return <Component width={preference.width} />;
        }}
      />
    </div>
  );
}

export function MineWorkbenchContent({
  layout,
  editing,
  mobile,
  onReorder,
  onWidthChange,
  onDataStatusChange,
}: MineWorkbenchContentProps) {
  const visibleWidgetIds = useMemo(
    () => new Set(layout.filter((item) => item.visible).map((item) => item.id)),
    [layout],
  );

  return (
    <MineWorkbenchDataProvider
      visibleWidgetIds={visibleWidgetIds}
      onDataStatusChange={onDataStatusChange}
    >
      <MineWorkbenchWidgets
        layout={layout}
        editing={editing}
        mobile={mobile}
        onReorder={onReorder}
        onWidthChange={onWidthChange}
      />
    </MineWorkbenchDataProvider>
  );
}
