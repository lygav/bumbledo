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
      /\.control-button\s*\{[\s\S]*border-radius:\s*var\(--control-radius\);[\s\S]*cursor:\s*pointer;/,
    );
    expect(stylesheet).toMatch(
      /\.control-button:hover:not\(:disabled\)\s*\{[\s\S]*box-shadow:\s*var\(--control-shadow-hover\);/,
    );
    expect(stylesheet).toMatch(
      /\.control-button-toggle\.is-active,\s*[\s\S]*\.control-button-toggle\[aria-pressed='true'\],\s*[\s\S]*\.control-button-toggle\[aria-expanded='true'\]\s*\{[\s\S]*background:\s*var\(--accent-bg\);/,
    );
  });
});
