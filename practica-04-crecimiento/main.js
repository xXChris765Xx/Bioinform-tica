import * as THREE from 'three';
import {
    OrbitControls
} from 'three/addons/controls/OrbitControls.js';

// ESCENA

const scene = new THREE.Scene();
scene.background =
    new THREE.Color(0x87ceeb);

// CÁMARA

const camera =
    new THREE.PerspectiveCamera(
        60,
        window.innerWidth /
        window.innerHeight,
        0.1,
        100
    );
camera.position.set(
    7,
    5,
    9
);

// RENDERER

const renderer =
    new THREE.WebGLRenderer({
        antialias: true
    });
renderer.setSize(
    window.innerWidth,
    window.innerHeight
);
renderer.setPixelRatio(
    window.devicePixelRatio
);
document.body.appendChild(
    renderer.domElement
);

// ORBIT CONTROLS

const controls =
    new OrbitControls(
        camera,
        renderer.domElement
    );
controls.enableDamping = true;
controls.target.set(
    0,
    2.5,
    0
);

// ILUMINACIÓN

const ambientLight =
    new THREE.AmbientLight(
        0xffffff,
        1
    );
scene.add(
    ambientLight
);
const directionalLight =
    new THREE.DirectionalLight(
        0xffffff,
        1.2
    );
directionalLight.position.set(
    5,
    10,
    5
);
scene.add(
    directionalLight
);

// SUELO

const groundGeometry =
    new THREE.PlaneGeometry(
        20,
        20
    );
const groundMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x4f7942
    });
const ground =
    new THREE.Mesh(
        groundGeometry,
        groundMaterial
    );
ground.rotation.x =
    -Math.PI / 2;
scene.add(
    ground
);

// MACETA

const potGeometry =
    new THREE.CylinderGeometry(
        1.2,
        0.9,
        1.5,
        32
    );
const potMaterial =
    new THREE.MeshStandardMaterial({
        color: 0xc96a3d
    });
const pot =
    new THREE.Mesh(
        potGeometry,
        potMaterial
    );
pot.position.y = 0.75;
pot.userData = {
    name: "Maceta",
    geometry: "Cilindro",
    description:
        "Contenedor donde crece la planta."
};
scene.add(
    pot
);

// TIERRA

const soilGeometry =
    new THREE.CylinderGeometry(
        1.05,
        1.05,
        0.15,
        32
    );
const soilMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x4b2e1e
    });
const soil =
    new THREE.Mesh(
        soilGeometry,
        soilMaterial
    );
soil.position.y =
    1.52;
soil.userData = {
    name: "Tierra",
    geometry: "Cilindro",
    description:
        "Medio donde se encuentran las raíces."
};
scene.add(
    soil
);

// GRUPO PRINCIPAL

const plant =
    new THREE.Group();
plant.position.y =
    1.5;
scene.add(
    plant
);

// TALLO

const stemGeometry =
    new THREE.CylinderGeometry(
        0.18,
        0.25,
        4.5,
        16
    );
const stemMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x4b8b3b
    });
const stem =
    new THREE.Mesh(
        stemGeometry,
        stemMaterial
    );
stem.position.y =
    2.25;
stem.userData = {
    name: "Tallo principal",
    geometry: "Cilindro",
    description:
        "Sostiene la planta y transporta agua y nutrientes."
};
plant.add(
    stem
);

// GRUPO DE RAMAS

const branchesGroup =
    new THREE.Group();
branchesGroup.position.y =
    0;
stem.add(
    branchesGroup
);

// CREAR RAMA

function createBranch(
    x,
    y,
    z,
    rotationZ
) {
    const geometry =
        new THREE.CylinderGeometry(
            0.09,
            0.13,
            2,
            12
        );
    const material =
        new THREE.MeshStandardMaterial({
            color: 0x3f7135
        });
    const branch =
        new THREE.Mesh(
            geometry,
            material
        );
    branch.position.set(
        x,
        y,
        z
    );
    branch.rotation.z =
        rotationZ;
    branch.userData = {
        name: "Rama",
        geometry: "Cilindro",
        description:
            "Rama secundaria que sostiene hojas."
    };
    branchesGroup.add(
        branch
    );
    return branch;
}

