import { Html } from '@react-three/drei';
import { labelStyle } from './modelStyles';

export default function DiodeModel({
  selected,
  conducting,
}: {
  selected: boolean;
  conducting: boolean;
}) {
  return (
    <group>
      {/* Стеклянный корпус */}
      <mesh castShadow position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.24, 0.24, 1.1, 32]} />
        <meshPhysicalMaterial
          color={conducting ? '#a7f3d0' : '#e0e7ff'}
          transparent
          opacity={0.55}
          roughness={0.05}
          metalness={0.1}
          transmission={0.6}
          thickness={0.5}
          clearcoat={1}
          emissive={conducting ? '#10b981' : '#000'}
          emissiveIntensity={conducting ? 0.6 : 0}
        />
      </mesh>

      {/* Внутренний кристалл (светится при токе) */}
      <mesh position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.12, 0.12, 0.4, 16]} />
        <meshStandardMaterial
          color={conducting ? '#10b981' : '#475569'}
          emissive={conducting ? '#10b981' : '#000'}
          emissiveIntensity={conducting ? 4 : 0.2}
          metalness={0.4}
          roughness={0.3}
        />
      </mesh>

      {/* Катодная полоса (серебристая) */}
      <mesh position={[0.4, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.245, 0.245, 0.08, 32]} />
        <meshStandardMaterial
          color="#cbd5e1"
          metalness={0.95}
          roughness={0.15}
          emissive="#94a3b8"
          emissiveIntensity={0.1}
        />
      </mesh>

      {/* Вторая полоса — намёк на маркировку */}
      <mesh position={[0.5, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.245, 0.245, 0.04, 32]} />
        <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
      </mesh>

      {/* Ножки A и K */}
      <mesh castShadow position={[-0.85, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.6, 12]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>
      <mesh castShadow position={[0.85, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.045, 0.045, 0.6, 12]} />
        <meshStandardMaterial color="#d4d4d8" metalness={1} roughness={0.15} />
      </mesh>

      {/* Точка на аноде */}
      <mesh position={[-0.6, 0.3, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={0.6} />
      </mesh>

      {/* Свечение при токе */}
      {conducting && (
        <>
          <pointLight position={[0, 0.3, 0]} intensity={0.8} distance={3} color="#10b981" />
          <mesh position={[0, 0.3, 0]}>
            <sphereGeometry args={[0.35, 16, 16]} />
            <meshBasicMaterial color="#10b981" transparent opacity={0.15} depthWrite={false} />
          </mesh>
        </>
      )}

      <Html position={[0, 1.0, 0]} center distanceFactor={10}>
        <div
          style={{
            ...labelStyle,
            background: conducting ? 'rgba(16,185,129,0.95)' : 'rgba(99,102,241,0.95)',
            color: '#fff',
            borderColor: conducting ? '#10b981' : '#6366f1',
          }}
        >
          🔷 {conducting ? 'ПРОВОДИТ' : 'ЗАКРЫТ'}
        </div>
      </Html>
    </group>
  );
}