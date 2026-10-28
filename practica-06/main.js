import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createGeoGlobe } from './geo-globe.js';
import {
    calculateStress,
    createInitialState,
    stepSimulation
} from './simulation.js';

const API_BASE = 'http://127.0.0.1:8000/api';
const FALLBACK_SPECIES = {
    id: 1,
    nombre_comun: 'Limonero',
    nombre_cientifico: 'Citrus limon',
    temperatura_min_c: 17,
    temperatura_max_c: 28,
    humedad_min_pct: 50,
    humedad_max_pct: 70,
    luz_min_horas: 6,
    luz_optima_horas: 10,
    hidratacion_min_pct: 30,
    ph_min: 6,
    ph_max: 7,
    r: 0.0025,
    capacidad_carga: 1,
    dias_madurez: 1095
};

const $ = (id) => document.getElementById(id);
const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, value));
const number = (id) => Number($(id).value);
const formatNumber = (value, digits = 0) => Number(value ?? 0).toLocaleString('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const initialConditions = { temperatureC: 25, humidityPct: 60, sunHours: 8, windKmh: 10, irrigationLWeek: 80, soilPh: 6.5 };
function fillSpeciesSelect(select, selectedId) {
    select.innerHTML = speciesCatalog.map((item) => `<option value="${item.id}" ${Number(item.id) === Number(selectedId) ? 'selected' : ''}>${escapeHtml(item.nombre_comun)} · ${escapeHtml(item.nombre_cientifico)}</option>`).join('');
}

let species = FALLBACK_SPECIES;
let simulationId = null;
let simulationRunning = false;
let viewingHistory = false;
let state = createInitialState({ initialAgeDays: 1825, initialHeightCm: 250, initialBiomassG: 18000, initialHealthPct: 90, initialSoilMoisturePct: 75 });
let stateHistory = [];
let chartGrowth = null;
let chartTimeline = null;
let selectedObject = null;
let frameTime = 0;
let simulationWriteQueue = Promise.resolve();
let apiOnline = false;
let speciesCatalog = [FALLBACK_SPECIES];
let geoGlobe = null;
let activeGeoData = null;
let geoSiteA = null;
let geoSiteB = null;
let geoDataAppliedToSimulation = false;
let geoOccurrenceRequestId = 0;
let geoHotspots = [];
let geoHotspotsLoading = false;

// ── Visor Three.js: limonero procedural con jerarquía, viento y raycasting ──
const sceneHost = $('scene');
const scene = new THREE.Scene();
const skyColor = new THREE.Color(0x9ac8c5);
scene.background = skyColor.clone();
scene.fog = new THREE.Fog(0x9ac8c5, 28, 75);
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 120);
camera.position.set(9, 8, 13);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setSize(sceneHost.clientWidth, sceneHost.clientHeight);
sceneHost.appendChild(renderer.domElement);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.target.set(0, 2.5, 0);
orbit.minDistance = 5;
orbit.maxDistance = 22;

scene.add(new THREE.HemisphereLight(0xe4f0dc, 0x596343, 2.0));
const sunLight = new THREE.DirectionalLight(0xfff1ca, 2.6);
sunLight.position.set(-5, 12, 7);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(1024, 1024);
scene.add(sunLight);

const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    new THREE.MeshStandardMaterial({ color: 0x829c57, roughness: 1 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.12;
ground.receiveShadow = true;
scene.add(ground);

// Orchard rows give the focal tree a citrus grove context.
const orchard = new THREE.Group();
scene.add(orchard);
const orchardTrunkMaterial = new THREE.MeshStandardMaterial({ color: 0x765238, roughness: 1 });
const orchardLeafMaterials = [0x416f3c, 0x4f8042, 0x608a49].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 0.92 }));
for (let row = -2; row <= 2; row += 1) {
    for (let col = -3; col <= 3; col += 1) {
        if (row === 0 && col === 0) continue;
        const x = col * 5 + ((row + col) % 2) * 1.1;
        const z = row * 5.2 - 2;
        const size = 0.63 + ((Math.abs(row * 3 + col) % 4) * 0.055);
        const tree = new THREE.Group();
        tree.position.set(x, 0, z);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * size, 0.2 * size, 2.2 * size, 8), orchardTrunkMaterial);
        trunk.position.y = 1.1 * size;
        trunk.castShadow = true;
        tree.add(trunk);
        for (let i = 0; i < 5; i += 1) {
            const crown = new THREE.Mesh(new THREE.SphereGeometry(0.8 * size, 10, 8), orchardLeafMaterials[i % orchardLeafMaterials.length]);
            crown.position.set(((i % 3) - 1) * 0.42 * size, (2.2 + Math.floor(i / 3) * 0.48) * size, (i % 2 ? 0.28 : -0.22) * size);
            crown.scale.set(1.1, 0.82, 0.94);
            crown.castShadow = true;
            tree.add(crown);
        }
        tree.userData.windPhase = (row + 3) * 0.8 + col * 0.6;
        orchard.add(tree);
    }
}

const tree = new THREE.Group();
scene.add(tree);
const clickableParts = [];
const branchPivots = [];
const leaves = [];
const lemons = [];
const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x765238, roughness: 0.85 });
const branchMaterial = new THREE.MeshStandardMaterial({ color: 0x59703a, roughness: 0.82 });
const leafMaterial = new THREE.MeshStandardMaterial({ color: 0x397a3e, roughness: 0.77, side: THREE.DoubleSide });
const fruitMaterial = new THREE.MeshStandardMaterial({ color: 0xf2ce43, roughness: 0.58 });

const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 4.4, 14), trunkMaterial);
trunk.position.y = 2.2;
trunk.castShadow = true;
trunk.receiveShadow = true;
trunk.userData = { name: 'Tronco principal', geometry: 'Cilindro', role: 'stem', description: 'Sostiene la copa y transporta agua y nutrientes desde las raíces.' };
tree.add(trunk);
clickableParts.push(trunk);

function createBranch(x, y, z, rotationZ, length, index) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.rotation.z = rotationZ;
    pivot.userData.baseRotation = rotationZ;
    pivot.userData.windPhase = index * 0.83;
    tree.add(pivot);
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.12, length, 10), branchMaterial);
    branch.position.y = length * 0.48;
    branch.rotation.z = -0.1;
    branch.castShadow = true;
    branch.userData = { name: `Rama ${index + 1}`, geometry: 'Cilindro', role: 'branch', description: 'Rama secundaria que sostiene hojas, flores y frutos.' };
    pivot.add(branch);
    branchPivots.push(pivot);
    clickableParts.push(branch);
    return pivot;
}

const limbs = [
    [-0.1, 2.25, 0, -0.96, 2.2], [0.12, 2.65, 0.05, 0.9, 2.15],
    [-0.08, 3.08, -0.05, -0.78, 1.95], [0.12, 3.52, 0.03, 0.73, 1.8],
    [0, 3.86, 0, -0.28, 1.55], [-0.05, 2.82, -0.1, -1.2, 1.5]
];
const limbPivots = limbs.map((args, index) => createBranch(...args, index));

