// ============================================================================
// Fuente única de verdad para los assets de la tarjeta.
// Todo lo de aquí abajo usa placehold.co / emojis como PLACEHOLDER.
// Para reemplazar por los assets finales, sólo hay que cambiar las rutas por
// archivos locales dentro de /public/assets/images/ (ver README de esa carpeta)
// y volver a apuntar cada clave a "/assets/images/<archivo>".
// ============================================================================

export const IMAGES = {
  // Paso 1: corazón con las manos sobre la cabeza -> cocodrilo festivo
  heartOnHead: "https://placehold.co/300x300/588157/ffffff?text=%F0%9F%90%8A+Croco+Fiesta",
  // Paso 2: peace sign -> confeti verde (no necesita imagen, se deja por si se quiere usar)
  peace: "https://placehold.co/300x300/A3B18A/ffffff?text=%E2%9C%8C%EF%B8%8F+Peace",
  // Paso 3: finger heart -> cocodrilo con moño
  fingerHeart: "https://placehold.co/300x300/3A5A40/ffffff?text=%F0%9F%90%8A%F0%9F%8E%80+Croco+Bow",
  // Paso 4: sonrisa -> se usa directo el badge de smile
  smile: "https://placehold.co/300x300/D8C07A/1A2E1F?text=%F0%9F%98%81+Smile",
  // Photocard final
  photocard: "https://placehold.co/400x600/A3B18A/ffffff?text=Photocard+Campeche",
};

export const AUDIO = {
  // Placeholder ficticio: reemplazar por el archivo real en /public/assets/audio/
  background: "/assets/audio/audio_placeholder.mp3",
};
