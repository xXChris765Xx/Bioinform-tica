import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// ESCENA

const scene = new THREE.Scene();
const daytimeBackground = new THREE.Color(0x87ceeb);
scene.background = daytimeBackground.clone();

// CÁMARA

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);
camera.position.set(9, 8, 16);

// RENDERER

const renderer = new THREE.WebGLRenderer({
    antialias: true
});
renderer.setSize(
    window.innerWidth,
    window.innerHeight
);
renderer.setPixelRatio(
    window.devicePixelRatio
);
document.body.appendChild(renderer.domElement);

// CONTROLES ORBIT

const controls = new OrbitControls(
    camera,
    renderer.domElement
);
controls.enableDamping = true;
controls.target.set(0, 4, 0);

// ILUMINACIÓN

// Luz ambiental

const ambientLight = new THREE.AmbientLight(
    0xffffff,
    1
);
scene.add(ambientLight);

// Luz direccional

const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    1
);
directionalLight.position.set(
    5,
    10,
    5
);
directionalLight.castShadow = true;
scene.add(directionalLight);

// SUELO

const groundGeometry = new THREE.PlaneGeometry(
    20,
    20
);
const groundMaterial = new THREE.MeshStandardMaterial({
    color: 0x4f7942,
    roughness: 0.9
});
const ground = new THREE.Mesh(
    groundGeometry,
    groundMaterial
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = 0;
scene.add(ground);

// CÉSPED Y ÁRBOLES DEL JARDÍN

const gardenGroup = new THREE.Group();
scene.add(gardenGroup);
// Briznas en pequeños grupos para dar textura al suelo.
const grassGeometry = new THREE.ConeGeometry(0.055, 0.42, 4);
const grassMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x76a84b, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x5d963e, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x8ab653, roughness: 1 })
];
const grassTufts = [];
let randomSeed = 37;
function gardenRandom() {
    randomSeed = (randomSeed * 16807) % 2147483647;
    return (randomSeed - 1) / 2147483646;
}
for (let i = 0; i < 145; i++) {
    const angle = gardenRandom() * Math.PI * 2;
    const radius = 2.1 + gardenRandom() * 7.2;
    const tuft = new THREE.Group();
    tuft.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const bladeCount = 3 + Math.floor(gardenRandom() * 3);
    for (let bladeIndex = 0; bladeIndex < bladeCount; bladeIndex++) {
        const blade = new THREE.Mesh(
            grassGeometry,
            grassMaterials[Math.floor(gardenRandom() * grassMaterials.length)]
        );
        const height = 0.65 + gardenRandom() * 0.8;
        blade.scale.set(0.75 + gardenRandom() * 0.5, height, 0.75 + gardenRandom() * 0.5);
        blade.position.set(
            (gardenRandom() - 0.5) * 0.22,
            height * 0.16,
            (gardenRandom() - 0.5) * 0.22
        );
        blade.rotation.z = (gardenRandom() - 0.5) * 0.6;
        blade.rotation.x = (gardenRandom() - 0.5) * 0.6;
        tuft.add(blade);
    }
    tuft.userData.phase = gardenRandom() * Math.PI * 2;
    gardenGroup.add(tuft);
    grassTufts.push(tuft);
}
const treePositions = [
    [-7.2, -5.8], [-3.8, -7.8], [0.8, -8.1], [5.4, -7.0],
    [7.7, -2.8], [7.5, 3.0], [-4.6, 7.1], [-1.0, 7.8], [-6.3, 5.6], [-8.0, 0.8]
];
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x79502f, roughness: 1 });
const crownMaterials = [
    new THREE.MeshStandardMaterial({ color: 0x347a3d, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x438d47, roughness: 1 }),
    new THREE.MeshStandardMaterial({ color: 0x5a9b4c, roughness: 1 })
];
const trees = [];
treePositions.forEach(([x, z], index) => {
    const tree = new THREE.Group();
    tree.position.set(x, 0, z);
    const scale = 0.82 + (index % 4) * 0.11;
    const trunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18 * scale, 0.3 * scale, 2.7 * scale, 8),
        trunkMaterial
    );
    trunk.position.y = 1.35 * scale;
    tree.add(trunk);
    const crown = new THREE.Group();
    crown.position.y = 2.35 * scale;
    tree.add(crown);
    [
        [0, 0.35, 0, 1.0],
        [-0.38, 0.2, 0.08, 0.68],
        [0.4, 0.25, -0.05, 0.72],
        [0.02, 0.85, 0.02, 0.78]
    ].forEach(([cx, cy, cz, size], crownIndex) => {
        const foliage = new THREE.Mesh(
            new THREE.SphereGeometry(0.95 * scale * size, 10, 8),
            crownMaterials[(index + crownIndex) % crownMaterials.length]
        );
        foliage.position.set(cx * scale, cy * scale, cz * scale);
        foliage.scale.set(1.15, 0.9, 1);
        crown.add(foliage);
    });
    tree.userData.phase = index * 0.7;
    tree.userData.crown = crown;
    gardenGroup.add(tree);
    trees.push(tree);
});

