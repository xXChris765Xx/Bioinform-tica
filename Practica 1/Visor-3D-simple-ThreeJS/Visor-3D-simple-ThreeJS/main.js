import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// 1. Escena
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x111122);

// 2. Cámara
const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
camera.position.set(0, 3, 7);

// 3. Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// 4. OrbitControls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 5. Luces
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
directionalLight.position.set(5, 10, 7);
scene.add(directionalLight);

// 6. Plano
const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshStandardMaterial({ color: 0x333333 })
);
plane.rotation.x = -Math.PI / 2;
plane.position.y = -1;
plane.name = "Plano";
scene.add(plane);

// 7. Cubo
const cube = new THREE.Mesh(
    new THREE.BoxGeometry(1.2, 1.2, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x3498db })
);
cube.position.set(-2, 0, 0);
cube.name = "Cubo azul";
scene.add(cube);

// 8. Esfera
const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.8, 32, 32),
    new THREE.MeshStandardMaterial({ color: 0xe74c3c })
);
sphere.position.set(2, 0, 0);
sphere.name = "Esfera roja";
scene.add(sphere);

// 9. Modelo 3D .glb
const loader = new GLTFLoader();

loader.load(
    'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Models/main/2.0/Duck/glTF-Binary/Duck.glb',
    (gltf) => {
        const model = gltf.scene;
        model.scale.set(0.8, 0.8, 0.8);
        model.position.set(0, -1, 0);

        model.traverse((child) => {
            if (child.isMesh) {
                child.name = "Modelo 3D (Pato)";
            }
        });

        scene.add(model);
    },
    undefined,
    () => {
        console.log("No se pudo cargar el modelo 3D.");
    }
);

// 10. Raycasting
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const selectedInfo = document.getElementById("selected-info");

window.addEventListener("click", (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const object = intersects[0].object;
        selectedInfo.textContent = `Seleccionado: ${object.name || "Objeto"}`;

        console.log("Objeto seleccionado:", object.name || "Objeto");

        if (object.material && object.material.color) {
            const colorOriginal = object.material.color.getHex();
            object.material.color.setHex(0x00ffcc);

            setTimeout(() => {
                object.material.color.setHex(colorOriginal);
            }, 300);
        }
    }
});

// 11. Animación
function animate() {
    requestAnimationFrame(animate);

    controls.update();

    cube.rotation.x += 0.005;
    cube.rotation.y += 0.01;
    sphere.rotation.y += 0.01;

    renderer.render(scene, camera);
}

animate();

// 12. Ajustar ventana
window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});
