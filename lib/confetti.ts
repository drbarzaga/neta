import confetti from 'canvas-confetti';

/** Lanza un confetti festivo desde el centro-abajo de la pantalla. */
export function fireConfetti() {
  const defaults = { origin: { y: 0.7 }, zIndex: 9999 };
  confetti({
    ...defaults,
    particleCount: 90,
    spread: 70,
    startVelocity: 45,
  });
  confetti({
    ...defaults,
    particleCount: 60,
    spread: 100,
    scalar: 0.8,
    startVelocity: 35,
    decay: 0.9,
  });
}
