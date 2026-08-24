import { useMemo } from 'react';
import { WorkbenchLayout } from './components/WorkbenchLayout';
import {
  SpaceWorkbenchDataProvider,
  useSpaceWorkbenchData,
} from './data/SpaceWorkbenchData';
import type {
  WorkbenchLayoutPreference,
  WorkbenchWidgetWidth,
} from './layout/model';
import {
  spaceWidgetDefinitions,
  type WorkbenchWidgetRegistration,
} from './registry';
import { useStyles } from './styles';

type SpaceWorkbenchContentProps = {
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

function SpaceWorkbenchWidgets(
  props: Omit<SpaceWorkbenchContentProps, 'onDataStatusChange'>,
) {
  useSpaceWorkbenchData();
  const { styles } = useStyles();
  const definitionsById = new Map<string, WorkbenchWidgetRegistration>(
    spaceWidgetDefinitions.map((item) => [item.id, item] as const),
  );

  return (
    <div className={styles.spaceWorkbenchTone}>
      <WorkbenchLayout
        layout={props.layout}
        definitions={spaceWidgetDefinitions}
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

export function SpaceWorkbenchContent({
  layout,
  editing,
  mobile,
  onReorder,
  onWidthChange,
  onDataStatusChange,
}: SpaceWorkbenchContentProps) {
  const visibleWidgetIds = useMemo(
    () => new Set(layout.filter((item) => item.visible).map((item) => item.id)),
    [layout],
  );

  return (
    <SpaceWorkbenchDataProvider
      visibleWidgetIds={visibleWidgetIds}
      onDataStatusChange={onDataStatusChange}
    >
      <SpaceWorkbenchWidgets
        layout={layout}
        editing={editing}
        mobile={mobile}
        onReorder={onReorder}
        onWidthChange={onWidthChange}
      />
    </SpaceWorkbenchDataProvider>
  );
}
