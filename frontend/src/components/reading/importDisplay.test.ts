import { describe, expect, it } from 'vitest';

import { IMPORT_TEXT_MAX_BYTES } from '@/types/api';

import {
  formatKilobytes,
  getImportTextByteCount,
  normalizeImportText,
} from './importDisplay';

describe('importDisplay normalization', () => {
  it('test_normalize_import_text_given_trailing_whitespace_per_line_expect_per_line_rstrip', () => {
    // The server does NOT collapse interior whitespace; it rstrips each line.
    // The old client normalization (`\s+` → ' ') collapsed interior whitespace
    // and so disagreed with the server's byte count.
    const input = 'linje en   \nlinje to\t\n\n\nlinje tre';
    const normalized = normalizeImportText(input);
    expect(normalized).toBe('linje en\nlinje to\n\nlinje tre');
  });

  it('test_normalize_import_text_given_crlf_and_cr_expect_lf_only', () => {
    expect(normalizeImportText('a\r\nb\rc')).toBe('a\nb\nc');
  });

  it('test_normalize_import_text_given_three_plus_newlines_expect_collapsed_to_two', () => {
    expect(normalizeImportText('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('test_normalize_import_text_given_leading_and_trailing_whitespace_expect_trimmed', () => {
    expect(normalizeImportText('   hello\nworld   ')).toBe('hello\nworld');
  });

  it('test_normalize_import_text_given_distinct_canonical_forms_expect_nfc_normalized', () => {
    // `é` precomposed (U+00E9, 2 UTF-8 bytes) vs decomposed (e + U+0301,
    // 3 UTF-8 bytes) — NFC must yield the precomposed form so the byte count
    // matches the server.
    const decomposed = 'e\u0301';
    const precomposed = 'é';
    expect(normalizeImportText(decomposed)).toBe(precomposed);
  });

  it('test_get_normalized_import_text_byte_count_given_100_000_ascii_chars_expect_100_000_bytes', () => {
    // Boundary: the server caps the NORMALIZED text at 100_000 bytes.
    expect(
      getImportTextByteCount(normalizeImportText('a'.repeat(100_000))),
    ).toBe(100_000);
  });

  it('test_get_normalized_import_text_byte_count_given_100_001_ascii_chars_expect_100_001_bytes', () => {
    // Boundary: one byte over the cap.
    expect(
      getImportTextByteCount(normalizeImportText('a'.repeat(100_001))),
    ).toBe(100_001);
  });

  it('test_get_normalized_import_text_byte_count_given_norwegian_oe_expect_multibyte_counted', () => {
    // `ø` is U+00F8 — 2 UTF-8 bytes. The client must count BYTES, not chars,
    // or it would underestimate and let oversized text through to a 413.
    expect(getImportTextByteCount('ø')).toBe(2);
    expect(
      getImportTextByteCount(normalizeImportText('ø'.repeat(50_000))),
    ).toBe(100_000);
  });

  it('test_import_text_max_bytes_given_client_constant_expect_equals_server_cap', () => {
    // Regression guard: the client constant must equal the server's 100_000
    // cap exactly (NOT 1024*100 = 102_400, which the old constant used).
    expect(IMPORT_TEXT_MAX_BYTES).toBe(100_000);
  });

  it('test_format_kilobytes_given_100_000_bytes_expect_97_7_kb', () => {
    // 100_000 / 1024 ≈ 97.6562, rounded to 1 fractional digit = 97.7 KB.
    // (The old test asserted "100 KB", which only matched the old 102_400
    // constant exactly.)
    expect(formatKilobytes(100_000)).toBe('97.7 KB');
  });
});
