export const el = {
  startScreen: document.getElementById("start-screen"),
  arScreen: document.getElementById("ar-screen"),
  giftBox: document.getElementById("gift-box"),
  permissionError: document.getElementById("permission-error"),

  webcam: document.getElementById("webcam"),
  canvas: document.getElementById("output-canvas"),
  cameraWrap: document.getElementById("camera-wrap"),

  missionCard: document.getElementById("mission-card"),
  missionDots: document.getElementById("mission-dots"),
  missionStep: document.getElementById("mission-current-text"),
  missionTitle: document.getElementById("mission-title"),
  missionDesc: document.getElementById("mission-desc"),

  audio: document.getElementById("bg-audio"),
  audioToggle: document.getElementById("audio-toggle"),
  audioToggleIcon: document.getElementById("audio-toggle-icon"),

  modal: document.getElementById("photocard-modal"),
  keepPlaying: document.getElementById("keep-playing"),
  downloadCollage: document.getElementById("download-collage"),
  photocardImg: document.querySelector(".photocard__img"),
};

export function goToArScreen() {
  el.startScreen.classList.remove("screen--active");
  el.arScreen.classList.add("screen--active");
}

export function goToStartScreen() {
  el.arScreen.classList.remove("screen--active");
  el.startScreen.classList.add("screen--active");
}

export function renderMissionDots(missions, currentIndex) {
  el.missionDots.innerHTML = missions
    .map((_, i) => {
      const cls = i < currentIndex ? "is-done" : i === currentIndex ? "is-current" : "";
      return `<span class="${cls}"></span>`;
    })
    .join("");
}

export function renderMission(mission, index, total) {
  el.missionStep.textContent = String(index + 1);
  el.missionTitle.textContent = `${mission.icon} ${mission.title}`;
  el.missionDesc.textContent = mission.desc;
}

let badgeTimeout = null;

export function showSuccessBadge(imgSrc, textStr) {
  const badge = document.getElementById("success-badge");
  const img = document.getElementById("success-badge-img");
  const text = document.getElementById("success-badge-text");

  if (!badge || !img || !text) return;

  // 1. Asignar los valores (la imagen aleatoria y el título de la misión)
  img.src = imgSrc;
  text.textContent = textStr;

  // 2. Limpiar cualquier animación pendiente si el usuario hace gestos muy rápido
  if (badgeTimeout) clearTimeout(badgeTimeout);

  // 3. Quitar el atributo hidden y forzar un "reflow" para que la animación se reinicie desde cero
  badge.hidden = false;
  badge.style.animation = 'none';
  void badge.offsetWidth; // Truco mágico de CSS para reiniciar animaciones
  badge.style.animation = 'badge-pop 2.5s ease forwards';

  // 4. Ocultar el badge por completo después de que termine la animación
  badgeTimeout = setTimeout(() => {
    badge.hidden = true;
  }, 2600);
}

export function blurCamera(isBlurred) {
  el.cameraWrap.classList.toggle("is-blurred", isBlurred);
}

export function showPhotocardModal() {
  el.missionCard.hidden = true;
  el.modal.hidden = false;
}

export function hidePhotocardModal() {
  el.modal.hidden = true;
  el.missionCard.hidden = false;
  blurCamera(false);
}

export function setAudioIcon(isPlaying) {
  el.audioToggleIcon.textContent = isPlaying ? "🔊" : "🔇";
}

export function showPermissionError() {
  el.permissionError.hidden = false;
}
