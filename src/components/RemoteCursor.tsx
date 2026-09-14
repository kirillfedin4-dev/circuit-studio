import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

export interface RemoteCursorData {
  id: string;
  color: string;
  /** Мировые координаты [x, 0, z] */
  position: [number, number, number];
  /** Короткое имя (например, clientId) */
  name: string;
}

export default function RemoteCursor({ cursor }: { cursor: RemoteCursorData }) {
  const groupRef = useRef<THREE.Group>(null);
  const targetRef = useRef(new THREE.Vector3(...cursor.position));

  // Плавная интерполяция к целевой позиции (сглаживание движения)
  useFrame((_, delta) => {
    if (!groupRef.current) return;
    targetRef.current.set(cursor.position[0], 0.15, cursor.position[2]);
    groupRef.current.position.lerp(targetRef.current, Math.min(1, delta * 10));
  });

  return (
    <group ref={groupRef} position={cursor.position}>
      {/* Шарик-маркер */}
      <mesh>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshBasicMaterial color={cursor.color} transparent opacity={0.9} />
      </mesh>

      {/* Пульсирующее кольцо вокруг */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
        <ringGeometry args={[0.25, 0.35, 24]} />
        <meshBasicMaterial color={cursor.color} transparent opacity={0.5} depthWrite={false} />
      </mesh>

      {/* Луч вниз к полу */}
      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.01, 0.01, 0.6, 8]} />
        <meshBasicMaterial color={cursor.color} transparent opacity={0.4} />
      </mesh>

      {/* Имя игрока */}
      <Html position={[0, 0.6, 0]} center distanceFactor={12} zIndexRange={[100, 0]}>
        <div
          style={{
            background: cursor.color,
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            padding: '2px 6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            userSelect: 'none',
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
            fontFamily: 'Inter, system-ui, sans-serif',
          }}
        >
          {cursor.name}
        </div>
      </Html>
    </group>
  );
}