import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import type { Exercise } from '@/types/lesson-contracts';

import { OperationShell } from './OperationShell';

const useReducedMotionMock = vi.fn(() => false);

vi.mock('motion/react', async () => {
  const actual =
    await vi.importActual<typeof import('motion/react')>('motion/react');
  return {
    ...actual,
    useReducedMotion: () => useReducedMotionMock(),
  };
});

type ChooseExercise = Extract<Exercise, { operation: 'choose' }>;

function makeExercise(): ChooseExercise {
  return {
    kind: 'exercise',
    objective_id: 'obj-1',
    id: 'ex-1',
    operation: 'choose',
    prompt: [{ kind: 'text', value: 'Pick one.' }],
    explanation: [{ kind: 'text', value: 'Because grammar.' }],
    payload: {
      options: [
        { option_id: 'a', text: 'A' },
        { option_id: 'b', text: 'B' },
      ],
      answer_id: 'a',
    },
  };
}

function Shell({
  retry,
  result = null,
  canCheck = true,
  fillWorkSurface = false,
  promptAsInstruction = false,
  ownsResultFeedback = false,
  statusFirstOnMobile = false,
  statusHint,
  pending = false,
  pendingLabel,
  exercise = makeExercise(),
  onCheck = vi.fn(),
  onContinue = vi.fn(),
  children = <p data-testid="body">Body</p>,
}: {
  retry?: Parameters<typeof OperationShell>[0]['retry'];
  result?: Parameters<typeof OperationShell>[0]['result'];
  canCheck?: boolean;
  fillWorkSurface?: boolean;
  promptAsInstruction?: boolean;
  ownsResultFeedback?: boolean;
  statusFirstOnMobile?: boolean;
  statusHint?: string;
  pending?: boolean;
  pendingLabel?: string;
  exercise?: Exercise;
  onCheck?: () => void;
  onContinue?: () => void;
  children?: React.ReactNode;
}) {
  return (
    <OperationShell
      exercise={exercise}
      retry={retry}
      result={result}
      canCheck={canCheck}
      fillWorkSurface={fillWorkSurface}
      promptAsInstruction={promptAsInstruction}
      ownsResultFeedback={ownsResultFeedback}
      statusFirstOnMobile={statusFirstOnMobile}
      statusHint={statusHint}
      pending={pending}
      pendingLabel={pendingLabel}
      onCheck={onCheck}
      onContinue={onContinue}
    >
      {children}
    </OperationShell>
  );
}

describe('OperationShell — non-retry path', () => {
  it('renders a Check button that calls onCheck when canCheck is true', async () => {
    const user = userEvent.setup();
    const onCheck = vi.fn();
    render(<Shell onCheck={onCheck} result={null} canCheck />);

    const checkButton = screen.getByRole('button', { name: /check/i });
    expect(checkButton).not.toBeDisabled();
    await user.click(checkButton);
    expect(onCheck).toHaveBeenCalledTimes(1);
  });

  it('disables Check when canCheck is false', () => {
    render(<Shell canCheck={false} />);
    expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
  });

  it('renders Continue and calls onContinue after a result is set (correct)', async () => {
    const user = userEvent.setup();
    const onContinue = vi.fn();
    render(<Shell result={{ correct: true }} onContinue={onContinue} />);

    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
  });

  it('renders the wrong banner text when result is incorrect', () => {
    render(<Shell result={{ correct: false }} />);
    expect(screen.getByText(/not quite/i)).toBeInTheDocument();
  });

  it('never renders a button whose label/onClick flips between Check and Continue', () => {
    // The non-retry footer must render Check and Continue as distinct button
    // instances so a fast second click or held Enter cannot fall through from
    // Check to Continue on the same element.
    const { rerender } = render(<Shell result={null} canCheck />);

    // Pre-result: Check exists, Continue does not.
    expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /continue/i }),
    ).not.toBeInTheDocument();

    // Simulate the parent setting a result after Check.
    rerender(<Shell result={{ correct: true }} canCheck />);

    // Post-result: Continue exists, Check does not. They are never the same
    // element.
    expect(
      screen.getByRole('button', { name: /continue/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /check/i }),
    ).not.toBeInTheDocument();
  });
});

