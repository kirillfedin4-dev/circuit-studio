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
  const knobRef = useRef<THREE.Mesh>(null);
  const dragging = useRef(false);

  // Вращаем ручку в зависимости от wiper (-135° .. +135°)
  useFrame(() => {
    if (knobRef.current) {
      const angle = (-0.75 + wiper * 1.5) * Math.PI;
      knobRef.current.rotation.z = -angle;
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
    // Горизонтальное движение мыши меняет wiper
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
      {/* Корпус — плоский цилиндр */}
      <mesh castShadow position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.5, 32]} />
        <meshStandardMaterial
          color={selected ? '#ef4444' : '#1e293b'}
          metalness={0.6}
          roughness={0.4}
        />
      </mesh>

      {/* Верхняя крышка */}
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.05, 32]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Рукоятка (крутится) */}
      <mesh
        ref={knobRef}
        position={[0, 0.7, 0]}
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
        <cylinderGeometry args={[0.25, 0.25, 0.15, 20]} />
        <meshStandardMaterial
          color={hovered ? '#f59e0b' : '#eab308'}
          emissive={hovered ? '#f59e0b' : '#000'}
          emissiveIntensity={hovered ? 0.6 : 0}
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Метка на рукоятке */}
      <mesh ref={knobRef} position={[0, 0.78, 0]}>
        <boxGeometry args={[0.4, 0.02, 0.04]} />
        <meshBasicMaterial color="#1e293b" />
      </mesh>

      {/* Шкала (полукруг) */}
      {Array.from({ length: 11 }).map((_, i) => {
        const angle = -0.75 + (i / 10) * 1.5;
        const r = 0.42;
        return (
          <mesh
            key={i}
            position={[Math.sin(angle) * r, 0.72, Math.cos(angle) * r]}
            rotation={[0, -angle, 0]}
          >
            <boxGeometry args={[0.02, 0.01, 0.06]} />
            <meshBasicMaterial color={i === Math.round(wiper * 10) ? '#f59e0b' : '#64748b'} />
          </mesh>
        );
      })}

      {/* Ножки: A, B, W */}
      <mesh position={[-1, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[1, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.9, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0, 1.2, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>

      {/* Подпись */}
      <Html position={[0, 1.55, 0]} center distanceFactor={10}>
        <div style={{
          ...labelStyle,
          background: 'rgba(249,115,22,0.95)',
          color: '#fff',
          borderColor: '#f97316',
        }}>
          🎚️ {(resistance / 1000).toFixed(1)}kΩ · {Math.round(wiper * 100)}%
        </div>
      </Html>
    </group>
  );
}