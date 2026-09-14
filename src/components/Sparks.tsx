import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SparksProps {
  position: [number, number, number];
  active: boolean;
  color?: string;
  count?: number;
  spread?: number;
  speed?: number;
  duration?: number;
}

export default function Sparks({
  position,
  active,
  color = '#ffcc00',
  count = 20,
  spread = 1.5,
  speed = 1.5,
  duration = 1.2,
}: SparksProps) {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useRef(0);
  const wasActive = useRef(false);

  const particles = useMemo(() => {
    return Array.from({ length: count }).map(() => {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI;
      const velocity = speed * (0.5 + Math.random());
      return {
        vx: Math.sin(phi) * Math.cos(theta) * velocity,
        vy: Math.abs(Math.cos(phi)) * velocity * 1.2,
        vz: Math.sin(phi) * Math.sin(theta) * velocity,
        size: 0.04 + Math.random() * 0.06,
        life: 0.5 + Math.random() * 0.5,
      };
    });
  }, [count, speed]);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;

    // Запуск частиц при переходе active: false → true
    if (active && !wasActive.current) {
      startTime.current = clock.getElapsedTime();
      wasActive.current = true;
    }
    if (!active && wasActive.current) {
      wasActive.current = false;
      return;
    }

    const elapsed = clock.getElapsedTime() - startTime.current;
    const t = elapsed / duration;

    groupRef.current.children.forEach((child, i) => {
      const p = particles[i];
      if (!p) return;

      // Движение с гравитацией
      const time = elapsed;
      const x = p.vx * time;
      const y = p.vy * time - 4.9 * time * time * 0.5;
      const z = p.vz * time;
      child.position.set(x, Math.max(-0.5, y), z);

      // Затухание
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = Math.max(0, 1 - t) * p.life;
      }
      const scale = 1 - t * 0.5;
      child.scale.set(scale, scale, scale);
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={position}>
      {particles.map((p, i) => (
        <mesh key={i}>
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={1}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}