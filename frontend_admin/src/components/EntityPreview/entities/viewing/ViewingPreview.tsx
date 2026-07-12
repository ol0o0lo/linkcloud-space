import { EntityPreview } from '../../EntityPreview';
import type { EntityPreviewEntryProps } from '../../types';

export function ViewingPreview(props: EntityPreviewEntryProps) {
  return <EntityPreview type="viewing" {...props} />;
}
