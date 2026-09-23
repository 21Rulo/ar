/**
 * app.js — Controlador del ciclo de vida del tracking de imágenes (WebAR)
 * ---------------------------------------------------------------------------
 * Stack: MindAR (image-tracking) + A-Frame.
 *
 * Responsabilidades:
 *   1. Cachear las referencias del DOM relevantes.
 *   2. Gestionar los eventos `targetFound` / `targetLost` que dispara
 *      MindAR sobre la entidad objetivo (#portfolio-target).
 *   3. Reproducir / pausar el video sincronizado con la visibilidad del póster,
 *      manejando las restricciones de autoplay de los navegadores móviles.
 *   4. Ajustar dinámicamente la relación de aspecto del plano de video para
 *      que coincida con las dimensiones reales de `video.mp4`.
 *
 * Se ejecuta como módulo ES (<script type="module" src="app.js">), por lo que
 * el `defer` está implícito y `document` ya está disponible al evaluarse.
 * ---------------------------------------------------------------------------
 */

// ---------------------------------------------------------------------------
// Constantes de estado (centralizadas para evitar "strings mágicos" dispersos)
// ---------------------------------------------------------------------------
const STATUS = Object.freeze({
  IDLE: 'Apunta la cámara al póster...',
  DETECTED: '¡Póster detectado! Reproduciendo video... 🎬',
  LOST: 'Póster fuera de cuadro. Busca de nuevo el póster para continuar 🔍',
});

// ---------------------------------------------------------------------------
// Referencias del DOM (Requisito 1)
// ---------------------------------------------------------------------------
const target = document.querySelector('#portfolio-target');
const videoScreen = document.querySelector('#video-screen');
const video = document.querySelector('#ar-video');
const statusText = document.querySelector('#status-text');
const soundButton = document.querySelector('#sound-button');
const scene = document.querySelector('a-scene');

/**
 * Actualiza de forma segura el texto de estado en la interfaz superior.
 * @param {string} message
 */
function setStatus(message) {
  if (statusText) {
    statusText.textContent = message;
  }
}

// ---------------------------------------------------------------------------
// Requisito 2: Manejo del ciclo de vida del tracking
// ---------------------------------------------------------------------------

/**
 * Reproduce el video al detectar el póster.
 *
 * El <video> arranca muteado (atributo `muted` en index.html) porque los
 * navegadores móviles, sobre todo iOS, bloquean el autoplay con sonido. Así la
 * reproducción es inmediata, sin esperar a que el usuario toque la pantalla.
 * Si el usuario ya activó el sonido pero el navegador vuelve a bloquearlo,
 * reintentamos en silencio.
 */
async function playVideo() {
  if (!video) return;

  try {
    await video.play();
  } catch (err) {
    if (video.muted) {
      console.error('[AR] No se pudo reproducir el video:', err);
      setStatus('No se pudo reproducir el video. Revisa los permisos del navegador ⚠️');
      return;
    }
    console.warn('[AR] Audio bloqueado, reproduciendo en silencio:', err);
    video.muted = true;
    try {
      await video.play();
    } catch (fatalErr) {
      console.error('[AR] No se pudo reproducir el video:', fatalErr);
      setStatus('No se pudo reproducir el video. Revisa los permisos del navegador ⚠️');
      return;
    }
  }

  setStatus(STATUS.DETECTED);
  // El botón de audio solo aparece cuando el video ya está flotando sobre el póster.
  soundButton.hidden = !video.muted;
}

/**
 * Activa el audio desde el botón flotante. Al ejecutarse dentro de un gesto
 * del usuario, el navegador permite reproducir con sonido.
 */
async function enableSound() {
  video.muted = false;
  soundButton.hidden = true;
  try {
    if (target?.object3D?.visible) await video.play();
  } catch (err) {
    console.warn('[AR] No se pudo activar el audio:', err);
    video.muted = true;
    soundButton.hidden = false;
  }
}

/**
 * Handler: la cámara reconoce el póster.
 */
function onTargetFound() {
  console.log('[AR] targetFound → póster reconocido');
  playVideo();
}

/**
 * Handler: el póster sale del campo de visión.
 * Pausamos de inmediato para que el audio no continúe en segundo plano.
 */
function onTargetLost() {
  console.log('[AR] targetLost → póster fuera de cuadro');
  if (video) video.pause();
  soundButton.hidden = true;
  setStatus(STATUS.LOST);
}

// ---------------------------------------------------------------------------
// Requisito 3: Ajuste dinámico de la relación de aspecto del plano de video
// ---------------------------------------------------------------------------

