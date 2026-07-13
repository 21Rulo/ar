// =============================================================================
//  Detector de Gestos - Gatos
//  MediaPipe Tasks-Vision (GestureRecognizer + FaceLandmarker) en tiempo real.
//
//  app.js se carga como <script type="module">, por lo que importamos los
//  símbolos directamente desde el CDN de jsdelivr (misma versión 0.10.8 que el
//  bundle declarado en index.html). Esto evita depender del nombre del global.
// =============================================================================

import {
    FilesetResolver,
    GestureRecognizer,
    FaceLandmarker,
    DrawingUtils,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8";

// -----------------------------------------------------------------------------
//  Configuración
// -----------------------------------------------------------------------------
const CONFIG = {
    wasmPath: "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm",

    models: {
        gesture:
            "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task",
        face:
            "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
    },

    // Umbral de las blendshapes para considerar que hay una expresión activa.
    laughThreshold: 0.45,

    // Nombre exacto del gesto de pulgar arriba que devuelve el modelo por defecto.
    thumbsUpGesture: "Thumb_Up",

    // Dibujar (opcional) los landmarks de mano y cara sobre el canvas.
    drawLandmarks: false,
};

// Estados posibles y su representación visual (imagen + texto).
const STATES = {
    THUMBS_UP: { src: "public/pulgar.png", text: "¡Pulgar Arriba!" },
    LAUGHING: { src: "public/reir.png", text: "Riendo" },
    SERIOUS: { src: "public/serio.png", text: "Serio" },
};

// -----------------------------------------------------------------------------
//  Referencias al DOM
// -----------------------------------------------------------------------------
const video = document.getElementById("webcam");
const canvas = document.getElementById("output_canvas");
const canvasCtx = canvas.getContext("2d");
const catDisplay = document.getElementById("cat-display");
const statusText = document.getElementById("status-text");

// -----------------------------------------------------------------------------
//  Estado global de la app
// -----------------------------------------------------------------------------
let gestureRecognizer = null;
let faceLandmarker = null;
let drawingUtils = null;

let isRunning = false;
let lastVideoTime = -1; // Evita reprocesar el mismo frame de vídeo.
let currentState = null; // Cache del estado para no tocar el DOM sin necesidad.

// -----------------------------------------------------------------------------
//  1. Carga de modelos
// -----------------------------------------------------------------------------
async function createRecognizers() {
    setStatus("Cargando modelos…");

    const vision = await FilesetResolver.forVisionTasks(CONFIG.wasmPath);

    // Los dos modelos se crean en paralelo para acelerar el arranque.
    [gestureRecognizer, faceLandmarker] = await Promise.all([
        GestureRecognizer.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: CONFIG.models.gesture,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            numHands: 1,
        }),
        FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
                modelAssetPath: CONFIG.models.face,
                delegate: "GPU",
            },
            runningMode: "VIDEO",
            outputFaceBlendshapes: true,
            numFaces: 1,
        }),
    ]);

    drawingUtils = new DrawingUtils(canvasCtx);
}

// -----------------------------------------------------------------------------
//  2. Webcam
// -----------------------------------------------------------------------------
async function enableWebcam() {
    if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("Tu navegador no soporta getUserMedia.");
        throw new Error("getUserMedia no disponible");
    }

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
    });

    video.srcObject = stream;

    // Esperamos a que el vídeo tenga datos para conocer sus dimensiones reales.
    await new Promise((resolve) => {
        video.addEventListener("loadeddata", resolve, { once: true });
    });

    // El canvas se ajusta a la resolución intrínseca del vídeo para que los
    // landmarks (coordenadas normalizadas) queden alineados con la imagen.
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}

// -----------------------------------------------------------------------------
//  3. Bucle de predicción en tiempo real
// -----------------------------------------------------------------------------
function startLoop() {
    isRunning = true;
    requestAnimationFrame(predictWebcam);
}

