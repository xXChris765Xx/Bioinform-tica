# Práctica 03 - Construcción procedural de una planta 3D

## Descripción

Este proyecto consiste en la construcción de una planta 3D utilizando Three.js y geometrías primitivas.

La escena representa una planta dentro de una maceta, rodeada de césped y árboles para crear un pequeño jardín. La planta y el entorno se construyeron mediante objetos 3D, transformaciones y grupos jerárquicos.

También incluye dos macetas adicionales con flores y un espantapájaros 3D que se balancea suavemente.

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript
- Three.js
- OrbitControls

## Elementos de la escena

La planta está formada por:

- Tallo principal: cilindro.
- Ramas: cilindros.
- Hojas: esferas escaladas.
- Flores: esferas utilizadas como pétalos y centro.
- Maceta: cilindro.
- Tierra: cilindro.
- Suelo: plano.
- Césped: grupos de briznas distribuidos alrededor de la planta.
- Árboles: troncos y copas frondosas alrededor del jardín.
- Dos macetas pequeñas con tallos, hojas y flores.
- Espantapájaros cargado desde `models/espantapajaros__scarecrow.glb`.

## Jerarquía

Se utiliza THREE.Group para organizar las diferentes partes de la planta.

La estructura principal es:

Planta
├── Tallo
├── Ramas
├── Hojas
└── Flores

Esto permite aplicar transformaciones a grupos completos de objetos.

## Iluminación

La escena utiliza:

- Luz ambiental.
- Luz direccional.

La intensidad de ambas luces puede modificarse mediante un control HTML. Al reducirla a cero, el fondo y los objetos quedan completamente oscuros.

## Animación

La planta y el espantapájaros tienen una animación de balanceo suave utilizando `requestAnimationFrame`. El césped, las flores de las macetas y las copas de los árboles se mecen ligeramente para simular una brisa.

Las flores también realizan una rotación continua.

La animación puede activarse o detenerse mediante el botón correspondiente.

## Créditos del modelo

El modelo `espantapajaros__scarecrow.glb` es de TioDem, obtenido de [Sketchfab](https://sketchfab.com/3d-models/espantapajaros-scarecrow-80ddf4dab88e49c8bff018b898bb144f), y se distribuye bajo la licencia [Creative Commons Atribución 4.0](https://creativecommons.org/licenses/by/4.0/).

## Interacción

Se implementó raycasting mediante `THREE.Raycaster`.

Al hacer clic sobre una parte de la planta se muestra información sobre:

- Nombre de la parte.
- Tipo de geometría.
- Altura sobre el suelo.
- Función de la parte.

## Controles

El proyecto cuenta con los siguientes controles:

- Activar o detener la animación.
- Cambiar el color de las hojas.
- Reiniciar la cámara.
- Modificar la intensidad de la luz.
- Mostrar u ocultar las hojas.

## Ejecución

El proyecto puede abrirse mediante un servidor local para cargar correctamente los módulos de Three.js.

Por ejemplo, utilizando Visual Studio Code con la extensión Live Server.

## Autor

Christopher Rebollar Pelayo

## Práctica

Práctica 03: Construcción procedural de una planta 3D
