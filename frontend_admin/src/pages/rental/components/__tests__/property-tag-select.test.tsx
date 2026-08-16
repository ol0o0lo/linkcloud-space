import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import {
  getInheritedPropertyTags,
  normalizePropertyTags,
  PropertyTagSelect,
} from '../PropertyTagSelect';

type HarnessProps = React.ComponentProps<typeof PropertyTagSelect> & {
  onValueChange?: (value: string[]) => void;
};

function PropertyTagSelectHarness({
  onValueChange,
  value: initialValue = [],
  ...props
}: HarnessProps) {
  const [value, setValue] = useState(initialValue);

  return (
    <PropertyTagSelect
      {...props}
      value={value}
      onChange={(nextValue) => {
        setValue(nextValue);
        onValueChange?.(nextValue);
      }}
    />
  );
}

describe('PropertyTagSelect utilities', () => {
  it('normalizes whitespace and removes empty or duplicate tags while preserving order', () => {
    expect(
      normalizePropertyTags([
        '  近地铁  ',
        '',
        '采光   好',
        '近地铁',
        '  ',
        '南北\t通透',
      ]),
    ).toEqual(['近地铁', '采光 好', '南北 通透']);
  });

  it('returns only normalized inherited tags not already owned by the house', () => {
    expect(
      getInheritedPropertyTags(
        ['近地铁', '采光   好'],
        [' 近地铁 ', '有   电梯', '有 电梯', '拎包入住'],
      ),
    ).toEqual(['有 电梯', '拎包入住']);
  });
});

describe('PropertyTagSelect', () => {
  it('renders normalized suggestions in configured order and toggles them', () => {
    const onValueChange = vi.fn();
    render(
      <PropertyTagSelectHarness
        value={['已有标签']}
        suggestions={[' 近地铁 ', '采光   好', '近地铁', '拎包入住']}
        onValueChange={onValueChange}
      />,
    );

    const suggestions = screen.getByLabelText('常用标签');
    expect(
      within(suggestions)
        .getAllByText(/近地铁|采光 好|拎包入住/)
        .map((item) => item.textContent),
    ).toEqual(['近地铁', '采光 好', '拎包入住']);

    fireEvent.click(within(suggestions).getByText('近地铁'));
    expect(onValueChange).toHaveBeenLastCalledWith(['已有标签', '近地铁']);

    fireEvent.click(within(suggestions).getByText('近地铁'));
    expect(onValueChange).toHaveBeenLastCalledWith(['已有标签']);
  });

  it('accepts manual tags separated by Chinese and Western punctuation', () => {
    const onValueChange = vi.fn();
    render(
      <PropertyTagSelectHarness
        aria-label="房源标签"
        onValueChange={onValueChange}
      />,
    );

    fireEvent.change(screen.getByRole('combobox', { name: '房源标签' }), {
      target: {
        value: ' 采光   好,独立阳台，南北通透;采光 好；拎包入住、交通便利、',
      },
    });

    expect(onValueChange).toHaveBeenLastCalledWith([
      '采光 好',
      '独立阳台',
      '南北通透',
      '拎包入住',
      '交通便利',
    ]);
  });

  it('shows only non-duplicate inherited tags without emitting them as own tags', () => {
    const onValueChange = vi.fn();
    render(
      <PropertyTagSelectHarness
        value={['近地铁']}
        suggestions={['采光好']}
        inheritedTags={['近地铁', '有   电梯', '采光好']}
        onValueChange={onValueChange}
      />,
    );

    const inherited = screen.getByLabelText('继承标签');
    expect(within(inherited).queryByText('近地铁')).not.toBeInTheDocument();
    expect(within(inherited).getByText('有 电梯')).toBeInTheDocument();
    expect(within(inherited).getByText('采光好')).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByLabelText('常用标签')).getByText('采光好'),
    );

    expect(onValueChange).toHaveBeenLastCalledWith(['近地铁', '采光好']);
    expect(screen.queryByLabelText('继承标签')).toHaveTextContent(
      '将从当前楼栋继承：有 电梯',
    );
  });

  it('keeps manual entry enabled when suggestions fail to load and supports clearing', () => {
    const onValueChange = vi.fn();
    const { container } = render(
      <PropertyTagSelectHarness
        aria-label="房源标签"
        value={['近地铁']}
        suggestionsError
        onValueChange={onValueChange}
      />,
    );

    expect(
      screen.getByText('常用标签暂时不可用，仍可手动输入。'),
    ).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: '房源标签' })).toBeEnabled();

    fireEvent.mouseDown(
      container.querySelector('.ant-select-clear') as Element,
    );
    expect(onValueChange).toHaveBeenLastCalledWith([]);
  });
});