function predictWebcam() {
    // Un único timestamp compartido por ambos modelos para el mismo frame.
    const timestamp = performance.now();

    // Solo procesamos si el frame de vídeo cambió: así evitamos trabajo redundante
    // y caídas de FPS cuando requestAnimationFrame va más rápido que la cámara.
    if (video.currentTime !== lastVideoTime && video.readyState >= 2) {
        lastVideoTime = video.currentTime;

        const gestureResult = gestureRecognizer.recognizeForVideo(video, timestamp);
        const faceResult = faceLandmarker.detectForVideo(video, timestamp);

        updateState(gestureResult, faceResult);

        if (CONFIG.drawLandmarks) {
            drawOverlay(gestureResult, faceResult);
        }
    }

    if (isRunning) {
        requestAnimationFrame(predictWebcam);
    }
}

// -----------------------------------------------------------------------------
//  4. Lógica de estados
// -----------------------------------------------------------------------------
function updateState(gestureResult, faceResult) {
    let nextState;

    if (isThumbsUp(gestureResult)) {
        nextState = "THUMBS_UP";
    } else if (isLaughing(faceResult)) {
        nextState = "LAUGHING";
    } else {
        nextState = "SERIOUS";
    }

    applyState(nextState);
}

function isThumbsUp(gestureResult) {
    const gestures = gestureResult?.gestures;
    if (!gestures || gestures.length === 0) return false;

    // gestures[0] corresponde a la primera mano; [0] es el gesto de mayor score.
    const top = gestures[0][0];
    return top?.categoryName === CONFIG.thumbsUpGesture;
}

function isLaughing(faceResult) {
    const blendshapes = faceResult?.faceBlendshapes;
    if (!blendshapes || blendshapes.length === 0) return false;

    // Convertimos las categorías en un mapa {nombre -> score} para leerlas fácil.
    const scores = {};
    for (const category of blendshapes[0].categories) {
        scores[category.categoryName] = category.score;
    }

    const t = CONFIG.laughThreshold;
    const jawOpen = (scores.jawOpen ?? 0) > t;
    const smiling =
        (scores.mouthSmileLeft ?? 0) > t && (scores.mouthSmileRight ?? 0) > t;

    return jawOpen || smiling;
}

// Aplica el estado al DOM solo si cambió (evita recargar la imagen cada frame).
function applyState(stateKey) {
    if (stateKey === currentState) return;
    currentState = stateKey;

    const state = STATES[stateKey];
    catDisplay.src = state.src;
    statusText.textContent = state.text;
}

// -----------------------------------------------------------------------------
//  5. Dibujo opcional de landmarks sobre el canvas
// -----------------------------------------------------------------------------
function drawOverlay(gestureResult, faceResult) {
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Mano ---
    if (gestureResult?.landmarks) {
        for (const landmarks of gestureResult.landmarks) {
            drawingUtils.drawConnectors(
                landmarks,
                GestureRecognizer.HAND_CONNECTIONS,
                { color: "#89b4fa", lineWidth: 4 }
            );
            drawingUtils.drawLandmarks(landmarks, {
                color: "#f38ba8",
                lineWidth: 1,
                radius: 3,
            });
        }
    }

    // --- Cara (contornos ligeros para no saturar el frame) ---
    if (faceResult?.faceLandmarks) {
        for (const landmarks of faceResult.faceLandmarks) {
            drawingUtils.drawConnectors(
                landmarks,
                FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
                { color: "#a6e3a1", lineWidth: 2 }
            );
            drawingUtils.drawConnectors(
                landmarks,
                FaceLandmarker.FACE_LANDMARKS_LIPS,
                { color: "#f9e2af", lineWidth: 2 }
            );
        }
    }

    canvasCtx.restore();
}

// -----------------------------------------------------------------------------
//  Utilidades
// -----------------------------------------------------------------------------
function setStatus(text) {
    statusText.textContent = text;
}

// -----------------------------------------------------------------------------
//  Arranque
// -----------------------------------------------------------------------------
async function main() {
    try {
        await createRecognizers();
        await enableWebcam();
        setStatus("Detectando…");
        startLoop();
    } catch (err) {
        console.error(err);
        setStatus("Error: " + (err?.message ?? err));
    }
}

main();
