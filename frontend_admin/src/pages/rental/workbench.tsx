import React from 'react';
import { TenantSelectionGuard } from '@/pages/space/shared';
import { SpaceWorkbenchContent } from '@/pages/team-operations/workbench/SpaceWorkbenchContent';
import { useWorkbenchLayoutPreference } from '@/pages/team-operations/workbench/hooks/useWorkbenchLayoutPreference';
import { spaceWidgetDefinitions } from '@/pages/team-operations/workbench/registry';

export {
  buildPublishWorkbenchRows,
  buildWorkflowTasks,
  getHouseTaskLink,
  getWorkbenchFiltersFromSearch,
  syncWorkbenchFiltersSearch,
} from '@/pages/team-operations/workbench/widgets/space/model';

type RentalOperationsWorkbenchContentProps = {
  onDataStatusChange?: (
    isFetching: boolean,
    updatedAt: string | null,
  ) => void;
};

export const RentalOperationsWorkbenchContent: React.FC<
  RentalOperationsWorkbenchContentProps
> = ({ onDataStatusChange }) => {
  const layout = useWorkbenchLayoutPreference('space', spaceWidgetDefinitions);

  return (
    <SpaceWorkbenchContent
      layout={layout.rendered}
      onDataStatusChange={onDataStatusChange}
    />
  );
};

const WorkbenchPage: React.FC = () => (
  <TenantSelectionGuard title="房源工作台">
    <RentalOperationsWorkbenchContent />
  </TenantSelectionGuard>
);

export default WorkbenchPage;