// CREAR RAMAS

const branch1 =
    createBranch(
        0,
        1.0,
        0,
        -Math.PI / 3
    );
const branch2 =
    createBranch(
        0,
        2.0,
        0,
        Math.PI / 3
    );
const branch3 =
    createBranch(
        0,
        3.0,
        0,
        -Math.PI / 3
    );

// GRUPO DE HOJAS

const leavesGroup =
    new THREE.Group();
plant.add(
    leavesGroup
);

// MATERIAL DE HOJAS

let leafMaterial =
    new THREE.MeshStandardMaterial({
        color: 0x2e8b57,
        roughness: 0.7
    });

// CREAR HOJA

function createLeaf(
    x,
    y,
    z,
    scale
) {
    const geometry =
        new THREE.SphereGeometry(
            0.45,
            16,
            16
        );
    const leaf =
        new THREE.Mesh(
            geometry,
            leafMaterial
        );
    leaf.position.set(
        x,
        y,
        z
    );
    leaf.scale.set(
        scale * 1.3,
        scale,
        scale * 0.6
    );
    leaf.userData = {
        name: "Hoja",
        geometry: "Esfera",
        description:
            "Realiza la fotosíntesis y produce energía."
    };
    leavesGroup.add(
        leaf
    );
    return leaf;
}

// CREAR HOJAS

const leaves = [];
leaves.push(
    createLeaf(-1, 2.5, 0, 1)
);
leaves.push(
    createLeaf(1, 3, 0, 1)
);
leaves.push(
    createLeaf(-0.9, 3.7, 0, 0.9)
);
leaves.push(
    createLeaf(0.9, 4.1, 0, 0.9)
);
leaves.push(
    createLeaf(-0.7, 4.8, 0, 0.8)
);
leaves.push(
    createLeaf(0.7, 5.2, 0, 0.8)
);
leaves.push(
    createLeaf(0, 5.7, 0, 0.8)
);

// GRUPO DE FLORES

const flowersGroup =
    new THREE.Group();
plant.add(
    flowersGroup
);

// CREAR FLOR

function createFlower(
    x,
    y,
    z
) {
    const flower =
        new THREE.Group();
    flower.position.set(
        x,
        y,
        z
    );
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
    center.userData = {
        name: "Centro de la flor",
        geometry: "Esfera",
        description:
            "Centro reproductivo de la flor."
    };
    flower.add(
        center
    );
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
        const geometry =
            new THREE.SphereGeometry(
                0.22,
                12,
                12
            );
        const petal =
            new THREE.Mesh(
                geometry,
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
            description:
                "Parte de la flor que ayuda a atraer polinizadores."
        };
        flower.add(
            petal
        );
    }
    flowersGroup.add(
        flower
    );
    return flower;
}

// CREAR FLORES

const flower1 =
    createFlower(
        -0.8,
        5.2,
        0
    );
const flower2 =
    createFlower(
        0.8,
        5.0,
        0
    );

// ESTADO DE CRECIMIENTO

let growth = 0;
let growthSpeed = 1;
let windIntensity = 0.5;
let animationPaused = false;
let leavesColorGreen = true;

// INICIALIZAR ESCALA

// El tallo comienza desde cero

stem.scale.set(
    1,
    0,
    1
);

// Las ramas comienzan desde cero

branchesGroup.children.forEach(
    branch => {
        branch.scale.set(
            1,
            0,
            1
        );
    }
);

// Las hojas comienzan invisibles

leaves.forEach(
    leaf => {
        leaf.scale.set(
            0,
            0,
            0
        );
    }
);

// Las flores comienzan invisibles

flowersGroup.scale.set(
    0,
    0,
    0
);

