/**
 * @jest-environment jsdom
 */
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConfirmClaimCard } from '@/components/optimization-review/ConfirmClaimCard';
import type { ReviewChangeGroup } from '@/types/optimization-review';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const group: ReviewChangeGroup = {
  id: 'confirm-1',
  section: 'experience',
  title: 'Add only if true',
  summary: '',
  before_excerpt: 'Prepared monthly reports for managers.',
  after_excerpt: 'Prepared monthly reports for managers, providing actionable insights to non-technical stakeholders.',
  affected_fields: ['experience'],
  operations: [],
  reason_tags: ['confirm'],
  confirm: {
    requires: 'experience',
    index: 0,
    kept: 'Prepared monthly reports for managers.',
    proposed: 'Prepared monthly reports for managers, providing actionable insights to non-technical stakeholders.',
    after: null,
    terms: ['stakeholders'],
    estimated_gain: 3,
  },
};

const labels = {
  badge: 'Add only if true',
  question: "This line uses the job's words. Is it true for you?",
  now: 'Now it says',
  nowEmpty: 'Not on your résumé',
  withLine: 'If you confirm',
  gain: (points: number) => `+${points} pts`,
  add: 'Yes, add it',
  remove: "Don't add",
  needsSection: 'Include the experience change above to use this.',
};

describe('ConfirmClaimCard', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (props: { confirmed: boolean; available: boolean; onToggle?: (id: string) => void }) =>
    act(() => {
      root.render(<ConfirmClaimCard group={group} labels={labels} onToggle={props.onToggle ?? (() => {})} {...props} />);
    });

  it('shows both lines, the points, and asks before adding', () => {
    render({ confirmed: false, available: true });
    const text = container.textContent ?? '';
    expect(text).toContain('Prepared monthly reports for managers.');
    expect(text).toContain('non-technical stakeholders');
    expect(text).toContain('+3 pts');
    expect(container.querySelector('button')?.textContent).toContain('Yes, add it');
  });

  it('confirms through onToggle with its id', () => {
    const onToggle = jest.fn();
    render({ confirmed: false, available: true, onToggle });
    act(() => container.querySelector('button')?.click());
    expect(onToggle).toHaveBeenCalledWith('confirm-1');
  });

  it('cannot be confirmed while its section change is excluded, and says why', () => {
    render({ confirmed: true, available: false });
    expect((container.querySelector('button') as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain('Include the experience change above');
    expect(container.querySelector('button')?.textContent).toContain('Yes, add it');
  });
});
