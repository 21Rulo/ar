import confetti from "canvas-confetti";

const SAGE_PALETTE = ["#3A5A40", "#588157", "#A3B18A", "#D8C07A", "#FBFAF5"];

/** Ráfaga corta para completar una misión. */
export function burst() {
  confetti({
    particleCount: 90,
    spread: 70,
    startVelocity: 45,
    origin: { y: 0.6 },
    colors: SAGE_PALETTE,
  });
}

/** Lluvia sostenida de confeti verde, usada en el paso 2 (peace sign). */
export function greenRain(durationMs = 2000) {
  const end = Date.now() + durationMs;

  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: SAGE_PALETTE,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: SAGE_PALETTE,
    });

    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Gran celebración final, para cuando aparece la photocard. */
export function grandFinale() {
  const duration = 2500;
  const end = Date.now() + duration;

  (function frame() {
    confetti({
      particleCount: 6,
      startVelocity: 55,
      spread: 100,
      origin: { x: Math.random(), y: Math.random() * 0.3 },
      colors: SAGE_PALETTE,
    });

    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