describe('OperationShell — retry path', () => {
  describe('footer (working / wrong)', () => {
    it('shows Check (disabled when canCheck=false) with no Reveal button in working phase', () => {
      render(
        <Shell
          retry={{
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck={false}
        />,
      );

      expect(screen.getByRole('button', { name: /check/i })).toBeDisabled();
      expect(
        screen.queryByRole('button', { name: /reveal answer/i }),
      ).not.toBeInTheDocument();
    });

    it('shows Check (enabled) when canCheck is true', () => {
      render(
        <Shell
          retry={{
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck
        />,
      );
      expect(screen.getByRole('button', { name: /check/i })).not.toBeDisabled();
    });

    it('shows "Adjust your answer to try again." in wrong phase with canCheck=false', () => {
      // After a wrong check with a filled board, canCheck is false (dirty
      // gate) but the generic "Select an answer" would be misleading.
      render(
        <Shell
          retry={{
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck={false}
        />,
      );
      expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
        /adjust your answer to try again\./i,
      );
    });

    it('shows "Ready to check" in working phase with canCheck=true', () => {
      render(
        <Shell
          retry={{
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          canCheck
        />,
      );
      expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
        /ready to check/i,
      );
    });

    it('shows Reveal answer button only when canReveal is true', () => {
      const onReveal = vi.fn();
      render(
        <Shell
          retry={{
            phase: 'wrong',
            shakeKey: 1,
            canReveal: true,
            onReveal,
          }}
          canCheck
        />,
      );
      expect(
        screen.getByRole('button', { name: /reveal answer/i }),
      ).toBeInTheDocument();
    });

    it('calls onReveal when Reveal answer is clicked', async () => {
      const user = userEvent.setup();
      const onReveal = vi.fn();
      render(
        <Shell
          retry={{
            phase: 'wrong',
            shakeKey: 1,
            canReveal: true,
            onReveal,
          }}
          canCheck
        />,
      );
      await user.click(screen.getByRole('button', { name: /reveal answer/i }));
      expect(onReveal).toHaveBeenCalledTimes(1);
    });

    it('does not render the wrongHint in retry mode', () => {
      render(
        <OperationShell
          exercise={makeExercise()}
          retry={{
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          wrongHint="Old hint text"
          onCheck={vi.fn()}
        >
          <p>Body</p>
        </OperationShell>,
      );
      expect(screen.queryByText('Old hint text')).not.toBeInTheDocument();
    });
  });

  describe('banner states', () => {
    it('shows exactly one alert (sr-only live region) in wrong phase; visible banner has no role', () => {
      render(
        <Shell
          retry={{
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      // Exactly one role="alert": the sr-only live region keyed on shakeKey.
      // The visible banner inside the shaking motion.div is a plain styled
      // div (no role/aria-live) so SRs do not double announce.
      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveClass('sr-only');
      expect(alerts[0]).toHaveTextContent(
        /incorrect — adjust your answer and try again./i,
      );

      // The visible banner is still rendered but carries no role.
      const visibleBanner = screen
        .getAllByText(/incorrect — adjust your answer and try again./i)
        .find((el) => !el.classList.contains('sr-only'));
      expect(visibleBanner).toBeDefined();
      expect(visibleBanner).not.toHaveAttribute('role');
      expect(visibleBanner).not.toHaveAttribute('aria-live');
    });

    it('does not show an alert in the working phase', () => {
      render(
        <Shell
          retry={{
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('footer (solved / revealed)', () => {
    it('shows Continue in solved phase and calls onContinue', async () => {
      const user = userEvent.setup();
      const onContinue = vi.fn();
      render(
        <Shell
          retry={{
            phase: 'solved',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
          onContinue={onContinue}
        />,
      );
      const continueButton = screen.getByRole('button', { name: /continue/i });
      expect(continueButton).toBeInTheDocument();
      await user.click(continueButton);
      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('shows the solved "Correct" banner in solved phase', () => {
      render(
        <Shell
          retry={{
            phase: 'solved',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.getByText(/^correct$/i)).toBeInTheDocument();
      expect(screen.getByText('Because grammar.')).toBeInTheDocument();
    });

    it('shows Continue in revealed phase and the revealed banner', () => {
      render(
        <Shell
          retry={{
            phase: 'revealed',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(
        screen.getByRole('button', { name: /continue/i }),
      ).toBeInTheDocument();
      expect(screen.getByText(/here's the answer\./i)).toBeInTheDocument();
    });

    it('does not render Reveal answer in terminal phases', () => {
      render(
        <Shell
          retry={{
            phase: 'revealed',
            shakeKey: 1,
            canReveal: true,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(
        screen.queryByRole('button', { name: /reveal answer/i }),
      ).not.toBeInTheDocument();
    });
  });

  describe('focus management', () => {
    it('moves focus to Continue when entering a terminal phase', () => {
      render(
        <Shell
          retry={{
            phase: 'solved',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.getByRole('button', { name: /continue/i })).toHaveFocus();
    });

    it('does not steal focus in the working phase', () => {
      render(
        <Shell
          retry={{
            phase: 'working',
            shakeKey: 0,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );
      expect(screen.getByRole('button', { name: /check/i })).not.toHaveFocus();
    });
  });

  describe('reduced motion', () => {
    it('renders the wrong-phase alert without shake when reduced motion is preferred', () => {
      useReducedMotionMock.mockReturnValue(true);
      try {
        render(
          <Shell
            retry={{
              phase: 'wrong',
              shakeKey: 1,
              canReveal: false,
              onReveal: vi.fn(),
            }}
          />,
        );

        // sr-only alert still present for SR users.
        const alerts = screen.getAllByRole('alert');
        expect(alerts).toHaveLength(1);
        expect(alerts[0]).toHaveClass('sr-only');
        expect(alerts[0]).toHaveTextContent(
          /incorrect — adjust your answer and try again./i,
        );

        // The visible banner's parent (motion.div) should not carry a shake.
        const visibleBanner = screen
          .getAllByText(/incorrect — adjust your answer and try again./i)
          .find((el) => !el.classList.contains('sr-only'));
        expect(visibleBanner).toBeDefined();
        const wrapper = screen.getByTestId('work-surface');
        expect(wrapper).toBeInTheDocument();
        const style = wrapper.getAttribute('style') ?? '';
        expect(style).not.toMatch(/translate3d\(-?[^0]/);
      } finally {
        useReducedMotionMock.mockReturnValue(false);
      }
    });

    it('renders the wrong-phase alert with shake when motion is allowed', () => {
      useReducedMotionMock.mockReturnValue(false);
      render(
        <Shell
          retry={{
            phase: 'wrong',
            shakeKey: 1,
            canReveal: false,
            onReveal: vi.fn(),
          }}
        />,
      );

      // Exactly one role="alert" (sr-only live region); visible banner has no role.
      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toHaveClass('sr-only');
      expect(alerts[0]).toHaveTextContent(
        /incorrect — adjust your answer and try again./i,
      );
    });

    it('preserves keyboard focus inside the work surface across wrong checks for reduced-motion users', () => {
      useReducedMotionMock.mockReturnValue(true);
      try {
        function ShellWithFocusable({ shakeKey }: { shakeKey: number }) {
          return (
            <OperationShell
              exercise={makeExercise()}
              retry={{
                phase: 'wrong',
                shakeKey,
                canReveal: false,
                onReveal: vi.fn(),
              }}
              onCheck={vi.fn()}
            >
              <button type="button">Focusable child</button>
            </OperationShell>
          );
        }

        const { rerender } = render(<ShellWithFocusable shakeKey={1} />);
        const child = screen.getByRole('button', {
          name: /focusable child/i,
        });
        child.focus();
        expect(child).toHaveFocus();

        // Simulate a new wrong check — shakeKey changes. For reduced-motion
        // users the work-surface key is stable, so the subtree is NOT
        // remounted and focus is preserved.
        rerender(<ShellWithFocusable shakeKey={2} />);
        expect(child).toHaveFocus();
      } finally {
        useReducedMotionMock.mockReturnValue(false);
      }
    });

    it('remounts the work surface on a new wrong check for non-reduced-motion users (focus is lost)', () => {
      useReducedMotionMock.mockReturnValue(false);
      try {
        function ShellWithFocusable({ shakeKey }: { shakeKey: number }) {
          return (
            <OperationShell
              exercise={makeExercise()}
              retry={{
                phase: 'wrong',
                shakeKey,
                canReveal: false,
                onReveal: vi.fn(),
              }}
              onCheck={vi.fn()}
            >
              <button type="button">Focusable child</button>
            </OperationShell>
          );
        }

        const { rerender } = render(<ShellWithFocusable shakeKey={1} />);
        const child = screen.getByRole('button', {
          name: /focusable child/i,
        });
        child.focus();
        expect(child).toHaveFocus();

        // shakeKey changes → motion.div key changes → subtree remounts.
        // The original `child` reference is detached; focus is lost.
        rerender(<ShellWithFocusable shakeKey={2} />);
        expect(child).not.toHaveFocus();
      } finally {
        useReducedMotionMock.mockReturnValue(false);
      }
    });
  });
});

describe('OperationShell — shared exercise UI normalization', () => {
  it('test_operation_header_given_render_expect_explicit_mb4_boundary_without_stacked_gap', () => {
    render(<Shell />);

    expect(screen.getByTestId('operation-header')).toHaveClass('mb-4');
    expect(screen.getByTestId('operation-body').className).not.toMatch(
      /(?:^|\s)gap-[\d.]+/,
    );
  });

  it('test_work_surface_given_render_expect_retained_p5_sm_p6_vertical_padding', () => {
    render(<Shell />);

    expect(screen.getByTestId('work-surface')).toHaveClass('p-5', 'sm:p-6');
  });

  it('test_work_surface_given_default_expect_centred_content_with_reserved_banner_slot', () => {
    render(<Shell />);

    const surface = screen.getByTestId('work-surface');
    const reservedSlot = within(surface).getByTestId('operation-banner');

    expect(surface).toHaveClass('justify-center');
    expect(reservedSlot).toHaveClass('invisible');
    expect(reservedSlot).toHaveAttribute('aria-hidden', 'true');
  });

  it('test_work_surface_given_fill_work_surface_expect_stretched_content_without_reserved_banner', () => {
    render(<Shell fillWorkSurface />);

    const surface = screen.getByTestId('work-surface');

    expect(surface).not.toHaveClass('justify-center');
    expect(
      within(surface).queryByTestId('operation-banner'),
    ).not.toBeInTheDocument();
  });

  it('test_work_surface_given_fill_work_surface_and_result_expect_banner_still_rendered', () => {
    render(<Shell fillWorkSurface result={{ correct: false }} />);

    const banner = screen.getByText(/not quite/i);

    expect(banner).toHaveAttribute('role', 'status');
    expect(banner).not.toHaveClass('invisible');
  });

  it('test_operation_header_given_prompt_as_instruction_expect_operation_label_over_prompt_paragraph', () => {
    render(<Shell promptAsInstruction />);

    const prompt = screen.getByTestId('exercise-prompt');

    expect(prompt.tagName).toBe('P');
    expect(prompt).toHaveAttribute('id', 'exercise-prompt-ex-1');
    expect(screen.getByText(/^choose$/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: /pick one/i }),
    ).not.toBeInTheDocument();
  });

  it('test_result_feedback_given_retry_owned_verdict_expect_no_shell_banner', () => {
    render(
      <Shell
        ownsResultFeedback
        fillWorkSurface
        retry={{
          phase: 'solved',
          shakeKey: 0,
          canReveal: false,
          onReveal: vi.fn(),
        }}
        result={{ correct: true }}
      />,
    );

    expect(screen.queryByTestId('operation-banner')).not.toBeInTheDocument();
    expect(screen.queryByText('Correct')).not.toBeInTheDocument();
  });

  it('test_pending_check_given_render_expect_disabled_button_and_live_status', () => {
    render(<Shell pending pendingLabel="Checking answer…" />);

    const pendingButton = screen.getByRole('button', {
      name: 'Checking answer…',
    });

    expect(pendingButton).toBeDisabled();
    expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
      'Checking answer…',
    );
    expect(screen.getByTestId('flashcard-action-status')).toHaveAttribute(
      'aria-live',
      'polite',
    );
  });

  it('test_result_feedback_given_operation_owned_verdict_expect_no_shell_banner_or_generic_status', () => {
    render(
      <Shell
        ownsResultFeedback
        fillWorkSurface
        result={{ correct: true }}
        statusHint="Continue when you are ready"
      />,
    );

    expect(screen.queryByTestId('operation-banner')).not.toBeInTheDocument();
    expect(screen.queryByText('Correct')).not.toBeInTheDocument();
    expect(screen.getByTestId('flashcard-action-status')).toHaveTextContent(
      'Continue when you are ready',
    );
  });

  it('test_footer_given_status_first_on_mobile_expect_status_before_actions', () => {
    render(<Shell statusFirstOnMobile statusHint="Write a response" />);

    const footer = screen.getByTestId('flashcard-footer');

    expect(footer).toHaveClass('flex-col');
    expect(footer).not.toHaveClass('flex-col-reverse');
  });

  it('test_instruction_prompt_given_long_task_expect_small_screen_disclosure', async () => {
    const user = userEvent.setup();
    const longPrompt = {
      ...makeExercise(),
      prompt: [
        {
          kind: 'text' as const,
          value:
            'Write two Norwegian ordering sentences. Replace the coffee and cinnamon bun with two different café items taught in this lesson. Use the same two items in both sentences: first use «Jeg vil gjerne ha», then use «Kan jeg få».',
        },
      ],
    };
    render(<Shell promptAsInstruction exercise={longPrompt} />);

    const prompt = screen.getByTestId('exercise-prompt');
    const disclosure = screen.getByRole('button', { name: /show full task/i });

    expect(prompt).toHaveClass('line-clamp-3', 'sm:line-clamp-none');
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    expect(disclosure).toHaveAttribute('aria-controls', prompt.id);

    await user.click(disclosure);

    expect(prompt).not.toHaveClass('line-clamp-3');
    expect(screen.getByRole('button', { name: /show less/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('test_instruction_prompt_given_short_task_expect_no_disclosure', () => {
    render(<Shell promptAsInstruction />);

    expect(screen.getByTestId('exercise-prompt')).not.toHaveClass(
      'line-clamp-3',
    );
    expect(
      screen.queryByRole('button', { name: /show full task/i }),
    ).not.toBeInTheDocument();
  });

  it('test_shared_banner_given_correct_result_expect_subtle_accent_treatment', () => {
    render(<Shell result={{ correct: true }} />);

    const banner = screen.getByText(/^correct$/i);
    expect(banner).toHaveClass(
      'border-accent-20',
      'bg-accent-0',
      'text-accent-90',
    );
    expect(banner).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('flashcard-action-status')).toHaveClass(
      'text-accent-80',
    );
    expect(screen.getByTestId('flashcard-action-status')).not.toHaveAttribute(
      'aria-live',
    );
  });

  it('test_shared_banner_given_incorrect_result_expect_subtle_destructive_treatment', () => {
    render(<Shell result={{ correct: false }} />);

    const banner = screen.getByText(/not quite/i);
    expect(banner).toHaveClass(
      'border-destructive-20',
      'bg-destructive-0',
      'text-destructive-80',
    );
    expect(banner).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('flashcard-action-status')).toHaveClass(
      'text-destructive',
    );
  });

  it('test_retry_wrong_banner_given_wrong_phase_expect_subtle_destructive_treatment', () => {
    render(
      <Shell
        retry={{
          phase: 'wrong',
          shakeKey: 1,
          canReveal: false,
          onReveal: vi.fn(),
        }}
        canCheck={false}
      />,
    );

    const visibleBanner = screen
      .getAllByText(/incorrect — adjust your answer and try again./i)
      .find((el) => !el.classList.contains('sr-only'));
    expect(visibleBanner).toBeDefined();
    expect(visibleBanner).toHaveClass(
      'border-destructive-20',
      'bg-destructive-0',
      'text-destructive-80',
    );
  });
});
