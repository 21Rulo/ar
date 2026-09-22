import { IMAGES } from "./assets.js";

// Cuántos frames seguidos tiene que sostenerse un gesto para darlo por
// válido. Evita falsos positivos por un único frame ruidoso (~0.4s a 30fps).
const HOLD_FRAMES = 12;

export const MISSIONS = [
  {
    id: "heart-on-head",
    title: "Corazón en la cabeza",
    desc: "Levanta las dos manos y forma un corazón sobre tu cabeza",
    icon: "🙌",
    badgeImg: IMAGES.heartOnHead,
    tracker: "hands",
    detect: detectHeartOnHead,
  },
  {
    id: "peace-sign",
    title: "Señal de la paz",
    desc: "Haz la señal de la paz ✌️ con una mano",
    icon: "✌️",
    badgeImg: IMAGES.peace,
    tracker: "hands",
    detect: detectPeaceSign,
  },
  {
    id: "finger-heart",
    title: "Finger heart",
    desc: "Junta la punta del pulgar y el índice como un 🫰",
    icon: "🫰",
    badgeImg: IMAGES.fingerHeart,
    tracker: "hands",
    detect: detectFingerHeart,
  },
  {
    id: "smile",
    title: "Sonríe",
    desc: "Regálanos tu mejor sonrisa 😁",
    icon: "😁",
    badgeImg: IMAGES.smile,
    tracker: "face",
    detect: detectSmile,
  },
];

/** Paso 1: dos muñecas (landmark 0) dentro del tercio superior de la imagen. */
function detectHeartOnHead(gestureResult) {
  const hands = gestureResult?.landmarks ?? [];
  if (hands.length < 2) return false;

  return hands.every((hand) => hand[0]?.y < 0.33);
}

/** Paso 2: gesto "Victory" (peace sign) reconocido por MediaPipe con confianza > 0.5. */
function detectPeaceSign(gestureResult) {
  const gestures = gestureResult?.gestures ?? [];
  return gestures.some((handGestures) =>
    handGestures.some((g) => g.categoryName === "Victory" && g.score > 0.5)
  );
}

/**
 * Paso 3: distancia pulgar(4)-índice(8) mínima, normalizada por el tamaño
 * de la mano (muñeca-nudillo medio) para que funcione sin importar qué tan
 * cerca esté la mano de la cámara.
 */
function detectFingerHeart(gestureResult) {
  const hands = gestureResult?.landmarks ?? [];

  return hands.some((hand) => {
    const thumbTip = hand[4];
    const indexTip = hand[8];
    const wrist = hand[0];
    const middleMcp = hand[9];
    if (!thumbTip || !indexTip || !wrist || !middleMcp) return false;

    const handSize = distance2D(wrist, middleMcp) || 1;
    const fingerGap = distance2D(thumbTip, indexTip);

    return fingerGap / handSize < 0.35;
  });
}

/** Paso 4: blendshapes mouthSmileLeft y mouthSmileRight > 0.5. */
function detectSmile(faceResult) {
  const categories = faceResult?.faceBlendshapes?.[0]?.categories ?? [];
  if (!categories.length) return false;

  const left = categories.find((c) => c.categoryName === "mouthSmileLeft");
  const right = categories.find((c) => c.categoryName === "mouthSmileRight");

  return (left?.score ?? 0) > 0.5 && (right?.score ?? 0) > 0.5;
}

function distance2D(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Pequeña máquina de "sostener el gesto N frames" para no disparar el
 * éxito con un único frame afortunado.
 */
export function createHoldTracker(onConfirmed) {
  let streak = 0;
  let confirmed = false;

  return {
    reset() {
      streak = 0;
      confirmed = false;
    },
    feed(isDetected) {
      if (confirmed) return;

      streak = isDetected ? streak + 1 : 0;
      if (streak >= HOLD_FRAMES) {
        confirmed = true;
        onConfirmed();
      }
    },
    get progress() {
      return Math.min(streak / HOLD_FRAMES, 1);
    },
  };
}
