import { describe, expect, it } from 'vitest';

import { K_OPERATION_COMPONENT_MAP } from './componentMap';
import { FlashCardSpeak } from './FlashCardSpeak/FlashCardSpeak';
import { FlashCardWrite } from './FlashCardWrite/FlashCardWrite';

describe('operation component map', () => {
  it('test_operation_component_map_given_speak_and_write_operations_expect_renderers_registered', () => {
    expect(K_OPERATION_COMPONENT_MAP.speak).toBe(FlashCardSpeak);
    expect(K_OPERATION_COMPONENT_MAP.write).toBe(FlashCardWrite);
  });
});