// ESPANTAPÁJAROS DEL MODELO GLB

const scarecrowPivot = new THREE.Group();
scarecrowPivot.position.set(4.4, 0, -2.8);
scarecrowPivot.userData.phase = 1.7;
gardenGroup.add(scarecrowPivot);

const gltfLoader = new GLTFLoader();
gltfLoader.load(
    './models/espantapajaros__scarecrow.glb',
    (gltf) => {
        const scarecrowModel = gltf.scene;
        scarecrowModel.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(scarecrowModel);
        const size = bounds.getSize(new THREE.Vector3());
        const modelScale = 4.2 / size.y;

        scarecrowModel.scale.setScalar(modelScale);
        scarecrowModel.position.set(
            -(bounds.min.x + bounds.max.x) * 0.5 * modelScale,
            -bounds.min.y * modelScale,
            -(bounds.min.z + bounds.max.z) * 0.5 * modelScale
        );
        scarecrowModel.traverse((object) => {
            if (object.isMesh) {
                object.castShadow = true;
                object.receiveShadow = true;
            }
        });
        scarecrowPivot.add(scarecrowModel);
    },
    undefined,
    (error) => console.error('No se pudo cargar el espantapájaros:', error)
);

// MACETA

const potGeometry = new THREE.CylinderGeometry(
    1.2,
    0.9,
    1.5,
    32
);
const potMaterial = new THREE.MeshStandardMaterial({
    color: 0xc96a3d,
    roughness: 0.8
});
const pot = new THREE.Mesh(
    potGeometry,
    potMaterial
);
pot.position.y = 0.75;
pot.userData = {
    name: "Maceta",
    geometry: "Cilindro",
    height: "0.75 unidades",
    description: "Contenedor que sostiene la tierra y las raíces de la planta."
};
scene.add(pot);

// TIERRA

const soilGeometry = new THREE.CylinderGeometry(
    1.05,
    1.05,
    0.15,
    32
);
const soilMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b2e1e
});
const soil = new THREE.Mesh(
    soilGeometry,
    soilMaterial
);
soil.position.y = 1.52;
soil.userData = {
    name: "Tierra",
    geometry: "Cilindro",
    height: "1.52 unidades",
    description: "Superficie donde se encuentran las raíces de la planta."
};
scene.add(soil);

// GRUPO PRINCIPAL DE LA PLANTA

const plant = new THREE.Group();
plant.position.y = 1.5;
scene.add(plant);

// TALLO PRINCIPAL

const stemGeometry = new THREE.CylinderGeometry(
    0.18,
    0.25,
    4.5,
    16
);
const stemMaterial = new THREE.MeshStandardMaterial({
    color: 0x4b8b3b,
    roughness: 0.7
});
const stem = new THREE.Mesh(
    stemGeometry,
    stemMaterial
);
stem.position.y = 2.25;
stem.scale.y = 0;
stem.userData = {
    name: "Tallo principal",
    geometry: "Cilindro",
    height: "3.75 unidades",
    description: "Sostiene la planta y transporta agua y nutrientes."
};
plant.add(stem);

// GRUPO DE RAMAS

