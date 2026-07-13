import * as THREE from 'three';
import { MindARThree } from 'mind-ar/dist/mindar-face-three.prod.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const start = async () => {
  // 1. Inicializar MindAR para rostros apuntando al contenedor
  const mindarThree = new MindARThree({
    container: document.querySelector("#ar-container"),
    maxFaces: 2
  });

  const { renderer, scene, camera } = mindarThree;

  // 2. Añadir iluminación y ancla en el entrecejo (168)
  const anchor = mindarThree.addAnchor(168);

  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(0, 5, 5);
  scene.add(dirLight);

  // 3. Cargar el modelo 3D del Burro de Shrek
  const loader = new GLTFLoader();

  loader.load(
    'assets/donkey/scene.gltf',
    (gltf) => {
      const donkeyModel = gltf.scene;

      // Escala y posición iniciales
      donkeyModel.scale.set(1.0, 1.0, 1.0);
      donkeyModel.position.set(0, 0.2, -0.5);

      // Ocultar el texto de carga si existe
      const loading = document.getElementById('loading');
      if (loading) loading.style.display = 'none';

      // Anclar el modelo al tracking de la cara
      anchor.group.add(donkeyModel);
    },
    (xhr) => {
      console.log(Math.round(xhr.loaded / xhr.total * 100) + '% cargado');
    },
    (error) => {
      console.error('Error al cargar el modelo del burrito:', error);
    }
  );

  // 4. Arrancar el motor de AR y el ciclo de renderizado
  await mindarThree.start();

  renderer.setAnimationLoop(() => {
    renderer.render(scene, camera);
  });
};

// Ejecutar la aplicación
start();