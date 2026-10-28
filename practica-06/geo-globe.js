import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const RADIUS = 4.4;
const toVector = (latitude, longitude, radius = RADIUS) => {
    const lat = THREE.MathUtils.degToRad(latitude);
    const lon = THREE.MathUtils.degToRad(longitude);
    return new THREE.Vector3(-radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon));
};

function makeGlowTexture() {
    const canvas = document.createElement('canvas'); canvas.width = 128; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 1, 64, 64, 63);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(.12, 'rgba(255,255,255,.95)');
    gradient.addColorStop(.32, 'rgba(255,255,255,.38)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

function makeEarthTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#102c4a'); gradient.addColorStop(.48, '#176080'); gradient.addColorStop(1, '#102c4a');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = 'rgba(154, 220, 220, .15)'; ctx.lineWidth = 1;
    for (let lon = 0; lon <= 360; lon += 15) {
        const x = lon / 360 * canvas.width; ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let lat = -75; lat <= 75; lat += 15) {
        const y = (90 - lat) / 180 * canvas.height; ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    const continents = [
        [[-168,70],[-145,72],[-125,57],[-124,48],[-111,47],[-105,30],[-97,25],[-82,8],[-78,9],[-80,25],[-66,45],[-60,52],[-80,60],[-95,72],[-125,72]],
        [[-81,12],[-70,9],[-50,-2],[-43,-21],[-53,-42],[-68,-55],[-76,-34],[-80,-10]],
        [[-11,72],[25,71],[52,60],[42,48],[30,42],[35,30],[18,12],[8,5],[-5,8],[-17,20],[-16,35],[-8,50]],
        [[35,40],[52,55],[78,68],[113,68],[145,58],[165,48],[145,35],[124,25],[118,10],[105,4],[98,20],[78,8],[65,25],[47,30]],
        [[112,-11],[153,-10],[155,-28],[136,-39],[115,-34]],
        [[-53,60],[-42,59],[-20,72],[-35,83],[-52,78]],
        [[-180,-72],[-120,-74],[-60,-72],[0,-75],[60,-72],[120,-74],[180,-72],[180,-90],[-180,-90]]
    ];
    const project = ([lon, lat]) => [((lon + 180) / 360) * canvas.width, ((90 - lat) / 180) * canvas.height];
    continents.forEach((polygon) => {
        ctx.beginPath(); polygon.forEach((point, index) => { const [x, y] = project(point); index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }); ctx.closePath();
        const land = ctx.createLinearGradient(0, 0, 0, canvas.height); land.addColorStop(0, '#75a978'); land.addColorStop(1, '#b0a66b');
        ctx.fillStyle = land; ctx.fill(); ctx.strokeStyle = 'rgba(217,226,161,.48)'; ctx.lineWidth = 2; ctx.stroke();
    });
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export function createGeoGlobe(host, onSelect) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#081625');
    const camera = new THREE.PerspectiveCamera(42, 1, .1, 100);
    camera.position.set(0, 1.3, 15.5);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setSize(host.clientWidth, host.clientHeight); host.appendChild(renderer.domElement);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.minDistance = 6.2; controls.maxDistance = 25; controls.rotateSpeed = .55;
    scene.add(new THREE.AmbientLight(0x9bc8df, 1.2));
    const sun = new THREE.DirectionalLight(0xffe3bb, 2.8); sun.position.set(-6, 5, 8); scene.add(sun);
    const earthMaterial = new THREE.MeshStandardMaterial({ map: makeEarthTexture(), roughness: .92, metalness: 0 });
    new THREE.TextureLoader().load('./assets/earth-blue-marble.jpg', (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.wrapS = THREE.RepeatWrapping;
        // SphereGeometry's longitude seam is at u=0; center the equirectangular
        // map's Greenwich meridian (u=.5) on longitude 0 so markers line up.
        texture.offset.x = .5;
        earthMaterial.map = texture;
        earthMaterial.needsUpdate = true;
    }, undefined, (error) => console.warn('No se pudo cargar la textura terrestre local; se mantiene el mapa de respaldo.', error));
    const globe = new THREE.Mesh(new THREE.SphereGeometry(RADIUS, 128, 96), earthMaterial);
    scene.add(globe);
    const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(RADIUS * 1.025, 64, 48), new THREE.MeshBasicMaterial({ color: 0x55b4e7, transparent: true, opacity: .085, side: THREE.BackSide })); scene.add(atmosphere);
    const starsGeometry = new THREE.BufferGeometry(); const stars = [];
    for (let index = 0; index < 900; index += 1) {
        const direction = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize().multiplyScalar(18 + Math.random() * 18);
        stars.push(direction.x, direction.y, direction.z);
    }
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
    scene.add(new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: 0xd7edff, size: .055, transparent: true, opacity: .78 })));
    const siteGroup = new THREE.Group(); scene.add(siteGroup);
    const occurrenceGroup = new THREE.Group(); scene.add(occurrenceGroup);
    const glowTexture = makeGlowTexture();
    const raycaster = new THREE.Raycaster(); const pointer = new THREE.Vector2(); let down = null;
    let occurrenceTargets = [];
    const updatePointer = (event) => {
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        renderer.domElement.style.cursor = raycaster.intersectObjects(occurrenceTargets, false).length ? 'pointer' : 'grab';
    };
    renderer.domElement.addEventListener('pointerdown', (event) => { down = [event.clientX, event.clientY]; });
    renderer.domElement.addEventListener('pointermove', updatePointer);
    renderer.domElement.addEventListener('pointerup', (event) => {
        if (!down || Math.hypot(event.clientX - down[0], event.clientY - down[1]) > 5) return;
        const bounds = renderer.domElement.getBoundingClientRect();
        pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
        raycaster.setFromCamera(pointer, camera);
        const occurrenceHit = raycaster.intersectObjects(occurrenceTargets, false)[0];
        if (occurrenceHit) {
            const { latitude, longitude } = occurrenceHit.object.userData.location;
            onSelect(latitude, longitude);
            return;
        }
        const hit = raycaster.intersectObject(globe)[0];
        if (!hit) return;
        const p = hit.point.clone().normalize();
        const latitude = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(p.y, -1, 1)));
        const longitude = THREE.MathUtils.radToDeg(Math.atan2(p.z, -p.x));
        onSelect(Number(latitude.toFixed(3)), Number(longitude.toFixed(3)));
    });
    function clearGroup(group) {
        while (group.children.length) {
            const object = group.children[0]; group.remove(object);
            object.geometry?.dispose();
            if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
            else object.material?.dispose();
        }
    }
    function setSite(latitude, longitude) {
        clearGroup(siteGroup);
        const position = toVector(latitude, longitude, RADIUS * 1.008);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xffcb5b, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
        halo.position.copy(position); halo.scale.set(.8, .8, 1); siteGroup.add(halo);
        const marker = new THREE.Mesh(new THREE.SphereGeometry(.095, 18, 14), new THREE.MeshBasicMaterial({ color: 0xffd366 })); marker.position.copy(position); siteGroup.add(marker);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(.19, .017, 8, 36), new THREE.MeshBasicMaterial({ color: 0xffd366, transparent: true, opacity: .8 }));
        ring.position.copy(position); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), position.clone().normalize()); siteGroup.add(ring);
    }
    function setOccurrences(occurrences = []) {
        clearGroup(occurrenceGroup);
        occurrenceTargets = [];
        occurrences.slice(0, 100).forEach((record) => {
            const position = toVector(record.lat, record.lon, RADIUS * 1.012);
            const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0x48ffd4, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
            halo.position.copy(position); halo.scale.set(.54, .54, 1); occurrenceGroup.add(halo);
            const point = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 10), new THREE.MeshBasicMaterial({ color: 0xd5fff4 }));
            point.position.copy(position); occurrenceGroup.add(point);
            const target = new THREE.Mesh(new THREE.SphereGeometry(.14, 10, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, colorWrite: false, depthWrite: false }));
            target.position.copy(position); target.userData.location = { latitude: Number(record.lat), longitude: Number(record.lon) };
            occurrenceGroup.add(target); occurrenceTargets.push(target);
        });
    }
    let animation;
    const render = () => { animation = requestAnimationFrame(render); controls.update(); renderer.render(scene, camera); };
    render();
    const resize = () => { const width = host.clientWidth; const height = host.clientHeight; if (!width || !height) return; camera.aspect = width / height; camera.updateProjectionMatrix(); renderer.setSize(width, height); };
    const observer = new ResizeObserver(resize); observer.observe(host); window.addEventListener('resize', resize);
    return { setSite, setOccurrences, resize, dispose() { cancelAnimationFrame(animation); observer.disconnect(); window.removeEventListener('resize', resize); renderer.domElement.removeEventListener('pointermove', updatePointer); controls.dispose(); renderer.dispose(); glowTexture.dispose(); host.replaceChildren(); } };
}
