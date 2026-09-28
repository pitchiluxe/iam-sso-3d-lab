/**
 * ui/directory/adIcons.ts — the snap-in's small icons, drawn rather than emoji.
 *
 * Emoji render differently on every machine and look nothing like the MMC
 * console. These are 16×16 SVGs in the shapes Windows uses: a yellow folder for
 * a container, a folder with an org-chart badge for an OU, the domain's three
 * linked nodes, and the user, group and computer glyphs. Static markup, never
 * built from data.
 */
const svg = (body: string): string =>
  `<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" style="display:block">${body}</svg>`;

const FOLDER =
  '<path d="M1 3.5h5l1.2 1.4H15v8.6H1z" fill="#e8b84a" stroke="#b8862a" stroke-width=".8"/>' +
  '<path d="M1 6h14v7.5H1z" fill="#f5cf6a" stroke="#b8862a" stroke-width=".8"/>';

export const AD_ICONS = {
  console: svg(
    '<rect x="1" y="2" width="14" height="11" rx="1" fill="#3a78c2" stroke="#1f4f8a" stroke-width=".8"/>' +
      '<rect x="2.5" y="4" width="11" height="7.5" fill="#eaf3ff"/>' +
      '<circle cx="6" cy="7.5" r="1.4" fill="#3a78c2"/><path d="M8.5 6.5h4M8.5 8.5h3" stroke="#3a78c2" stroke-width="1"/>',
  ),
  queries: svg(
    FOLDER +
      '<circle cx="10" cy="9.5" r="2" fill="none" stroke="#6b5317" stroke-width="1"/><path d="M11.4 11l2 2" stroke="#6b5317" stroke-width="1.2"/>',
  ),
  domain: svg(
    '<path d="M8 4v4M8 8L4 11.5M8 8l4 3.5" stroke="#5a6b7c" stroke-width="1"/>' +
      '<rect x="5.5" y="1" width="5" height="3.6" rx=".6" fill="#4b8bd6" stroke="#2a5d9a" stroke-width=".7"/>' +
      '<rect x="1.3" y="10.4" width="5" height="3.6" rx=".6" fill="#4b8bd6" stroke="#2a5d9a" stroke-width=".7"/>' +
      '<rect x="9.7" y="10.4" width="5" height="3.6" rx=".6" fill="#4b8bd6" stroke="#2a5d9a" stroke-width=".7"/>',
  ),
  container: svg(FOLDER),
  ou: svg(
    FOLDER +
      '<rect x="8.3" y="7.4" width="2.4" height="1.9" fill="#fff" stroke="#6b5317" stroke-width=".6"/>' +
      '<rect x="6.2" y="10.8" width="2.4" height="1.9" fill="#fff" stroke="#6b5317" stroke-width=".6"/>' +
      '<rect x="10.4" y="10.8" width="2.4" height="1.9" fill="#fff" stroke="#6b5317" stroke-width=".6"/>' +
      '<path d="M9.5 9.3v.8M7.4 10.1h4.2v.7M7.4 10.1v.7" stroke="#6b5317" stroke-width=".6" fill="none"/>',
  ),
  snapins: svg(
    FOLDER +
      '<path d="M9.6 7.6l1 2.1 2.3.3-1.7 1.6.4 2.3-2-1.1-2 1.1.4-2.3-1.7-1.6 2.3-.3z" fill="#2f7d4f"/>',
  ),
  tool: svg(
    '<rect x="2" y="2" width="12" height="12" rx="2" fill="#2f7d4f" stroke="#1d5534" stroke-width=".8"/>' +
      '<path d="M5 8.3l2 2 4-4.3" stroke="#fff" stroke-width="1.6" fill="none"/>',
  ),
  user: svg(
    '<circle cx="8" cy="5" r="3" fill="#6fa3dc" stroke="#2f5f96" stroke-width=".8"/>' +
      '<path d="M2.2 15c.4-3.4 2.8-5.3 5.8-5.3s5.4 1.9 5.8 5.3z" fill="#3a78c2" stroke="#1f4f8a" stroke-width=".8"/>',
  ),
  userDisabled: svg(
    '<circle cx="8" cy="5" r="3" fill="#b7c3cf" stroke="#6b7a89" stroke-width=".8"/>' +
      '<path d="M2.2 15c.4-3.4 2.8-5.3 5.8-5.3s5.4 1.9 5.8 5.3z" fill="#9aa7b4" stroke="#6b7a89" stroke-width=".8"/>' +
      '<circle cx="12" cy="11.5" r="3.2" fill="#fff" stroke="#c0392b" stroke-width="1.2"/><path d="M10 13.5l4-4" stroke="#c0392b" stroke-width="1.3"/>',
  ),
  group: svg(
    '<circle cx="5.2" cy="5.2" r="2.4" fill="#8bb6e6" stroke="#2f5f96" stroke-width=".7"/>' +
      '<circle cx="10.8" cy="5.2" r="2.4" fill="#6fa3dc" stroke="#2f5f96" stroke-width=".7"/>' +
      '<path d="M.8 14c.3-2.8 2.2-4.4 4.4-4.4s4.1 1.6 4.4 4.4z" fill="#5c93d1" stroke="#1f4f8a" stroke-width=".7"/>' +
      '<path d="M6.4 14c.3-2.8 2.2-4.4 4.4-4.4s4.1 1.6 4.4 4.4z" fill="#3a78c2" stroke="#1f4f8a" stroke-width=".7"/>',
  ),
  computer: svg(
    '<rect x="1.5" y="2" width="13" height="9" rx="1" fill="#e9eef3" stroke="#56626e" stroke-width=".9"/>' +
      '<rect x="3" y="3.5" width="10" height="6" fill="#4b8bd6"/><path d="M6 13.5h4M8 11v2.5" stroke="#56626e" stroke-width="1.2"/>',
  ),
  builtinGroup: svg(
    '<circle cx="5.2" cy="5.2" r="2.4" fill="#c9d3dd" stroke="#6b7a89" stroke-width=".7"/>' +
      '<circle cx="10.8" cy="5.2" r="2.4" fill="#b7c3cf" stroke="#6b7a89" stroke-width=".7"/>' +
      '<path d="M.8 14c.3-2.8 2.2-4.4 4.4-4.4s4.1 1.6 4.4 4.4z" fill="#a4b1be" stroke="#56626e" stroke-width=".7"/>' +
      '<path d="M6.4 14c.3-2.8 2.2-4.4 4.4-4.4s4.1 1.6 4.4 4.4z" fill="#8c9aa8" stroke="#56626e" stroke-width=".7"/>',
  ),
} as const;

export type AdIcon = keyof typeof AD_ICONS;

/** A 16×16 icon element. */
export function adIcon(name: AdIcon): HTMLElement {
  const span = document.createElement('span');
  span.style.cssText = 'display:inline-flex;width:16px;height:16px;flex-shrink:0;';
  // Static, trusted markup from this module (never user data).
  span.innerHTML = AD_ICONS[name];
  return span;
}
