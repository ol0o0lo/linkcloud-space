import { Card } from 'antd';
import React, { useState } from 'react';
import { TenantSelectionGuard } from '@/pages/space/shared';
import { TeamRolesPanel, type TeamRolesPanelProps } from './TeamRolesPanel';

function initialTeamId() {
  const value = new URLSearchParams(window.location.search).get('team');
  if (!value || !/^\d+$/.test(value)) return undefined;
  const teamId = Number(value);
  return teamId > 0 ? teamId : undefined;
}

const TeamRolesPage: React.FC = () => {
  const [selectedTeamId, setSelectedTeamId] =
    useState<TeamRolesPanelProps['selectedTeamId']>(initialTeamId);

  return (
    <TenantSelectionGuard title="角色管理">
      <Card>
        <TeamRolesPanel
          selectedTeamId={selectedTeamId}
          onTeamChange={setSelectedTeamId}
        />
      </Card>
    </TenantSelectionGuard>
  );
};

export { TeamRolesPanel };
export default TeamRolesPage;