const branchesGroup = new THREE.Group();
branchesGroup.position.y = 1.5;
stem.add(branchesGroup);

// FUNCIÓN PARA CREAR RAMAS

const branchPivots = [];

function createBranch(
    x,
    y,
    z,
    rotationZ
) {
    const branchGeometry =
        new THREE.CylinderGeometry(
            0.09,
            0.13,
            2,
            12
        );
    const branchMaterial =
        new THREE.MeshStandardMaterial({
            color: 0x3f7135
        });
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.z = rotationZ;
    pivot.userData.baseRotation = rotationZ;
    const branch = new THREE.Mesh(
        branchGeometry,
        branchMaterial
    );
    branch.position.y = 0;
    branch.scale.y = 0;
    branch.userData = {
        name: "Rama",
        geometry: "Cilindro",
        height: `${y + 3.75} unidades`,
        description:
            "Rama secundaria que sostiene hojas y flores."
    };
    pivot.add(branch);
    branchesGroup.add(pivot);
    branchPivots.push({ pivot, mesh: branch, stage: 0.22 + y * 0.09 });
    return branch;
}

// CREAR RAMAS

const branch1 = createBranch(
    0,
    1.0,
    0,
    -Math.PI / 3
);
const branch2 = createBranch(
    0,
    2.0,
    0,
    Math.PI / 3
);
const branch3 = createBranch(
    0,
    3.0,
    0,
    -Math.PI / 3
);

// GRUPO DE HOJAS

const leavesGroup = new THREE.Group();
plant.add(leavesGroup);

// MATERIAL DE LAS HOJAS

let leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e8b57,
    roughness: 0.7
});
const growingLeaves = [];

// FUNCIÓN PARA CREAR HOJAS

function createLeaf(
    x,
    y,
    z,
    scale
) {
    const leafGeometry =
        new THREE.SphereGeometry(
            0.45,
            16,
            16
        );
    const leaf = new THREE.Mesh(
        leafGeometry,
        leafMaterial
    );
    leaf.position.set(
        x,
        y,
        z
    );
    leaf.scale.set(
        0,
        0,
        0
    );
    growingLeaves.push({ leaf, finalScale: new THREE.Vector3(scale * 1.3, scale, scale * 0.6), stage: 0.48 + y * 0.055 });
    leaf.userData = {
        name: "Hoja",
        geometry: "Esfera",
        height: `${y + 1.5} unidades`,
        description:
            "Realiza la fotosíntesis y permite a la planta producir energía."
    };
    leavesGroup.add(leaf);
    return leaf;
}

// CREAR HOJAS

createLeaf(-1.0, 2.5, 0, 1);
createLeaf(1.0, 3.0, 0, 1);
createLeaf(-0.9, 3.7, 0, 0.9);
createLeaf(0.9, 4.1, 0, 0.9);
createLeaf(-0.7, 4.8, 0, 0.8);
createLeaf(0.7, 5.2, 0, 0.8);
createLeaf(0, 5.7, 0, 0.8);

// GRUPO DE FLORES

const flowersGroup = new THREE.Group();
plant.add(flowersGroup);

// FUNCIÓN PARA CREAR FLORES

function createFlower(
    x,
    y,
    z
) {
    const flowerGroup =
        new THREE.Group();
    flowerGroup.position.set(
        x,
        y,
        z
    );
    flowerGroup.scale.setScalar(0);
    flowerGroup.userData.growthStage = 0.86;

    // Centro de la flor

    const centerGeometry =
        new THREE.SphereGeometry(
            0.25,
            16,
            16
        );
    const centerMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xffd700
        });
    const center =
        new THREE.Mesh(
            centerGeometry,
            centerMaterial
        );
    flowerGroup.add(center);

    // Pétalos

    const petalMaterial =
        new THREE.MeshStandardMaterial({
            color: 0xff69b4
        });
    for (
        let i = 0;
        i < 6;
        i++
    ) {
        const angle =
            (Math.PI * 2 * i) / 6;
        const petalGeometry =
            new THREE.SphereGeometry(
                0.22,
                12,
                12
            );
        const petal =
            new THREE.Mesh(
                petalGeometry,
                petalMaterial
            );
        petal.position.set(
            Math.cos(angle) * 0.35,
            Math.sin(angle) * 0.35,
            0
        );
        petal.scale.set(
            1,
            1.5,
            0.6
        );
        petal.userData = {
            name: "Pétalo",
            geometry: "Esfera",
            height: `${y + 1.5} unidades`,
            description:
                "Parte de la flor que ayuda a atraer polinizadores."
        };
        flowerGroup.add(petal);
    }
    flowerGroup.userData = {
        name: "Flor",
        geometry: "Esferas",
        height: `${y + 1.5} unidades`,
        description:
            "Estructura reproductiva de la planta."
    };
    flowersGroup.add(
        flowerGroup
    );
}

