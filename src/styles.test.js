import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('styles', () => {
  it('defines shared design tokens at :root', () => {
    const stylesheet = readFileSync(
      new URL('./styles.css', import.meta.url),
      'utf8',
    );

    expect(stylesheet).toMatch(/:root\s*\{[\s\S]*--radius-control:\s*6px;/);
    expect(stylesheet).toMatch(/:root\s*\{[\s\S]*--radius-surface:\s*8px;/);
    expect(stylesheet).toMatch(/:root\s*\{[\s\S]*--radius-pill:\s*999px;/);
    expect(stylesheet).toMatch(
      /:root\s*\{[\s\S]*--focus-ring:\s*0 0 0 3px rgba\(74, 144, 217, 0\.25\);/,
    );
  });

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
      /\.status-pill\s*\{[\s\S]*border-radius:\s*var\(--radius-pill\);[\s\S]*cursor:\s*default;/,
    );
    expect(stylesheet).toMatch(
      /\.control-button\s*\{[\s\S]*border-radius:\s*var\(--radius-control\);[\s\S]*cursor:\s*pointer;/,
    );
    expect(stylesheet).toMatch(
      /\.control-button:hover:not\(:disabled\)\s*\{[\s\S]*background:\s*var\(--color-surface-hover\);[\s\S]*box-shadow:\s*var\(--shadow-md\);/,
    );
    expect(stylesheet).toMatch(
      /\.control-button-toggle\.is-active,\s*[\s\S]*\.control-button-toggle\[aria-pressed='true'\],\s*[\s\S]*\.control-button-toggle\[aria-checked='true'\],\s*[\s\S]*\.control-button-toggle\[aria-expanded='true'\]\s*\{[\s\S]*background:\s*var\(--color-accent-surface\);/,
    );
  });
});
