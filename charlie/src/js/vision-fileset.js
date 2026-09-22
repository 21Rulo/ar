import { FilesetResolver } from "@mediapipe/tasks-vision";

// Pineado a la misma versión del paquete npm instalado para evitar
// desincronización entre el WASM (CDN) y el JS glue (bundle de Vite).
const WASM_BASE =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";

let filesetPromise = null;

/** El FilesetResolver es pesado de crear: se comparte entre recognizer y landmarker. */
export function getVisionFileset() {
  if (!filesetPromise) {
    filesetPromise = FilesetResolver.forVisionTasks(WASM_BASE);
  }
  return filesetPromise;
}

/**
 * Intenta crear la tarea con delegate "GPU" (más rápido) y si el dispositivo
 * no lo soporta, reintenta en "CPU" para que la demo nunca se rompa.
 */
export async function createWithGpuFallback(createFn, baseOptions) {
  try {
    return await createFn({ ...baseOptions, delegate: "GPU" });
  } catch (err) {
    console.warn("Delegate GPU no disponible, usando CPU:", err);
    return createFn({ ...baseOptions, delegate: "CPU" });
  }
}
