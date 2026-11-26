import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dark, light } from '../src/design/tokens/palette.ts';

function luminance(hex: string) {
  const rgb = hex.slice(1).match(/../g)!.map(channel => Number.parseInt(channel, 16) / 255);
  const linear = rgb.map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(foreground: string, background: string) {
  const colors = [luminance(foreground), luminance(background)];
  return (Math.max(...colors) + 0.05) / (Math.min(...colors) + 0.05);
}

test('both themes provide WCAG AA for body text and action labels', () => {
  for (const palette of [dark, light]) {
    for (const text of [palette.textPrimary, palette.textSecondary, palette.textTertiary, palette.accent, palette.danger]) {
      for (const background of [palette.canvas, palette.surface, palette.surfaceElevated, palette.surfaceRecessed]) {
        assert.ok(contrast(text, background) >= 4.5, `${text} on ${background}`);
      }
    }
    assert.ok(contrast(palette.onAccent, palette.accent) >= 4.5);
  }
});
