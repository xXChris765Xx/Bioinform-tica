# Práctica 03 - Construcción procedural de una planta 3D

## Descripción

Este proyecto consiste en la construcción de una planta 3D utilizando Three.js y geometrías primitivas.

La escena representa una planta dentro de una maceta, rodeada de césped y árboles para crear un pequeño jardín. La planta y el entorno se construyeron mediante objetos 3D, transformaciones y grupos jerárquicos.

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

La intensidad de la luz direccional puede modificarse mediante un control HTML.

## Animación

La planta tiene una animación de balanceo suave utilizando `requestAnimationFrame`. El césped y las copas de los árboles se mecen ligeramente para simular una brisa.

Las flores también realizan una rotación continua.

La animación puede activarse o detenerse mediante el botón correspondiente.

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