const leafGeometry = new THREE.SphereGeometry(0.5, 14, 12);
const leafLocations = [
    [-1.65, 3.15, 0.1, 0.95], [-1.28, 3.8, 0.36, 0.82], [-0.78, 4.22, 0.3, 0.82],
    [-0.18, 4.56, 0.25, 0.84], [0.62, 4.3, 0.32, 0.86], [1.25, 3.82, 0.2, 0.92],
    [1.62, 3.28, -0.05, 0.78], [1.15, 2.95, 0.42, 0.9], [0.54, 3.34, 0.56, 0.92],
    [-0.56, 3.5, 0.54, 0.82], [-1.25, 3.18, -0.44, 0.82], [-0.75, 4.05, -0.55, 0.88],
    [0.08, 4.42, -0.48, 0.86], [0.9, 4.06, -0.46, 0.85], [1.42, 3.45, -0.52, 0.8],
    [-0.2, 2.75, 0.52, 0.8], [0.72, 2.74, -0.42, 0.82], [-1.48, 3.7, -0.18, 0.76],
    [0.12, 3.84, 0.7, 0.9], [1.56, 3.92, 0.02, 0.82], [-0.88, 4.45, -0.06, 0.7],
    [0.9, 4.48, 0.02, 0.73], [-1.7, 2.9, 0.38, 0.67], [1.78, 2.98, -0.3, 0.68]
];
leafLocations.forEach(([x, y, z, size], index) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    pivot.userData.windPhase = index * 0.47;
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
    leaf.scale.set(size * 1.35, size * 0.56, size * 0.19);
    leaf.rotation.z = ((index % 2) ? 1 : -1) * 0.28;
    leaf.castShadow = true;
    leaf.userData = { name: `Hoja ${index + 1}`, geometry: 'Esfera aplanada', role: 'leaf', description: 'Realiza fotosíntesis; el color refleja el estado nutricional y la salud.' };
    pivot.add(leaf);
    tree.add(pivot);
    leaves.push({ pivot, mesh: leaf });
    clickableParts.push(leaf);
});

function makeLemonGeometry() {
    const points = [
        new THREE.Vector2(0.02, -0.42), new THREE.Vector2(0.12, -0.34),
        new THREE.Vector2(0.21, -0.16), new THREE.Vector2(0.25, 0),
        new THREE.Vector2(0.21, 0.16), new THREE.Vector2(0.12, 0.34),
        new THREE.Vector2(0.02, 0.42)
    ];
    return new THREE.LatheGeometry(points, 14);
}
const lemonGeometry = makeLemonGeometry();
const fruitLocations = [
    [-1.05, 2.92, 0.48], [-0.45, 3.55, 0.72], [0.42, 3.95, 0.66], [1.1, 3.38, 0.48],
    [1.42, 2.9, -0.2], [-1.35, 3.52, -0.2], [0.55, 3.06, -0.62], [-0.25, 4.14, -0.28]
];
fruitLocations.forEach(([x, y, z], index) => {
    const fruit = new THREE.Mesh(lemonGeometry, fruitMaterial);
    fruit.position.set(x, y, z);
    fruit.rotation.z = index % 2 ? 0.2 : -0.18;
    fruit.rotation.x = index % 2 ? 0.15 : -0.1;
    fruit.scale.setScalar(0);
    fruit.castShadow = true;
    fruit.userData = { name: `Limón ${index + 1}`, geometry: 'LatheGeometry', role: 'fruit', description: 'Fruto estimado por el escenario; su cantidad cambia con edad y estrés.' };
    tree.add(fruit);
    lemons.push(fruit);
    clickableParts.push(fruit);
});

const soilRing = new THREE.Mesh(new THREE.TorusGeometry(1.25, 0.055, 10, 48), new THREE.MeshStandardMaterial({ color: 0x54a7cf, emissive: 0x183d56, roughness: 0.4 }));
soilRing.rotation.x = Math.PI / 2;
soilRing.position.y = 0.04;
tree.add(soilRing);
const soil = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.13, 32), new THREE.MeshStandardMaterial({ color: 0x513a27, roughness: 1 }));
soil.position.y = 0;
tree.add(soil);

// Usa el espantapájaros incluido en models y normaliza su altura para el visor.
new GLTFLoader().load(new URL('./models/espantapajaros__scarecrow.glb', import.meta.url).href, (gltf) => {
    const scarecrow = gltf.scene;
    const bounds = new THREE.Box3().setFromObject(scarecrow);
    const size = bounds.getSize(new THREE.Vector3());
    if (size.y > 0) scarecrow.scale.setScalar(2.8 / size.y);
    const scaledBounds = new THREE.Box3().setFromObject(scarecrow);
    scarecrow.position.set(2.8, -scaledBounds.min.y, 1.1);
    scarecrow.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
        object.userData = {
            ...object.userData,
            name: 'Espantapájaros',
            geometry: object.geometry?.type ?? 'Modelo 3D',
            role: 'scarecrow',
            description: 'Modelo 3D del espantapájaros del huerto.'
        };
        clickableParts.push(object);
    });
    scene.add(scarecrow);
}, undefined, (error) => console.warn('No se pudo cargar el modelo del espantapájaros.', error));

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
renderer.domElement.addEventListener('click', (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(clickableParts, false)[0];
    if (hit) {
        selectedObject = hit.object;
        renderInspector(selectedObject);
    }
});

function renderInspector(object) {
    if (!object) return;
    const role = object.userData.role;
    const stress = state.stress ?? calculateStress(readEnvironment(), state.nutrients, species);
    const relevantStress = role === 'leaf' ? stress.nutrients : role === 'fruit' ? Math.max(stress.water, stress.heat) : stress.total;
    const contribution = role === 'fruit' ? 0.035 : role === 'leaf' ? 0.008 : role === 'branch' ? 0.06 : role === 'scarecrow' ? 0 : 0.2;
    const panel = $('selectedInfo');
    panel.innerHTML = `<span class="eyebrow">INSPECTOR 3D</span><h2>${object.userData.name}</h2><p>${object.userData.description}</p><div class="selected-metrics"><div><span>Especie</span><strong>${species.nombre_cientifico}</strong></div><div><span>Crecimiento</span><strong>${formatNumber(state.growthPct ?? 0)} %</strong></div><div><span>Geometría</span><strong>${object.userData.geometry}</strong></div><div><span>Estrés asociado</span><strong>${formatNumber(relevantStress)} / 100</strong></div><div><span>Biomasa estimada</span><strong>${formatNumber(state.biomassG * contribution, 0)} g</strong></div><div><span>Frutos estimados</span><strong>${formatNumber(state.fruits)}</strong></div></div>`;
}

function readEnvironment(waterOverride = null) {
    return {
        temperatureC: number('temperatureInput'),
        humidityPct: number('humidityInput'),
        sunHours: number('lightInput'),
        co2Ppm: number('co2Input'),
        windKmh: number('windInput'),
        irrigationLWeek: waterOverride ?? number('waterInput'),
        soilPh: number('phInput'),
        fertilizer: { N: number('nitrogenInput') / 100, P: number('phosphorusInput') / 100, K: number('potassiumInput') / 100, Fe: number('ironInput') / 100 }
    };
}

function readInitial() {
    return { initialAgeDays: 1825, initialHeightCm: 250, initialBiomassG: 18000, initialHealthPct: 90, initialSoilMoisturePct: 75, initialFlowers: 0, initialFruits: 0, nutrients: { N: number('nitrogenInput'), P: number('phosphorusInput'), K: number('potassiumInput'), Fe: number('ironInput') } };
}

function getModelParameters() {
    return { r: number('rateInput'), K: number('capacityInput'), t0: Number(species.dias_madurez ?? 1095), maxHeightCm: 400, maxBiomassG: 80000 };
}

// ── Three.js ← estado de la simulación ──
function colorForPlantHealth() {
    const iron = state.nutrients.Fe;
    const nitrogen = state.nutrients.N;
    if (iron < 40 || nitrogen < 40) return 0xb7a84e;
    if (state.healthPct < 45) return 0x79543b;
    if (state.healthPct < 70) return 0x7f9944;
    return 0x397a3e;
}

