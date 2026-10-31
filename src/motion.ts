// Visitors who ask their device for less motion get the camera set in place
// instead of flown there.
const query = window.matchMedia("(prefers-reduced-motion: reduce)");

export const lessMotion = () => query.matches;
