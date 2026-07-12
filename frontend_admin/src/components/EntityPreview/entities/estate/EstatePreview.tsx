import { EntityPreview } from '../../EntityPreview';
import type { EntityPreviewEntryProps } from '../../types';

export function EstatePreview(props: EntityPreviewEntryProps) {
  return <EntityPreview type="estate" {...props} />;
}