function applyPlantState() {
    const size = clamp(state.heightCm / 300, 0.22, 1.55);
    tree.scale.setScalar(size);
    const mature = state.ageDays >= 1095;
    const branchGrowth = mature ? 1 : clamp((state.growthPct ?? 0) / 52, 0.12, 1);
    branchPivots.forEach((pivot) => {
        const breeze = frameTime * 1.2 + pivot.userData.windPhase;
        pivot.rotation.z = pivot.userData.baseRotation + Math.sin(breeze) * 0.035 * number('windInput') / 30;
        const limb = pivot.children[0];
        limb.scale.y = branchGrowth;
        limb.position.y = limb.geometry.parameters.height * 0.48 * branchGrowth;
    });
    const leafColor = new THREE.Color(colorForPlantHealth());
    leafMaterial.color.copy(leafColor);
    leaves.forEach(({ pivot, mesh }, index) => {
        const phase = frameTime * 1.5 + pivot.userData.windPhase;
        pivot.rotation.z = Math.sin(phase) * 0.055 * number('windInput') / 30;
        const developed = mature ? 1 : clamp((state.growthPct ?? 0) / 40, 0.15, 1);
        mesh.visible = state.ageDays > 15;
        mesh.scale.set(1.35 * developed, 0.56 * developed, 0.19);
        mesh.rotation.z = Math.sin(phase + index) * 0.1;
    });
    const fruitCapacity = Math.max(1, state.fruitPotential ?? 300);
    const visibleFruitCount = state.fruits > 0 ? Math.min(lemons.length, Math.ceil((state.fruits / fruitCapacity) * lemons.length)) : 0;
    const fruitScale = 0.18 + 0.82 * clamp(state.fruitDevelopment ?? 0);
    lemons.forEach((fruit, index) => {
        fruit.visible = index < visibleFruitCount;
        fruit.scale.setScalar(fruit.visible ? fruitScale * (0.88 + (index % 3) * 0.06) : 0);
        fruit.rotation.z += Math.sin(frameTime + index) * 0.0005 * number('windInput');
    });
    soilRing.material.color.set(state.soilMoisturePct < 30 ? 0xe6745b : state.soilMoisturePct < 55 ? 0xe1be4f : 0x54a7cf);
    soil.material.color.set(state.soilMoisturePct < 30 ? 0x654433 : 0x513a27);
    sunLight.intensity = 0.7 + number('lightInput') / 8;
}

// ── Indicadores, gráficas y recomendaciones ──
function setMeter(name, value) {
    const amount = clamp(value);
    $(`${name}StressBar`).style.width = `${amount}%`;
    $(`${name}StressValue`).textContent = formatNumber(amount);
}

function renderState({ record = false } = {}) {
    const environment = readEnvironment();
    if (!viewingHistory) state.stress = calculateStress({ ...environment, soilMoisturePct: state.soilMoisturePct }, state.nutrients, species);
    $('dayBadge').textContent = `Día ${formatNumber(state.day)}`;
    $('heightKpi').textContent = `${formatNumber(state.heightCm)} cm`;
    $('biomassKpi').textContent = `${formatNumber(state.biomassG / 1000, 1)} kg`;
    $('healthKpi').textContent = `${formatNumber(state.healthPct)} %`;
    $('waterKpi').textContent = `${formatNumber(state.soilMoisturePct)} %`;
    $('partsKpi').textContent = `${formatNumber(state.leaves)} / ${formatNumber(state.branches)}`;
    $('icrKpi').textContent = `${formatNumber(state.icr, 2)} %`;
    $('fruitKpi').textContent = `${formatNumber(state.flowers)} / ${formatNumber(state.fruits)}`;
    const maturityAge = Number(species.dias_madurez);
    const daysAfterMaturity = Math.min(state.day, Math.max(0, state.ageDays - maturityAge));
    const harvestDays = state.ageDays < maturityAge
        ? maturityAge - state.ageDays + 148
        : Math.max(0, 148 - daysAfterMaturity);
    $('harvestKpi').textContent = state.fruitDevelopment >= 1 && state.fruits > 0 ? 'Listo' : `${formatNumber(harvestDays)} d`;
    $('stageBadge').textContent = `Etapa: ${state.stage ?? stageName(state.ageDays)}`;
    $('stressBadge').textContent = `Estrés: ${formatNumber(state.stress.total)} / 100`;
    setMeter('water', state.stress.water);
    setMeter('heat', state.stress.heat);
    setMeter('light', state.stress.light);
    setMeter('nutrient', state.stress.nutrients);
    const recommendation = state.recommendation ?? { priority: 'info', text: 'Mantener las condiciones y observar el crecimiento.' };
    $('recommendationText').textContent = recommendation.text;
    $('recommendationCard').classList.toggle('warning', recommendation.priority === 'aviso');
    $('recommendationCard').classList.toggle('critical', recommendation.priority === 'critica');
    applyPlantState();
    if (selectedObject) renderInspector(selectedObject);
    if (record) {
        const point = { ...state, stress: { ...state.stress } };
        const existingIndex = stateHistory.findIndex((entry) => entry.day === point.day);
        if (existingIndex >= 0) stateHistory[existingIndex] = point;
        else stateHistory.push(point);
        stateHistory.sort((a, b) => a.day - b.day);
        addGrowthPoint(point);
        updateTimelineControls();
    }
}

function stageName(ageDays) {
    if (ageDays < 21) return 'germinación';
    if (ageDays < 183) return 'plántula';
    if (ageDays < 1095) return 'juvenil';
    return 'adulto';
}

function initCharts() {
    if (!window.Chart) return;
    Chart.defaults.color = '#93a797';
    Chart.defaults.font.family = 'DM Sans, sans-serif';
    chartGrowth = new Chart($('growthChart'), {
        type: 'line',
        data: { labels: [0], datasets: [
            { label: 'Biomasa (kg)', data: [state.biomassG / 1000], borderColor: '#a8d65e', backgroundColor: 'rgba(168,214,94,.12)', fill: true, tension: .3, yAxisID: 'y' },
            { label: 'Altura (cm)', data: [state.heightCm], borderColor: '#74bdd0', backgroundColor: 'transparent', tension: .3, yAxisID: 'y1' }
        ] },
        options: { responsive: true, maintainAspectRatio: false, animation: false, plugins: { legend: { labels: { boxWidth: 9, usePointStyle: true, pointStyle: 'circle', font: { size: 9 } } } }, scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 5, font: { size: 8 } } }, y: { beginAtZero: true, grid: { color: 'rgba(220,240,220,.07)' }, ticks: { font: { size: 8 } } }, y1: { position: 'right', beginAtZero: true, grid: { display: false }, ticks: { font: { size: 8 } } } } }
    });
    chartTimeline = new Chart($('timelineChart'), {
        type: 'line',
        data: { labels: [], datasets: [
            { label: 'Biomasa (kg)', data: [], borderColor: '#a8d65e', backgroundColor: 'rgba(168,214,94,.1)', fill: true, tension: .32, pointRadius: 1, pointHoverRadius: 4 }
        ] },
        options: {
            responsive: true, maintainAspectRatio: false, animation: false,
            onClick: (_event, elements) => { if (elements.length) seekTimeline(elements[0].index); },
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false }, ticks: { maxTicksLimit: 5, font: { size: 8 } } }, y: { beginAtZero: true, grid: { color: 'rgba(220,240,220,.07)' }, ticks: { font: { size: 8 } } } }
        }
    });
}

function addGrowthPoint(point) {
    if (!chartGrowth) return;
    chartGrowth.data.labels.push(point.day);
    chartGrowth.data.datasets[0].data.push(Number((point.biomassG / 1000).toFixed(2)));
    chartGrowth.data.datasets[1].data.push(Number(point.heightCm.toFixed(1)));
    if (chartTimeline) {
        chartTimeline.data.labels.push(point.day);
        chartTimeline.data.datasets[0].data.push(Number((point.biomassG / 1000).toFixed(2)));
        chartTimeline.update('none');
    }
    chartGrowth.update('none');
}

function resetGrowthChart() {
    if (!chartGrowth) return;
    const hasHistory = stateHistory.length > 0;
    chartGrowth.data.labels = hasHistory ? [] : [state.day];
    chartGrowth.data.datasets[0].data = hasHistory ? [] : [state.biomassG / 1000];
    chartGrowth.data.datasets[1].data = hasHistory ? [] : [state.heightCm];
    chartGrowth.update('none');
    if (chartTimeline) {
        chartTimeline.data.labels = hasHistory ? [] : [state.day];
        chartTimeline.data.datasets[0].data = hasHistory ? [] : [Number((state.biomassG / 1000).toFixed(2))];
        chartTimeline.update('none');
    }
}

