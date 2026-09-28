# Práctica 04 - Animación y Simulación de Crecimiento

## Descripción

Este proyecto implementa una simulación de crecimiento de una planta 3D utilizando Three.js.

La planta comienza con un tamaño de cero y crece progresivamente hasta alcanzar su tamaño final. Durante el proceso aparecen primero el tallo, después las ramas, posteriormente las hojas y finalmente las flores.

## Tecnologías utilizadas

- HTML5
- CSS3
- JavaScript
- Three.js
- OrbitControls
- requestAnimationFrame

## Características

El proyecto cuenta con una planta formada mediante geometrías primitivas:

- Cilindros para el tallo y las ramas.
- Esferas para las hojas.
- Esferas para los pétalos y centro de las flores.
- Cilindro para la maceta.
- Plano para el suelo.

## Jerarquía

La planta utiliza THREE.Group para organizar sus elementos.

La estructura principal es:

Planta
├── Tallo
│   └── Ramas
├── Hojas
└── Flores

Esta jerarquía permite controlar las transformaciones y animaciones de los diferentes componentes.

## Simulación de crecimiento

El crecimiento se controla mediante una variable llamada `growth`, cuyo valor va desde 0 hasta 1.

El crecimiento ocurre por etapas:

1. Crecimiento del tallo.
2. Crecimiento de las ramas.
3. Aparición progresiva de las hojas.
4. Aparición de las flores.

Las transformaciones de escala se utilizan para hacer que los objetos aparezcan progresivamente.

## Animación

La escena utiliza `requestAnimationFrame` para actualizar continuamente la planta.

También se implementó una simulación sencilla de viento utilizando funciones sinusoidales.

El viento provoca movimientos suaves en:

- Tallo.
- Ramas.
- Hojas.
- Flores.

## Controles

El usuario puede modificar la simulación mediante controles HTML:

- Velocidad de crecimiento.
- Intensidad del viento.
- Pausar y reanudar.
- Reiniciar el crecimiento.
- Cambiar el color de las hojas.
- Reiniciar la cámara.

## Raycasting

Se implementó `THREE.Raycaster` para detectar cuando el usuario selecciona una parte de la planta.

Al seleccionar un objeto se muestra:

- Nombre.
- Estado de crecimiento.
- Tipo de geometría.
- Función de la parte seleccionada.

## Ejecución

El proyecto debe ejecutarse mediante un servidor local para cargar correctamente los módulos de Three.js.

Se recomienda utilizar Visual Studio Code junto con Live Server.

## Autor

Christopher Rebollar Pelayo

## Práctica

Práctica 04: Animación y Simulación de Crecimiento