/**
 * The previous and next year buttons beside the year. A tap or a click goes
 * one year; holding the button down keeps going, faster after a moment.
 * Enter and Space go one year, like a click.
 */
export function attachYearStep(button: HTMLButtonElement, delta: number, step: (delta: number) => void) {
  let timer = 0;
  let count = 0;
  const stop = () => {
    window.clearTimeout(timer);
    timer = 0;
  };
  const repeat = () => {
    if (button.disabled) return stop();
    step(delta);
    count++;
    timer = window.setTimeout(repeat, count < 10 ? 120 : 50);
  };
  button.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    stop();
    count = 0;
    step(delta);
    timer = window.setTimeout(repeat, 450);
  });
  // Lifted anywhere, or taken by the browser for a scroll: the steps stop.
  window.addEventListener("pointerup", stop);
  window.addEventListener("pointercancel", stop);
  button.addEventListener("pointerleave", stop);
  button.addEventListener("blur", stop);
  // A long press on a phone would open the menu for the button.
  button.addEventListener("contextmenu", (e) => e.preventDefault());
  // Pointer presses are handled above; a click with no pointer is a key.
  button.addEventListener("click", (e) => {
    if (e.detail === 0) step(delta);
  });
}
