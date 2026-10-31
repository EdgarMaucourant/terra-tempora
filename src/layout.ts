/**
 * The compact layout: phones in either orientation and tablets. It matches a
 * narrow window, or a touch screen with no mouse (pointer: coarse and no hover),
 * so a phone held sideways or an iPad gets the slim timeline, the side tabs and
 * the burger menu. Desktops and laptops with a mouse keep the full layout.
 *
 * Keep it in step with the `@media` rules in style.css that use the same query.
 */
export const COMPACT_QUERY = "(max-width: 640px), (hover: none) and (pointer: coarse)";

export const compactQuery = window.matchMedia(COMPACT_QUERY);
