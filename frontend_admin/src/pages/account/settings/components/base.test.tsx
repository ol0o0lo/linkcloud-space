import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BaseView from './base';

const MockFormContext = React.createContext<{
  formValue: string;
  setFormValue: (value: string) => void;
}>({
  formValue: '',
  setFormValue: () => {},
});

const { mockInvalidateQueries, mockMessageSuccess, mockQueryCurrent, mockSetInitialState, mockSetQueryData, mockUpdateCurrentUser, mockUploadAvatar } = vi.hoisted(() => ({
  mockInvalidateQueries: vi.fn(),
  mockMessageSuccess: vi.fn(),
  mockQueryCurrent: vi.fn(),
  mockSetInitialState: vi.fn(),
  mockSetQueryData: vi.fn(),
  mockUpdateCurrentUser: vi.fn(),
  mockUploadAvatar: vi.fn(),
}));

vi.mock('@umijs/max', () => ({
  useModel: () => ({
    initialState: {
      currentUser: {
        avatar: '/initial-avatar.png',
        id: 7,
        lastName: '旧昵称',
        name: '旧昵称',
      },
    },
    setInitialState: mockSetInitialState,
  }),
}));

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: mockInvalidateQueries,
      setQueryData: mockSetQueryData,
    }),
  };
});

vi.mock('../service', () => ({
  queryCurrent: mockQueryCurrent,
  updateCurrentUser: mockUpdateCurrentUser,
  uploadAvatar: mockUploadAvatar,
}));

vi.mock('./index.style', () => ({
  default: () => ({
    styles: {
      avatar: 'avatar',
      avatar_title: 'avatar-title',
      baseView: 'base-view',
      button_view: 'button-view',
      left: 'left',
      right: 'right',
    },
  }),
}));

vi.mock('@ant-design/icons', () => ({
  UploadOutlined: () => <span>upload</span>,
}));

vi.mock('antd', () => ({
  Button: ({ children, loading: _loading, ...props }: any) => <button type="button" {...props}>{children}</button>,
  Upload: ({ children, customRequest }: any) => (
    <div>
      <input
        aria-label="上传头像"
        data-testid="avatar-input"
        type="file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file || !customRequest) {
            return;
          }
          customRequest({
            file,
            onSuccess: vi.fn(),
            onError: vi.fn(),
          });
        }}
      />
      {children}
    </div>
  ),
  message: {
    success: mockMessageSuccess,
  },
}));

vi.mock('@ant-design/pro-components', () => ({
  ProForm: ({ children, initialValues, onFinish, submitter }: any) => {
    const [value, setValue] = React.useState(initialValues?.name ?? '');
    return (
      <MockFormContext.Provider
        value={{ formValue: value, setFormValue: setValue }}
      >
        <form
          onSubmit={(event) => {
            event.preventDefault();
            onFinish?.({ name: value });
          }}
        >
          {children}
          {submitter?.render?.({}, [<button key="reset" type="button">重置</button>, <button key="submit" type="submit">更新基本信息</button>])}
        </form>
      </MockFormContext.Provider>
    );
  },
  ProFormText: ({ label, name }: any) => {
    const { formValue, setFormValue } = React.useContext(MockFormContext);
    return (
      <label>
        <span>{label}</span>
        <input
          aria-label={label}
          data-testid={`field-${name}`}
          value={formValue}
          onChange={(event) => setFormValue(event.target.value)}
        />
      </label>
    );
  },
}));

describe('BaseView', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    vi.clearAllMocks();
    mockQueryCurrent.mockResolvedValue({
      data: {
        avatar: '/avatar.png',
        id: 7,
        lastName: '产品昵称',
        name: '旧名称',
      },
    });
  });

  it('仅回显昵称，并隐藏已移除的字段', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <BaseView />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('昵称')).toHaveValue('产品昵称');
    });

    expect(screen.queryByTestId('field-email')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-profile')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-country')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-phone')).not.toBeInTheDocument();
  });

  it('提交时更新昵称并同步当前用户状态', async () => {
    mockUpdateCurrentUser.mockResolvedValue({ last_name: '新昵称' });

    render(
      <QueryClientProvider client={queryClient}>
        <BaseView />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('昵称')).toHaveValue('产品昵称');
    });

    fireEvent.change(screen.getByLabelText('昵称'), {
      target: { value: '新昵称' },
    });
    fireEvent.click(screen.getByRole('button', { name: '更新基本信息' }));

    await waitFor(() => {
      expect(mockUpdateCurrentUser).toHaveBeenCalledWith(7, {
        last_name: '新昵称',
      });
      expect(mockMessageSuccess).toHaveBeenCalledWith('更新基本信息成功');
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['current-user'] });
    expect(mockSetInitialState).toHaveBeenCalled();
  });

  it('上传头像后刷新资料并同步全局头像', async () => {
    mockUploadAvatar.mockResolvedValue({ avatar_url: '/uploaded-avatar.png' });

    render(
      <QueryClientProvider client={queryClient}>
        <BaseView />
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('avatar-input')).toBeInTheDocument();
    });

    const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });

    fireEvent.change(screen.getByTestId('avatar-input'), {
      target: { files: [file] },
    });

    await waitFor(() => {
      expect(mockUploadAvatar).toHaveBeenCalledWith(file, expect.any(Object));
      expect(mockMessageSuccess).toHaveBeenCalledWith('头像更新成功');
    });

    expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: ['current-user'] });
    expect(mockSetInitialState).toHaveBeenCalled();
  });
});
