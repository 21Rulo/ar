/**
 * Pide permiso de cámara y deja el stream listo para reproducir en el <video>.
 * Se resuelve cuando el primer frame ya está disponible (loadeddata),
 * que es el momento correcto para empezar a alimentar a MediaPipe.
 */
export async function startWebcam(videoEl) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: 640, height: 480 },
    audio: false,
  });

  videoEl.srcObject = stream;

  // El atributo autoplay no siempre alcanza (p.ej. si el <video> acaba de
  // pasar de display:none a visible): se fuerza el play() explícitamente.
  try {
    await videoEl.play();
  } catch (err) {
    console.warn("videoEl.play() explícito falló, se sigue confiando en autoplay:", err);
  }

  await new Promise((resolve) => {
    if (videoEl.readyState >= 2) {
      resolve();
    } else {
      videoEl.onloadeddata = () => resolve();
    }
  });

  return stream;
}

export function stopWebcam(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}