function updateTimelineControls() {
    const slider = $('timelineInput');
    if (!slider) return;
    const selectedIndex = Math.max(0, stateHistory.findIndex((point) => point.day === state.day));
    slider.max = String(Math.max(0, stateHistory.length - 1));
    slider.value = String(selectedIndex);
    $('timelineOutput').textContent = `Día ${formatNumber(state.day)}`;
    $('timelineHint').textContent = stateHistory.length > 1
        ? `${stateHistory.length} puntos disponibles · arrastra para volver a un día anterior o avanzar.`
        : 'Avanza la simulación para generar puntos en la línea de tiempo.';
}

function seekTimeline(index) {
    if (!stateHistory.length) return;
    const point = stateHistory[clamp(Number(index), 0, stateHistory.length - 1)];
    if (!point) return;
    simulationRunning = false;
    viewingHistory = true;
    tickAccumulator = 0;
    const startAgeDays = state.startAgeDays ?? 1825;
    state = {
        ...state,
        ...point,
        stress: { ...point.stress, total: point.stress.total ?? (point.stress.water + point.stress.heat + point.stress.light + point.stress.nutrients) / 4 },
        ageDays: startAgeDays + point.day,
        stage: stageName(startAgeDays + point.day),
        growthPct: point.growthPct ?? 100,
        icr: point.icr ?? 0
    };
    const latestDay = stateHistory[stateHistory.length - 1]?.day ?? point.day;
    $('runButton').textContent = point.day < latestDay ? '▶ Reanudar desde aquí' : '▶ Reanudar';
    const labels = stateHistory.map((entry) => entry.day);
    if (chartGrowth) {
        chartGrowth.data.labels = labels;
        chartGrowth.data.datasets[0].data = stateHistory.map((entry) => Number((entry.biomassG / 1000).toFixed(2)));
        chartGrowth.data.datasets[1].data = stateHistory.map((entry) => Number(entry.heightCm.toFixed(1)));
        chartGrowth.update('none');
    }
    if (chartTimeline) {
        chartTimeline.data.labels = labels;
        chartTimeline.data.datasets[0].data = stateHistory.map((entry) => Number((entry.biomassG / 1000).toFixed(2)));
        chartTimeline.update('none');
    }
    $('timelineInput').value = String(stateHistory.indexOf(point));
    $('timelineOutput').textContent = `Día ${formatNumber(point.day)}`;
    renderState();
}

// ── API REST, persistencia e historial ──
async function apiRequest(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers ?? {}) }
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error ?? `Error API ${response.status}`);
    return body;
}

function setApiStatus(connected, text) {
    apiOnline = connected;
    $('connectionState').textContent = text;
    $('connectionDot').parentElement.classList.toggle('connected', connected);
    $('connectionDot').parentElement.classList.toggle('disconnected', !connected);
}

async function connectApi() {
    try {
        await apiRequest('/health');
        setApiStatus(true, 'API y MySQL conectados');
    } catch (error) {
        setApiStatus(false, 'Sin conexión · modo local');
        console.warn('API no disponible; se mantiene la simulación local.', error);
    }
    try {
        const catalog = await apiRequest('/especies');
        if (catalog.length) speciesCatalog = catalog;
        const lemon = catalog.find((item) => item.nombre_cientifico === 'Citrus limon');
        if (lemon) {
            species = lemon;
            fillSpeciesSelect($('speciesSelect'), lemon.id);
            fillSpeciesSelect($('geoSpeciesSelect'), lemon.id);
            $('rateInput').value = Number(lemon.r).toFixed(4);
            $('capacityInput').value = Number(lemon.capacidad_carga).toFixed(1);
        } else {
            $('speciesSelect').innerHTML = `<option value="1">Limonero · Citrus limon (local)</option>`;
            fillSpeciesSelect($('geoSpeciesSelect'), species.id);
        }
    } catch {
        $('speciesSelect').innerHTML = `<option value="1">Limonero · Citrus limon (local)</option>`;
        fillSpeciesSelect($('geoSpeciesSelect'), species.id);
    }
    renderState();
    refreshHistory();
}

function apiConditions(environment) {
    return {
        temperatura_c: environment.temperatureC,
        humedad_ambiental_pct: environment.humidityPct,
        luz_horas: environment.sunHours,
        co2_ppm: environment.co2Ppm,
        viento_kmh: environment.windKmh,
        riego_litros_semana: environment.irrigationLWeek,
        ph_suelo: environment.soilPh,
        hidratacion_inicial_pct: state.soilMoisturePct,
        nutrientes: state.nutrients
    };
}

async function createStoredSimulation() {
    if (!apiOnline) return null;
    const environment = readEnvironment();
    const created = await apiRequest('/simulaciones', {
        method: 'POST',
        body: JSON.stringify({
            especieId: Number($('speciesSelect').value || species.id),
            nombre: $('runName').value.trim() || 'Simulación de limonero',
            notas: 'Corrida creada desde el Laboratorio BioCultivo.',
            modelo: $('modelSelect').value,
            diasPlaneados: clamp(number('durationInput'), 7, 3650),
            condiciones: apiConditions(environment),
            parametros: getModelParameters(),
            edadInicialDias: state.ageDays,
            alturaInicialCm: state.heightCm,
            biomasaInicialG: state.biomassG,
            saludInicialPct: state.healthPct
        })
    });
    if (activeGeoData && geoDataAppliedToSimulation) {
        try {
            await apiRequest('/geo/analyses', { method: 'POST', body: JSON.stringify({
                lat: activeGeoData.coordinates.lat, lon: activeGeoData.coordinates.lon,
                nombre: activeGeoData.place, especieId: Number($('speciesSelect').value || 0) || null,
                simulacionId: created.id, data: activeGeoData
            }) });
            $('geoSaveStatus').textContent = `Análisis vinculado a la simulación #${created.id}.`;
            geoDataAppliedToSimulation = false;
        } catch (error) { console.warn('No se pudo asociar el análisis geográfico a la simulación.', error); }
    }
    return created.id;
}

function measurementPayload(current) {
    return {
        dia: current.day,
        alturaCm: Number(current.heightCm.toFixed(2)),
        biomasaG: Number(current.biomassG.toFixed(2)),
        hojas: current.leaves,
        ramas: current.branches,
        flores: current.flowers,
        frutos: current.fruits,
        saludPct: Number(current.healthPct.toFixed(2)),
        hidratacionPct: Number(current.soilMoisturePct.toFixed(2)),
        estresHidrico: Number(current.stress.water.toFixed(2)),
        estresTermico: Number(current.stress.heat.toFixed(2)),
        estresLuminico: Number(current.stress.light.toFixed(2)),
        estresNutricional: Number(current.stress.nutrients.toFixed(2)),
        nutrientes: current.nutrients
    };
}

function persistCurrentState() {
    if (!apiOnline || !simulationId) return;
    const payload = measurementPayload(state);
    simulationWriteQueue = simulationWriteQueue
        .then(() => apiRequest(`/simulaciones/${simulationId}/mediciones`, { method: 'POST', body: JSON.stringify(payload) }))
        .then(() => refreshHistory())
        .catch((error) => {
            setApiStatus(false, 'Error guardando datos');
            console.error('No se pudo guardar la medición.', error);
        });
}

