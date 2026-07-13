/**
 * app.js
 * ---------------------------------------------------------------------------
 * Manipulación de bloques físicos virtuales con las manos.
 *
 * Stack:
 *   - MediaPipe Tasks-Vision (HandLandmarker) -> detección de la mano por webcam.
 *   - Matter.js -> motor de física 2D que simula los bloques rígidos.
 *
 * Idea general del ciclo:
 *   1. La webcam alimenta al HandLandmarker en modo VIDEO.
 *   2. En cada frame extraemos la punta del índice (landmark 8) y del pulgar (4).
 *   3. Convertimos esas coordenadas normalizadas al espacio del canvas (640x480),
 *      reflejando la X porque la cámara se muestra en modo espejo.
 *   4. Si índice y pulgar se juntan (pinch), agarramos el bloque bajo el dedo
 *      mediante una Constraint de Matter.js; al soltar, el bloque cae libre.
 * ---------------------------------------------------------------------------
 */

import {
  HandLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8";

// ===========================================================================
//  CONSTANTES DE CONFIGURACIÓN
// ===========================================================================

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// Umbral (en coordenadas normalizadas 0..1) para considerar que el gesto es un
// "pinch". Cuanto más pequeño, más juntos deben estar los dedos.
const PINCH_THRESHOLD = 0.04;

// Rigidez de la restricción con la que arrastramos el bloque. Un valor bajo
// (0.05 - 0.2) produce un arrastre elástico y estable; 1 sería totalmente
// rígido y tiende a "explotar" con movimientos bruscos.
const DRAG_STIFFNESS = 0.12;

// Paleta plana y llamativa (estilo Catppuccin) para los bloques.
const BLOCK_COLORS = ["#f38ba8", "#a6e3a1", "#89b4fa"];
const BLOCK_SIZE = 60;

// ===========================================================================
//  CARGA DE MATTER.JS (script global vía CDN)
// ===========================================================================

/**
 * Matter.js no se distribuye como módulo ESM en el CDN indicado, así que lo
 * inyectamos como <script> clásico y esperamos a que exponga el global `Matter`.
 */
function loadMatterJs() {
  return new Promise((resolve, reject) => {
    if (window.Matter) return resolve(window.Matter);

    const script = document.createElement("script");
    script.src =
      "https://cdnjs.cloudflare.com/ajax/libs/matter-js/0.19.0/matter.min.js";
    script.onload = () => resolve(window.Matter);
    script.onerror = () =>
      reject(new Error("No se pudo cargar Matter.js desde el CDN."));
    document.head.appendChild(script);
  });
}

// ===========================================================================
//  ESTADO GLOBAL DE LA APLICACIÓN
// ===========================================================================

const statusText = document.getElementById("status-text");
const video = document.getElementById("webcam");

// Referencias del motor físico (se rellenan en setupPhysics()).
let Matter;
let engine, world, render, runner;
let blocks = []; // Los 3 cuadrados dinámicos.

// Estado del "arrastre" con la mano.
let dragConstraint = null; // Constraint activa mientras sostenemos un bloque.
let draggedBlock = null; // Bloque actualmente agarrado.
let isPinching = false; // ¿El gesto pinch está activo ahora mismo?

// El HandLandmarker y control del bucle de detección.
let handLandmarker;
let lastVideoTime = -1;

// ===========================================================================
//  1. CONFIGURACIÓN DEL MUNDO FÍSICO (Matter.js)
// ===========================================================================

function setupPhysics() {
  const { Engine, Render, Runner, Bodies, Composite } = Matter;

  const container = document.getElementById("matter-container");

  // Motor y mundo con gravedad hacia abajo (valor por defecto, ~1g).
  engine = Engine.create();
  world = engine.world;

  // Renderizador que dibuja dentro de #matter-container con fondo transparente
  // para que se vea la webcam por detrás.
  render = Render.create({
    element: container,
    engine: engine,
    options: {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
      wireframes: false, // Colores sólidos, no wireframe.
      background: "transparent",
    },
  });

  // --- Límites estáticos: suelo + paredes laterales ---
  // Son `isStatic: true` para que no caigan y contengan a los bloques.
  const wallOptions = {
    isStatic: true,
    render: { fillStyle: "#313244" }, // Gris plano sutil.
  };

  const ground = Bodies.rectangle(
    CANVAS_WIDTH / 2,
    CANVAS_HEIGHT - 10,
    CANVAS_WIDTH,
    20,
    wallOptions
  );
  const leftWall = Bodies.rectangle(
    -10,
    CANVAS_HEIGHT / 2,
    20,
    CANVAS_HEIGHT,
    wallOptions
  );
  const rightWall = Bodies.rectangle(
    CANVAS_WIDTH + 10,
    CANVAS_HEIGHT / 2,
    20,
    CANVAS_HEIGHT,
    wallOptions
  );

  Composite.add(world, [ground, leftWall, rightWall]);

  // --- Los 3 bloques cuadrados dinámicos ---
  // Se colocan dispersos y algo elevados para que caigan y se asienten.
  blocks = BLOCK_COLORS.map((color, i) => {
    const x = 160 + i * 160; // 160, 320, 480 -> repartidos en horizontal.
    const y = 80; // Arriba, para que caigan al iniciar.
    return Bodies.rectangle(x, y, BLOCK_SIZE, BLOCK_SIZE, {
      restitution: 0.2, // Un poco de rebote.
      friction: 0.4,
      render: {
        fillStyle: color,
        strokeStyle: "#ffffff",
        lineWidth: 2,
      },
    });
  });

  Composite.add(world, blocks);

  // Arrancamos el render y el runner (bucle de simulación física).
  Render.run(render);
  runner = Runner.create();
  Runner.run(runner, engine);
}

// ===========================================================================
//  2. INICIALIZACIÓN DE MEDIAPIPE + WEBCAM
// ===========================================================================

async function setupHandLandmarker() {
  // Cargamos el conjunto de binarios WASM oficiales de tasks-vision.
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath:
        "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1, // Con una mano basta para arrastrar bloques.
  });
}

