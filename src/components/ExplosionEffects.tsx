import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// ---------- Осколки стекла ----------
export function GlassShards({
  position,
  active,
  color = '#cbd5e1',
  count = 20,
}: {
  position: [number, number, number];
  active: boolean;
  color?: string;
  count?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useRef(0);
  const wasActive = useRef(false);

  const shards = useMemo(
    () =>
      Array.from({ length: count }).map(() => {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.random() * Math.PI;
        const speed = 1.5 + Math.random() * 2.5;
        return {
          vx: Math.sin(phi) * Math.cos(theta) * speed,
          vy: Math.abs(Math.cos(phi)) * speed * 1.5 + 1,
          vz: Math.sin(phi) * Math.sin(theta) * speed,
          rotX: (Math.random() - 0.5) * 8,
          rotY: (Math.random() - 0.5) * 8,
          rotZ: (Math.random() - 0.5) * 8,
          size: 0.05 + Math.random() * 0.08,
          life: 0.8 + Math.random() * 0.6,
        };
      }),
    [count]
  );

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (active && !wasActive.current) {
      startTime.current = clock.getElapsedTime();
      wasActive.current = true;
    }
    if (!active) {
      wasActive.current = false;
      return;
    }

    const t = clock.getElapsedTime() - startTime.current;
    groupRef.current.children.forEach((child, i) => {
      const s = shards[i];
      if (!s) return;
      const life = t / s.life;
      if (life >= 1) {
        child.visible = false;
        return;
      }
      child.visible = true;
      child.position.set(
        s.vx * t,
        Math.max(-0.5, s.vy * t - 9.8 * t * t * 0.5),
        s.vz * t
      );
      child.rotation.set(s.rotX * t, s.rotY * t, s.rotZ * t);
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshStandardMaterial;
      if (mat) mat.opacity = 1 - life;
    });
  });

  if (!active) return null;

  return (
    <group ref={groupRef} position={position}>
      {shards.map((s, i) => (
        <mesh key={i}>
          <tetrahedronGeometry args={[s.size, 0]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={1}
            emissive={color}
            emissiveIntensity={0.3}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

// ---------- Молния (при КЗ) ----------
export function LightningBolt({
  start,
  end,
  active,
  color = '#ffaa00',
}: {
  start: [number, number, number];
  end: [number, number, number];
  active: boolean;
  color?: string;
}) {
  const [points, setPoints] = useRef<THREE.Vector3[]>([]).current;

  // Генерируем ломаную линию между start и end с зигзагами
  const linePoints = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const steps = 12;
    const a = new THREE.Vector3(...start);
    const b = new THREE.Vector3(...end);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const base = a.clone().lerp(b, t);
      if (i > 0 && i < steps) {
        base.x += (Math.random() - 0.5) * 0.6;
        base.y += (Math.random() - 0.5) * 0.4;
        base.z += (Math.random() - 0.5) * 0.6;
      }
      pts.push(base);
    }
    return pts;
  }, [start[0], start[1], start[2], end[0], end[1], end[2], active]);

  if (!active) return null;

  return (
    <group>
      {/* Основная линия */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={linePoints.length}
            array={new Float32Array(linePoints.flatMap((p) => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={3} transparent opacity={0.9} />
      </line>

      {/* Свечение вдоль линии — куча маленьких сфер */}
      {linePoints.map((p, i) => (
        <mesh key={i} position={[p.x, p.y, p.z]}>
          <sphereGeometry args={[0.08 + Math.random() * 0.05, 8, 8]} />
          <meshBasicMaterial color="#fff8c0" transparent opacity={0.8} />
        </mesh>
      ))}

      {/* Большая вспышка в центре */}
      <mesh position={[start[0], start[1], start[2]]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} depthWrite={false} />
      </mesh>
    </group>
  );
}

// ---------- Копоть (остаётся после КЗ) ----------
export function SootMark({
  position,
  active,
}: {
  position: [number, number, number];
  active: boolean;
}) {
  if (!active) return null;
  return (
    <mesh
      position={[position[0], 0.01, position[2]]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <circleGeometry args={[0.6, 24]} />
      <meshBasicMaterial color="#0a0a0a" transparent opacity={0.6} depthWrite={false} />
    </mesh>
  );
}

// ---------- Тряска камеры ----------
export function CameraShake({ trigger, intensity = 0.15 }: { trigger: number; intensity?: number }) {
  const shakeUntil = useRef(0);
  const lastTrigger = useRef(trigger);

  useFrame(({ camera, clock }) => {
    if (trigger !== lastTrigger.current) {
      lastTrigger.current = trigger;
      shakeUntil.current = clock.getElapsedTime() + 0.35;
    }

    const now = clock.getElapsedTime();
    if (now < shakeUntil.current) {
      const remaining = (shakeUntil.current - now) / 0.35;
      const amp = intensity * remaining;
      camera.position.x += (Math.random() - 0.5) * amp;
      camera.position.y += (Math.random() - 0.5) * amp;
      camera.position.z += (Math.random() - 0.5) * amp;
    }
  });

  return null;
}