async function refreshHistory() {
    if (!apiOnline) return;
    try {
        const runs = await apiRequest('/simulaciones');
        $('historySelect').innerHTML = runs.length
            ? runs.map((run) => `<option value="${run.id}">${escapeHtml(run.nombre)} · ${escapeHtml(run.especie)} · ${run.estado}</option>`).join('')
            : '<option value="">Todavía no hay corridas guardadas</option>';
        fillReportHistory(runs);
    } catch (error) {
        console.warn('No se pudo actualizar el historial.', error);
    }
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function parseStoredJson(value) {
    if (!value) return {};
    if (typeof value === 'object') return value;
    try { return JSON.parse(value); } catch { return {}; }
}

function setControlValue(id, value) {
    if (value === undefined || value === null || !$(id)) return;
    $(id).value = value;
    $(id).dispatchEvent(new Event('input', { bubbles: true }));
}

async function loadStoredSimulation() {
    const id = Number($('historySelect').value);
    if (!id) return;
    try {
        const saved = await apiRequest(`/simulaciones/${id}`);
        const conditions = parseStoredJson(saved.condiciones);
        const parameters = parseStoredJson(saved.parametros);
        const storedSpecies = await apiRequest('/especies');
        const matchingSpecies = storedSpecies.find((item) => Number(item.id) === Number(saved.especie_id));
        if (matchingSpecies) {
            species = matchingSpecies;
            fillSpeciesSelect($('speciesSelect'), species.id);
            fillSpeciesSelect($('geoSpeciesSelect'), species.id);
        }
        simulationId = id;
        simulationRunning = false;
        viewingHistory = false;
        $('runButton').textContent = '▶ Reanudar';
        $('modelSelect').value = saved.modelo;
        $('runName').value = saved.nombre;
        setControlValue('durationInput', saved.dias_planeados);
        setControlValue('temperatureInput', conditions.temperatura_c);
        setControlValue('humidityInput', conditions.humedad_ambiental_pct);
        setControlValue('lightInput', conditions.luz_horas);
        setControlValue('co2Input', conditions.co2_ppm);
        setControlValue('windInput', conditions.viento_kmh);
        setControlValue('waterInput', conditions.riego_litros_semana);
        setControlValue('phInput', conditions.ph_suelo);
        setControlValue('rateInput', parameters.r);
        setControlValue('capacityInput', parameters.K);
        const measurements = saved.mediciones ?? [];
        if (measurements.length) {
            const last = measurements[measurements.length - 1];
            const first = measurements[0];
            const initialNutrients = parseStoredJson(first.nutrientes ?? conditions.nutrientes);
            for (const [key, inputId] of Object.entries({ N: 'nitrogenInput', P: 'phosphorusInput', K: 'potassiumInput', Fe: 'ironInput' })) {
                if (initialNutrients[key] !== undefined) $(inputId).value = initialNutrients[key];
            }
            state = {
                ...state,
                day: Number(last.dia),
                ageDays: Number(saved.edad_inicial_dias) + Number(last.dia),
                startAgeDays: Number(saved.edad_inicial_dias),
                heightCm: Number(last.altura_cm),
                startHeightCm: Number(saved.altura_inicial_cm),
                biomassG: Number(last.biomasa_g),
                startBiomassG: Number(saved.biomasa_inicial_g),
                healthPct: Number(last.salud_pct),
                soilMoisturePct: Number(last.hidratacion_pct),
                leaves: Number(last.hojas), branches: Number(last.ramas), flowers: Number(last.flores), fruits: Number(last.frutos),
                nutrients: typeof last.nutrientes === 'string' ? JSON.parse(last.nutrientes) : (last.nutrientes ?? state.nutrients),
                fruitDevelopment: clamp((Math.min(Number(last.dia), Math.max(0, Number(saved.edad_inicial_dias) + Number(last.dia) - 1095)) - 28) / 120, 0, 1),
                fruitPotential: Math.max(Number(last.frutos), 300),
                stress: { water: Number(last.estres_hidrico), heat: Number(last.estres_termico), light: Number(last.estres_luminico), nutrients: Number(last.estres_nutricional), total: 0 },
                stage: stageName(Number(saved.edad_inicial_dias) + Number(last.dia)), growthPct: 100, icr: 0
            };
            state.stress.total = (state.stress.water + state.stress.heat + state.stress.light + state.stress.nutrients) / 4;
            stateHistory = measurements.map((measurement) => ({
                day: Number(measurement.dia), heightCm: Number(measurement.altura_cm), biomassG: Number(measurement.biomasa_g),
                leaves: Number(measurement.hojas), branches: Number(measurement.ramas), flowers: Number(measurement.flores), fruits: Number(measurement.frutos),
                healthPct: Number(measurement.salud_pct), soilMoisturePct: Number(measurement.hidratacion_pct),
                nutrients: parseStoredJson(measurement.nutrientes ?? conditions.nutrientes),
                ageDays: Number(saved.edad_inicial_dias) + Number(measurement.dia),
                fruitDevelopment: clamp((Math.min(Number(measurement.dia), Math.max(0, Number(saved.edad_inicial_dias) + Number(measurement.dia) - 1095)) - 28) / 120, 0, 1),
                fruitPotential: Math.max(Number(measurement.frutos), 300),
                stage: stageName(Number(saved.edad_inicial_dias) + Number(measurement.dia)), growthPct: 100, icr: 0,
                stress: {
                    water: Number(measurement.estres_hidrico), heat: Number(measurement.estres_termico),
                    light: Number(measurement.estres_luminico), nutrients: Number(measurement.estres_nutricional),
                    total: (Number(measurement.estres_hidrico) + Number(measurement.estres_termico) + Number(measurement.estres_luminico) + Number(measurement.estres_nutricional)) / 4
                }
            }));
            resetGrowthChart();
            stateHistory.forEach(addGrowthPoint);
            updateTimelineControls();
            state.recommendation = saved.decisiones?.[0]
                ? { priority: saved.decisiones[0].prioridad, text: saved.decisiones[0].recomendacion }
                : { priority: 'info', text: 'Corrida cargada; avanza un día para generar una recomendación actualizada.' };
            renderState();
            setApiStatus(true, `Corrida #${id} cargada`);
        }
    } catch (error) {
        alert(`No se pudo cargar la simulación: ${error.message}`);
    }
}

function fillReportHistory(runs) {
    $('runCount').textContent = formatNumber(runs.length);
    $('reportHistoryBody').innerHTML = runs.length ? runs.map((run) => `<tr><td>${escapeHtml(run.nombre)}</td><td>${escapeHtml(run.especie)}</td><td>${escapeHtml(run.modelo)}</td><td>${escapeHtml(run.estado)}</td><td>${formatNumber(run.dia_actual)}</td></tr>`).join('') : '<tr><td colspan="5">No hay corridas guardadas.</td></tr>';
}

async function loadReports() {
    if (!apiOnline) {
        $('topRunsBody').innerHTML = '<tr><td colspan="5">Inicia MySQL y la API para cargar los reportes.</td></tr>';
        return;
    }
    try {
        const report = await apiRequest('/reportes/resumen');
        const top = report.top5 ?? [];
        $('topRunsBody').innerHTML = top.length ? top.map((run, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(run.simulacion)}</td><td>${escapeHtml(run.especie)}</td><td>${formatNumber(run.biomasa_maxima_g)} g</td><td>${formatNumber(run.frutos_maximos)}</td></tr>`).join('') : '<tr><td colspan="5">Aún no hay mediciones para clasificar.</td></tr>';
        $('efficientSpecies').textContent = report.especieMasEficiente?.nombre_comun ?? '—';
        $('efficiencyValue').textContent = report.especieMasEficiente ? `Biomasa por litro: ${formatNumber(report.especieMasEficiente.gramos_por_litro, 2)} g/L` : 'Se calcula con corridas que registran riego.';
        $('maturityAverage').textContent = report.diasPromedioMadurez == null ? '—' : `${formatNumber(report.diasPromedioMadurez)} días`;
        await refreshHistory();
    } catch (error) {
        $('topRunsBody').innerHTML = `<tr><td colspan="5">Error: ${escapeHtml(error.message)}</td></tr>`;
    }
}

// ── Motor diario, escenarios A/B y exportación ──
async function beginSimulation() {
    if (state.day >= number('durationInput')) resetSimulation();
    const laterPoints = stateHistory.filter((point) => point.day > state.day);
    if (laterPoints.length) {
        if (apiOnline && simulationId) {
            try {
                await simulationWriteQueue;
                await apiRequest(`/simulaciones/${simulationId}/mediciones/despues/${state.day}`, { method: 'DELETE' });
            } catch (error) {
                console.error('No se pudo recortar la línea de tiempo guardada.', error);
                return;
            }
        }
        stateHistory = stateHistory.filter((point) => point.day <= state.day);
        resetGrowthChart();
        stateHistory.forEach(addGrowthPoint);
        updateTimelineControls();
    }
    viewingHistory = false;
    if (apiOnline && !simulationId) {
        $('runButton').disabled = true;
        $('runButton').textContent = 'Guardando…';
        try {
            simulationId = await createStoredSimulation();
        } catch (error) {
            console.error('No se pudo crear la simulación en la API.', error);
        } finally {
            $('runButton').disabled = false;
        }
    }
    simulationRunning = true;
    $('runButton').textContent = 'Ⅱ Pausar';
    if (!stateHistory.some((point) => point.day === state.day)) {
        renderState({ record: true });
        persistCurrentState();
    }
}

function advanceDay() {
    const environment = readEnvironment();
    state = stepSimulation(state, environment, species, { ...getModelParameters(), model: $('modelSelect').value });
    const recommended = state.recommendation;
    if (recommended && apiOnline && simulationId && state.day % 7 === 0) {
        apiRequest(`/simulaciones/${simulationId}/decisiones`, {
            method: 'POST',
            body: JSON.stringify({ categoria: recommended.category, regla: recommended.rule, umbral: recommended.threshold, valorObservado: recommended.observed, recomendacion: recommended.text, prioridad: recommended.priority })
        }).catch((error) => console.warn('No se pudo guardar una recomendación.', error));
    }
    const duration = number('durationInput');
    renderState({ record: true });
    if (state.day % 7 === 0 || state.day >= duration) {
        persistCurrentState();
    }
    if (state.day >= duration) {
        simulationRunning = false;
        $('runButton').textContent = '↻ Nueva corrida';
        refreshHistory();
    }
}

function resetSimulation() {
    simulationRunning = false;
    viewingHistory = false;
    simulationId = null;
    state = createInitialState(readInitial());
    state.stage = stageName(state.ageDays);
    state.stress = calculateStress({ ...readEnvironment(), soilMoisturePct: state.soilMoisturePct }, state.nutrients, species);
    state.recommendation = { priority: 'info', text: 'Inicia la simulación para recibir recomendaciones de manejo.' };
    stateHistory = [];
    resetGrowthChart();
    $('runButton').textContent = '▶ Iniciar';
    updateTimelineControls();
    renderState();
}

function exportCsv() {
    if (!stateHistory.length) {
        alert('Inicia una corrida para generar mediciones antes de exportar el CSV.');
        return;
    }
    const headers = ['dia', 'altura_cm', 'biomasa_g', 'hojas', 'ramas', 'flores', 'frutos', 'salud_pct', 'hidratacion_pct', 'estres_hidrico', 'estres_termico', 'estres_luminico', 'estres_nutricional'];
    const rows = stateHistory.map((point) => [point.day, point.heightCm, point.biomassG, point.leaves, point.branches, point.flowers, point.fruits, point.healthPct, point.soilMoisturePct, point.stress.water, point.stress.heat, point.stress.light, point.stress.nutrients].join(','));
    const blob = new Blob(['\uFEFF' + headers.join(',') + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `limonero-simulacion-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
}

// ── Observatorio geoespacial ──
function geoScoreForSpecies(data, crop) {
    const rawTemp = data?.climate?.annualMeanTempC ?? data?.weather?.current?.temperature_2m;
    const temp = rawTemp == null ? Number.NaN : Number(rawTemp);
    const minTemp = Number(crop.temperatura_min_c ?? 17);
    const maxTemp = Number(crop.temperatura_max_c ?? 28);
    const mid = (minTemp + maxTemp) / 2;
    const temperatureScore = Number.isFinite(temp) ? Math.max(0, 100 - Math.abs(temp - mid) / Math.max(1, maxTemp - minTemp) * 100) : 55;
    const ph = data?.soil?.ph == null ? Number.NaN : Number(data.soil.ph);
    const minPh = Number(crop.ph_min ?? 6); const maxPh = Number(crop.ph_max ?? 7);
    const soilScore = Number.isFinite(ph) ? Math.max(0, 100 - Math.max(minPh - ph, ph - maxPh, 0) * 25) : 55;
    const rain = data?.climate?.annualPrecipitationMm == null ? Number.NaN : Number(data.climate.annualPrecipitationMm);
    const waterScore = Number.isFinite(rain) ? Math.min(100, Math.max(0, rain / 8)) : 55;
    return Math.round((temperatureScore * .4 + soilScore * .35 + waterScore * .25) * 10) / 10;
}

const fmtGeo = (value, digits = 1) => value == null || value === '' || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('es-MX', { maximumFractionDigits: digits, minimumFractionDigits: digits });
const currentGeoSpecies = () => speciesCatalog.find((crop) => Number(crop.id) === Number($('geoSpeciesSelect').value)) ?? species;
function showGeoData(data) {
    activeGeoData = data;
    $('geoPlaceTitle').textContent = data.place ?? `${fmtGeo(data.coordinates.lat, 3)}°, ${fmtGeo(data.coordinates.lon, 3)}°`;
    const location = data.location ?? {};
    const hasAreaName = Boolean(location.locality || location.region || location.country);
    $('geoAreaName').textContent = hasAreaName ? data.place : 'No se encontró una localidad cercana';
    const areaDetails = [`${fmtGeo(data.coordinates.lat, 3)}° lat, ${fmtGeo(data.coordinates.lon, 3)}° lon`];
    if (location.elevationMeters != null) areaDetails.push(`${fmtGeo(location.elevationMeters, 0)} m s. n. m.`);
    if (location.feature || location.addressType) areaDetails.push(`Zona: ${location.feature ?? location.addressType}`);
    $('geoAreaDetails').textContent = areaDetails.join(' · ');
    $('geoTemp').textContent = data.weather?.current?.temperature_2m == null ? '—' : `${fmtGeo(data.weather.current.temperature_2m)} °C`;
    $('geoRain').textContent = data.climate?.annualPrecipitationMm == null ? '—' : `${fmtGeo(data.climate.annualPrecipitationMm, 0)} mm`;
    $('geoRadiation').textContent = data.climate?.solarRadiation == null ? '—' : `${fmtGeo(data.climate.solarRadiation, 1)} MJ/m²/d`;
    $('geoSuitability').textContent = data.suitability == null ? '—' : `${fmtGeo(data.suitability)} / 100`;
    $('geoPh').textContent = data.soil?.ph == null ? 'Sin dato' : fmtGeo(data.soil.ph, 2);
    $('geoTexture').textContent = data.soil?.clayPct == null && data.soil?.sandPct == null ? 'Sin dato' : `${fmtGeo(data.soil?.clayPct)} / ${fmtGeo(data.soil?.sandPct)} %`;
    $('geoGbifCount').textContent = data.biodiversity?.count == null ? 'Sin dato' : Number(data.biodiversity.count).toLocaleString('es-MX');
    $('geoHumidity').textContent = data.weather?.current?.relative_humidity_2m == null ? '—' : `${fmtGeo(data.weather.current.relative_humidity_2m, 0)} %`;
    $('geoSaveAnalysis').disabled = false;
    $('geoUseSimulation').disabled = false;
    const providerErrors = Object.entries(data.errors ?? {});
    $('geoDataStatus').textContent = providerErrors.length ? `Fuentes con error: ${providerErrors.map(([name]) => name).join(', ')}` : 'Datos recibidos · ' + new Date(data.fetchedAt).toLocaleString('es-MX');
    const rank = speciesCatalog.map((crop) => ({ crop, score: geoScoreForSpecies(data, crop) })).sort((a, b) => b.score - a.score);
    $('geoRanking').innerHTML = rank.map(({ crop, score }, index) => `<div class="rank-row"><span>${index + 1}. ${escapeHtml(crop.nombre_comun)}</span><strong>${fmtGeo(score)}%</strong><i><b style="width:${score}%"></b></i></div>`).join('') || '<p>No hay especies cargadas.</p>';
    const rules = [...(data.rules ?? [])];
    if (data.biodiversity?.count != null && data.biodiversity.count === 0 && !rules.some((rule) => rule.rule === 'sin_registros_gbif')) rules.push({ priority: 'aviso', message: 'GBIF no tiene registros en esta área; la falta de registros no implica ausencia de la especie.' });
    $('geoRules').innerHTML = rules.length ? rules.map((rule) => `<article class="geo-rule ${rule.priority === 'critica' ? 'critical' : ''}">${escapeHtml(rule.message)}</article>`).join('') : '<p>Los datos disponibles no activan umbrales de riesgo.</p>';
    geoGlobe?.setSite(data.coordinates.lat, data.coordinates.lon);
}

async function loadGeoOccurrences(speciesId = $('geoSpeciesSelect').value) {
    const requestId = ++geoOccurrenceRequestId;
    $('geoOccurrenceStatus').textContent = 'Cargando ocurrencias globales de GBIF…';
    geoHotspots = [];
    geoHotspotsLoading = true;
    renderGeoHotspots();
    geoGlobe?.setOccurrences([]);
    try {
        const response = await apiRequest(`/geo/occurrences?speciesId=${encodeURIComponent(speciesId)}`);
        if (requestId !== geoOccurrenceRequestId) return;
        const points = response.points ?? [];
        geoHotspots = findGeoHotspots(points);
        geoHotspotsLoading = false;
        geoGlobe?.setOccurrences(points);
        renderGeoHotspots();
        const total = Number(response.count ?? 0).toLocaleString('es-MX');
        $('geoOccurrenceStatus').textContent = points.length
            ? `${points.length} puntos cargados de ${total} registros globales; los focos resumen esta muestra.`
            : `GBIF reporta ${total} registros globales, pero no devolvió puntos con coordenadas.`;
    } catch (error) {
        if (requestId !== geoOccurrenceRequestId) return;
        geoHotspotsLoading = false;
        renderGeoHotspots();
        $('geoOccurrenceStatus').textContent = `No se pudieron precargar los puntos GBIF: ${error.message}`;
    }
}

function geoDistanceKm(a, b) {
    const radians = Math.PI / 180;
    const lat1 = a.lat * radians; const lat2 = b.lat * radians;
    const deltaLat = (b.lat - a.lat) * radians; const deltaLon = (b.lon - a.lon) * radians;
    const chord = Math.sin(deltaLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(chord), Math.sqrt(Math.max(0, 1 - chord)));
}

function findGeoHotspots(points) {
    const cellDegrees = 2;
    const cells = new Map();
    points.forEach((point) => {
        const lat = Number(point.lat); const lon = Number(point.lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
        const row = Math.min(89, Math.floor((lat + 90) / cellDegrees));
        const column = Math.min(179, Math.floor((lon + 180) / cellDegrees));
        const key = `${row}:${column}`;
        if (!cells.has(key)) cells.set(key, []);
        cells.get(key).push({ ...point, lat, lon });
    });

    const candidates = [...cells.values()].map((records) => {
        let x = 0; let y = 0; let z = 0;
        records.forEach(({ lat, lon }) => {
            const latitude = lat * Math.PI / 180; const longitude = lon * Math.PI / 180;
            x += Math.cos(latitude) * Math.cos(longitude);
            y += Math.sin(latitude);
            z += Math.cos(latitude) * Math.sin(longitude);
        });
        const center = {
            lat: Math.atan2(y, Math.hypot(x, z)) * 180 / Math.PI,
            lon: Math.atan2(z, x) * 180 / Math.PI
        };
        const representative = records.reduce((best, record) => geoDistanceKm(center, record) < geoDistanceKm(center, best) ? record : best);
        const placeCounts = new Map();
        records.forEach((record) => {
            const place = [record.locality, record.stateProvince, record.country].find((value) => typeof value === 'string' && value.trim());
            if (place) placeCounts.set(place.trim(), (placeCounts.get(place.trim()) ?? 0) + 1);
        });
        const place = [...placeCounts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
        return { lat: representative.lat, lon: representative.lon, count: records.length, place };
    }).sort((a, b) => b.count - a.count);

    const hotspots = [];
    candidates.forEach((candidate) => {
        if (hotspots.length < 2 && hotspots.every((hotspot) => geoDistanceKm(hotspot, candidate) >= 300)) hotspots.push(candidate);
    });
    return hotspots;
}

function renderGeoHotspots() {
    [$('geoHotspot1'), $('geoHotspot2')].forEach((button, index) => {
        const hotspot = geoHotspots[index];
        button.replaceChildren();
        if (!hotspot) {
            button.textContent = geoHotspotsLoading ? 'Calculando foco…' : index === 0 ? 'Sin focos disponibles' : 'Sin otro foco distante';
            button.title = 'Se necesitan registros GBIF con coordenadas para sugerir una zona.';
            button.disabled = true;
            button.removeAttribute('aria-label');
            return;
        }
        const place = hotspot.place || `${fmtGeo(hotspot.lat, 2)}°, ${fmtGeo(hotspot.lon, 2)}°`;
        const name = document.createElement('span');
        name.textContent = place.length > 21 ? `${place.slice(0, 20)}…` : place;
        const count = document.createElement('small');
        count.textContent = `${hotspot.count} registro${hotspot.count === 1 ? '' : 's'}`;
        button.append(name, count);
        button.title = `${place} · ${fmtGeo(hotspot.lat, 3)}°, ${fmtGeo(hotspot.lon, 3)}° · ${count.textContent}`;
        button.setAttribute('aria-label', `Consultar ${place}, zona con ${count.textContent}`);
        button.disabled = false;
    });
}

function selectGeoHotspot(index) {
    const hotspot = geoHotspots[index];
    if (hotspot) loadGeoSite(hotspot.lat, hotspot.lon);
}

async function loadGeoSite(latitude, longitude) {
    const lat = Number(latitude); const lon = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        $('geoDataStatus').textContent = 'Coordenadas inválidas.'; return;
    }
    $('geoLatitude').value = lat.toFixed(3); $('geoLongitude').value = lon.toFixed(3);
    geoGlobe?.setSite(lat, lon);
    $('geoLoading').hidden = false; $('geoDataStatus').textContent = 'Consultando Open-Meteo, NASA POWER, SoilGrids y GBIF…';
    $('geoSaveAnalysis').disabled = true; $('geoUseSimulation').disabled = true;
    const speciesId = encodeURIComponent($('geoSpeciesSelect').value || '');
    try {
        const data = await apiRequest(`/geo/site?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&speciesId=${speciesId}`);
        showGeoData(data);
    } catch (error) {
        $('geoDataStatus').textContent = error.message === 'Failed to fetch'
            ? 'No conecta con FlightPHP en 127.0.0.1:8000. Inicia la API; se volverá a intentar automáticamente.'
            : `No se pudo consultar el observatorio: ${error.message}`;
    } finally { $('geoLoading').hidden = true; }
}

function compareGeoSites() {
    if (!geoSiteA || !geoSiteB) { $('geoCompareResult').textContent = 'Guarda dos sitios para comparar sus datos.'; return; }
    const crop = currentGeoSpecies();
    const a = geoScoreForSpecies(geoSiteA, crop); const b = geoScoreForSpecies(geoSiteB, crop);
    const winner = Math.abs(a - b) < 2 ? 'Resultado cercano: no hay una diferencia clara.' : `${a > b ? 'A' : 'B'} presenta mayor idoneidad estimada para ${crop.nombre_comun}.`;
    $('geoCompareResult').innerHTML = `<strong>${winner}</strong><div>A · ${escapeHtml(geoSiteA.place)}: ${fmtGeo(a)} / 100</div><div>B · ${escapeHtml(geoSiteB.place)}: ${fmtGeo(b)} / 100</div><div>Lluvia anual: ${fmtGeo(geoSiteA.climate?.annualPrecipitationMm, 0)} vs ${fmtGeo(geoSiteB.climate?.annualPrecipitationMm, 0)} mm</div>`;
}

async function saveGeoAnalysis() {
    if (!activeGeoData) return;
    $('geoSaveStatus').textContent = 'Guardando…';
    try {
        const data = await apiRequest('/geo/analyses', { method: 'POST', body: JSON.stringify({ lat: activeGeoData.coordinates.lat, lon: activeGeoData.coordinates.lon, nombre: activeGeoData.place, especieId: Number($('geoSpeciesSelect').value || 0) || null, simulacionId: simulationId, data: activeGeoData }) });
        $('geoSaveStatus').textContent = `Análisis #${data.id} guardado en MySQL.`;
    } catch (error) { $('geoSaveStatus').textContent = `No se pudo guardar: ${error.message}`; }
}

function applyGeoToSimulation() {
    if (!activeGeoData) return;
    geoDataAppliedToSimulation = true;
    const crop = currentGeoSpecies();
    species = crop;
    fillSpeciesSelect($('speciesSelect'), crop.id);
    $('rateInput').value = Number(crop.r ?? 0.0025).toFixed(4);
    $('capacityInput').value = Number(crop.capacidad_carga ?? 1).toFixed(1);
    const current = activeGeoData.weather?.current ?? {};
    const temperature = activeGeoData.climate?.annualMeanTempC ?? current.temperature_2m;
    if (temperature != null && Number.isFinite(Number(temperature))) $('temperatureInput').value = String(clamp(Number(temperature), -5, 45));
    if (current.relative_humidity_2m != null && Number.isFinite(Number(current.relative_humidity_2m))) $('humidityInput').value = String(clamp(Number(current.relative_humidity_2m), 10, 100));
    if (activeGeoData.soil?.ph != null && Number.isFinite(Number(activeGeoData.soil.ph))) $('phInput').value = String(clamp(Number(activeGeoData.soil.ph), 4, 9));
    const radiation = Number(activeGeoData.climate?.solarRadiation);
    if (activeGeoData.climate?.solarRadiation != null && Number.isFinite(radiation)) $('lightInput').value = String(clamp(5 + radiation / 5, 0, 14));
    $('runName').value = `Sitio ${activeGeoData.place} · ${crop.nombre_comun}`;
    ['temperatureInput', 'humidityInput', 'phInput', 'lightInput'].forEach((id) => $(id).dispatchEvent(new Event('input', { bubbles: true })));
    document.querySelector('[data-view="simulator"]').click();
}

// ── Interfaz ──
function bindControls() {
    const outputs = [
        ['temperatureInput', 'temperatureOutput', (value) => `${value} °C`],
        ['humidityInput', 'humidityOutput', (value) => `${value} %`],
        ['lightInput', 'lightOutput', (value) => `${value} h/día`],
        ['co2Input', 'co2Output', (value) => `${value} ppm`],
        ['waterInput', 'waterOutput', (value) => `${value} L`],
        ['windInput', 'windOutput', (value) => `${value} km/h`],
        ['phInput', 'phOutput', (value) => Number(value).toFixed(1)],
        ['speedInput', 'speedOutput', (value) => `${value} día${Number(value) === 1 ? '' : 's'}/s`]
    ];
    outputs.forEach(([inputId, outputId, format]) => {
        const input = $(inputId);
        const output = $(outputId);
        const update = () => { output.textContent = format(input.value); renderState(); };
        input.addEventListener('input', update);
        update();
    });
    $('speciesSelect').addEventListener('change', () => {
        const selected = speciesCatalog.find((crop) => Number(crop.id) === Number($('speciesSelect').value));
        if (!selected) return;
        species = selected;
        $('geoSpeciesSelect').value = String(selected.id);
        $('rateInput').value = Number(selected.r ?? 0.0025).toFixed(4);
        $('capacityInput').value = Number(selected.capacidad_carga ?? 1).toFixed(1);
        renderState();
        if (geoGlobe) loadGeoOccurrences(selected.id);
        if (activeGeoData) loadGeoSite(activeGeoData.coordinates.lat, activeGeoData.coordinates.lon);
    });
    $('runButton').addEventListener('click', () => {
        if (simulationRunning) {
            simulationRunning = false;
            $('runButton').textContent = '▶ Reanudar';
        } else {
            beginSimulation();
        }
    });
    $('restartButton').addEventListener('click', resetSimulation);
    $('timelineInput').addEventListener('input', (event) => seekTimeline(event.target.value));
    $('loadHistoryButton').addEventListener('click', loadStoredSimulation);
    $('refreshHistory').addEventListener('click', refreshHistory);
    $('refreshReports').addEventListener('click', loadReports);
    $('refreshReportsHistory').addEventListener('click', refreshHistory);
    $('csvButton').addEventListener('click', exportCsv);
    $('pdfButton').addEventListener('click', () => window.print());
    document.querySelectorAll('.view-tab').forEach((button) => button.addEventListener('click', () => {
        document.querySelectorAll('.view-tab').forEach((tab) => tab.classList.toggle('active', tab === button));
        const reports = button.dataset.view === 'reports';
        const observatory = button.dataset.view === 'observatory';
        $('simulatorView').classList.toggle('active', !reports && !observatory);
        $('observatoryView').classList.toggle('active', observatory);
        $('reportsView').classList.toggle('active', reports);
        if (reports) loadReports();
        if (observatory && !geoGlobe) {
            geoGlobe = createGeoGlobe($('globeScene'), loadGeoSite);
            loadGeoOccurrences();
            loadGeoSite($('geoLatitude').value, $('geoLongitude').value);
        }
        setTimeout(resizeRenderer, 40);
    }));
    $('geoSearchButton').addEventListener('click', () => loadGeoSite($('geoLatitude').value, $('geoLongitude').value));
    $('geoHotspot1').addEventListener('click', () => selectGeoHotspot(0));
    $('geoHotspot2').addEventListener('click', () => selectGeoHotspot(1));
    $('geoSpeciesSelect').addEventListener('change', () => {
        loadGeoOccurrences();
        if (activeGeoData) loadGeoSite(activeGeoData.coordinates.lat, activeGeoData.coordinates.lon);
    });
    $('geoSaveA').addEventListener('click', () => { if (activeGeoData) { geoSiteA = activeGeoData; $('geoCompareResult').textContent = `Ubicación A guardada: ${activeGeoData.place}`; compareGeoSites(); } });
    $('geoSaveB').addEventListener('click', () => { if (activeGeoData) { geoSiteB = activeGeoData; $('geoCompareResult').textContent = `Ubicación B guardada: ${activeGeoData.place}`; compareGeoSites(); } });
    $('geoSaveAnalysis').addEventListener('click', saveGeoAnalysis);
    $('geoUseSimulation').addEventListener('click', applyGeoToSimulation);
}

function resizeRenderer() {
    const width = sceneHost.clientWidth;
    const height = sceneHost.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

window.addEventListener('resize', resizeRenderer);
new ResizeObserver(resizeRenderer).observe(sceneHost);

let lastFrame = performance.now();
let tickAccumulator = 0;
function animate(now = performance.now()) {
    requestAnimationFrame(animate);
    const delta = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    frameTime += delta;
    if (simulationRunning) {
        tickAccumulator += delta * number('speedInput');
        while (tickAccumulator >= 1) {
            tickAccumulator -= 1;
            advanceDay();
        }
    }
    orchard.children.forEach((tree, index) => {
        tree.rotation.z = Math.sin(frameTime * 0.5 + tree.userData.windPhase + index) * 0.012;
    });
    orbit.update();
    renderer.render(scene, camera);
}

initCharts();
bindControls();
state.stage = stageName(state.ageDays);
state.stress = calculateStress({ ...initialConditions, soilMoisturePct: state.soilMoisturePct }, state.nutrients, species);
state.recommendation = { priority: 'info', text: 'Inicia la simulación para recibir recomendaciones de manejo.' };
renderState();
connectApi();
setInterval(async () => {
    try {
        await apiRequest('/health');
        if (!apiOnline) {
            await connectApi();
            if (apiOnline && $('observatoryView').classList.contains('active')) {
                loadGeoOccurrences();
                loadGeoSite($('geoLatitude').value, $('geoLongitude').value);
            }
        }
    } catch {
        if (apiOnline) setApiStatus(false, 'API o MySQL sin conexión');
    }
}, 15000);
animate();
