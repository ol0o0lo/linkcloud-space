export type AllauthFlow = {
  id: string;
  is_pending?: true;
  types?: string[];
};

export type PendingMfaFlowState = {
  kind: 'pending_mfa';
  flow: AllauthFlow;
};

export type PendingMfaTrustFlowState = {
  kind: 'pending_mfa_trust';
  flow: AllauthFlow;
};

export type UnsupportedFlowState = {
  kind: 'unsupported_flow';
  flowIds: string[];
  flows: AllauthFlow[];
};

export type ParsedAllauthFlowState =
  | PendingMfaFlowState
  | PendingMfaTrustFlowState
  | UnsupportedFlowState
  | null;

export function getAllauthFlows(error: any): AllauthFlow[] {
  const flows =
    error?.response?.data?.flows ||
    error?.response?.data?.data?.flows ||
    error?.data?.flows ||
    error?.data?.data?.flows ||
    [];
  return Array.isArray(flows) ? flows : [];
}

export function parseLoginFlowState(error: any): ParsedAllauthFlowState {
  if (error?.response?.status !== 401) {
    return null;
  }

  const flows = getAllauthFlows(error);
  if (!flows.length) {
    return null;
  }

  const pendingMfa = flows.find(
    (flow) => flow?.id === 'mfa_authenticate' && flow?.is_pending,
  );
  if (pendingMfa) {
    return {
      kind: 'pending_mfa',
      flow: pendingMfa,
    };
  }

  const pendingMfaTrust = flows.find(
    (flow) => flow?.id === 'mfa_trust' && flow?.is_pending,
  );
  if (pendingMfaTrust) {
    return {
      kind: 'pending_mfa_trust',
      flow: pendingMfaTrust,
    };
  }

  const unsupportedFlows = flows.filter((flow) => flow?.id && flow.id !== 'login');
  if (!unsupportedFlows.length) {
    return null;
  }

  return {
    kind: 'unsupported_flow',
    flowIds: unsupportedFlows.map((flow) => flow.id),
    flows: unsupportedFlows,
  };
}

export function formatUnsupportedFlowMessage(flowIds: string[]) {
  return `当前登录流程包含暂未支持的认证步骤：${flowIds.join('、')}，请联系开发处理。`;
}