// CREAR FLORES

createFlower(
    -0.8,
    5.2,
    0
);
createFlower(
    0.8,
    5.0,
    0
);

// DOS MACETAS ADICIONALES CON FLORES

const pottedPlants = [];
function createPottedFlower(x, z, petalColor, leafColor) {
    const pottedPlant = new THREE.Group();
    pottedPlant.position.set(x, 0, z);
    gardenGroup.add(pottedPlant);

    const smallPot = new THREE.Mesh(
        new THREE.CylinderGeometry(0.68, 0.5, 0.92, 24),
        new THREE.MeshStandardMaterial({ color: 0xb85d39, roughness: 0.85 })
    );
    smallPot.position.y = 0.46;
    pottedPlant.add(smallPot);

    const smallSoil = new THREE.Mesh(
        new THREE.CylinderGeometry(0.59, 0.59, 0.1, 24),
        new THREE.MeshStandardMaterial({ color: 0x4b2e1e, roughness: 1 })
    );
    smallSoil.position.y = 0.91;
    pottedPlant.add(smallSoil);

    const stemPivot = new THREE.Group();
    stemPivot.position.y = 0.94;
    pottedPlant.add(stemPivot);

    const stemMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.07, 0.11, 1.55, 10),
        new THREE.MeshStandardMaterial({ color: 0x3f7135, roughness: 0.8 })
    );
    stemMesh.position.y = 0;
    stemMesh.scale.y = 0;
    stemMesh.userData = {
        name: "Tallo de maceta",
        geometry: "Cilindro",
        growthRole: "stem",
        description: "Tallo joven que crece desde la tierra de la maceta."
    };
    stemPivot.add(stemMesh);

    const smallLeafMaterial = new THREE.MeshStandardMaterial({
        color: leafColor,
        roughness: 0.75
    });
    const leaves = [];
    [[-0.28, 0.52, -0.04], [0.27, 0.92, 0.04]].forEach(([lx, ly, lz], index) => {
        const smallLeaf = new THREE.Mesh(
            new THREE.SphereGeometry(0.34, 12, 10),
            smallLeafMaterial
        );
        smallLeaf.position.set(lx, ly, lz);
        const finalScale = new THREE.Vector3(1.2, 0.48, 0.55);
        smallLeaf.scale.setScalar(0);
        smallLeaf.rotation.z = index === 0 ? -0.45 : 0.45;
        smallLeaf.userData = {
            name: "Hoja",
            geometry: "Esfera",
            growthRole: "potted-leaf",
            originalColor: leafColor,
            description: "Hoja joven que aparece conforme crece el tallo."
        };
        stemPivot.add(smallLeaf);
        leaves.push({ mesh: smallLeaf, finalScale, stage: 0.4 + index * 0.08 });
    });

    const flowerHead = new THREE.Group();
    flowerHead.position.y = 1.62;
    flowerHead.scale.setScalar(0);
    flowerHead.userData = {
        name: "Flor",
        geometry: "Esferas",
        growthRole: "potted-flower",
        description: "Flor joven que brota al final del crecimiento del tallo."
    };
    stemPivot.add(flowerHead);
    const center = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xffd700, roughness: 0.65 })
    );
    center.userData = { ...flowerHead.userData };
    flowerHead.add(center);

    const petalMaterial = new THREE.MeshStandardMaterial({
        color: petalColor,
        roughness: 0.65
    });
    for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7;
        const petal = new THREE.Mesh(
            new THREE.SphereGeometry(0.17, 10, 10),
            petalMaterial
        );
        petal.position.set(Math.cos(angle) * 0.25, Math.sin(angle) * 0.25, 0);
        petal.scale.set(0.85, 1.35, 0.65);
        petal.userData = { ...flowerHead.userData };
        flowerHead.add(petal);
    }
    pottedPlants.push({
        group: pottedPlant,
        stemPivot,
        stemMesh,
        leaves,
        flowerHead,
        phase: pottedPlants.length * 0.8
    });
    return pottedPlant;
}

