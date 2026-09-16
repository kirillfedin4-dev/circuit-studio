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
      {/* Корпус — простой чёрный куб со скруглениями */}
      <mesh castShadow position={[0, 0.4, 0]}>
        <boxGeometry args={[0.9, 0.7, 0.7]} />
        <meshStandardMaterial
          color={selected ? '#ef4444' : '#1e293b'}
          metalness={0.5}
          roughness={0.5}
        />
      </mesh>

      {/* Верхняя грань — светлее, чтобы читалась форма */}
      <mesh position={[0, 0.76, 0]}>
        <boxGeometry args={[0.92, 0.03, 0.72]} />
        <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.4} />
      </mesh>

      {/* Большая стрелка-индикатор на верхней грани (кликабельная) */}
      <mesh
        position={[0, 0.79, 0]}
        rotation={[-Math.PI / 2, 0, open ? -Math.PI / 2 : Math.PI / 2]}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'default';
        }}
      >
        <coneGeometry args={[0.18, 0.4, 3]} />
        <meshStandardMaterial
          color={hovered ? '#f59e0b' : open ? '#10b981' : '#64748b'}
          emissive={hovered ? '#f59e0b' : open ? '#10b981' : '#000'}
          emissiveIntensity={hovered || open ? 1.2 : 0}
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Точка-индикатор состояния (маленькая, рядом со стрелкой) */}
      <mesh position={[0.32, 0.79, 0.25]}>
        <circleGeometry args={[0.06, 16]} />
        <meshBasicMaterial color={open ? '#10b981' : '#64748b'} />
      </mesh>

      {/* Три ножки: B, C, E — с цветными маркерами */}
      {/* База (B) — слева */}
      <mesh castShadow position={[-0.85, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.7, 10]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[-0.55, 0.4, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#eab308" emissive="#ca8a04" emissiveIntensity={0.6} />
      </mesh>

      {/* Коллектор (C) — справа сверху */}
      <mesh castShadow position={[0.7, 0.7, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.35, 10]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0.5, 0.7, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#0ea5e9" emissive="#0284c7" emissiveIntensity={0.6} />
      </mesh>

      {/* Эмиттер (E) — справа снизу */}
      <mesh castShadow position={[0.7, -0.05, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.35, 10]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0.5, -0.05, 0]}>
        <sphereGeometry args={[0.07, 12, 12]} />
        <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.6} />
      </mesh>

      {/* Подписи пинов на ножках */}
      <Html position={[-0.55, 0.7, 0]} center distanceFactor={12}>
        <div style={{ fontSize: 10, color: '#eab308', fontWeight: 700, pointerEvents: 'none' }}>B</div>
      </Html>
      <Html position={[0.5, 1.0, 0]} center distanceFactor={12}>
        <div style={{ fontSize: 10, color: '#0ea5e9', fontWeight: 700, pointerEvents: 'none' }}>C</div>
      </Html>
      <Html position={[0.5, -0.35, 0]} center distanceFactor={12}>
        <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 700, pointerEvents: 'none' }}>E</div>
      </Html>

      {/* Свечение при открытом */}
      {open && (
        <pointLight position={[0, 0.4, 0]} intensity={0.4} distance={2.5} color="#10b981" />
      )}

      <Html position={[0, 1.3, 0]} center distanceFactor={10}>
        <div
          style={{
            ...labelStyle,
            background: open ? 'rgba(16,185,129,0.95)' : 'rgba(139,92,246,0.95)',
            color: '#fff',
            borderColor: open ? '#10b981' : '#8b5cf6',
          }}
        >
          🔺 {open ? 'ОТКР' : 'ЗАКР'} · hFE={hFE}
        </div>
      </Html>
    </group>
  );
}