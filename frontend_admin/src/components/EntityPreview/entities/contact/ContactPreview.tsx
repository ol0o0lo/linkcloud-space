import { EntityPreview } from '../../EntityPreview';
import type { EntityPreviewEntryProps } from '../../types';

export function ContactPreview(props: EntityPreviewEntryProps) {
  return <EntityPreview type="contact" {...props} />;
}
