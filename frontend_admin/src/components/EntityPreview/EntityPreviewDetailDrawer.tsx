import { Drawer } from 'antd';
import { Suspense, useEffect, useState } from 'react';
import { EntityPreviewSkeleton } from './EntityPreviewState';
import { entityPreviewRegistry } from './registry';
import type { EntityPreviewType } from './types';

function getPreviewId(searchParam: string) {
  const value = Number(
    new URLSearchParams(window.location.search).get(searchParam),
  );
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

interface EntityPreviewDetailDrawerProps {
  searchParam: string;
  title: string;
  type: EntityPreviewType;
}

export function EntityPreviewDetailDrawer({
  searchParam,
  title,
  type,
}: EntityPreviewDetailDrawerProps) {
  const [id, setId] = useState(() => getPreviewId(searchParam));
  const definition = entityPreviewRegistry[type];

  useEffect(() => {
    const handlePopState = () => setId(getPreviewId(searchParam));
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [searchParam]);

  const close = () => {
    const params = new URLSearchParams(window.location.search);
    params.delete(searchParam);
    const nextSearch = params.toString();
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`,
    );
    setId(undefined);
  };

  if (!id || !definition) return null;

  const Panel = definition.Panel;

  return (
    <Drawer destroyOnHidden onClose={close} open size="large" title={title}>
      <Suspense fallback={<EntityPreviewSkeleton variant="drawer" />}>
        <Panel id={id} variant="drawer" />
      </Suspense>
    </Drawer>
  );
}