// ACTUALIZAR CRECIMIENTO

function updateGrowth() {
    if (
        animationPaused
    ) {
        return;
    }
    growth +=
        0.003 *
        growthSpeed;
    if (
        growth >= 1
    ) {
        growth = 1;
    }
    // -------------------------------

    // TALLO

    // -------------------------------
    const stemGrowth =
        Math.min(
            growth * 1.5,
            1
        );
    stem.scale.y =
        stemGrowth;
    // -------------------------------

    // RAMAS

    // -------------------------------
    const branchGrowth =
        Math.max(
            0,
            Math.min(
                (growth - 0.25) / 0.4,
                1
            )
        );
    branchesGroup.children.forEach(
        branch => {
            branch.scale.y =
                branchGrowth;
        }
    );
    // -------------------------------

    // HOJAS

    // -------------------------------
    const leafGrowth =
        Math.max(
            0,
            Math.min(
                (growth - 0.45) / 0.35,
                1
            )
        );
    leaves.forEach(
        leaf => {
            const originalScale =
                leaf.userData.originalScale ||
                1;
            const baseX =
                leaf.position.x;
            const baseY =
                leaf.position.y;
            const baseZ =
                leaf.position.z;
            const s =
                originalScale *
                leafGrowth;
            leaf.scale.set(
                s * 1.3,
                s,
                s * 0.6
            );
        }
    );
    // -------------------------------

    // FLORES

    // -------------------------------
    const flowerGrowth =
        Math.max(
            0,
            Math.min(
                (growth - 0.75) / 0.25,
                1
            )
        );
    flowersGroup.scale.set(
        flowerGrowth,
        flowerGrowth,
        flowerGrowth
    );
    // -------------------------------

    // INTERFAZ

    // -------------------------------
    const percentage =
        Math.round(
            growth * 100
        );
    document.getElementById(
        "growthPercent"
    ).textContent =
        percentage + "%";
    document.getElementById(
        "progress-bar"
    ).style.width =
        percentage + "%";
    const status =
        document.getElementById(
            "growthStatus"
        );
    if (percentage < 25) {
        status.textContent =
            "La planta está desarrollando su tallo.";
    } else if (
        percentage < 50
    ) {
        status.textContent =
            "Las ramas están comenzando a crecer.";
    } else if (
        percentage < 75
    ) {
        status.textContent =
            "Las hojas están apareciendo.";
    } else if (
        percentage < 100
    ) {
        status.textContent =
            "La planta está desarrollando sus flores.";
    } else {
        status.textContent =
            "¡La planta ha completado su crecimiento!";
    }
}

// ANIMACIÓN DEL VIENTO

function updateWind(
    time
) {
    if (
        animationPaused
    ) {
        return;
    }
    const wind =
        Math.sin(
            time * 2
        ) *
        windIntensity *
        0.05;

    // Balanceo del tallo

    stem.rotation.z =
        wind;

    // Balanceo de las ramas

    branchesGroup.children.forEach(
        (branch, index) => {
            branch.rotation.z +=
                Math.sin(
                    time * 2 +
                    index
                ) *
                windIntensity *
                0.01;
        }
    );

    // Balanceo de las hojas

    leaves.forEach(
        (leaf, index) => {
            leaf.rotation.z =
                Math.sin(
                    time * 3 +
                    index
                ) *
                windIntensity *
                0.15;
        }
    );

    // Movimiento de las flores

    flowersGroup.rotation.z =
        Math.sin(
            time * 2
        ) *
        windIntensity *
        0.05;
}

// RAYCASTING

const raycaster =
    new THREE.Raycaster();
const mouse =
    new THREE.Vector2();
