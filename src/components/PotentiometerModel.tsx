import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { labelStyle } from './modelStyles';

export default function PotentiometerModel({
  selected,
  resistance,
  wiper,
  onChangeWiper,
}: {
  selected: boolean;
  resistance: number;
  wiper: number;
  onChangeWiper: (v: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const knobRef = useRef<THREE.Group>(null);
  const dragging = useRef(false);

  // Вращаем ручку в зависимости от wiper (-135° .. +135°)
  useFrame(() => {
    if (knobRef.current) {
      const angle = (-0.75 + wiper * 1.5) * Math.PI;
      knobRef.current.rotation.y = -angle;
    }
  });

  const handleKnobDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    dragging.current = true;
    document.body.style.cursor = 'grabbing';
  };

  const handleKnobMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    // @ts-ignore
    const native: PointerEvent = (e as any).nativeEvent || (e as any);
    const delta = native.movementX || 0;
    const next = Math.max(0, Math.min(1, wiper + delta * 0.005));
    onChangeWiper(next);
  };

  const handleKnobUp = () => {
    dragging.current = false;
    document.body.style.cursor = 'default';
  };

  return (
    <group>
      {/* Основной корпус — синий куб со скруглениями */}
      <mesh castShadow position={[0, 0.35, 0]}>
        <boxGeometry args={[1.0, 0.6, 1.0]} />
        <meshStandardMaterial
          color={selected ? '#ef4444' : '#1e40af'}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      {/* Верхняя площадка (белая/серая) */}
      <mesh position={[0, 0.66, 0]}>
        <boxGeometry args={[1.02, 0.05, 1.02]} />
        <meshStandardMaterial color="#e2e8f0" metalness={0.2} roughness={0.7} />
      </mesh>

      {/* Круглая шкала на верхней площадке */}
      <mesh position={[0, 0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.32, 0.42, 32]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>

      {/* Деления шкалы (11 насечек) */}
      {Array.from({ length: 11 }).map((_, i) => {
        const angle = -0.75 + (i / 10) * 1.5;
        const r = 0.38;
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * r, 0.71, Math.cos(angle) * r]}
            rotation={[-Math.PI / 2, 0, -angle]}
          >
            <boxGeometry args={[0.02, 0.08, 0.01]} />
            <meshBasicMaterial
              color={i === Math.round(wiper * 10) ? '#f59e0b' : '#64748b'}
            />
          </mesh>
        );
      })}

      {/* Вал с ручкой (вращается) */}
      <group ref={knobRef} position={[0, 0.75, 0]}>
        {/* Метка на валу */}
        <mesh position={[0, 0.06, -0.18]}>
          <boxGeometry args={[0.04, 0.02, 0.12]} />
          <meshBasicMaterial color="#1e293b" />
        </mesh>

        {/* Ручка (цилиндр с насечкой) */}
        <mesh
          castShadow
          position={[0, 0.18, 0]}
          onPointerDown={handleKnobDown}
          onPointerMove={handleKnobMove}
          onPointerUp={handleKnobUp}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'grab';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = 'default';
          }}
        >
          <cylinderGeometry args={[0.22, 0.22, 0.2, 24]} />
          <meshStandardMaterial
            color={hovered ? '#f59e0b' : '#0f172a'}
            emissive={hovered ? '#f59e0b' : '#000'}
            emissiveIntensity={hovered ? 0.4 : 0}
            metalness={0.5}
            roughness={0.6}
          />
        </mesh>

        {/* Насечка на ручке (8 вертикальных полосок) */}
        {Array.from({ length: 8 }).map((_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(a) * 0.22, 0.18, Math.sin(a) * 0.22]}
              rotation={[0, -a, 0]}
            >
              <boxGeometry args={[0.015, 0.18, 0.02]} />
              <meshBasicMaterial color="#334155" />
            </mesh>
          );
        })}
      </group>

      {/* Ушки для пайки (3 штуки: A, W, B) */}
      {[
        { pos: [-0.6, 0.15, 0] as [number, number, number], label: 'A' },
        { pos: [0.6, 0.15, 0] as [number, number, number], label: 'B' },
        { pos: [0, 0.15, 0.6] as [number, number, number], label: 'W' },
      ].map(({ pos, label }) => (
        <group key={label} position={pos}>
          <mesh castShadow>
            <boxGeometry args={[0.15, 0.05, 0.2]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          {/* Отверстие для пайки */}
          <mesh position={[0, 0.03, 0]}>
            <cylinderGeometry args={[0.03, 0.03, 0.02, 12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.5} roughness={0.8} />
          </mesh>
        </group>
      ))}

      {/* Ножки A, B (сбоку) */}
      <mesh castShadow position={[-0.85, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>
      <mesh castShadow position={[0.85, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>

      {/* Ножка W (сверху) */}
      <mesh castShadow position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>

      {/* Подпись */}
      <Html position={[0, 1.55, 0]} center distanceFactor={10}>
        <div
          style={{
            ...labelStyle,
            background: 'rgba(249,115,22,0.95)',
            color: '#fff',
            borderColor: '#f97316',
          }}
        >
          🎚️ {(resistance / 1000).toFixed(1)}kΩ · {Math.round(wiper * 100)}%
        </div>
      </Html>
    </group>
  );
}