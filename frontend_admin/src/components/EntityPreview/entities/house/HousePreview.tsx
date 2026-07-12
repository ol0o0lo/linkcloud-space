import { EntityPreview } from '../../EntityPreview';
import type { EntityPreviewEntryProps } from '../../types';

export function HousePreview(props: EntityPreviewEntryProps) {
  return <EntityPreview type="house" {...props} />;
}
