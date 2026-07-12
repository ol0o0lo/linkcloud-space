import { EntityPreview } from '../../EntityPreview';
import type { EntityPreviewEntryProps } from '../../types';

export function LeasePreview(props: EntityPreviewEntryProps) {
  return <EntityPreview type="lease" {...props} />;
}
