import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import CashFlowBarChart from './CashFlowBarChart.vue';

describe('CashFlowBarChart', () => {
  const sampleData = [
    { month: '2024-01', income: 500000, expense: 300000, net: 200000, fixed: 100000, variable: 150000, exclude: 50000 },
    { month: '2024-02', income: 500000, expense: 400000, net: 100000, fixed: 100000, variable: 250000, exclude: 50000 },
  ];

  const sampleAverages = {
    income: 500000,
    expense: 350000,
    net: 150000,
    fixed: 100000,
    variable: 200000,
    exclude: 50000,
    count: 2
  };

  it('renders correctly with data', () => {
    const wrapper = mount(CashFlowBarChart, {
      props: {
        data: sampleData,
        averages: sampleAverages
      }
    });
    expect(wrapper.find('.section-title').text()).toBe('月次収支推移');
    expect(wrapper.findAll('rect')).toHaveLength(8); // (1 income + 3 expense) * 2 months
  });

  it('renders reference lines and deviation line when averages are provided', () => {
    const wrapper = mount(CashFlowBarChart, {
      props: {
        data: sampleData,
        averages: sampleAverages
      }
    });

    expect(wrapper.find('.right-axis').exists()).toBe(true);
    expect(wrapper.find('path[stroke="#ec4899"]').exists()).toBe(true); // Deviation line
  });

  it('shows high deviation indicator when lifestyle cost is >10% above average', () => {
    const wrapper = mount(CashFlowBarChart, {
      props: {
        data: sampleData, // Feb lifestyle: 100k+250k=350k. Avg lifestyle: 100k+200k=300k. Dev: +16.6% (>10%)
        averages: sampleAverages
      }
    });
    const indicators = wrapper.findAll('text').filter(t => t.text() === '▲');
    expect(indicators).toHaveLength(1);
  });

  it('calculates deviation correctly', () => {
    const wrapper = mount(CashFlowBarChart, {
      props: {
        data: sampleData,
        averages: sampleAverages
      }
    });
    const bars = wrapper.vm.bars;
    // Jan lifestyle: 100k+150k=250k. Avg: 300k. Dev: (250/300 - 1)*100 = -16.66...
    expect(bars[0].deviation.val).toBeCloseTo(-16.666);
    // Feb lifestyle: 100k+250k=350k. Avg: 300k. Dev: (350/300 - 1)*100 = +16.66...
    expect(bars[1].deviation.val).toBeCloseTo(16.666);
  });

  it('handles zero average lifestyle gracefully', () => {
    const wrapper = mount(CashFlowBarChart, {
      props: {
        data: sampleData,
        averages: { ...sampleAverages, fixed: 0, variable: 0 }
      }
    });
    expect(wrapper.find('.right-axis').exists()).toBe(false);
    expect(wrapper.find('path[stroke="#ec4899"]').exists()).toBe(false);
  });

  it('shows and hides tooltip on interaction', async () => {
    const wrapper = mount(CashFlowBarChart, {
      props: {
        data: sampleData,
        averages: sampleAverages
      }
    });

    wrapper.element.getBoundingClientRect = () => ({
      left: 0, top: 0, width: 800, height: 300,
    });

    const incomeRect = wrapper.find('rect[fill="#22c55e"]');
    const enterEvent = new MouseEvent('pointerenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'clientX', { value: 100 });
    Object.defineProperty(enterEvent, 'clientY', { value: 100 });
    await incomeRect.element.dispatchEvent(enterEvent);

    expect(wrapper.find('.cash-flow-tooltip').exists()).toBe(true);
    expect(wrapper.find('.cash-flow-tooltip').text()).toContain('収入');

    await incomeRect.trigger('pointerleave');
    expect(wrapper.find('.cash-flow-tooltip').exists()).toBe(false);

    await incomeRect.element.dispatchEvent(enterEvent);
    expect(wrapper.find('.cash-flow-tooltip').exists()).toBe(true);
    await wrapper.find('.chart-container').trigger('click');
    expect(wrapper.find('.cash-flow-tooltip').exists()).toBe(false);
  });

  it('handles pointermove for tooltip', async () => {
    const wrapper = mount(CashFlowBarChart, {
      props: { data: sampleData, averages: sampleAverages }
    });
    wrapper.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 300 });

    const incomeRect = wrapper.find('rect[fill="#22c55e"]');
    const moveEvent = new MouseEvent('pointermove', { bubbles: true });
    Object.defineProperty(moveEvent, 'clientX', { value: 120 });
    Object.defineProperty(moveEvent, 'clientY', { value: 120 });
    await incomeRect.element.dispatchEvent(moveEvent);
    expect(wrapper.find('.cash-flow-tooltip').exists()).toBe(true);
  });

  it('handles interaction with deviation points', async () => {
    const wrapper = mount(CashFlowBarChart, {
      props: { data: sampleData, averages: sampleAverages }
    });
    wrapper.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 300 });

    const devPoint = wrapper.find('circle[fill="#ec4899"]');
    const enterEvent = new MouseEvent('pointerenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'clientX', { value: 150 });
    Object.defineProperty(enterEvent, 'clientY', { value: 150 });
    await devPoint.element.dispatchEvent(enterEvent);
    expect(wrapper.find('.cash-flow-tooltip').text()).toContain('生活費(固定+変動)');
  });

  it('handles net line interaction', async () => {
    const wrapper = mount(CashFlowBarChart, {
      props: { data: sampleData, averages: sampleAverages, showNet: true }
    });
    wrapper.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 300 });

    const netPoint = wrapper.find('circle[fill="#3b82f6"]');
    const enterEvent = new MouseEvent('pointerenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'clientX', { value: 100 });
    Object.defineProperty(enterEvent, 'clientY', { value: 100 });
    await netPoint.element.dispatchEvent(enterEvent);
    expect(wrapper.find('.cash-flow-tooltip').text()).toContain('純収支');
  });

  it('handles exclude bar interaction', async () => {
    const wrapper = mount(CashFlowBarChart, {
      props: { data: sampleData, averages: sampleAverages }
    });
    wrapper.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 300 });

    const excludeRect = wrapper.find('rect[fill="#4b5563"]');
    const enterEvent = new MouseEvent('pointerenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'clientX', { value: 100 });
    Object.defineProperty(enterEvent, 'clientY', { value: 100 });
    await excludeRect.element.dispatchEvent(enterEvent);
    expect(wrapper.find('.cash-flow-tooltip').text()).toContain('除外');
  });

  it('handles negative deviation in tooltip', async () => {
    const wrapper = mount(CashFlowBarChart, {
      props: { data: sampleData, averages: sampleAverages }
    });
    wrapper.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 300 });

    const devPoint = wrapper.find('circle[fill="#ec4899"]');
    const enterEvent = new MouseEvent('pointerenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'clientX', { value: 10 });
    Object.defineProperty(enterEvent, 'clientY', { value: 10 });
    await devPoint.element.dispatchEvent(enterEvent);

    const tooltip = wrapper.find('.cash-flow-tooltip');
    expect(tooltip.text()).toContain('-16.7%');
    expect(tooltip.find('.is-positive').exists()).toBe(true);

    // Test positive deviation
    const febDevPoint = wrapper.findAll('circle[fill="#ec4899"]')[1];
    const enterEvent2 = new MouseEvent('pointerenter', { bubbles: true });
    Object.defineProperty(enterEvent2, 'clientX', { value: 20 });
    Object.defineProperty(enterEvent2, 'clientY', { value: 20 });
    await febDevPoint.element.dispatchEvent(enterEvent2);

    const tooltip2 = wrapper.find('.cash-flow-tooltip');
    expect(tooltip2.text()).toContain('+16.7%');
    expect(tooltip2.find('.is-negative').exists()).toBe(true);
  });

  it('handles hideTooltip with non-mouse pointer', async () => {
    const wrapper = mount(CashFlowBarChart, {
      props: { data: sampleData, averages: sampleAverages }
    });
    wrapper.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 300 });

    const incomeRect = wrapper.find('rect[fill="#22c55e"]');
    const enterEvent = new MouseEvent('pointerenter', { bubbles: true });
    Object.defineProperty(enterEvent, 'clientX', { value: 100 });
    Object.defineProperty(enterEvent, 'clientY', { value: 100 });
    await incomeRect.element.dispatchEvent(enterEvent);
    expect(wrapper.find('.cash-flow-tooltip').exists()).toBe(true);

    const leaveEvent = new PointerEvent('pointerleave', { pointerType: 'touch' });
    await incomeRect.element.dispatchEvent(leaveEvent);
    expect(wrapper.find('.cash-flow-tooltip').exists()).toBe(true);
  });
});
