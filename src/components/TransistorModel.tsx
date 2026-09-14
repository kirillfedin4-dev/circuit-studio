import { useState } from 'react';
import { Html } from '@react-three/drei';
import { labelStyle } from './modelStyles';

export default function TransistorModel({
  selected,
  hFE,
  open,
  onToggle,
}: {
  selected: boolean;
  hFE: number;
  open: boolean;
  onToggle: () => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <group>
      {/* Корпус — полуцилиндр / D-образная форма */}
      <mesh castShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.7, 24, 1, false, 0, Math.PI]} />
        <meshStandardMaterial
          color={selected ? '#ef4444' : open ? '#10b981' : '#1e293b'}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Плоская задняя стенка */}
      <mesh position={[0, 0.35, -0.01]}>
        <boxGeometry args={[0.7, 0.7, 0.02]} />
        <meshStandardMaterial color={selected ? '#ef4444' : '#0f172a'} metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Ножки: B, C, E */}
      <mesh position={[-0.8, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.55, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0.7, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.35, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0.7, -0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.35, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>

      {/* Индикатор состояния (стрелка эмиттера) */}
      <mesh
        position={[0.4, 0.3, 0]}
        rotation={[0, 0, open ? -Math.PI / 4 : Math.PI / 4]}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <coneGeometry args={[0.08, 0.2, 8]} />
        <meshStandardMaterial
          color={hovered ? '#f59e0b' : open ? '#10b981' : '#64748b'}
          emissive={hovered ? '#f59e0b' : open ? '#10b981' : '#000'}
          emissiveIntensity={hovered || open ? 0.7 : 0}
        />
      </mesh>

      {/* Точка на базе */}
      <mesh position={[-0.55, 0.35, 0]}>
        <sphereGeometry args={[0.06, 12, 12]} />
        <meshStandardMaterial color="#eab308" emissive="#ca8a04" emissiveIntensity={0.4} />
      </mesh>

      {/* Подпись */}
      <Html position={[0, 1.15, 0]} center distanceFactor={10}>
        <div style={{
          ...labelStyle,
          background: open ? 'rgba(16,185,129,0.95)' : 'rgba(139,92,246,0.95)',
          color: '#fff',
          borderColor: open ? '#10b981' : '#8b5cf6',
        }}>
          🔺 {open ? 'ОТКР' : 'ЗАКР'} · hFE={hFE}
        </div>
      </Html>
    </group>
  );
}