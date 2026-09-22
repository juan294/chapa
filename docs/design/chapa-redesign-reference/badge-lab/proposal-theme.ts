import { badgeTheme, type BadgeTheme } from '/Users/juan/code/chapa/apps/web/lib/render/theme';
import type { BadgePalette } from '@chapa/shared';
// Prototype-only mapping. No production palette enum or default is changed.
// Existing alternate palettes remain available; "jade" selects candidate Ice here.
const tint = (alpha: number) => `rgba(186, 217, 232, ${alpha})`;
const ice: BadgeTheme = {
  palette:'jade', bg:'#0C141B', card:'#14222D',
  textPrimary:'#F1EEE7', textSecondary:'#ABBAC3',
  accent:'#BAD9E8', accentLight:'#DFEDF4', accentRgb:'186, 217, 232',
  stroke:tint(0.22), heatmap:[tint(.12),tint(.30),tint(.48),tint(.68),tint(.92)], tint,
};
export function proposalTheme(palette: BadgePalette = 'jade'): BadgeTheme {
  return palette === 'jade' ? ice : badgeTheme(palette);
}
