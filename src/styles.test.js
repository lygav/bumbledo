import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('styles', () => {
  it('hides status metric lines when hidden is set', () => {
    const stylesheet = readFileSync(
      new URL('./styles.css', import.meta.url),
      'utf8',
    );

    expect(stylesheet).toMatch(
      /\.status-metric-line\[hidden\]\s*\{\s*display:\s*none;\s*\}/,
    );
  });
});