async function enableWebcam() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT },
  });
  video.srcObject = stream;

  // Esperamos a que el video tenga dimensiones válidas antes de procesar frames.
  return new Promise((resolve) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
  });
}

// ===========================================================================
//  3. UTILIDADES DE MAPEADO Y GESTOS
// ===========================================================================

/**
 * Convierte una coordenada normalizada de MediaPipe (0..1) al espacio del canvas.
 * La X se refleja (1 - x) porque la webcam se muestra en modo espejo (rotateY),
 * de modo que mover la mano a tu derecha mueve el cursor a la derecha en pantalla.
 */
function landmarkToCanvas(landmark) {
  return {
    x: (1 - landmark.x) * CANVAS_WIDTH,
    y: landmark.y * CANVAS_HEIGHT,
  };
}

/**
 * Distancia euclidiana entre dos landmarks en el espacio normalizado (0..1).
 * Trabajar en normalizado hace que el umbral de pinch sea independiente de la
 * resolución del canvas.
 */
function normalizedDistance(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// ===========================================================================
//  4. LÓGICA DE AGARRE / SOLTADO (sincronización mano <-> física)
// ===========================================================================

/**
 * Intenta agarrar un bloque situado bajo la posición del dedo.
 * Usa Matter.Query.point para saber qué cuerpos contienen ese punto y, si es
 * uno de nuestros bloques, crea una Constraint que lo une al dedo.
 */
function tryGrabBlock(fingerPos) {
  const { Query, Constraint, Composite } = Matter;

  // ¿Qué bloques contienen el punto del dedo?
  const found = Query.point(blocks, fingerPos);
  if (found.length === 0) return;

  draggedBlock = found[0];

  // La Constraint une un punto fijo del mundo (pointA = posición del dedo) con
  // el centro del bloque (bodyB). Iremos actualizando pointA cada frame para
  // que el bloque "persiga" al dedo con físicas reales.
  dragConstraint = Constraint.create({
    pointA: { x: fingerPos.x, y: fingerPos.y },
    bodyB: draggedBlock,
    pointB: { x: 0, y: 0 }, // Anclamos al centro del bloque.
    stiffness: DRAG_STIFFNESS,
    damping: 0.1,
    length: 0,
    render: {
      strokeStyle: "#f9e2af", // Hilo amarillo visible mientras arrastramos.
      lineWidth: 3,
    },
  });

  Composite.add(world, dragConstraint);
}

/**
 * Mientras el pinch se mantiene, movemos el ancla de la Constraint a la nueva
 * posición del dedo. El motor hace el resto: acelera el bloque hacia el dedo,
 * conservando inercia para poder "lanzarlo".
 */
function updateDrag(fingerPos) {
  if (dragConstraint) {
    dragConstraint.pointA.x = fingerPos.x;
    dragConstraint.pointA.y = fingerPos.y;
  }
}

/**
 * Suelta el bloque: elimina la Constraint del mundo. El bloque queda con la
 * velocidad que traía, así que la gravedad lo hace caer / apilarse / volar.
 */
function releaseBlock() {
  if (dragConstraint) {
    Matter.Composite.remove(world, dragConstraint);
  }
  dragConstraint = null;
  draggedBlock = null;
}

// ===========================================================================
//  5. BUCLE PRINCIPAL: DETECCIÓN DE MANO POR FRAME
// ===========================================================================

function predictWebcam() {
  // Guard recomendado por MediaPipe: solo procesamos cuando llega un frame nuevo.
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;

    const results = handLandmarker.detectForVideo(video, performance.now());

    if (results.landmarks && results.landmarks.length > 0) {
      const hand = results.landmarks[0];

      const indexTip = hand[8]; // Punta del índice.
      const thumbTip = hand[4]; // Punta del pulgar.

      // Posición del cursor = punta del índice, mapeada al canvas.
      const fingerPos = landmarkToCanvas(indexTip);

      // ¿Están los dedos lo bastante juntos para ser un pinch?
      const distance = normalizedDistance(indexTip, thumbTip);
      const pinchNow = distance < PINCH_THRESHOLD;

      handlePinchState(pinchNow, fingerPos);
    } else {
      // Sin mano en cuadro: si estábamos arrastrando, soltamos por seguridad.
      if (isPinching) {
        releaseBlock();
        isPinching = false;
      }
    }
  }

  // requestAnimationFrame mantiene el bucle sincronizado con el refresco de
  // pantalla (y con el render de Matter.js, que corre en su propio runner).
  requestAnimationFrame(predictWebcam);
}

