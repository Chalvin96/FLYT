import { describe, expect, it } from 'vitest';

import { calculateNextModelIndex } from './calculateNextModelIndex';
import type { FlytChatbotModel } from './types';

const models: readonly FlytChatbotModel[] = [
  'flyt',
  'chatgpt',
  'deepseek',
  'glm',
];

const usableExcept =
  (disabled: readonly FlytChatbotModel[]) => (model: FlytChatbotModel) =>
    !disabled.includes(model);

describe('calculateNextModelIndex', () => {
  it('test_calculate_next_model_index_given_arrow_down_on_last_model_expect_wraps_to_first', () => {
    expect(
      calculateNextModelIndex('ArrowDown', 3, models, usableExcept([])),
    ).toBe(0);
  });

  it('test_calculate_next_model_index_given_arrow_up_on_first_model_expect_wraps_to_last', () => {
    expect(
      calculateNextModelIndex('ArrowUp', 0, models, usableExcept([])),
    ).toBe(3);
  });

  it('test_calculate_next_model_index_given_arrow_down_next_disabled_expect_skips_to_next_usable', () => {
    expect(
      calculateNextModelIndex(
        'ArrowDown',
        0,
        models,
        usableExcept(['chatgpt']),
      ),
    ).toBe(2);
  });

  it('test_calculate_next_model_index_given_arrow_up_previous_disabled_expect_skips_to_previous_usable', () => {
    expect(
      calculateNextModelIndex('ArrowUp', 3, models, usableExcept(['deepseek'])),
    ).toBe(1);
  });

  it('test_calculate_next_model_index_given_home_key_expect_first_usable_model', () => {
    expect(
      calculateNextModelIndex('Home', 2, models, usableExcept(['flyt'])),
    ).toBe(1);
  });

  it('test_calculate_next_model_index_given_end_key_expect_last_usable_model', () => {
    expect(
      calculateNextModelIndex('End', 1, models, usableExcept(['glm'])),
    ).toBe(2);
  });

  it('test_calculate_next_model_index_given_all_models_disabled_expect_null', () => {
    expect(
      calculateNextModelIndex('ArrowDown', 0, models, usableExcept(models)),
    ).toBeNull();
  });

  it('test_calculate_next_model_index_given_unhandled_key_expect_null', () => {
    expect(
      calculateNextModelIndex('a', 1, models, usableExcept([])),
    ).toBeNull();
  });
});