createPottedFlower(-3.3, 0.8, 0xff69b4, 0x2e8b57);
createPottedFlower(3.3, 0.8, 0x9b59b6, 0x4f8a3c);

// RAYCASTING

const raycaster =
    new THREE.Raycaster();
const mouse =
    new THREE.Vector2();

// CLICK DEL MOUSE

window.addEventListener(
    "click",
    onMouseClick
);
function onMouseClick(event) {
    mouse.x =
        (event.clientX /
            window.innerWidth) * 2 - 1;
    mouse.y =
        -(event.clientY /
            window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(
        mouse,
        camera
    );
    const objects = [
        stem,
        pot,
        soil,
        ...branchesGroup.children,
        ...growingLeaves.map(({ leaf }) => leaf),
        ...pottedPlants.flatMap(({ stemMesh, leaves, flowerHead }) => [
            stemMesh,
            ...leaves.map(({ mesh }) => mesh),
            flowerHead
        ])
    ];
    flowersGroup.traverse(
        function(object) {
            if (
                object.isMesh
            ) {
                objects.push(
                    object
                );
            }
        }
    );
    const intersections =
        raycaster.intersectObjects(
            objects,
            true
        );
    if (
        intersections.length > 0
    ) {
        const selected =
            intersections[0].object;
        selectedObject = selected;
        showInformation(
            selected
        );
    }
}

// MOSTRAR INFORMACIÓN

function showInformation(
    object
) {
    const data =
        object.userData;
    if (!data.name) {
        return;
    }
    const panel =
        document.getElementById(
            "selected-info"
        );
    panel.innerHTML = `
        <h3>${data.name}</h3>
        <p>
            <strong>Estado de crecimiento:</strong>
            ${Math.round(getPartGrowth(data) * 100)}%
        </p>
        <p>
            <strong>Tipo de geometría:</strong>
            ${data.geometry}
        </p>
        <p>
            <strong>Altura:</strong>
            ${data.height}
        </p>
        <p>
            <strong>Función:</strong>
            ${data.description}
        </p>
    `;
}

function getPartGrowth(data) {
    if (data.growthRole === "stem") return THREE.MathUtils.clamp(plantGrowth / 0.48, 0, 1);
    if (data.growthRole === "potted-leaf") return THREE.MathUtils.clamp((plantGrowth - 0.4) / 0.3, 0, 1);
    if (data.growthRole === "potted-flower") return THREE.MathUtils.clamp((plantGrowth - 0.72) / 0.28, 0, 1);
    if (data.name === "Tallo principal") return THREE.MathUtils.clamp(plantGrowth / 0.52, 0, 1);
    if (data.name === "Rama") return THREE.MathUtils.clamp((plantGrowth - 0.22) / 0.45, 0, 1);
    if (data.name === "Hoja") return THREE.MathUtils.clamp((plantGrowth - 0.48) / 0.42, 0, 1);
    if (data.name === "Flor" || data.name === "Pétalo") return THREE.MathUtils.clamp((plantGrowth - 0.86) / 0.14, 0, 1);
    return 1;
}

// CONTROL DE ANIMACIÓN

let animationEnabled = true;
let plantGrowth = 0;
let growthSpeed = 1;
let windStrength = 0.5;
let selectedObject = null;
const animationButton =
    document.getElementById(
        "animationButton"
    );
animationButton.addEventListener(
    "click",
    function() {
        animationEnabled =
            !animationEnabled;
        if (
            animationEnabled
        ) {
            animationButton.textContent =
            "Pausar simulación";
        } else {
            animationButton.textContent =
            "Reanudar simulación";
        }
    }
);

document.getElementById("growthSpeed").addEventListener("input", (event) => {
    growthSpeed = Number(event.target.value);
    document.getElementById("growthSpeedValue").textContent = `${growthSpeed.toFixed(1)}×`;
});
document.getElementById("windIntensity").addEventListener("input", (event) => {
    windStrength = Number(event.target.value) / 100;
    document.getElementById("windValue").textContent = `${event.target.value}%`;
});
document.getElementById("restartGrowthButton").addEventListener("click", () => {
    plantGrowth = 0;
    stem.scale.y = 0;
    stem.position.y = 0;
    plant.visible = true;
    branchPivots.forEach(({ mesh }) => { mesh.scale.y = 0; mesh.position.y = 0; });
    growingLeaves.forEach(({ leaf }) => leaf.scale.setScalar(0));
    flowersGroup.children.forEach((flower) => flower.scale.setScalar(0));
    pottedPlants.forEach(({ stemMesh, leaves, flowerHead }) => {
        stemMesh.scale.y = 0;
        stemMesh.position.y = 0;
        leaves.forEach(({ mesh }) => mesh.scale.setScalar(0));
        flowerHead.scale.setScalar(0);
    });
    document.getElementById("growthPercent").textContent = "0%";
    document.getElementById("growthProgress").style.width = "0%";
});

// CAMBIAR COLOR DE HOJAS

let greenLeaves = true;
const leafColorButton =
    document.getElementById(
        "leafColorButton"
    );
leafColorButton.addEventListener(
    "click",
    function() {
        if (greenLeaves) {
            leafMaterial.color.set(
                0xe53935
            );
        } else {
            leafMaterial.color.set(
                0x2e8b57
            );
        }
        pottedPlants.forEach(({ leaves }) => leaves.forEach(({ mesh }) => {
            mesh.material.color.set(greenLeaves ? 0xe53935 : mesh.userData.originalColor);
        }));
        greenLeaves =
            !greenLeaves;
    }
);

// REINICIAR CÁMARA

const resetCameraButton =
    document.getElementById(
        "resetCameraButton"
    );
resetCameraButton.addEventListener(
    "click",
    function() {
        camera.position.set(
            9,
            8,
            16
        );
        controls.target.set(
            0,
            4,
            0
        );
        controls.update();
    }
);

// CONTROL DE INTENSIDAD DE LUZ

const lightIntensity =
    document.getElementById(
        "lightIntensity"
    );
lightIntensity.addEventListener(
    "input",
    function() {
        const intensity = Number(lightIntensity.value);
        directionalLight.intensity = intensity;
        ambientLight.intensity = intensity;

        // Al llegar a cero, también oscurece el fondo para dejar la escena negra.
        scene.background = daytimeBackground.clone().multiplyScalar(
            Math.min(intensity, 1)
        );
    }
);

// MOSTRAR / OCULTAR HOJAS

let leavesVisible = true;
const leafVisibilityButton =
    document.getElementById(
        "leafVisibilityButton"
    );
leafVisibilityButton.addEventListener(
    "click",
    function() {
        leavesVisible =
            !leavesVisible;
        leavesGroup.visible =
            leavesVisible;
        pottedPlants.forEach(({ leaves }) => leaves.forEach(({ mesh }) => { mesh.visible = leavesVisible; }));
        if (leavesVisible) {
            leafVisibilityButton.textContent =
                "Ocultar hojas";
        } else {
            leafVisibilityButton.textContent =
                "Mostrar hojas";
        }
    }
);

// ANIMACIÓN

const clock = new THREE.Clock();
let elapsedTime = 0;
function animate() {
    requestAnimationFrame(
        animate
    );
    const delta = Math.min(clock.getDelta(), 0.05);
    if (animationEnabled) elapsedTime += delta;
    const time = elapsedTime;
    if (animationEnabled) {
        plantGrowth = Math.min(1, plantGrowth + delta * growthSpeed / 12);
        const stemGrowth = THREE.MathUtils.smoothstep(plantGrowth, 0, 0.52);
        stem.scale.y = stemGrowth;
        stem.position.y = 2.25 * stemGrowth;
        branchPivots.forEach(({ mesh, stage }) => {
            mesh.scale.y = THREE.MathUtils.smoothstep(plantGrowth, stage, stage + 0.22);
            mesh.position.y = mesh.scale.y;
        });
        growingLeaves.forEach(({ leaf, finalScale, stage }) => {
            const amount = THREE.MathUtils.smoothstep(plantGrowth, stage, stage + 0.12);
            leaf.scale.copy(finalScale).multiplyScalar(amount);
        });
        flowersGroup.children.forEach((flower) => {
            flower.scale.setScalar(THREE.MathUtils.smoothstep(plantGrowth, flower.userData.growthStage, 1));
        });
        document.getElementById("growthPercent").textContent = `${Math.round(plantGrowth * 100)}%`;
        document.getElementById("growthProgress").style.width = `${plantGrowth * 100}%`;
        if (selectedObject) showInformation(selectedObject);

        plant.rotation.z = Math.sin(time * 1.5) * 0.04 * windStrength;
        branchPivots.forEach(({ pivot }, index) => {
            pivot.rotation.z = pivot.userData.baseRotation + Math.sin(time * 1.6 + index) * 0.035 * windStrength;
        });
        growingLeaves.forEach(({ leaf }, index) => {
            leaf.rotation.z = Math.sin(time * 1.8 + index * 0.8) * 0.08 * windStrength;
        });
        flowersGroup.rotation.y =
            time * 0.5;
        scarecrowPivot.rotation.z =
            Math.sin(time * 0.8 + scarecrowPivot.userData.phase) * 0.025;
        scarecrowPivot.rotation.x =
            Math.cos(time * 0.65 + scarecrowPivot.userData.phase) * 0.018;
        pottedPlants.forEach(({ stemPivot, phase }) => {
            stemPivot.rotation.z = Math.sin(time * 1.2 + phase) * 0.055 * windStrength;
            stemPivot.rotation.x = Math.cos(time * 0.9 + phase) * 0.025 * windStrength;
        });
        pottedPlants.forEach(({ stemMesh, leaves, flowerHead, phase }) => {
            const stemAmount = THREE.MathUtils.smoothstep(plantGrowth, 0.04 + phase * 0.015, 0.48 + phase * 0.015);
            stemMesh.scale.y = stemAmount;
            stemMesh.position.y = 0.775 * stemAmount;
            leaves.forEach(({ mesh, finalScale, stage }, index) => {
                const leafAmount = THREE.MathUtils.smoothstep(plantGrowth, stage + phase * 0.015, stage + 0.16 + phase * 0.015);
                mesh.scale.copy(finalScale).multiplyScalar(leafAmount);
                mesh.rotation.z = (index === 0 ? -0.45 : 0.45) + Math.sin(time * 1.7 + phase + index) * 0.08 * windStrength;
            });
            const flowerAmount = THREE.MathUtils.smoothstep(plantGrowth, 0.72 + phase * 0.015, 0.98);
            flowerHead.scale.setScalar(flowerAmount);
        });
        grassTufts.forEach((tuft) => {
            const breeze = time * 1.8 + tuft.userData.phase;
            tuft.rotation.z = Math.sin(breeze) * 0.08 * windStrength;
            tuft.rotation.x = Math.cos(breeze * 0.8) * 0.06 * windStrength;
        });
        trees.forEach((tree) => {
            tree.userData.crown.rotation.z =
                Math.sin(time * 0.7 + tree.userData.phase) * 0.025 * windStrength;
            tree.userData.crown.rotation.x =
                Math.cos(time * 0.6 + tree.userData.phase) * 0.018 * windStrength;
        });
    }
    controls.update();
    renderer.render(
        scene,
        camera
    );
}
animate();

// AJUSTAR VENTANA

window.addEventListener(
    "resize",
    function() {
        camera.aspect =
            window.innerWidth /
            window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(
            window.innerWidth,
            window.innerHeight
        );
    }
);
