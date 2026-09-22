// CAMBIAR ESTE NÚMERO POR LA CANTIDAD EXACTA DE IMÁGENES QUE HAY EN LA CARPETA
export const TOTAL_ITEMS = 34;
export const ITEM_IMAGES = Array.from({ length: TOTAL_ITEMS }, (_, i) => `assets/items/item${i + 1}.webp`);

export function getRandomItem() {
  return ITEM_IMAGES[Math.floor(Math.random() * ITEM_IMAGES.length)];
}
