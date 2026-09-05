import { useQuery } from '@tanstack/react-query';
import { Alert, Skeleton, Tabs } from 'antd';
import React, { useEffect, useState } from 'react';
import { TenantSelectionGuard, useTenantWorkspace } from '@/pages/space/shared';
import { allocationApi } from '@/services/manual/allocation';
import AccrualEntriesTab from './components/AccrualEntriesTab';
import AllocationReviewTab from './components/AllocationReviewTab';
import MonthlyTotalsTab from './components/MonthlyTotalsTab';

type EarningsTab = 'reviews' | 'entries' | 'monthly';

function readLocationState() {
  const params = new URLSearchParams(window.location.search);
  const rawTab = params.get('tab');
  const requestId = Number(params.get('request')) || undefined;
  const tab: EarningsTab =
    rawTab === 'entries' || rawTab === 'monthly' ? rawTab : 'reviews';
  return { tab, requestId };
}

function syncLocation(tab: EarningsTab) {
  const params = new URLSearchParams(window.location.search);
  params.set('tab', tab);
  if (tab !== 'reviews') params.delete('request');
  const search = params.toString();
  window.history.replaceState(
    window.history.state,
    '',
    `${window.location.pathname}${search ? `?${search}` : ''}${window.location.hash || ''}`,
  );
}

const EarningsPage: React.FC = () => {
  const workspace = useTenantWorkspace();
  const initialLocation = readLocationState();
  const [activeTab, setActiveTab] = useState<EarningsTab>(initialLocation.tab);
  const [initialRequestId, setInitialRequestId] = useState(
    initialLocation.requestId,
  );

  const capabilitiesQuery = useQuery({
    queryKey: ['allocation', 'capabilities', workspace.selectedOrgSlug],
    queryFn: allocationApi.getCapabilities,
    enabled: Boolean(workspace.selectedOrgSlug),
  });

  useEffect(() => {
    const handlePopState = () => {
      const next = readLocationState();
      setActiveTab(next.tab);
      setInitialRequestId(next.requestId);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const changeTab = (key: string) => {
    const nextTab = key as EarningsTab;
    setActiveTab(nextTab);
    if (nextTab !== 'reviews') setInitialRequestId(undefined);
    syncLocation(nextTab);
  };

  return (
    <TenantSelectionGuard title="收益管理">
      {capabilitiesQuery.isLoading ? (
        <Skeleton active paragraph={{ rows: 8 }} />
      ) : capabilitiesQuery.isError ? (
        <Alert type="error" showIcon title="收益管理权限和范围加载失败" />
      ) : (
        <Tabs
          activeKey={activeTab}
          onChange={changeTab}
          items={[
            {
              key: 'reviews',
              label: '分配审核',
              children: (
                <AllocationReviewTab
                  capabilities={capabilitiesQuery.data}
                  initialRequestId={initialRequestId}
                />
              ),
            },
            {
              key: 'entries',
              label: '收益流水',
              children: (
                <AccrualEntriesTab capabilities={capabilitiesQuery.data} />
              ),
            },
            {
              key: 'monthly',
              label: '月度汇总',
              children: (
                <MonthlyTotalsTab capabilities={capabilitiesQuery.data} />
              ),
            },
          ]}
        />
      )}
    </TenantSelectionGuard>
  );
};

export default EarningsPage;
