import { FaceLandmarker } from "@mediapipe/tasks-vision";
import { getVisionFileset, createWithGpuFallback } from "./vision-fileset.js";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarker = null;

/**
 * Se crea recién en el paso 4 (sonrisa), después de cerrar el
 * GestureRecognizer, para no tener dos modelos pesados corriendo a la vez.
 */
export async function initFaceLandmarker() {
  if (landmarker) return landmarker;

  const vision = await getVisionFileset();
  landmarker = await createWithGpuFallback(
    (baseOptions) =>
      FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: baseOptions.delegate },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
      }),
    {}
  );

  return landmarker;
}

export function detectFace(videoEl, timestampMs) {
  if (!landmarker) return null;
  return landmarker.detectForVideo(videoEl, timestampMs);
}

export function closeFaceLandmarker() {
  landmarker?.close();
  landmarker = null;
}
