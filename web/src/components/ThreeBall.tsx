'use client';

import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function BallMesh() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Realistic rotation speed
      meshRef.current.rotation.y += 0.015;
      meshRef.current.rotation.x += 0.007;
      
      // Smooth bouncing motion
      const time = state.clock.getElapsedTime();
      meshRef.current.position.y = Math.sin(time * 2.5) * 0.05;
    }
  });

  // Dynamically generate a flat canvas texture representing a real tennis ball felt and seam
  const tennisTexture = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // 1. Draw base fluorescent neon green/yellow color
    ctx.fillStyle = '#CCFF00';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Generate felt micro-fiber noise for realism
    for (let i = 0; i < 35000; i++) {
      const x = Math.random() * canvas.width;
      const y = Math.random() * canvas.height;
      const size = Math.random() * 2 + 1;
      ctx.fillStyle = Math.random() > 0.5 ? '#B8E600' : '#D4FF2A';
      ctx.fillRect(x, y, size, size);
    }

    // 3. Draw the white tennis seam perfectly flush in spherical UV coordinates
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 26; // Thick realistic seam
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();

    const r = 1.0;
    const totalPoints = 300;
    let lastU = -1;

    for (let i = 0; i <= totalPoints; i++) {
      const t = (i / totalPoints) * Math.PI * 2;
      const factor = Math.sqrt(1 - 0.23 * Math.cos(2 * t) * Math.cos(2 * t));
      const x = r * Math.cos(t) * factor;
      const y = r * Math.sin(t) * factor;
      const z = 0.48 * r * Math.cos(2 * t);

      // Convert 3D spherical point to UV space
      const phi = Math.atan2(y, x); // -PI to PI
      const theta = Math.acos(z / r); // 0 to PI

      const u = (phi + Math.PI) / (Math.PI * 2);
      const v = theta / Math.PI;

      const px = u * canvas.width;
      const py = v * canvas.height;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        // Avoid drawing lines across the canvas when the coordinate wraps around 0-1 boundary
        if (Math.abs(u - lastU) > 0.5) {
          ctx.moveTo(px, py);
        } else {
          ctx.lineTo(px, py);
        }
      }
      lastU = u;
    }
    ctx.stroke();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, []);

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1.1, 64, 64]} />
      <meshStandardMaterial 
        map={tennisTexture || undefined}
        roughness={0.9} // High roughness to resemble soft felt
        metalness={0.0} // Felt is non-metallic
      />
    </mesh>
  );
}

export default function ThreeBall({ onClick }: { onClick: () => void }) {
  return (
    <div className="w-10 h-10 cursor-pointer flex items-center justify-center transition-transform hover:scale-110 active:scale-95 duration-300" onClick={onClick}>
      <Canvas camera={{ position: [0, 0, 2.5] }} gl={{ antialias: true }}>
        <ambientLight intensity={0.9} />
        {/* Soft light direction to prevent flat look while preserving the flat seam aesthetic */}
        <directionalLight position={[3, 3, 3]} intensity={1.1} />
        <directionalLight position={[-3, -1, -2]} intensity={0.25} color="#CCFF00" />
        <BallMesh />
      </Canvas>
    </div>
  );
}
