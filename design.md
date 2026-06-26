# Especificación de Diseño Premium - CourtUp

Este documento define las directrices y el sistema de diseño completo para el rediseño del frontend de **CourtUp**, integrando el proyecto de Google Stitch [17090194689681540489](https://stitch.withgoogle.com/projects/17090194689681540489).

---

## 1. Integración con Google Stitch

Utilizaremos el proyecto de Stitch **17090194689681540489** como fuente de verdad para los componentes UI y assets del frontend:
* **Figma/Stitch Project URL**: [Stitch Project 17090194689681540489](https://stitch.withgoogle.com/projects/17090194689681540489)
* **Design System**: Sincronización de tokens para colores, tipografías y espaciados exportados directamente desde Stitch.
* **Componentes Sincronizados**: Mapeo directo de botones, inputs y contenedores definidos en el workspace de Stitch hacia el código React de CourtUp.

---

## 2. Paleta de Colores y Tipografía

### Colores Base (SaaS Moderno)
* **Fondo Principal**: Claro minimalista (`stone-50` / `#FAFAF9` a `#FFFFFF`).
* **Sidebar y Elementos de Control**: Oscuro premium (`stone-950` / `#0C0A09` con bordes muy finos en `#1C1917`).
* **Acentos Primarios**: 
  * Verde limón (`#CDFE04` / `hsl(72, 99%, 51%)`) para estados activos, badges, y la pelota de tenis.
  * Gris oscuro elegante (`stone-900`) para botones y controles principales.

### Tipografía
* **Familia**: `Inter` (importada de Google Fonts) como tipografía principal.
* **Títulos**: Extra-bold (`font-black`) con tracking ajustado (`tracking-tight`) para un look moderno de alto impacto.

---

## 3. Estructura y Navegación del Sidebar

La barra lateral (Sidebar) actuará como el eje de navegación central con la siguiente estructura:

* **Logo**: Logo de `CourtUp` estático no cliqueable con una pelota de tenis animada al hacer hover.
* **Navegación**:
  1. **Inicio** (Icono `Home` - Redirige a `/`).
  2. **Torneos** (Menú colapsable con animación de chevron):
     * *Dashboard de Torneos* (Vista analítica y KPIs).
     * *Crear Torneo* (Formulario de alta rápida).
     * *Torneos Activos* (Listado e itinerarios públicos).
  3. **Canchas** (Icono `MapPin` - Gestión física y horarios).
  4. **Clases** (Icono `BookOpen` - Agenda de profesores y reservas).
* **Control de Perfil**: Dropdown interactivo en la parte inferior para alternar de rol (SuperAdmin, Organizador, Profesor, Jugador) de forma fluida.

---

## 4. Efectos 3D y Animaciones Premium

Para brindar una experiencia interactiva de primer nivel, se implementarán los siguientes efectos visuales:

### Pelota de Tenis 3D (Toggle de Sidebar)
* **Tecnología**: Three.js utilizando `@react-three/fiber` y `@react-three/drei`.
* **Comportamiento**: Una esfera 3D realista con textura y costuras de pelota de tenis en color verde limón que gira de manera interactiva en la parte superior del sidebar. Al hacer clic sobre ella, realiza una animación de giro rápido y colapsa/expande el sidebar.

### Efecto de Inclinación 3D (Card Tilt)
* **Comportamiento**: Las tarjetas de torneos activos, canchas y KPIs en el dashboard contarán con un efecto de inclinación en 3D basado en la posición del cursor (`hover:scale-105` combinado con rotaciones sutiles en los ejes X e Y usando perspectiva 3D).
* **CSS Utilizado**:
  ```css
  .card-3d-tilt {
    transform-style: preserve-3d;
    perspective: 1000px;
    transition: transform 0.3s ease, box-shadow 0.3s ease;
  }
  .card-3d-tilt:hover {
    transform: rotateX(4deg) rotateY(-4deg) scale(1.02);
    box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.08);
  }
  ```

---

## 5. Mapeo de Pantallas a Conservar

Rediseñaremos la UI de las pantallas existentes aplicando la nueva estética sin alterar su lógica funcional interna:
1. **Home/Inicio** (`src/app/page.tsx`)
2. **Login** (`src/app/login/page.tsx`)
3. **Cartelera de Torneos** (`src/app/torneos/page.tsx`)
4. **Editar Torneo** (`src/app/organizador/torneos/editar/[id]/page.tsx`)
5. **Gestión de Canchas** (`src/app/organizador/canchas/page.tsx`)
6. **Agenda del Profesor** (`src/app/profesor/agenda/page.tsx`)

---

## 6. Tokens de Diseño Detallados (Figma Sync)

### Bordes y Sombras
* **Borde Redondeado (Border Radius)**:
  * Cards e Inputs: `rounded-2xl` (1rem / 16px)
  * Modales y Contenedores grandes: `rounded-3xl` (1.5rem / 24px)
  * Botones y Badges pequeños: `rounded-xl` (0.75rem / 12px)
* **Sombras (Shadows)**:
  * Soft elevation: `box-shadow: 0 4px 20px -2px rgba(0,0,0,0.05)`
  * High-elevation (Modales / Drawers): `box-shadow: 0 25px 50px -12px rgba(0,0,0,0.1)`

### Grillas y Espaciado (Layout Grid)
* **Contenedor Principal**: Máximo `max-w-7xl` con padding adaptativo `p-4 md:p-8`.
* **Sidebar Gap**: Espaciado izquierdo garantizado de `lg:ml-64` cuando está expandido, y `lg:ml-[72px]` cuando está colapsado para prevenir solapamientos.

---

## 7. Implementación Técnica del Componente 3D TennisBall

A continuación se detalla la estructura base para el renderizado del toggle 3D en `ThreeBall.tsx`:

```tsx
import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

function BallMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Rotación continua
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
      meshRef.current.rotation.x += 0.005;
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      {/* Material simulando costura y textura de fieltro */}
      <meshStandardMaterial 
        color="#CDFE04" 
        roughness={0.8} 
        metalness={0.1}
        wireframe={false}
      />
    </mesh>
  );
}

export default function TennisBall3D({ onClick }: { onClick: () => void }) {
  return (
    <div className="w-10 h-10 cursor-pointer" onClick={onClick}>
      <Canvas camera={{ position: [0, 0, 2.5] }}>
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 2, 2]} intensity={1} />
        <BallMesh />
      </Canvas>
    </div>
  );
}
```

---

## 8. Directrices de Sincronización de Stitch

1. **Upload Design**: Carga de este archivo usando `upload_design_md` para sincronizar las especificaciones en la nube de Stitch.
2. **Apply Design**: Ejecución del comando de aplicación de sistema de diseño para heredar tokens en toda la aplicación de manera automática.
3. **Mantenimiento**: En caso de cambios en Figma, refrescar el sistema de diseño local con `update_design_system`.
