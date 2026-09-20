import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HouseAIInsightCard from './HouseAIInsightCard';

const { mockGetHouseAIInsight, mockGenerateHouseAIInsight } = vi.hoisted(
  () => ({
    mockGetHouseAIInsight: vi.fn(),
    mockGenerateHouseAIInsight: vi.fn(),
  }),
);

vi.mock('@/services/manual/house', () => ({
  houseApi: {
    getHouseAIInsight: mockGetHouseAIInsight,
    generateHouseAIInsight: mockGenerateHouseAIInsight,
  },
}));

const generatedInsight = {
  state: 'fresh' as const,
  insight: {
    schema_version: 3,
    conclusion: {
      text: '两居空间和租金信息较清楚，但高楼层无电梯需要优先确认是否能接受。',
      fact_ids: ['layout', 'rent', 'elevator'],
    },
    signals: [
      {
        label: '空间配置',
        value: '2室1厅 · 80㎡',
        tone: 'positive' as const,
        fact_ids: ['layout', 'area'],
      },
      {
        label: '上下楼',
        value: '高楼层且无电梯',
        tone: 'caution' as const,
        fact_ids: ['elevator'],
      },
      {
        label: '月租',
        value: '¥4,200/月',
        tone: 'neutral' as const,
        fact_ids: ['rent'],
      },
    ],
    appeal_points: [
      {
        text: '两居户型有独立卧室和公共活动空间。',
        fact_ids: ['layout'],
      },
      {
        text: '80㎡建筑面积为日常收纳和活动留出空间。',
        fact_ids: ['area'],
      },
    ],
    missing_fields: [{ key: 'videos', label: '房源视频' }],
    viewing_questions: [
      {
        text: '高楼层日常上下楼是否方便，搬家是否有替代方案？',
        fact_ids: ['elevator'],
        missing_field_keys: [],
      },
      {
        text: '是否可以补充房源视频，确认当前装修和采光状态？',
        fact_ids: [],
        missing_field_keys: ['videos'],
      },
    ],
    facts: [
      { id: 'layout', label: '户型', value: '2室1厅' },
      { id: 'area', label: '建筑面积', value: '80㎡' },
      { id: 'rent', label: '挂牌租金', value: '¥4,200/月' },
      { id: 'elevator', label: '电梯', value: '不可使用电梯' },
    ],
  },
  generated_at: '2026-09-10T10:00:00+08:00',
  expires_at: '2026-09-11T10:00:00+08:00',
  source_changed: false,
};

function renderCard() {
  return render(
    <QueryClientProvider client={new QueryClient()}>
      <HouseAIInsightCard enabled houseId={99} organizationSlug="org" />
    </QueryClientProvider>,
  );
}

describe('HouseAIInsightCard', () => {
  beforeEach(() => {
    mockGetHouseAIInsight.mockReset();
    mockGenerateHouseAIInsight.mockReset();
  });

  it('only generates after the user clicks and keeps evidence collapsed', async () => {
    mockGetHouseAIInsight.mockResolvedValue({
      state: 'not_generated',
      insight: null,
      generated_at: null,
      expires_at: null,
      source_changed: false,
    });
    mockGenerateHouseAIInsight.mockResolvedValue(generatedInsight);

    renderCard();

    expect(
      await screen.findByRole('button', { name: /生成租房速览/ }),
    ).toBeInTheDocument();
    expect(mockGenerateHouseAIInsight).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: /生成租房速览/ }));

    await waitFor(() =>
      expect(mockGenerateHouseAIInsight).toHaveBeenCalledWith(99),
    );
    expect(
      await screen.findByText(generatedInsight.insight.conclusion.text),
    ).toBeInTheDocument();
    expect(screen.getByText('高楼层且无电梯')).toBeInTheDocument();
    expect(screen.getByText('值得关注的特点')).toBeInTheDocument();
    expect(screen.getByText('看房前先确认')).toBeInTheDocument();
    expect(screen.queryByText('户型 · 2室1厅')).not.toBeInTheDocument();
    expect(screen.queryByText('未说明 · 房源视频')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /查看内容依据（5）/ }));

    expect(screen.getByText('户型 · 2室1厅')).toBeInTheDocument();
    expect(screen.getByText('建筑面积 · 80㎡')).toBeInTheDocument();
    expect(screen.getByText('挂牌租金 · ¥4,200/月')).toBeInTheDocument();
    expect(screen.getByText('电梯 · 不可使用电梯')).toBeInTheDocument();
    expect(screen.getByText('未说明 · 房源视频')).toBeInTheDocument();
    expect(
      screen.getByText(
        'AI 生成内容仅供租房参考，实际情况以看房和合同约定为准。',
      ),
    ).toBeInTheDocument();
  });

  it('keeps expired content visible and explains when source data changed', async () => {
    mockGetHouseAIInsight.mockResolvedValue({
      ...generatedInsight,
      state: 'expired',
      source_changed: true,
    });

    renderCard();

    expect(
      await screen.findByText(generatedInsight.insight.conclusion.text),
    ).toBeInTheDocument();
    expect(screen.getByText('房源资料有更新')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '重新生成' }),
    ).toBeInTheDocument();
  });

  it('hides the optional appeal section when AI has no reliable appeal point', async () => {
    mockGetHouseAIInsight.mockResolvedValue({
      ...generatedInsight,
      insight: {
        ...generatedInsight.insight,
        appeal_points: [],
      },
    });

    renderCard();

    expect(
      await screen.findByText(generatedInsight.insight.conclusion.text),
    ).toBeInTheDocument();
    expect(screen.queryByText('值得关注的特点')).not.toBeInTheDocument();
    expect(screen.getByText('看房前先确认')).toBeInTheDocument();
  });

  it('marks legacy cache as replaceable instead of showing a false expiry time', async () => {
    mockGetHouseAIInsight.mockResolvedValue({
      ...generatedInsight,
      state: 'expired',
      insight: {
        ...generatedInsight.insight,
        schema_version: 2,
      },
    });

    renderCard();

    expect(await screen.findByText('旧版速览 · 可更新')).toBeInTheDocument();
    expect(screen.queryByText(/已于 .* 过期/)).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '重新生成' }),
    ).toBeInTheDocument();
  });
});
