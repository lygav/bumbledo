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

  it('keeps metric pills visually quieter than interactive toolbar buttons', () => {
    const stylesheet = readFileSync(
      new URL('./styles.css', import.meta.url),
      'utf8',
    );

    expect(stylesheet).toMatch(
      /\.status-pill\s*\{[\s\S]*border-radius:\s*999px;[\s\S]*cursor:\s*default;/,
    );
    expect(stylesheet).toMatch(
      /\.toolbar-button\s*\{[\s\S]*border-radius:\s*10px;[\s\S]*cursor:\s*pointer;/,
    );
    expect(stylesheet).toMatch(
      /\.toolbar-button:hover\s*\{[\s\S]*box-shadow:\s*0 6px 14px rgba\(15, 23, 42, 0\.08\);/,
    );
  });
});
