import { Html } from '@react-three/drei';
import { labelStyle } from './modelStyles';

export default function DiodeModel({
  selected,
  conducting,
}: {
  selected: boolean;
  /** Пропускает ли ток прямо сейчас (для визуального свечения) */
  conducting: boolean;
}) {
  return (
    <group>
      {/* Корпус — чёрный цилиндр с полосой */}
      <mesh castShadow position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 1.0, 24]} />
        <meshStandardMaterial
          color={selected ? '#ef4444' : '#0f172a'}
          metalness={0.5}
          roughness={0.4}
        />
      </mesh>

      {/* Серебристая полоса (катод) */}
      <mesh position={[0.35, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.23, 0.23, 0.08, 24]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Треугольник (анод → катод) — намёк на направление */}
      <mesh position={[-0.15, 0.3, 0.24]}>
        <coneGeometry args={[0.12, 0.25, 3]} />
        <meshStandardMaterial
          color={conducting ? '#10b981' : '#64748b'}
          emissive={conducting ? '#10b981' : '#000'}
          emissiveIntensity={conducting ? 0.8 : 0}
        />
      </mesh>

      {/* Ножки: A и K */}
      <mesh position={[-0.8, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>
      <mesh position={[0.8, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.04, 0.04, 0.5, 10]} />
        <meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} />
      </mesh>

      {/* Свечение при протекании тока */}
      {conducting && (
        <pointLight position={[0, 0.3, 0]} intensity={0.6} distance={3} color="#10b981" />
      )}

      {/* Подпись */}
      <Html position={[0, 0.95, 0]} center distanceFactor={10}>
        <div style={{
          ...labelStyle,
          background: conducting ? 'rgba(16,185,129,0.95)' : 'rgba(99,102,241,0.95)',
          color: '#fff',
          borderColor: conducting ? '#10b981' : '#6366f1',
        }}>
          🔷 {conducting ? 'ПРОВОДИТ' : 'ЗАКРЫТ'}
        </div>
      </Html>
    </group>
  );
}