/**
 * Máquina de estados del gesto pinch. Distingue los 3 momentos clave:
 *   - Flanco de bajada (empieza el pinch)   -> intentar agarrar.
 *   - Pinch sostenido                        -> actualizar arrastre.
 *   - Flanco de subida (termina el pinch)    -> soltar el bloque.
 */
function handlePinchState(pinchNow, fingerPos) {
  if (pinchNow && !isPinching) {
    // Acaba de comenzar el pinch: intentamos agarrar un bloque bajo el dedo.
    tryGrabBlock(fingerPos);
  } else if (pinchNow && isPinching) {
    // Pinch mantenido: seguimos moviendo el bloque agarrado (si hay).
    updateDrag(fingerPos);
  } else if (!pinchNow && isPinching) {
    // Se soltó el pinch: liberamos el bloque para que caiga.
    releaseBlock();
  }

  isPinching = pinchNow;
}

// ===========================================================================
//  ARRANQUE
// ===========================================================================

async function main() {
  try {
    statusText.textContent = "Cargando motor de física...";
    Matter = await loadMatterJs();
    setupPhysics();

    statusText.textContent = "Cargando modelo de manos (MediaPipe)...";
    await setupHandLandmarker();

    statusText.textContent = "Activando webcam...";
    await enableWebcam();

    statusText.textContent =
      "¡Listo! Junta índice y pulgar (pinch) para agarrar los bloques 🤏";

    // Iniciamos el bucle de detección de mano.
    predictWebcam();
  } catch (err) {
    console.error(err);
    statusText.textContent = "Error: " + err.message;
  }
}

main();