/**
 * Ajusta el `width`/`height` del <a-video> para que respete la relación de
 * aspecto real del archivo de video, evitando que la imagen se vea estirada.
 *
 * Fijamos el ANCHO a 1 unidad (coincide con el ancho del target de MindAR, que
 * está normalizado a 1) y calculamos la ALTURA a partir del aspect ratio.
 *
 * Ajuste MANUAL alternativo (si conoces las dimensiones de antemano):
 *   Para un video 1920x1080 (16:9) → height = 1 / (1920/1080) = 0.5625
 *   <a-video id="video-screen" width="1" height="0.5625"> ... </a-video>
 *   Para 4:3 → height = 0.75 (valor por defecto actual en index.html).
 */
function fitVideoAspectRatio() {
  if (!video || !videoScreen) return;

  const apply = () => {
    const { videoWidth, videoHeight } = video;
    if (!videoWidth || !videoHeight) return;

    const planeWidth = 1; // 1 unidad = ancho del marcador normalizado de MindAR.
    const planeHeight = planeWidth * (videoHeight / videoWidth);

    // Actualizamos los atributos del componente A-Frame en caliente.
    videoScreen.setAttribute('width', planeWidth);
    videoScreen.setAttribute('height', planeHeight.toFixed(4));

    console.log(
      `[AR] Video ${videoWidth}x${videoHeight} → plano ${planeWidth} x ${planeHeight.toFixed(4)}`
    );
  };

  // `loadedmetadata` garantiza que videoWidth/videoHeight ya están disponibles.
  if (video.readyState >= 1 /* HAVE_METADATA */) {
    apply();
  } else {
    video.addEventListener('loadedmetadata', apply, { once: true });
  }
}

// Sin pantalla de carga: si MindAR no puede abrir la cámara (p. ej. permiso
// denegado), lo avisamos en el texto de estado para no dejar al usuario a ciegas.
scene?.addEventListener('arError', () => {
  setStatus('No se pudo acceder a la cámara. Permite el acceso y recarga la página 📷');
});

// ---------------------------------------------------------------------------
// Soporte de rotación (vertical ↔ horizontal)
// ---------------------------------------------------------------------------

/**
 * MindAR lee las dimensiones del stream de la cámara UNA sola vez al arrancar
 * y construye el controlador de tracking con ellas. Al girar el celular el
 * stream cambia de, p. ej., 480x640 a 640x480, pero el controlador sigue con
 * las medidas viejas y deja de reconocer el póster. La solución es reiniciar
 * el sistema de MindAR cada vez que cambia la orientación.
 */
function handleOrientationChanges() {
  const arSystem = scene.systems['mindar-image-system'];
  if (!arSystem) return;

  let restartTimer = null;

  const restartAR = () => {
    clearTimeout(restartTimer);
    // Esperamos a que el navegador termine de rotar y reajustar el viewport.
    restartTimer = setTimeout(async () => {
      console.log('[AR] Cambio de orientación → reiniciando MindAR');
      video.pause();
      soundButton.hidden = true;
      setStatus(STATUS.IDLE);
      try {
        arSystem.stop();
        await arSystem.start();
      } catch (err) {
        console.error('[AR] No se pudo reiniciar MindAR tras rotar:', err);
      }
    }, 500);
  };

  if (screen.orientation?.addEventListener) {
    screen.orientation.addEventListener('change', restartAR);
  } else {
    // Fallback para Safari iOS antiguo.
    window.addEventListener('orientationchange', restartAR);
  }
}

// ---------------------------------------------------------------------------
// Requisito 4: Inicialización encapsulada y control de errores
// ---------------------------------------------------------------------------

/**
 * Punto de entrada: enlaza los listeners una vez que la escena de A-Frame
 * ha terminado de cargar sus componentes (incluido el sistema de MindAR).
 */
function init() {
  // Validación defensiva: si falta algún nodo crítico, abortamos con contexto.
  if (!target || !video || !videoScreen || !statusText || !soundButton) {
    console.error('[AR] Faltan elementos del DOM requeridos. Revisa index.html.', {
      target,
      video,
      videoScreen,
      statusText,
      soundButton,
    });
    return;
  }

  // Requisito 2 — listeners del ciclo de vida del tracking.
  target.addEventListener('targetFound', onTargetFound);
  target.addEventListener('targetLost', onTargetLost);

  // Requisito 3 — proporciones del plano.
  fitVideoAspectRatio();

  soundButton.addEventListener('click', enableSound);

  handleOrientationChanges();

  setStatus(STATUS.IDLE);
  console.log('[AR] Controlador inicializado y a la espera de targets.');
}

// A-Frame monta la escena de forma asíncrona. Esperamos al evento `loaded`
// de <a-scene> para asegurar que la entidad objetivo ya tiene su componente
// `mindar-image-target` listo para emitir eventos.
if (scene?.hasLoaded) {
  init();
} else {
  scene?.addEventListener('loaded', init, { once: true });
}