window.addEventListener(
    "click",
    function(event) {
        mouse.x =
            (event.clientX /
                window.innerWidth) *
            2 - 1;
        mouse.y =
            -(event.clientY /
                window.innerHeight) *
            2 + 1;
        raycaster.setFromCamera(
            mouse,
            camera
        );
        const objects = [
            stem,
            pot,
            soil,
            ...branchesGroup.children,
            ...leaves
        ];
        flowersGroup.traverse(
            object => {
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
                false
            );
        if (
            intersections.length > 0
        ) {
            const selected =
                intersections[0].object;
            showInformation(
                selected
            );
        }
    }
);

// PANEL DE INFORMACIÓN

function showInformation(
    object
) {
    const panel =
        document.getElementById(
            "info-panel"
        );
    const data =
        object.userData;
    if (
        !data.name
    ) {
        return;
    }
    let growthPercentage =
        Math.round(
            growth * 100
        );
    panel.innerHTML = `
        <h3>${data.name}</h3>
        <p>
            <strong>Estado de crecimiento:</strong>
            ${growthPercentage}%
        </p>
        <p>
            <strong>Geometría:</strong>
            ${data.geometry}
        </p>
        <p>
            <strong>Función:</strong>
            ${data.description}
        </p>
    `;
}

// SLIDER DE VELOCIDAD

const growthSpeedSlider =
    document.getElementById(
        "growthSpeed"
    );
growthSpeedSlider.addEventListener(
    "input",
    function() {
        growthSpeed =
            Number(
                this.value
            );
        document.getElementById(
            "growthSpeedValue"
        ).textContent =
            growthSpeed.toFixed(1);
    }
);

// SLIDER DE VIENTO

const windSlider =
    document.getElementById(
        "windIntensity"
    );
windSlider.addEventListener(
    "input",
    function() {
        windIntensity =
            Number(
                this.value
            );
        document.getElementById(
            "windValue"
        ).textContent =
            windIntensity.toFixed(1);
    }
);

// PAUSAR / REANUDAR

const pauseButton =
    document.getElementById(
        "pauseButton"
    );
pauseButton.addEventListener(
    "click",
    function() {
        animationPaused =
            !animationPaused;
        if (
            animationPaused
        ) {
            this.textContent =
                "Reanudar crecimiento";
        } else {
            this.textContent =
                "Pausar crecimiento";
        }
    }
);

// REINICIAR CRECIMIENTO

const resetButton =
    document.getElementById(
        "resetButton"
    );
resetButton.addEventListener(
    "click",
    function() {
        growth = 0;
        animationPaused =
            false;
        pauseButton.textContent =
            "Pausar crecimiento";
        stem.scale.y = 0;
        branchesGroup.children.forEach(
            branch => {
                branch.scale.y = 0;
            }
        );
        leaves.forEach(
            leaf => {
                leaf.scale.set(
                    0,
                    0,
                    0
                );
            }
        );
        flowersGroup.scale.set(
            0,
            0,
            0
        );
    }
);

// CAMBIAR COLOR DE HOJAS

const leafColorButton =
    document.getElementById(
        "leafColorButton"
    );
leafColorButton.addEventListener(
    "click",
    function() {
        if (
            leavesColorGreen
        ) {
            leafMaterial.color.set(
                0x9acd32
            );
            this.textContent =
                "Hojas verdes";
        } else {
            leafMaterial.color.set(
                0x2e8b57
            );
            this.textContent =
                "Cambiar color de hojas";
        }
        leavesColorGreen =
            !leavesColorGreen;
    }
);

// REINICIAR CÁMARA

const cameraButton =
    document.getElementById(
        "cameraButton"
    );
cameraButton.addEventListener(
    "click",
    function() {
        camera.position.set(
            7,
            5,
            9
        );
        controls.target.set(
            0,
            2.5,
            0
        );
        controls.update();
    }
);

// RELOJ

const clock =
    new THREE.Clock();

// ANIMACIÓN PRINCIPAL

function animate() {
    requestAnimationFrame(
        animate
    );
    const time =
        clock.getElapsedTime();
    updateGrowth();
    updateWind(
        time
    );
    controls.update();
    renderer.render(
        scene,
        camera
    );
}
animate();

// RESIZE

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
