import { EntityPreview } from '../../EntityPreview';
import type { EntityPreviewEntryProps } from '../../types';

export function BuildingPreview(props: EntityPreviewEntryProps) {
  return <EntityPreview type="building" {...props} />;
}
