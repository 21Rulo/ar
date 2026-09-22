import { GestureRecognizer } from "@mediapipe/tasks-vision";
import { getVisionFileset, createWithGpuFallback } from "./vision-fileset.js";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task";

let recognizer = null;

/**
 * Crea (o reutiliza) el GestureRecognizer en modo VIDEO.
 * Se usa para las misiones 1, 2 y 3 (manos), ya que además de landmarks
 * trae gestos precomputados (Victory, etc.) sin costo extra.
 */
export async function initGestureRecognizer() {
  if (recognizer) return recognizer;

  const vision = await getVisionFileset();
  recognizer = await createWithGpuFallback(
    (baseOptions) =>
      GestureRecognizer.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: baseOptions.delegate },
        runningMode: "VIDEO",
        numHands: 2,
      }),
    {}
  );

  return recognizer;
}

export function detectGestures(videoEl, timestampMs) {
  if (!recognizer) return null;
  return recognizer.recognizeForVideo(videoEl, timestampMs);
}

/** Libera el modelo de manos para ahorrar recursos (paso 4 usa la cara). */
export function closeGestureRecognizer() {
  recognizer?.close();
  recognizer = null;
}
