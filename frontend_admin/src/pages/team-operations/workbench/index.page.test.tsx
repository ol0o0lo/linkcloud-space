import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import type { PropsWithChildren } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TeamOperationsWorkbenchPage from './index';

const controllerState = vi.hoisted(() => ({
  isEditing: false,
  loadError: false,
}));
const retry = vi.hoisted(() => vi.fn());
const useLayoutPreference = vi.hoisted(() => vi.fn());

vi.mock('@umijs/max', () => ({
  history: {
    block: vi.fn(() => vi.fn()),
    push: vi.fn(),
    replace: vi.fn(),
  },
  useLocation: () => ({
    pathname: '/rental/workbench/overview',
    search: '?view=mine',
  }),
  useModel: () => ({
    initialState: {
      teamOperationsCapabilities: {
        announcement_organization_manage: true,
        announcement_team_ids: [],
        task_organization_manage: true,
        task_team_ids: [],
      },
    },
  }),
}));

vi.mock('@/pages/space/shared', () => ({
  TenantSelectionGuard: ({ children }: PropsWithChildren) => children,
  useTenantWorkspace: () => ({
    selectedOrgSlug: 'org',
    selectedOrganization: { name: '测试空间' },
  }),
}));

vi.mock('@/services/manual/teamOperations', () => ({
  acceptTaskAssignment: vi.fn(),
  completeTaskAssignment: vi.fn(),
  getDailyTeamOperationsDashboard: vi.fn().mockResolvedValue({
    pending_acceptance: 0,
    in_progress: 0,
    due_today: 0,
    overdue: 0,
    completed_today: 0,
    unacknowledged_announcements: 0,
    urgent_items: [],
  }),
}));

vi.mock('./hooks/useWorkbenchLayoutPreference', () => ({
  useWorkbenchLayoutPreference: useLayoutPreference,
}));

vi.mock('./hooks/useUnsavedWorkbenchGuard', () => ({
  useUnsavedWorkbenchGuard: vi.fn(),
}));

vi.mock('./MineWorkbenchContent', () => ({
  MineWorkbenchContent: () => <div>我的工作台内容</div>,
}));

vi.mock('./SpaceWorkbenchContent', () => ({
  SpaceWorkbenchContent: () => <div>空间工作台内容</div>,
}));

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <TeamOperationsWorkbenchPage />
    </QueryClientProvider>,
  );
}

describe('TeamOperationsWorkbenchPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    controllerState.isEditing = false;
    controllerState.loadError = false;
    useLayoutPreference.mockImplementation((_view, definitions) => {
      const layout = definitions.map((item: any) => ({
        id: item.id,
        width: item.defaultWidth,
        visible: item.defaultVisible,
      }));
      return {
        committed: layout,
        draft: layout,
        rendered: layout,
        isReady: true,
        isLoading: false,
        isSaving: false,
        isEditing: controllerState.isEditing,
        isDirty: false,
        loadError: controllerState.loadError,
        canSave: true,
        beginEditing: vi.fn(),
        cancelEditing: vi.fn(),
        restoreDefaults: vi.fn(),
        setDraft: vi.fn(),
        retry,
        save: vi.fn(),
      };
    });
  });

  it('disables view switching while the workbench is being edited', () => {
    controllerState.isEditing = true;
    renderPage();

    expect(screen.getByText('我的工作台内容')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '我的工作台' })).toBeDisabled();
  });

  it('disables customization and retries when settings fail to load', () => {
    controllerState.loadError = true;
    renderPage();

    expect(screen.getByRole('button', { name: '自定义工作台' })).toBeDisabled();
    screen.getByRole('button', { name: /^重\s*试$/ }).click();
    expect(retry).toHaveBeenCalledOnce();
  });
});
