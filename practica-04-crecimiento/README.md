# Práctica 04 - Crecimiento vegetal

Laboratorio interactivo de crecimiento vegetal construido con Three.js. La escena conserva la planta procedural y el jardín de la práctica anterior, y ahora muestra el desarrollo de tallo, ramas, hojas y flores mediante una animación progresiva.

## Ejecutar

Abre `index.html` desde un servidor local (por ejemplo, la extensión Live Server de VS Code). Three.js y OrbitControls se cargan desde jsDelivr; el espantapájaros se carga desde `models/espantapajaros__scarecrow.glb`.

## Controles

- **Velocidad de crecimiento:** ajusta cuánto tarda la planta en completar sus etapas.
- **Reiniciar crecimiento:** vuelve la planta a su estado inicial.
- **Pausar / reanudar simulación:** detiene o continúa el crecimiento y las animaciones.
- **Intensidad del viento:** regula el balanceo de ramas, hojas, césped y copas.
- **Cambiar color de hojas:** alterna el color de las hojas.
- **Intensidad de luz:** ajusta la iluminación de la escena.
- **Reiniciar cámara:** vuelve al encuadre inicial.

Haz clic en una parte de la planta para consultar su nombre, porcentaje de crecimiento, geometría y función. El crecimiento se actualiza en el bucle `requestAnimationFrame` con `THREE.Clock` y curvas suaves de interpolación. No se usan shaders externos en esta versión.

## Tecnologías

HTML, CSS, JavaScript, Three.js, OrbitControls y GLTFLoader.
Haz clic en una parte de cualquiera de las plantas para consultar su nombre, porcentaje de crecimiento, geometría y función. El crecimiento se actualiza en el bucle `requestAnimationFrame` con `THREE.Clock` y curvas suaves de interpolación. Las plantas pequeñas de las macetas comparten el mismo ciclo, velocidad, pausa, reinicio, viento y controles de color/visibilidad que la planta principal. No se usan shaders externos en esta versión.
