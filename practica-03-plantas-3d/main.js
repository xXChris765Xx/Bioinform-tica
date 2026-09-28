import * as THREE from 'three';

import { OrbitControls } from 'three/addons/controls/OrbitControls.js';


// =====================================================
// ESCENA
// =====================================================

const scene = new THREE.Scene();

scene.background = new THREE.Color(0x87ceeb);


// =====================================================
// CÁMARA
// =====================================================

const camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    100
);

camera.position.set(7, 5, 9);


// =====================================================
// RENDERER
// =====================================================

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


// =====================================================
// CONTROLES ORBIT
// =====================================================

const controls = new OrbitControls(
    camera,
    renderer.domElement
);

controls.enableDamping = true;

controls.target.set(0, 2.5, 0);


// =====================================================
// ILUMINACIÓN
// =====================================================

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


// =====================================================
// SUELO
// =====================================================

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


// =====================================================
// MACETA
// =====================================================

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


// =====================================================
// TIERRA
// =====================================================

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


// =====================================================
// GRUPO PRINCIPAL DE LA PLANTA
// =====================================================

const plant = new THREE.Group();

plant.position.y = 1.5;

scene.add(plant);


// =====================================================
// TALLO PRINCIPAL
// =====================================================

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

stem.userData = {
    name: "Tallo principal",
    geometry: "Cilindro",
    height: "3.75 unidades",
    description: "Sostiene la planta y transporta agua y nutrientes."
};

plant.add(stem);


// =====================================================
// GRUPO DE RAMAS
// =====================================================

const branchesGroup = new THREE.Group();

branchesGroup.position.y = 1.5;

stem.add(branchesGroup);


// =====================================================
// FUNCIÓN PARA CREAR RAMAS
// =====================================================

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

    const branch = new THREE.Mesh(
        branchGeometry,
        branchMaterial
    );

    branch.position.set(
        x,
        y,
        z
    );

    branch.rotation.z = rotationZ;

    branch.userData = {
        name: "Rama",
        geometry: "Cilindro",
        height: `${y + 3.75} unidades`,
        description:
            "Rama secundaria que sostiene hojas y flores."
    };

    branchesGroup.add(branch);

    return branch;
}


// =====================================================
// CREAR RAMAS
// =====================================================

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


// =====================================================
// GRUPO DE HOJAS
// =====================================================

const leavesGroup = new THREE.Group();

plant.add(leavesGroup);


// =====================================================
// MATERIAL DE LAS HOJAS
// =====================================================

let leafMaterial = new THREE.MeshStandardMaterial({
    color: 0x2e8b57,
    roughness: 0.7
});


// =====================================================
// FUNCIÓN PARA CREAR HOJAS
// =====================================================

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
        scale * 1.3,
        scale,
        scale * 0.6
    );

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


// =====================================================
// CREAR HOJAS
// =====================================================

createLeaf(-1.0, 2.5, 0, 1);

createLeaf(1.0, 3.0, 0, 1);

createLeaf(-0.9, 3.7, 0, 0.9);

createLeaf(0.9, 4.1, 0, 0.9);

createLeaf(-0.7, 4.8, 0, 0.8);

createLeaf(0.7, 5.2, 0, 0.8);

createLeaf(0, 5.7, 0, 0.8);


// =====================================================
// GRUPO DE FLORES
// =====================================================

const flowersGroup = new THREE.Group();

plant.add(flowersGroup);


// =====================================================
// FUNCIÓN PARA CREAR FLORES
// =====================================================

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


// =====================================================
// CREAR FLORES
// =====================================================

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


// =====================================================
// RAYCASTING
// =====================================================

const raycaster =
    new THREE.Raycaster();

const mouse =
    new THREE.Vector2();


// =====================================================
// CLICK DEL MOUSE
// =====================================================

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
        ...leavesGroup.children
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


// =====================================================
// MOSTRAR INFORMACIÓN
// =====================================================

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


// =====================================================
// CONTROL DE ANIMACIÓN
// =====================================================

let animationEnabled = true;

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
                "Detener animación";

        } else {

            animationButton.textContent =
                "Activar animación";
        }
    }
);


// =====================================================
// CAMBIAR COLOR DE HOJAS
// =====================================================

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
                0x6b8e23
            );

        } else {

            leafMaterial.color.set(
                0x2e8b57
            );
        }


        greenLeaves =
            !greenLeaves;
    }
);


// =====================================================
// REINICIAR CÁMARA
// =====================================================

const resetCameraButton =
    document.getElementById(
        "resetCameraButton"
    );


resetCameraButton.addEventListener(
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


// =====================================================
// CONTROL DE INTENSIDAD DE LUZ
// =====================================================

const lightIntensity =
    document.getElementById(
        "lightIntensity"
    );


lightIntensity.addEventListener(
    "input",
    function() {

        directionalLight.intensity =
            Number(
                lightIntensity.value
            );
    }
);


// =====================================================
// MOSTRAR / OCULTAR HOJAS
// =====================================================

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


        if (leavesVisible) {

            leafVisibilityButton.textContent =
                "Ocultar hojas";

        } else {

            leafVisibilityButton.textContent =
                "Mostrar hojas";
        }
    }
);


// =====================================================
// ANIMACIÓN
// =====================================================

const clock =
    new THREE.Clock();


function animate() {

    requestAnimationFrame(
        animate
    );


    const time =
        clock.getElapsedTime();


    if (animationEnabled) {

        plant.rotation.z =
            Math.sin(time * 1.5) *
            0.04;


        flowersGroup.rotation.y =
            time * 0.5;
    }


    controls.update();


    renderer.render(
        scene,
        camera
    );
}


animate();


// =====================================================
// AJUSTAR VENTANA
// =====================================================

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