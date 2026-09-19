import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { Canvas, useThree, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Grid, Line, Html, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { THEMES, type ThemeKey, type Theme } from './theme';
import { api, setToken, getToken, WS_URL, type ApiUser } from './api';
import AuthPanel from './components/AuthPanel';
import CloudPanel from './components/CloudPanel';
import Oscilloscope from './components/Oscilloscope';
import GLBModel from './components/GLBModel';
import Sparks from './components/Sparks';
import { GlassShards, LightningBolt, SootMark, CameraShake } from './components/ExplosionEffects';
import LessonsMap from './components/LessonsMap';
import LessonView from './components/LessonView';
import Sidebar from './components/Sidebar';
import RobotMascot from './components/RobotMascot';
import LampContextMenu from './components/LampContextMenu';
import { LESSONS } from './lessons';
import type { CircuitComponent, Wire, ComponentType } from './types';
import RemoteCursor from './components/RemoteCursor';
import TransistorModel from './components/TransistorModel';
import DiodeModel from './components/DiodeModel';
import PotentiometerModel from './components/PotentiometerModel';

interface SubCircuit {
  id: string;
  name: string;
  icon: string;
  components: CircuitComponent[];
  wires: Wire[];
}

const PINS: Record<ComponentType, { name: string; offset: [number, number, number] }[]> = {
  battery: [{ name: '+', offset: [0.9, 0.35, 0] }, { name: '-', offset: [-0.9, 0.35, 0] }],
  resistor: [{ name: 'A', offset: [-1, 0.3, 0] }, { name: 'B', offset: [1, 0.3, 0] }],
  lamp: [{ name: 'A', offset: [-0.7, 0.15, 0] }, { name: 'B', offset: [0.7, 0.15, 0] }],
  capacitor: [{ name: '+', offset: [0.7, 0.3, 0] }, { name: '-', offset: [-0.7, 0.3, 0] }],
  inductor: [{ name: 'A', offset: [-0.9, 0.3, 0] }, { name: 'B', offset: [0.9, 0.3, 0] }],
  led: [{ name: '+', offset: [-0.7, 0.15, 0] }, { name: 'B', offset: [0.7, 0.15, 0] }],
  switch: [{ name: 'A', offset: [-0.9, 0.2, 0] }, { name: 'B', offset: [0.9, 0.2, 0] }],
  ground: [{ name: 'GND', offset: [0, 0.6, 0] }],
  ammeter: [{ name: 'IN', offset: [-0.9, 0.2, 0] }, { name: 'OUT', offset: [0.9, 0.2, 0] }],
  voltmeter: [{ name: '+', offset: [-0.9, 0.2, 0] }, { name: '-', offset: [0.9, 0.2, 0] }],
  transistor: [
    { name: 'B', offset: [-0.85, 0.3, 0] },
    { name: 'C', offset: [0.7, 0.7, 0] },
    { name: 'E', offset: [0.7, -0.05, 0] },
  ],
  diode: [
    { name: 'A', offset: [-0.6, 0.3, 0] },
    { name: 'K', offset: [0.6, 0.3, 0] },
  ],
  potentiometer: [
    { name: 'A', offset: [-1, 0.3, 0] },
    { name: 'W', offset: [0, 1.2, 0] },
    { name: 'B', offset: [1, 0.3, 0] },
  ],
};

function rotateOffset3D(offset: [number, number, number], rot: [number, number, number]): [number, number, number] {
  const [rx, ry, rz] = rot.map((d) => (d * Math.PI) / 180) as [number, number, number];
  let [x, y, z] = offset;
  let ny = y * Math.cos(rx) - z * Math.sin(rx);
  let nz = y * Math.sin(rx) + z * Math.cos(rx);
  y = ny; z = nz;
  let nx = x * Math.cos(ry) + z * Math.sin(ry);
  nz = -x * Math.sin(ry) + z * Math.cos(ry);
  x = nx; z = nz;
  nx = x * Math.cos(rz) - y * Math.sin(rz);
  ny = x * Math.sin(rz) + y * Math.cos(rz);
  x = nx; y = ny;
  return [x, y, z];
}

function getComponentResistance(c: CircuitComponent): number {
  if (c.type === 'resistor') return c.resistance ?? 220;
  if (c.type === 'lamp') return (c.rating ?? 1) * 100;
  if (c.type === 'led') return 150;
  if (c.type === 'diode') return 50;
  if (c.type === 'ammeter') return 0.01;
  if (c.type === 'potentiometer') return (c.resistance ?? 1000) * (c.wiper ?? 0.5);
  return 0;
}

function getOtherPin(type: string, pin: string): string | null {
  switch (type) {
    case 'resistor':
    case 'lamp':
    case 'inductor':
    case 'switch':
      return pin === 'A' ? 'B' : 'A';
    case 'led':
    case 'capacitor':
      return pin === '+' ? '-' : '+';
    case 'ammeter':
      return pin === 'IN' ? 'OUT' : 'IN';
    case 'diode':
      return pin === 'A' ? 'K' : 'A';
    case 'transistor':
      return null;
    case 'potentiometer':
      if (pin === 'A') return 'B';
      if (pin === 'B') return 'A';
      return null;
    default:
      return null;
  }
}

const audioCtxRef: { current: AudioContext | null } = { current: null };

function getAudioCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtxRef.current) {
    try {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch { return null; }
  }
  if (audioCtxRef.current.state === 'suspended') {
    audioCtxRef.current.resume().catch(() => {});
  }
  return audioCtxRef.current;
}

function playClick() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.06);
}

function playConnect() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const osc = ctx.createOscillator(); const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(660, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(990, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.12, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + 0.13);
}

function playExplosion() {
  const ctx = getAudioCtx(); if (!ctx) return;
  const bufferSize = ctx.sampleRate * 0.4;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufferSize, 2);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 800;
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + 0.4);
}

function LampHum({ active, volume, muted }: { active: boolean; volume: number; muted: boolean }) {
  const oscRef = useRef<OscillatorNode | null>(null);
  const gainRef = useRef<GainNode | null>(null);

  useEffect(() => {
    const ctx = getAudioCtx(); if (!ctx) return;
    const shouldPlay = active && !muted && volume > 0;

    if (shouldPlay && !oscRef.current) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 60;
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      oscRef.current = osc;
      gainRef.current = gain;
    }

    if (gainRef.current) {
      const target = shouldPlay ? Math.min(0.03, volume * 0.03) : 0;
      gainRef.current.gain.linearRampToValueAtTime(target, ctx.currentTime + 0.15);
    }

    if (!shouldPlay && oscRef.current) {
      const osc = oscRef.current;
      setTimeout(() => { try { osc.stop(); } catch {} }, 200);
      oscRef.current = null;
      gainRef.current = null;
    }
  }, [active, volume, muted]);

  useEffect(() => () => {
    if (oscRef.current) { try { oscRef.current.stop(); } catch {} }
  }, []);

  return null;
}

function BatteryModel({ selected, voltage }: { selected: boolean; voltage: number }) {
  return (
    <group>
      <mesh castShadow receiveShadow position={[0, 0.3, 0]}>
        <boxGeometry args={[1.4, 0.7, 0.7]} />
        <meshStandardMaterial color={selected ? '#ef4444' : '#1e293b'} metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.56, 0]}>
        <boxGeometry args={[1.42, 0.1, 0.72]} />
        <meshStandardMaterial color={selected ? '#f59e0b' : '#0ea5e9'} emissive={selected ? '#f59e0b' : '#0ea5e9'} emissiveIntensity={0.4} metalness={0.5} roughness={0.2} />
      </mesh>
      <mesh castShadow position={[0.85, 0.3, 0]}><cylinderGeometry args={[0.18, 0.18, 0.5, 20]} /><meshStandardMaterial color="#ef4444" metalness={0.9} roughness={0.2} /></mesh>
      <mesh position={[0.85, 0.6, 0]}><cylinderGeometry args={[0.13, 0.13, 0.15, 16]} /><meshStandardMaterial color="#eab308" metalness={0.9} /></mesh>
      <mesh castShadow position={[-0.85, 0.3, 0]}><cylinderGeometry args={[0.18, 0.18, 0.35, 20]} /><meshStandardMaterial color="#2563eb" metalness={0.9} roughness={0.2} /></mesh>
      <mesh position={[-0.85, 0.5, 0]}><cylinderGeometry args={[0.13, 0.13, 0.15, 16]} /><meshStandardMaterial color="#38bdf8" metalness={0.9} /></mesh>
      <Html position={[0, 1.2, 0]} center distanceFactor={10}><div style={labelStyle}>🔋 {voltage}V</div></Html>
    </group>
  );
}

function ResistorModel({ selected, resistance }: { selected: boolean; resistance: number }) {
  const bands = ['#78350f', '#000000', '#dc2626', '#eab308'];
  return (
    <group>
      <mesh castShadow position={[0, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.28, 0.28, 1.3, 24]} /><meshStandardMaterial color={selected ? '#ef4444' : '#d4a373'} roughness={0.5} metalness={0.1} /></mesh>
      {bands.map((color, i) => (
        <mesh key={i} position={[-0.35 + i * 0.25, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.29, 0.29, 0.1, 24]} /><meshStandardMaterial color={color} roughness={0.6} /></mesh>
      ))}
      <mesh castShadow position={[-0.9, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.6, 12]} /><meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} /></mesh>
      <mesh castShadow position={[0.9, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.6, 12]} /><meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.15} /></mesh>
      <Html position={[0, 1.1, 0]} center distanceFactor={10}><div style={labelStyle}>⚡ {resistance >= 1000 ? `${(resistance / 1000).toFixed(1)}kΩ` : `${resistance}Ω`}</div></Html>
    </group>
  );
}

function LampModel({ selected, lit, burnt, overheated, rating }: { selected: boolean; lit: boolean; burnt: boolean; overheated: boolean; rating: number }) {
  const glowSpriteRef = useRef<THREE.Sprite>(null);
  useFrame(({ clock }) => {
    if (lit && !burnt && glowSpriteRef.current) {
      const t = clock.getElapsedTime();
      const scale = 1 + Math.sin(t * 15) * 0.04 + Math.sin(t * 7) * 0.03;
      glowSpriteRef.current.scale.set(scale * 3, scale * 3, 1);
    }
  });
  const glowTexture = useMemo(() => {
    const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    grad.addColorStop(0, 'rgba(255, 235, 130, 0.85)');
    grad.addColorStop(0.4, 'rgba(255, 200, 80, 0.35)');
    grad.addColorStop(1, 'rgba(255, 180, 60, 0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(canvas);
  }, []);
  return (
    <group>
      <mesh castShadow position={[0, 0.55, 0]}>
        <sphereGeometry args={[0.42, 32, 32]} />
        <meshStandardMaterial color={burnt ? '#2a1a1a' : overheated ? '#ff6b35' : lit ? '#fff8c0' : '#cbd5e1'} emissive={burnt ? '#000' : overheated ? '#ff3300' : lit ? '#fbbf24' : '#000'} emissiveIntensity={overheated ? 3 : lit ? 2.5 : 0} roughness={0.1} metalness={0.3} transparent opacity={0.92} />
      </mesh>
      {!burnt && (
        <mesh position={[0, 0.55, 0]}>
          <torusGeometry args={[0.15, 0.025, 8, 16]} />
          <meshStandardMaterial color={overheated ? '#ff3300' : lit ? '#fbbf24' : '#92400e'} emissive={overheated ? '#ff3300' : lit ? '#fbbf24' : '#000'} emissiveIntensity={overheated ? 4 : lit ? 3 : 0.2} />
        </mesh>
      )}
      <mesh castShadow position={[0, 0.12, 0]}><cylinderGeometry args={[0.22, 0.22, 0.35, 20]} /><meshStandardMaterial color={selected ? '#ef4444' : burnt ? '#44403c' : '#94a3b8'} metalness={0.9} roughness={0.3} /></mesh>
      {[0.05, 0.1, 0.15].map((y, i) => (<mesh key={i} position={[0, 0.05 + i * 0.07, 0]}><torusGeometry args={[0.23, 0.02, 8, 24]} /><meshStandardMaterial color="#94a3b8" metalness={0.9} /></mesh>))}
      {lit && !burnt && (
        <>
          <pointLight position={[0, 0.55, 0]} intensity={overheated ? 4 : 3} distance={8} color={overheated ? '#ff3300' : '#fbbf24'} castShadow shadow-mapSize={[1024, 1024]} shadow-bias={-0.0005} />
          <sprite ref={glowSpriteRef} position={[0, 0.55, 0]} scale={[3, 3, 1]}>
            <spriteMaterial map={glowTexture} transparent opacity={0.7} depthWrite={false} blending={THREE.AdditiveBlending} />
          </sprite>
        </>
      )}
      <Html position={[0, 1.3, 0]} center distanceFactor={10}>
        <div style={{ ...labelStyle, background: overheated ? 'rgba(255,100,50,0.95)' : labelStyle.background, borderColor: overheated ? '#ff3300' : labelStyle.borderColor, color: overheated ? '#fff' : labelStyle.color }}>
          {burnt ? '💥 ' : overheated ? '🔥 ' : '💡 '}{rating}W
        </div>
      </Html>
    </group>
  );
}

function CapacitorModel({ selected, capacitance }: { selected: boolean; capacitance: number }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.4, 0]}><cylinderGeometry args={[0.35, 0.35, 0.9, 24]} /><meshStandardMaterial color={selected ? '#ef4444' : '#334155'} metalness={0.5} roughness={0.4} /></mesh>
      <mesh position={[0, 0.15, 0]}><cylinderGeometry args={[0.36, 0.36, 0.12, 24]} /><meshStandardMaterial color="#94a3b8" emissive="#64748b" emissiveIntensity={0.2} /></mesh>
      <mesh position={[0, 0.65, 0]}><cylinderGeometry args={[0.36, 0.36, 0.12, 24]} /><meshStandardMaterial color="#f87171" emissive="#dc2626" emissiveIntensity={0.2} /></mesh>
      <mesh position={[0.65, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.6, 12]} /><meshStandardMaterial color="#c0c0c0" metalness={1} /></mesh>
      <mesh position={[-0.65, 0.4, 0]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.05, 0.05, 0.6, 12]} /><meshStandardMaterial color="#c0c0c0" metalness={1} /></mesh>
      <Html position={[0, 1.2, 0]} center distanceFactor={10}><div style={labelStyle}>🔌 {capacitance}µF</div></Html>
    </group>
  );
}

function InductorModel({ selected, inductance }: { selected: boolean; inductance: number }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.15, 0]}><boxGeometry args={[1.6, 0.1, 0.5]} /><meshStandardMaterial color="#a16207" roughness={0.8} /></mesh>
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (<mesh key={i} castShadow position={[-0.6 + i * 0.2, 0.35, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.22, 0.05, 12, 24]} /><meshStandardMaterial color={selected ? '#ef4444' : '#d97706'} metalness={0.9} roughness={0.3} /></mesh>))}
      <mesh position={[-0.85, 0.2, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 10]} /><meshStandardMaterial color="#c0c0c0" metalness={1} /></mesh>
      <mesh position={[0.85, 0.2, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 10]} /><meshStandardMaterial color="#c0c0c0" metalness={1} /></mesh>
      <Html position={[0, 1, 0]} center distanceFactor={10}><div style={labelStyle}>🌀 {inductance}mH</div></Html>
    </group>
  );
}

function LedModel({ selected, lit, burnt }: { selected: boolean; lit: boolean; burnt: boolean }) {
  const color = lit ? '#10b981' : '#94a3b8';
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}><sphereGeometry args={[0.3, 24, 24, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={color} emissive={lit ? '#10b981' : '#000'} emissiveIntensity={lit ? 3 : 0} transparent opacity={0.9} roughness={0.1} /></mesh>
      <mesh castShadow position={[0, 0.35, 0]}><cylinderGeometry args={[0.3, 0.28, 0.3, 24]} /><meshStandardMaterial color={selected ? '#ef4444' : burnt ? '#44403c' : '#cbd5e1'} roughness={0.5} transparent opacity={0.85} /></mesh>
      <mesh position={[-0.2, 0.1, 0]}><cylinderGeometry args={[0.04, 0.04, 0.5, 10]} /><meshStandardMaterial color="#c0c0c0" metalness={1} /></mesh>
      <mesh position={[0.2, 0.05, 0]}><cylinderGeometry args={[0.04, 0.04, 0.4, 10]} /><meshStandardMaterial color="#c0c0c0" metalness={1} /></mesh>
      {lit && !burnt && <pointLight position={[0, 0.5, 0]} intensity={1.5} distance={5} color="#10b981" />}
      <Html position={[0, 1.1, 0]} center distanceFactor={10}><div style={labelStyle}>{burnt ? '💥 LED' : '🟢 LED'}</div></Html>
    </group>
  );
}

function SwitchModel({ selected, closed, onToggle }: { selected: boolean; closed: boolean; onToggle: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group>
      <mesh castShadow position={[0, 0.1, 0]}><boxGeometry args={[1.6, 0.2, 0.6]} /><meshStandardMaterial color={selected ? '#ef4444' : '#334155'} metalness={0.4} roughness={0.5} /></mesh>
      <mesh position={[-0.6, 0.25, 0]}><boxGeometry args={[0.15, 0.15, 0.15]} /><meshStandardMaterial color="#eab308" metalness={0.9} emissive="#ca8a04" emissiveIntensity={0.3} /></mesh>
      <mesh position={[0.6, 0.25, 0]}><boxGeometry args={[0.15, 0.15, 0.15]} /><meshStandardMaterial color="#eab308" metalness={0.9} emissive="#ca8a04" emissiveIntensity={0.3} /></mesh>
      <group position={[-0.6, 0.32, 0]} rotation={[0, 0, closed ? 0 : 0.6]}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <mesh castShadow position={[0.6, 0, 0]}><boxGeometry args={[1.3, 0.08, 0.15]} /><meshStandardMaterial color={hovered ? '#f59e0b' : closed ? '#10b981' : '#64748b'} metalness={0.7} emissive={hovered ? '#f59e0b' : closed ? '#10b981' : '#000'} emissiveIntensity={hovered || closed ? 0.7 : 0} /></mesh>
      </group>
      <Html position={[0, 1, 0]} center distanceFactor={10}><div style={labelStyle}>🔀 {closed ? 'Замкнут' : 'Разомкнут'}</div></Html>
    </group>
  );
}

function GroundModel({ selected }: { selected: boolean }) {
  return (
    <group>
      <mesh castShadow position={[0, 0.4, 0]}><cylinderGeometry args={[0.06, 0.06, 0.8, 12]} /><meshStandardMaterial color="#c0c0c0" metalness={1} roughness={0.2} /></mesh>
      {[0.05, 0.1, 0.15].map((y, i) => (<mesh key={i} position={[0, y, 0]}><boxGeometry args={[0.8 - i * 0.2, 0.06, 0.06]} /><meshStandardMaterial color={selected ? '#ef4444' : '#94a3b8'} metalness={0.9} roughness={0.2} /></mesh>))}
      <Html position={[0, 0.85, 0]} center distanceFactor={10}><div style={labelStyle}>⏚ GND</div></Html>
    </group>
  );
}

function AmmeterModel({ selected, current, energized }: { selected: boolean; current: number; energized: boolean }) {
  const ratio = Math.min(1, Math.abs(current) / 1);
  const angle = -Math.PI / 2 + ratio * Math.PI;
  const needleRef = useRef<THREE.Group>(null);
  useEffect(() => { if (needleRef.current) needleRef.current.rotation.z = -angle; }, [angle]);
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}><boxGeometry args={[1.2, 1, 0.4]} /><meshStandardMaterial color={selected ? '#ef4444' : '#1e293b'} roughness={0.5} /></mesh>
      <mesh position={[0, 0.5, 0.21]}><circleGeometry args={[0.42, 32]} /><meshStandardMaterial color="#f8fafc" /></mesh>
      {Array.from({ length: 7 }).map((_, i) => { const a = -Math.PI / 2 + (i / 6) * Math.PI; return (<mesh key={i} position={[Math.cos(a) * 0.35, 0.5 + Math.sin(a) * 0.35, 0.22]} rotation={[0, 0, a - Math.PI / 2]}><boxGeometry args={[0.02, 0.06, 0.01]} /><meshBasicMaterial color="#475569" /></mesh>); })}
      <group ref={needleRef} position={[0, 0.5, 0.23]}><mesh position={[0, 0.18, 0]}><boxGeometry args={[0.02, 0.36, 0.01]} /><meshBasicMaterial color="#dc2626" /></mesh></group>
      <mesh position={[0, 0.5, 0.23]}><circleGeometry args={[0.04, 16]} /><meshBasicMaterial color="#1e293b" /></mesh>
      <Html position={[0, 0.5, 0.25]} center distanceFactor={10}><div style={{ fontSize: 9, color: '#1e293b', fontWeight: 700, marginTop: 20 }}>A</div></Html>
      <Html position={[0, 1.4, 0]} center distanceFactor={10}><div style={labelStyle}>📏 {(current * 1000).toFixed(0)} мА</div></Html>
      <mesh position={[0, 0.05, 0]}><boxGeometry args={[1.25, 0.08, 0.45]} /><meshStandardMaterial color={energized ? '#10b981' : '#64748b'} emissive={energized ? '#10b981' : '#000'} emissiveIntensity={energized ? 0.7 : 0} /></mesh>
    </group>
  );
}

function VoltmeterModel({ selected, voltage, energized }: { selected: boolean; voltage: number; energized: boolean }) {
  const ratio = Math.min(1, Math.abs(voltage) / 24);
  const angle = -Math.PI / 2 + ratio * Math.PI;
  const needleRef = useRef<THREE.Group>(null);
  useEffect(() => { if (needleRef.current) needleRef.current.rotation.z = -angle; }, [angle]);
  return (
    <group>
      <mesh castShadow position={[0, 0.5, 0]}><boxGeometry args={[1.2, 1, 0.4]} /><meshStandardMaterial color={selected ? '#ef4444' : '#1e293b'} roughness={0.5} /></mesh>
      <mesh position={[0, 0.5, 0.21]}><circleGeometry args={[0.42, 32]} /><meshStandardMaterial color="#f8fafc" /></mesh>
      {Array.from({ length: 7 }).map((_, i) => { const a = -Math.PI / 2 + (i / 6) * Math.PI; return (<mesh key={i} position={[Math.cos(a) * 0.35, 0.5 + Math.sin(a) * 0.35, 0.22]} rotation={[0, 0, a - Math.PI / 2]}><boxGeometry args={[0.02, 0.06, 0.01]} /><meshBasicMaterial color="#475569" /></mesh>); })}
      <group ref={needleRef} position={[0, 0.5, 0.23]}><mesh position={[0, 0.18, 0]}><boxGeometry args={[0.02, 0.36, 0.01]} /><meshBasicMaterial color="#0284c7" /></mesh></group>
      <mesh position={[0, 0.5, 0.23]}><circleGeometry args={[0.04, 16]} /><meshBasicMaterial color="#1e293b" /></mesh>
      <Html position={[0, 0.5, 0.25]} center distanceFactor={10}><div style={{ fontSize: 9, color: '#1e293b', fontWeight: 700, marginTop: 20 }}>V</div></Html>
      <Html position={[0, 1.4, 0]} center distanceFactor={10}><div style={labelStyle}>📏 {voltage.toFixed(1)} В</div></Html>
      <mesh position={[0, 0.05, 0]}><boxGeometry args={[1.25, 0.08, 0.45]} /><meshStandardMaterial color={energized ? '#0ea5e9' : '#64748b'} emissive={energized ? '#0ea5e9' : '#000'} emissiveIntensity={energized ? 0.7 : 0} /></mesh>
    </group>
  );
}

function SmokeParticles({ position }: { position: [number, number, number] }) {
  const groupRef = useRef<THREE.Group>(null);
  const startTime = useRef(0);
  const particles = useMemo(() => Array.from({ length: 12 }).map(() => ({
    offset: [(Math.random() - 0.5) * 0.3, 0, (Math.random() - 0.5) * 0.3] as [number, number, number],
    speed: 0.5 + Math.random() * 0.4, drift: (Math.random() - 0.5) * 0.6, size: 0.15 + Math.random() * 0.15,
  })), []);
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    if (startTime.current === 0) startTime.current = clock.getElapsedTime();
    const elapsed = clock.getElapsedTime() - startTime.current;
    groupRef.current.children.forEach((child, i) => {
      const p = particles[i]; if (!p) return;
      const t = elapsed * p.speed;
      child.position.set(p.offset[0] + p.drift * t, 0.6 + t * 1.2, p.offset[2] + Math.sin(t * 2 + i) * 0.15);
      const mesh = child as THREE.Mesh;
      const mat = mesh.material as THREE.MeshBasicMaterial;
      if (mat) mat.opacity = Math.max(0, 0.5 - elapsed * 0.15);
      const s = 1 + t * 1.5; child.scale.set(s, s, s);
    });
  });
  return (
    <group ref={groupRef} position={position}>
      {particles.map((p, i) => (<mesh key={i} position={[p.offset[0], 0.6, p.offset[2]]}><sphereGeometry args={[p.size, 8, 8]} /><meshBasicMaterial color="#64748b" transparent opacity={0.5} depthWrite={false} /></mesh>))}
    </group>
  );
}

function PinMarker({ pin, compId, onPinDown, onPinUp, onCancel, active, highlighted }: {
  pin: { name: string; offset: [number, number, number] }; compId: string;
  onPinDown: (ref: { comp: string; pin: string }, e: ThreeEvent<PointerEvent>) => void;
  onPinUp: (ref: { comp: string; pin: string }) => void;
  onCancel: () => void;
  active: boolean; highlighted: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const ref = { comp: compId, pin: pin.name };
  return (
    <group position={pin.offset}>
      <mesh
        onPointerDown={(e) => {
          e.stopPropagation();
          // @ts-ignore
          if ((e as any).button === 2) {
            onCancel();
            return;
          }
          onPinDown(ref, e);
        }}
        onPointerUp={(e) => { e.stopPropagation(); onPinUp(ref); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'crosshair'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[hovered || active ? 0.22 : highlighted ? 0.18 : 0.14, 20, 20]} />
        <meshStandardMaterial
          color={active ? '#10b981' : hovered ? '#0284c7' : highlighted ? '#a855f7' : '#eab308'}
          emissive={active ? '#10b981' : hovered ? '#0284c7' : highlighted ? '#a855f7' : '#ca8a04'}
          emissiveIntensity={active || hovered || highlighted ? 1.2 : 0.4}
        />
      </mesh>
      <mesh
        onPointerDown={(e) => { e.stopPropagation(); onPinDown(ref, e); }}
        onPointerUp={(e) => { e.stopPropagation(); onPinUp(ref); }}
      >
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hovered && (
        <Html position={[0, 0.35, 0]} center distanceFactor={12}>
          <div style={pinLabelStyle}>{pin.name}</div>
        </Html>
      )}
    </group>
  );
}

function DraggableComponent({
  comp, selected, lit, burnt, overheated,
  onClick, onDrag, onDragStart, onDragEnd, disableControls, enableControls,
  connectSource, onPinDown, onPinUp, onCancelConnect, onToggleSwitch, onChangeWiper,
  ammeterReadings, voltmeterReadings, energized,
  remoteUsers, onLampContextMenu, draggedIds,
}: {
  comp: CircuitComponent;
  selected: boolean; lit: boolean; burnt: boolean; overheated: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  onDrag: (pos: [number, number, number]) => void;
  onDragStart: () => void; onDragEnd: () => void;
  disableControls: () => void; enableControls: () => void;
  connectSource: { comp: string; pin: string } | null;
  onPinDown: (ref: { comp: string; pin: string }, e: ThreeEvent<PointerEvent>) => void;
  onPinUp: (ref: { comp: string; pin: string }) => void;
  onCancelConnect: () => void;
  onToggleSwitch: () => void;
  onChangeWiper: (v: number) => void;
  ammeterReadings: Map<string, number>;
  voltmeterReadings: Map<string, number>;
  energized: boolean;
  remoteUsers: { id: string; color: string; selectedId?: string }[];
  onLampContextMenu?: (compId: string, e: ThreeEvent<MouseEvent>) => void;
  draggedIds: Set<string>;
}) {
  const [hovered, setHovered] = useState(false);
  const dragging = useRef(false);
  const { camera, raycaster, pointer } = useThree();
  const plane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), []);
  const rot = comp.rotation ?? [0, 0, 0];
  const remoteSelectors = remoteUsers.filter((u) => u.selectedId === comp.id);

  useEffect(() => {
    const stop = () => {
      if (dragging.current) {
        dragging.current = false;
        onDragEnd();
        enableControls();
      }
    };
    window.addEventListener('pointerup', stop);
    return () => window.removeEventListener('pointerup', stop);
  }, [onDragEnd, enableControls]);

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    // @ts-ignore
    if ((e as any).button === 2 && comp.type === 'lamp' && onLampContextMenu) {
      e.stopPropagation();
      onLampContextMenu(comp.id, e as any);
      return;
    }
    if (connectSource) return;
    e.stopPropagation();
    // @ts-ignore
    const native = (e as any).nativeEvent || (e as any);
    const isMulti = native.shiftKey || native.ctrlKey || native.metaKey;
    if (!isMulti && !draggedIds.has(comp.id)) {
      onClick(e as any);
    } else if (isMulti) {
      onClick(e as any);
    }
    dragging.current = true;
    // Пытаемся захватить указатель на canvas
    const canvas = (window as any).__r3fCanvas as HTMLCanvasElement | null;
    if (canvas && native.pointerId !== undefined) {
      try { canvas.setPointerCapture(native.pointerId); } catch {}
    }
    disableControls();
    onDragStart();
  };

  const handlePointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!dragging.current) return;
    e.stopPropagation();
    raycaster.setFromCamera(pointer, camera);
    const hit = new THREE.Vector3();
    if (raycaster.ray.intersectPlane(plane, hit)) {
      const x = Math.max(-15, Math.min(15, hit.x));
      const z = Math.max(-15, Math.min(15, hit.z));
      onDrag([x, 0, z]);
    }
  };

  return (
    <group
      position={comp.position}
      rotation={[(rot[0] * Math.PI) / 180, (rot[1] * Math.PI) / 180, (rot[2] * Math.PI) / 180]}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onClick={(e) => {
        if (connectSource) return;
        e.stopPropagation();
      }}
      onPointerOver={(e) => {
        if (connectSource) return;
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'grab';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.1, 32]} />
        <meshStandardMaterial
          color={selected ? '#0ea5e9' : hovered ? '#a855f7' : '#e2e8f0'}
          transparent
          opacity={selected ? 0.5 : hovered ? 0.35 : 0.2}
        />
      </mesh>

      {(selected || hovered) && (
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[1.3, 32]} />
          <meshBasicMaterial
            color={selected ? '#d4af37' : '#2a6b3a'}
            transparent
            opacity={0.15}
            depthWrite={false}
          />
        </mesh>
      )}

      {remoteSelectors.map((u, i) => (
        <mesh key={u.id} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.15 + i * 0.08, 1.22 + i * 0.08, 32]} />
          <meshBasicMaterial color={u.color} transparent opacity={0.8} />
        </mesh>
      ))}

      {comp.type === 'battery' && (
        <GLBModel path="/models/battery.glb" fallback={<BatteryModel selected={selected} voltage={comp.voltage ?? 9} />} />
      )}
      {comp.type === 'resistor' && (
        <GLBModel path="/models/resistor.glb" fallback={<ResistorModel selected={selected} resistance={comp.resistance ?? 220} />} />
      )}
      {comp.type === 'lamp' && (
        <GLBModel path="/models/lamp.glb" fallback={<LampModel selected={selected} lit={lit} burnt={burnt} overheated={overheated} rating={comp.rating ?? 1} />} />
      )}
      {comp.type === 'voltmeter' && <VoltmeterModel selected={selected} voltage={voltmeterReadings.get(comp.id) ?? 0} energized={energized} />}
      {comp.type === 'lamp' && burnt && (
        <>
          <SmokeParticles position={[0, 0.5, 0]} />
          <Sparks position={[0, 0.5, 0]} active={burnt} color="#ffaa00" count={25} spread={1.5} speed={2} duration={1.5} />
          <GlassShards position={[0, 0.55, 0]} active={burnt} color="#e2e8f0" count={24} />
        </>
      )}
      {comp.type === 'capacitor' && (
        <GLBModel path="/models/capacitor.glb" fallback={<CapacitorModel selected={selected} capacitance={comp.capacitance ?? 100} />} />
      )}
      {comp.type === 'inductor' && <InductorModel selected={selected} inductance={comp.inductance ?? 10} />}
      {comp.type === 'led' && <LedModel selected={selected} lit={lit} burnt={burnt} />}
      {comp.type === 'switch' && <SwitchModel selected={selected} closed={comp.closed ?? false} onToggle={onToggleSwitch} />}
      {comp.type === 'ground' && <GroundModel selected={selected} />}
      {comp.type === 'ammeter' && <AmmeterModel selected={selected} current={ammeterReadings.get(comp.id) ?? 0} energized={energized} />}
      {comp.type === 'transistor' && (
        <TransistorModel
          selected={selected}
          hFE={comp.hFE ?? 100}
          open={comp.transistorOpen ?? false}
          onToggle={onToggleSwitch}
        />
      )}
      {comp.type === 'diode' && (
        <DiodeModel selected={selected} conducting={lit} />
      )}
      {comp.type === 'potentiometer' && (
        <PotentiometerModel
          selected={selected}
          resistance={comp.resistance ?? 1000}
          wiper={comp.wiper ?? 0.5}
          onChangeWiper={onChangeWiper}
        />
      )}

      {PINS[comp.type].map((pin) => (
        <PinMarker
          key={pin.name}
          pin={pin}
          compId={comp.id}
          active={connectSource?.comp === comp.id && connectSource?.pin === pin.name}
          highlighted={!!connectSource}
          onPinDown={onPinDown}
          onPinUp={onPinUp}
          onCancel={onCancelConnect}
        />
      ))}
    </group>
  );
}

function Wire3D({ from, to, energized, shorted, current, selected, onSelect }: {
  from: [number, number, number]; to: [number, number, number];
  energized: boolean; shorted: boolean; current: number;
  selected: boolean; onSelect: () => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const t = useRef(0);
  const [hovered, setHovered] = useState(false);
  const curve = useMemo(() => {
    const mid = new THREE.Vector3((from[0] + to[0]) / 2, 1.5, (from[2] + to[2]) / 2);
    return new THREE.QuadraticBezierCurve3(new THREE.Vector3(...from), mid, new THREE.Vector3(...to));
  }, [from[0], from[1], from[2], to[0], to[1], to[2]]);
  const points = useMemo(() => curve.getPoints(40), [curve]);
  const color = shorted ? '#dc2626' : selected ? '#a855f7' : energized ? '#10b981' : '#94a3b8';
  const DOT_COUNT = 5;

  useFrame((_, delta) => {
    if (!groupRef.current || !energized) return;
    t.current = (t.current + delta * (0.3 + current * 5)) % 1;
    const children = groupRef.current.children;
    for (let i = 0; i < DOT_COUNT; i++) {
      const offset = (i / DOT_COUNT) % 1;
      const p = curve.getPoint((t.current + offset) % 1);
      children[i]?.position.copy(p);
    }
  });

  const clickSegments = useMemo(() => {
    const segs: { mid: THREE.Vector3; quat: THREE.Quaternion; len: number }[] = [];
    const N = 20;
    for (let i = 0; i < N; i++) {
      const a = curve.getPoint(i / N);
      const b = curve.getPoint((i + 1) / N);
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const dir = b.clone().sub(a);
      const len = dir.length();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
      segs.push({ mid, quat, len });
    }
    return segs;
  }, [curve]);

  return (
    <group>
      <Line points={points} color="#000" lineWidth={Math.min(9, 3 + current * 20)} opacity={0.08} transparent />
      <Line points={points} color={hovered && !selected ? '#0284c7' : color} lineWidth={selected ? 8 : hovered ? 6 : Math.min(8, 2 + current * 20)} />
      {clickSegments.map((s, i) => {
        const euler = new THREE.Euler().setFromQuaternion(s.quat);
        return (
          <mesh key={i} position={s.mid} rotation={[euler.x, euler.y, euler.z]}
            onClick={(e) => { e.stopPropagation(); onSelect(); }}
            onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
            onPointerOut={() => { setHovered(false); document.body.style.cursor = 'default'; }}
          >
            <cylinderGeometry args={[0.22, 0.22, s.len * 1.05, 6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        );
      })}
      {energized && (
        <group ref={groupRef}>
          {Array.from({ length: DOT_COUNT }).map((_, i) => (
            <mesh key={i}><sphereGeometry args={[0.08 + i * 0.01, 10, 10]} /><meshBasicMaterial color={shorted ? '#ef4444' : '#34d399'} /></mesh>
          ))}
        </group>
      )}
    </group>
  );
}

function PendingWire3D({ start }: { start: [number, number, number] }) {
  const { camera, raycaster, pointer } = useThree();
  const [end, setEnd] = useState<[number, number, number]>([start[0], start[1] + 1.5, start[2]]);

  useFrame(() => {
    raycaster.setFromCamera(pointer, camera);
    const p = new THREE.Vector3();
    raycaster.ray.at(6, p);
    setEnd([p.x, Math.max(0.5, p.y), p.z]);
  });

  const points = useMemo(() => {
    const mid = new THREE.Vector3((start[0] + end[0]) / 2, Math.max(start[1], end[1]) + 1, (start[2] + end[2]) / 2);
    const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(...start), mid, new THREE.Vector3(...end));
    return curve.getPoints(30);
  }, [start[0], start[1], start[2], end[0], end[1], end[2]]);

  return (
    <group>
      <Line points={points} color="#059669" lineWidth={3} dashed dashSize={0.15} gapSize={0.1} />
      <mesh position={end}>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial color="#059669" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

interface ChainAnalysis {
  energizedWires: Set<string>;
  shortedWires: Set<string>;
  litLamps: Set<string>;
  burntLamps: Set<string>;
  overheatedLamps: Set<string>;
  errors: string[];
  closed: boolean;
  currentAmps: number;
  totalResistance: number;
  batteryVoltage: number;
  powerPerLamp: Map<string, number>;
  ammeterReadings: Map<string, number>;
  voltmeterReadings: Map<string, number>;
}

function analyzeCircuit(components: CircuitComponent[], wires: Wire[]): ChainAnalysis {
  const errors: string[] = [];
  const energizedWires = new Set<string>();
  const shortedWires = new Set<string>();
  const litLamps = new Set<string>();
  const burntLamps = new Set<string>();
  const overheatedLamps = new Set<string>();
  const powerPerLamp = new Map<string, number>();
  const ammeterReadings = new Map<string, number>();
  const voltmeterReadings = new Map<string, number>();
  let currentAmps = 0, totalResistance = 0, batteryVoltage = 0;

  for (const w of wires) {
    const fromComp = components.find((c) => c.id === w.fromComp);
    const toComp = components.find((c) => c.id === w.toComp);
    if (!fromComp || !toComp) continue;
    if (fromComp.id === toComp.id && fromComp.type === 'battery' &&
      ((w.fromPin === '+' && w.toPin === '-') || (w.fromPin === '-' && w.toPin === '+'))) {
      shortedWires.add(w.id); errors.push(`⚠ Короткое замыкание на батарее!`);
    }
    if (fromComp.type === 'battery' && toComp.type === 'battery' && fromComp.id !== toComp.id) {
      const fromIsPlus = w.fromPin === '+', toIsPlus = w.toPin === '+';
      if (fromIsPlus === toIsPlus) { shortedWires.add(w.id); errors.push(`⚠ Прямое соединение одинаковых полюсов`); }
    }
  }

  for (const bat of components.filter((c) => c.type === 'battery')) {
    const visited = new Set<string>();
    const queue: { comp: string; pin: string }[] = [{ comp: bat.id, pin: '+' }];
    let reachedMinus = false;
    const pathWires: string[] = [];
    const pathComponents = new Set<string>();

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const key = `${cur.comp}:${cur.pin}`;
      if (visited.has(key)) continue;
      visited.add(key);
      if (cur.comp === bat.id && cur.pin === '-') { reachedMinus = true; break; }
      pathComponents.add(cur.comp);

      for (const w of wires) {
        let next: { comp: string; pin: string } | null = null;
        if (w.fromComp === cur.comp && w.fromPin === cur.pin) { next = { comp: w.toComp, pin: w.toPin }; pathWires.push(w.id); }
        else if (w.toComp === cur.comp && w.toPin === cur.pin) { next = { comp: w.fromComp, pin: w.fromPin }; pathWires.push(w.id); }
        if (next) {
          const comp = components.find((c) => c.id === next!.comp);
          if (comp && comp.type !== 'battery') {
            if (comp.type === 'switch' && !comp.closed) continue;
            if (comp.type === 'voltmeter') continue;
            if (comp.type === 'lamp' && burntLamps.has(comp.id)) continue;
            if (comp.type === 'diode') {
              const enteringFrom = next!.pin;
              const otherPin = enteringFrom === 'A' ? 'K' : 'A';
              if (enteringFrom !== 'A') continue;
              queue.push({ comp: comp.id, pin: otherPin });
              continue;
            }
            const otherPin = getOtherPin(comp.type, next!.pin);
            if (otherPin) queue.push({ comp: comp.id, pin: otherPin });
          } else queue.push(next);
        }
      }
    }

    if (reachedMinus) {
      pathWires.forEach((id) => energizedWires.add(id));
      const voltage = bat.voltage ?? 9;
      batteryVoltage = voltage;
      let R = 0;
      pathComponents.forEach((cid) => {
        const c = components.find((x) => x.id === cid);
        if (!c) return;
        if (c.type === 'resistor') R += c.resistance ?? 220;
        if (c.type === 'lamp') R += (c.rating ?? 1) * 100;
        if (c.type === 'led') R += 150;
        if (c.type === 'ammeter') R += 0.01;
        if (c.type === 'diode') R += 50;
        if (c.type === 'potentiometer') R += (c.resistance ?? 1000);
      });
      if (R <= 0) R = 0.1;
      totalResistance = R;
      const I = voltage / R;
      currentAmps = I;
      pathComponents.forEach((cid) => {
        const c = components.find((x) => x.id === cid);
        if (!c) return;
        if (c.type === 'lamp') {
          const lampR = (c.rating ?? 1) * 100;
          const P_lamp = I * I * lampR;
          powerPerLamp.set(c.id, P_lamp);
          if (P_lamp > (c.rating ?? 1) * 1.5) burntLamps.add(c.id);
          else if (P_lamp > (c.rating ?? 1) * 1.1) { overheatedLamps.add(c.id); litLamps.add(c.id); }
          else litLamps.add(c.id);
        }
        if (c.type === 'led') litLamps.add(c.id);
        if (c.type === 'diode') litLamps.add(c.id);
        if (c.type === 'ammeter') ammeterReadings.set(c.id, I);
      });
    } else errors.push(`⚠ Цепь не замкнута`);
  }

  for (const vm of components.filter((c) => c.type === 'voltmeter')) {
    const plusWires = wires.filter((w) =>
      (w.fromComp === vm.id && w.fromPin === '+') ||
      (w.toComp === vm.id && w.toPin === '+')
    );
    const minusWires = wires.filter((w) =>
      (w.fromComp === vm.id && w.fromPin === '-') ||
      (w.toComp === vm.id && w.toPin === '-')
    );
    if (plusWires.length === 0 || minusWires.length === 0) continue;
    const plusCompId = plusWires[0].fromComp === vm.id ? plusWires[0].toComp : plusWires[0].fromComp;
    const minusCompId = minusWires[0].fromComp === vm.id ? minusWires[0].toComp : minusWires[0].fromComp;
    if (plusCompId === minusCompId) {
      const target = components.find((c) => c.id === plusCompId);
      if (!target) continue;
      let U = 0;
      const R_target = getComponentResistance(target);
      if (R_target > 0) U = currentAmps * R_target;
      voltmeterReadings.set(vm.id, U);
    } else {
      voltmeterReadings.set(vm.id, 0);
    }
  }

  return {
    energizedWires, shortedWires, litLamps, burntLamps, overheatedLamps,
    errors, closed: energizedWires.size > 0,
    currentAmps, totalResistance, batteryVoltage, powerPerLamp,
    ammeterReadings, voltmeterReadings,
  };
}

const COMPONENT_LABELS: Record<ComponentType, { icon: string; name: string; color: string }> = {
  battery: { icon: '🔋', name: 'Батарея', color: '#0ea5e9' },
  resistor: { icon: '⚡', name: 'Резистор', color: '#f59e0b' },
  lamp: { icon: '💡', name: 'Лампа', color: '#eab308' },
  capacitor: { icon: '🔌', name: 'Конденсатор', color: '#a855f7' },
  inductor: { icon: '🌀', name: 'Катушка', color: '#d97706' },
  led: { icon: '🟢', name: 'Светодиод', color: '#10b981' },
  switch: { icon: '🔀', name: 'Переключатель', color: '#ec4899' },
  ground: { icon: '⏚', name: 'Земля', color: '#64748b' },
  ammeter: { icon: '📏', name: 'Амперметр', color: '#10b981' },
  voltmeter: { icon: '📐', name: 'Вольтметр', color: '#0ea5e9' },
  transistor: { icon: '🔺', name: 'Транзистор NPN', color: '#8b5cf6' },
  diode: { icon: '🔷', name: 'Диод', color: '#6366f1' },
  potentiometer: { icon: '🎚️', name: 'Потенциометр', color: '#f97316' },
};

const PRESET_BLOCKS: SubCircuit[] = [
  { id: 'rc', name: 'RC-фильтр', icon: '🎛️', components: [
    { id: 'r', type: 'resistor', position: [-1, 0, 0], rotation: [0,0,0], resistance: 1000 },
    { id: 'c', type: 'capacitor', position: [1, 0, 0], rotation: [0,0,0], capacitance: 100 },
  ], wires: [] },
  { id: 'divider', name: 'Делитель', icon: '📐', components: [
    { id: 'r1', type: 'resistor', position: [0, 0, -1], rotation: [0,90,0], resistance: 1000 },
    { id: 'r2', type: 'resistor', position: [0, 0, 1], rotation: [0,90,0], resistance: 1000 },
  ], wires: [{ id: 'w1', fromComp: 'r1', fromPin: 'B', toComp: 'r2', toPin: 'A' }] },
  { id: 'led', name: 'LED + резистор', icon: '🟢', components: [
    { id: 'r', type: 'resistor', position: [-1, 0, 0], rotation: [0,0,0], resistance: 330 },
    { id: 'led', type: 'led', position: [1, 0, 0], rotation: [0,0,0] },
  ], wires: [{ id: 'w1', fromComp: 'r', fromPin: 'B', toComp: 'led', toPin: '+' }] },
  { id: 'lamp-sw', name: 'Лампа + выключатель', icon: '💡', components: [
    { id: 'sw', type: 'switch', position: [-1, 0, 0], rotation: [0,0,0], closed: false },
    { id: 'l', type: 'lamp', position: [1, 0, 0], rotation: [0,0,0], rating: 1 },
  ], wires: [{ id: 'w1', fromComp: 'sw', fromPin: 'B', toComp: 'l', toPin: 'A' }] },
];

export default function App() {
  const [components, setComponents] = useState<CircuitComponent[]>([
    { id: 'bat1', type: 'battery', position: [-4, 0, 0], rotation: [0,0,0], voltage: 9 },
    { id: 'res1', type: 'resistor', position: [0, 0, -2], rotation: [0,0,0], resistance: 220 },
    { id: 'lamp1', type: 'lamp', position: [4, 0, 0], rotation: [0,0,0], rating: 1, lampVolume: 0.5, lampMuted: false },
  ]);
  const [wires, setWires] = useState<Wire[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [selectedWireIds, setSelectedWireIds] = useState<Set<string>>(new Set());
  const [connectSource, setConnectSource] = useState<{ comp: string; pin: string } | null>(null);
  const [soundOn, setSoundOn] = useState(true);
  const [theme, setTheme] = useState<ThemeKey>('light');
  const [cameraMode, setCameraMode] = useState<'free' | 'orbit'>('free');
  const [clipboard, setClipboard] = useState<{
    components: CircuitComponent[];
    wires: Wire[];
  } | null>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  const [screen, setScreen] = useState<'sandbox' | 'lessons' | 'lesson-active'>('sandbox');
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [completedLessons, setCompletedLessons] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem('circuit-studio-lessons-progress');
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [shakeTrigger, setShakeTrigger] = useState(0);
  const [flashScreen, setFlashScreen] = useState(false);
  const [lessonTime, setLessonTime] = useState(0);
  const [lampMenu, setLampMenu] = useState<{ x: number; y: number; compId: string } | null>(null);

  const [marquee, setMarquee] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  const [roomId, setRoomId] = useState(() => {
    if (typeof window === 'undefined') return 'default';
    return new URLSearchParams(window.location.search).get('room') || '';
  });
  const [onlineUsers, setOnlineUsers] = useState<{
    id: string;
    color: string;
    selectedId?: string;
    cursor?: [number, number, number];
    name?: string;
  }[]>([]);
  const [mpStatus, setMpStatus] = useState<'off' | 'connecting' | 'connected'>('off');

  const controlsRef = useRef<any>(null);
  const prevBurntRef = useRef<Set<string>>(new Set());
  const prevClosedRef = useRef<boolean>(false);
  const prevShortRef = useRef<boolean>(false);
  const historyRef = useRef<{ components: CircuitComponent[]; wires: Wire[] }[]>([]);
  const historyIndexRef = useRef(-1);
  const [, setHistoryVersion] = useState(0);

  const marqueeStateRef = useRef<{
    isActive: boolean;
    startX: number;
    startY: number;
    moved: boolean;
  }>({ isActive: false, startX: 0, startY: 0, moved: false });
  const marqueeBlockedRef = useRef(false);

  const dragStartPositions = useRef<Map<string, [number, number, number]>>(new Map());
  const dragAnchorRef = useRef<[number, number, number] | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const yProviderRef = useRef<WebsocketProvider | null>(null);
  const yAwarenessRef = useRef<any>(null);
  const isApplyingRemoteRef = useRef(false);
  const myClientIdRef = useRef(Math.random().toString(36).slice(2, 8));

  const T = THEMES[theme];
  const analysis = useMemo(() => analyzeCircuit(components, wires), [components, wires]);

  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const block = (e: MouseEvent) => e.preventDefault();
    canvas.addEventListener('contextmenu', block);
    return () => canvas.removeEventListener('contextmenu', block);
  }, []);

  useEffect(() => {
    const wake = () => {
      const ctx = getAudioCtx();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      window.removeEventListener('pointerdown', wake);
    };
    window.addEventListener('pointerdown', wake);
    return () => window.removeEventListener('pointerdown', wake);
  }, []);

  useEffect(() => {
    if (getToken()) {
      api.me().then((r) => setUser(r.user)).catch(() => setToken(null));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('circuit-studio-lessons-progress', JSON.stringify(completedLessons));
  }, [completedLessons]);

  useEffect(() => {
    if (screen !== 'lesson-active') {
      setLessonTime(0);
      return;
    }
    setLessonTime(0);
    const id = setInterval(() => setLessonTime((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [screen, activeLessonId]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const isMiddle = e.button === 1;
      const isAltLeft = e.button === 0 && e.altKey;
      if (!isMiddle && !isAltLeft) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-ui-panel]')) return;
      if (target.tagName !== 'CANVAS') return;

      if (isMiddle) e.preventDefault();
      e.preventDefault();
      e.stopPropagation();

      if (controlsRef.current) controlsRef.current.enabled = false;

      marqueeStateRef.current.isActive = true;
      marqueeStateRef.current.startX = e.clientX;
      marqueeStateRef.current.startY = e.clientY;
      marqueeStateRef.current.moved = true;
      setMarquee({
        startX: e.clientX,
        startY: e.clientY,
        endX: e.clientX,
        endY: e.clientY,
      });
    };

    const onPointerMove = (e: PointerEvent) => {
      if (!marqueeStateRef.current.isActive) return;
      setMarquee({
        startX: marqueeStateRef.current.startX,
        startY: marqueeStateRef.current.startY,
        endX: e.clientX,
        endY: e.clientY,
      });
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!marqueeStateRef.current.isActive) return;
      marqueeStateRef.current.isActive = false;

      if (controlsRef.current) controlsRef.current.enabled = true;

      const x1 = Math.min(marqueeStateRef.current.startX, e.clientX);
      const y1 = Math.min(marqueeStateRef.current.startY, e.clientY);
      const x2 = Math.max(marqueeStateRef.current.startX, e.clientX);
      const y2 = Math.max(marqueeStateRef.current.startY, e.clientY);

      const cam = (window as any).__r3fCamera;
      const sz = (window as any).__r3fSize;

      const ids = new Set<string>();
      const wireIds = new Set<string>();
      if (cam && sz) {
        for (const comp of components) {
          const world = new THREE.Vector3(comp.position[0], 0, comp.position[2]);
          const proj = world.clone().project(cam);
          const sx = (proj.x * 0.5 + 0.5) * sz.width;
          const sy = (-proj.y * 0.5 + 0.5) * sz.height;
          if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) {
            ids.add(comp.id);
          }
        }
        for (const w of wires) {
          const fromComp = components.find((c) => c.id === w.fromComp);
          const toComp = components.find((c) => c.id === w.toComp);
          if (!fromComp || !toComp) continue;
          const fromPin = PINS[fromComp.type].find((p) => p.name === w.fromPin);
          const toPin = PINS[toComp.type].find((p) => p.name === w.toPin);
          if (!fromPin || !toPin) continue;
          const fromWorld = new THREE.Vector3(
            fromComp.position[0] + fromPin.offset[0],
            fromComp.position[1] + fromPin.offset[1],
            fromComp.position[2] + fromPin.offset[2]
          );
          const toWorld = new THREE.Vector3(
            toComp.position[0] + toPin.offset[0],
            toComp.position[1] + toPin.offset[1],
            toComp.position[2] + toPin.offset[2]
          );
          const mid = fromWorld.clone().add(toWorld).multiplyScalar(0.5);
          mid.y = 1.5;
          const proj = mid.clone().project(cam);
          const sx = (proj.x * 0.5 + 0.5) * sz.width;
          const sy = (-proj.y * 0.5 + 0.5) * sz.height;
          if (sx >= x1 && sx <= x2 && sy >= y1 && sy <= y2) {
            wireIds.add(w.id);
          }
        }
      }

      setSelectedIds(ids);
      setSelectedWireIds(wireIds);
      setSelectedWireId(null);
      setMarquee(null);
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
    };
  }, [components]);

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  const openLesson = (id: string) => {
    setActiveLessonId(id);
    setScreen('lesson-active');
    setComponents([]);
    setWires([]);
    setSelectedIds(new Set());
    setSelectedWireId(null);
    setConnectSource(null);
  };

  const completeLesson = (id: string) => {
    setCompletedLessons((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const nextLesson = () => {
    if (!activeLessonId) return;
    const idx = LESSONS.findIndex((l) => l.id === activeLessonId);
    const next = LESSONS[idx + 1];
    if (next) openLesson(next.id);
    else setScreen('lessons');
  };

  useEffect(() => {
    if (!roomId) return;
    setMpStatus('connecting');
    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const provider = new WebsocketProvider(WS_URL, roomId, ydoc);
    yProviderRef.current = provider;

    provider.on('status', (e: { status: string }) => {
      setMpStatus(e.status === 'connected' ? 'connected' : 'connecting');
    });

const yComps = ydoc.getMap<Y.Map<any>>('components');
const yWires = ydoc.getMap<Y.Map<any>>('wires');

const applyRemote = () => {
  isApplyingRemoteRef.current = true;
  
  // Преобразуем Y.Map → обычный массив CircuitComponent
  const comps: CircuitComponent[] = [];
  yComps.forEach((yComp) => {
    const comp = yComp.toJSON() as CircuitComponent;
    comps.push(comp);
  });
  
  const wrs: Wire[] = [];
  yWires.forEach((yWire) => {
    const wire = yWire.toJSON() as Wire;
    wrs.push(wire);
  });
  
  setComponents(comps);
  setWires(wrs);
  setTimeout(() => { isApplyingRemoteRef.current = false; }, 50);
};

    yComps.observe(applyRemote);
    yWires.observe(applyRemote);

    provider.on('sync', (synced: boolean) => {
      if (synced && yComps.length === 0 && yWires.length === 0) {
        yComps.push(components);
        yWires.push(wires);
      } else if (synced) {
        applyRemote();
      }
    });

const awareness = provider.awareness;
yAwarenessRef.current = awareness;

if (awareness.getLocalState() === null) {
  awareness.setLocalState({});
}
    const updateUsers = () => {
      const states = Array.from(awareness.getStates().entries()) as [number, any][];
      const others = states
        .filter(([id]) => id !== ydoc.clientID)
        .map(([id, s]) => ({
          id: String(id),
          color: s.user?.color || '#a855f7',
          selectedId: s.user?.selectedId,
          cursor: s.user?.cursor,
          name: s.user?.clientId || String(id).slice(-4),
        }));
      setOnlineUsers(others);
    };
    awareness.on('change', updateUsers);
    updateUsers();

    const myColor = `hsl(${Math.floor(Math.random() * 360)}, 80%, 60%)`;
    awareness.setLocalStateField('user', {
      color: myColor,
      selectedId: null,
      clientId: myClientIdRef.current,
    });

return () => {
  provider.destroy();
  // ⚠️ НЕ вызываем ydoc.destroy() и awareness.destroy()!
  // Они переиспользуются React StrictMode
  ydocRef.current = null;
  yProviderRef.current = null;
  yAwarenessRef.current = null;
  // ...
      setMpStatus('off');
      setOnlineUsers([]);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

useEffect(() => {
  if (!ydocRef.current || mpStatus !== 'connected') return;
  if (isApplyingRemoteRef.current) return;
  
  const yComps = ydocRef.current.getMap<Y.Map<any>>('components');
  const yWires = ydocRef.current.getMap<Y.Map<any>>('wires');
  
  ydocRef.current.transact(() => {
    // === Компоненты ===
    const currentIds = new Set(components.map((c) => c.id));
    const yIds = new Set(yComps.keys());
    
    // Удаляем те, которых больше нет
    for (const id of yIds) {
      if (!currentIds.has(id)) yComps.delete(id);
    }
    
    // Обновляем или добавляем
    for (const comp of components) {
      const existing = yComps.get(comp.id);
      if (!existing) {
        // Новый компонент — создаём Y.Map
        const yComp = new Y.Map();
        Object.entries(comp).forEach(([k, v]) => yComp.set(k, v));
        yComps.set(comp.id, yComp);
      } else {
        // Существующий — обновляем только изменившиеся поля
        for (const [k, v] of Object.entries(comp)) {
          if (JSON.stringify(existing.get(k)) !== JSON.stringify(v)) {
            existing.set(k, v);
          }
        }
      }
    }
    
    // === Провода ===
    const currentWireIds = new Set(wires.map((w) => w.id));
    const yWireIds = new Set(yWires.keys());
    
    for (const id of yWireIds) {
      if (!currentWireIds.has(id)) yWires.delete(id);
    }
    
    for (const wire of wires) {
      const existing = yWires.get(wire.id);
      if (!existing) {
        const yWire = new Y.Map();
        Object.entries(wire).forEach(([k, v]) => yWire.set(k, v));
        yWires.set(wire.id, yWire);
      } else {
        for (const [k, v] of Object.entries(wire)) {
          if (JSON.stringify(existing.get(k)) !== JSON.stringify(v)) {
            existing.set(k, v);
          }
        }
      }
    }
  });
}, [components, wires, mpStatus]);

  useEffect(() => {
    if (!yAwarenessRef.current) return;
    const first = selectedIds.values().next().value;
    yAwarenessRef.current.setLocalStateField('user', {
      ...(yAwarenessRef.current.getLocalState()?.user || {}),
      selectedId: first ?? null,
    });
  }, [selectedIds]);

  useEffect(() => {
    if (!roomId) return;
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const hit = new THREE.Vector3();
    let rafId = 0;
    let lastSent = 0;

    const tick = () => {
      rafId = requestAnimationFrame(tick);
      const now = performance.now();
      if (now - lastSent < 33) return;
      lastSent = now;

      const cam = (window as any).__r3fCamera;
      const ptr = (window as any).__r3fPointer;
      const rcast = (window as any).__r3fRaycaster;
      if (!cam || !ptr || !rcast || !yAwarenessRef.current) return;

      rcast.setFromCamera(ptr, cam);
      if (rcast.ray.intersectPlane(plane, hit)) {
        const x = Math.max(-15, Math.min(15, hit.x));
        const z = Math.max(-15, Math.min(15, hit.z));
        yAwarenessRef.current.setLocalStateField('user', {
          ...(yAwarenessRef.current.getLocalState()?.user || {}),
          cursor: [x, 0, z],
        });
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [roomId]);

  useEffect(() => {
    const snapshot = { components: JSON.parse(JSON.stringify(components)), wires: JSON.parse(JSON.stringify(wires)) };
    const history = historyRef.current;
    const idx = historyIndexRef.current;
    const current = history[idx];
    if (current && JSON.stringify(current.components) === JSON.stringify(snapshot.components) &&
        JSON.stringify(current.wires) === JSON.stringify(snapshot.wires)) return;
    if (idx < history.length - 1) history.splice(idx + 1);
    history.push(snapshot);
    if (history.length > 50) history.shift();
    historyIndexRef.current = history.length - 1;
    setHistoryVersion((v) => v + 1);
  }, [components, wires]);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const snap = historyRef.current[historyIndexRef.current];
      if (snap) {
        setComponents(JSON.parse(JSON.stringify(snap.components)));
        setWires(JSON.parse(JSON.stringify(snap.wires)));
        setSelectedIds(new Set()); setSelectedWireId(null);
      }
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const snap = historyRef.current[historyIndexRef.current];
      if (snap) {
        setComponents(JSON.parse(JSON.stringify(snap.components)));
        setWires(JSON.parse(JSON.stringify(snap.wires)));
        setSelectedIds(new Set()); setSelectedWireId(null);
      }
      setHistoryVersion((v) => v + 1);
    }
  }, []);

  useEffect(() => {
    const prev = prevBurntRef.current;
    let hadNew = false;
    for (const id of analysis.burntLamps) if (!prev.has(id)) hadNew = true;
    if (hadNew) {
      if (soundOn) playExplosion();
      setShakeTrigger((k) => k + 1);
      setFlashScreen(true);
      setTimeout(() => setFlashScreen(false), 120);
    }
    prevBurntRef.current = new Set(analysis.burntLamps);
  }, [analysis.burntLamps, soundOn]);

  useEffect(() => {
    const hasShort = analysis.shortedWires.size > 0;
    if (hasShort && !prevShortRef.current) {
      setShakeTrigger((k) => k + 1);
      setFlashScreen(true);
      setTimeout(() => setFlashScreen(false), 120);
    }
    prevShortRef.current = hasShort;
  }, [analysis.shortedWires.size]);

  useEffect(() => {
    if (!soundOn) return;
    if (analysis.closed !== prevClosedRef.current) {
      playClick(); prevClosedRef.current = analysis.closed;
    }
  }, [analysis.closed, soundOn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (k === 'z' || k === 'я') && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (((e.ctrlKey || e.metaKey) && (k === 'y' || k === 'н')) || ((e.ctrlKey || e.metaKey) && e.shiftKey && (k === 'z' || k === 'я'))) { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && (k === 'c' || k === 'с')) {
        if (selectedIds.size === 0 && selectedWireIds.size === 0) return;
        const comps = components.filter((x) => selectedIds.has(x.id));
        const innerWires = wires.filter(
          (w) => selectedIds.has(w.fromComp) && selectedIds.has(w.toComp)
        );
        const extraWires = wires.filter((w) => selectedWireIds.has(w.id));
        const combinedWires = [...innerWires, ...extraWires.filter(
          (w) => !innerWires.some((iw) => iw.id === w.id)
        )];
        setClipboard({
          components: JSON.parse(JSON.stringify(comps)),
          wires: JSON.parse(JSON.stringify(combinedWires)),
        });
        if (soundOn) playConnect();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (k === 'v' || k === 'м')) {
        if (!clipboard || clipboard.components.length === 0) return;
        const idMap = new Map<string, string>();
        const newComps: CircuitComponent[] = clipboard.components.map((c) => {
          const newId = crypto.randomUUID();
          idMap.set(c.id, newId);
          return {
            ...c,
            id: newId,
            position: [c.position[0] + 1.5, c.position[1], c.position[2] + 1.5],
          };
        });
        const newWires: Wire[] = clipboard.wires.map((w) => ({
          id: crypto.randomUUID(),
          fromComp: idMap.get(w.fromComp) || w.fromComp,
          fromPin: w.fromPin,
          toComp: idMap.get(w.toComp) || w.toComp,
          toPin: w.toPin,
        }));
        setComponents((prev) => [...prev, ...newComps]);
        setWires((prev) => [...prev, ...newWires]);
        setSelectedIds(new Set(newComps.map((c) => c.id)));
        setSelectedWireId(null);
        if (soundOn) playConnect();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (k === 'd' || k === 'в')) {
        e.preventDefault();
        if (selectedIds.size > 0) {
          const newIds: string[] = [];
          const newComps: CircuitComponent[] = [];
          for (const id of selectedIds) {
            const c = components.find((x) => x.id === id);
            if (c) {
              const newId = crypto.randomUUID();
              newComps.push({ ...c, id: newId, position: [c.position[0] + 1.5, 0, c.position[2] + 1.5] });
              newIds.push(newId);
            }
          }
          setComponents((prev) => [...prev, ...newComps]);
          setSelectedIds(new Set(newIds));
        }
        return;
      }
      if (e.key === 'Escape') {
        setConnectSource(null);
        setSelectedIds(new Set());
        setSelectedWireId(null);
        setLampMenu(null);
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        let didSomething = false;
        if (selectedWireIds.size > 0 || selectedWireId) {
          const ids = new Set(selectedWireIds);
          if (selectedWireId) ids.add(selectedWireId);
          setWires((prev) => prev.filter((w) => !ids.has(w.id)));
          setSelectedWireIds(new Set());
          setSelectedWireId(null);
          didSomething = true;
        }
        if (selectedIds.size > 0) {
          setComponents((prev) => prev.filter((c) => !selectedIds.has(c.id)));
          setWires((prev) => prev.filter((w) => !selectedIds.has(w.fromComp) && !selectedIds.has(w.toComp)));
          setSelectedIds(new Set());
          didSomething = true;
        }
        if (didSomething && soundOn) playClick();
      }
      if (selectedIds.size > 0) {
        const upd = (key: 0 | 1 | 2, delta: number) => {
          setComponents((p) => p.map((c) => {
            if (!selectedIds.has(c.id)) return c;
            const r = [...c.rotation] as [number, number, number];
            r[key] += delta;
            return { ...c, rotation: r };
          }));
        };
        if (['q','Q','й','Й'].includes(e.key)) upd(1, -15);
        if (['e','E','у','У'].includes(e.key)) upd(1, 15);
        if (['r','R','к','К'].includes(e.key)) upd(1, 90);
        if (['w','W','ц','Ц'].includes(e.key)) upd(0, -15);
        if (['s','S','ы','Ы'].includes(e.key)) upd(0, 15);
        if (['a','A','ф','Ф'].includes(e.key)) upd(2, -15);
        if (['d','D','в','В'].includes(e.key)) upd(2, 15);
        if (e.key === 'f' || e.key === 'F' || e.key === 'а' || e.key === 'А') {
          const id = selectedIds.values().next().value;
          const c = components.find((x) => x.id === id);
          if (c && controlsRef.current) {
            controlsRef.current.target.copy(new THREE.Vector3(c.position[0], 0, c.position[2]));
          }
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedIds, selectedWireId, selectedWireIds, soundOn, undo, redo, clipboard, components, wires]);

  const disableControls = useCallback(() => { if (controlsRef.current) controlsRef.current.enabled = false; }, []);
  const enableControls = useCallback(() => { if (controlsRef.current) controlsRef.current.enabled = true; }, []);

  const addComponent = (type: ComponentType) => {
    const id = crypto.randomUUID();
    const x = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 10;
    const base: CircuitComponent = { id, type, position: [x, 0, z], rotation: [0, 0, 0] };
    if (type === 'battery') base.voltage = 9;
    if (type === 'resistor') base.resistance = 220;
    if (type === 'lamp') { base.rating = 1; base.lampVolume = 0.5; base.lampMuted = false; }
    if (type === 'capacitor') base.capacitance = 100;
    if (type === 'inductor') base.inductance = 10;
    if (type === 'transistor') { base.hFE = 100; base.transistorOpen = false; }
    if (type === 'potentiometer') { base.resistance = 1000; base.wiper = 0.5; }
    setComponents((prev) => [...prev, base]);
    setSelectedIds(new Set([id])); setSelectedWireId(null);
  };

  const addBlock = (block: SubCircuit) => {
    const bx = (Math.random() - 0.5) * 6;
    const bz = (Math.random() - 0.5) * 6;
    const idMap = new Map<string, string>();
    const newComps: CircuitComponent[] = block.components.map((c) => {
      const newId = crypto.randomUUID();
      idMap.set(c.id, newId);
      const base: CircuitComponent = { ...c, id: newId, position: [c.position[0] + bx, 0, c.position[2] + bz] };
      if (base.type === 'lamp') {
        base.lampVolume = base.lampVolume ?? 0.5;
        base.lampMuted = base.lampMuted ?? false;
      }
      return base;
    });
    const newWires: Wire[] = block.wires.map((w) => ({
      id: crypto.randomUUID(),
      fromComp: idMap.get(w.fromComp) || w.fromComp,
      fromPin: w.fromPin,
      toComp: idMap.get(w.toComp) || w.toComp,
      toPin: w.toPin,
    }));
    setComponents((prev) => [...prev, ...newComps]);
    setWires((prev) => [...prev, ...newWires]);
    if (newComps[0]) setSelectedIds(new Set([newComps[0].id]));
    if (soundOn) playConnect();
  };

  const removeSelected = () => {
    if (selectedIds.size === 0) return;
    setComponents((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setWires((prev) => prev.filter((w) => !selectedIds.has(w.fromComp) && !selectedIds.has(w.toComp)));
    setSelectedIds(new Set()); setConnectSource(null);
  };

  const duplicateSelected = () => {
    if (selectedIds.size === 0) return;
    const newIds: string[] = [];
    const newComps: CircuitComponent[] = [];
    for (const id of selectedIds) {
      const c = components.find((x) => x.id === id);
      if (c) {
        const newId = crypto.randomUUID();
        newComps.push({ ...c, id: newId, position: [c.position[0] + 1.5, 0, c.position[2] + 1.5] });
        newIds.push(newId);
      }
    }
    setComponents((prev) => [...prev, ...newComps]);
    setSelectedIds(new Set(newIds));
    if (soundOn) playConnect();
  };

  const handleComponentDragStart = (comp: CircuitComponent) => {
    const map = new Map<string, [number, number, number]>();
    for (const id of selectedIds) {
      const c = components.find((x) => x.id === id);
      if (c) map.set(id, [...c.position] as [number, number, number]);
    }
    if (!selectedIds.has(comp.id)) {
      map.clear();
      map.set(comp.id, [...comp.position] as [number, number, number]);
    }
    dragStartPositions.current = map;
    dragAnchorRef.current = null;
  };

  const handleComponentDrag = (comp: CircuitComponent, newPos: [number, number, number]) => {
  const now = performance.now();
  if (now - (dragAnchorRef.current as any)?.[0] ?? 0 < 50) return;
  dragAnchorRef.current = [now, 0, 0];
    if (dragStartPositions.current.size <= 1) {
      setComponents((prev) => prev.map((c) => (c.id === comp.id ? { ...c, position: newPos } : c)));
      return;
    }
    const startPos = dragStartPositions.current.get(comp.id);
    if (!startPos) {
      setComponents((prev) => prev.map((c) => (c.id === comp.id ? { ...c, position: newPos } : c)));
      return;
    }
    const dx = newPos[0] - startPos[0];
    const dz = newPos[2] - startPos[2];

    setComponents((prev) => prev.map((c) => {
      const sp = dragStartPositions.current.get(c.id);
      if (sp) {
        return { ...c, position: [sp[0] + dx, 0, sp[2] + dz] };
      }
      if (c.id === comp.id) {
        return { ...c, position: newPos };
      }
      return c;
    }));
  };

  const updateValue = (id: string, key: 'voltage'|'resistance'|'rating'|'capacitance'|'inductance', value: number) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, [key]: value } : c)));
  };

  const updateLampSound = (id: string, patch: { lampMuted?: boolean; lampVolume?: number }) => {
    setComponents((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const rotateSelected = (axis: 0|1|2, delta: number) => {
    if (selectedIds.size === 0) return;
    setComponents((prev) => prev.map((c) => {
      if (!selectedIds.has(c.id)) return c;
      const r = [...c.rotation] as [number, number, number];
      r[axis] += delta;
      return { ...c, rotation: r };
    }));
  };

  const resetRotation = () => {
    if (selectedIds.size === 0) return;
    setComponents((prev) => prev.map((c) => selectedIds.has(c.id) ? { ...c, rotation: [0,0,0] } : c));
  };

  const toggleSwitch = (id: string) => {
    if (soundOn) playClick();
    setComponents((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.type === 'transistor') return { ...c, transistorOpen: !c.transistorOpen };
        return { ...c, closed: !c.closed };
      })
    );
  };

  const saveScreenshot = () => {
    const canvas = document.querySelector('canvas[data-engine]') as HTMLCanvasElement | null
      ?? ((window as any).__r3fCanvas as HTMLCanvasElement | null);
    if (!canvas) {
      alert('Не удалось найти 3D-canvas');
      return;
    }
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `circuit-${Date.now()}.png`;
      a.click();
    } catch (e) {
      alert('Ошибка экспорта: ' + e);
    }
  };

  const saveCircuit = () => {
    const data = JSON.stringify({ components, wires }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `circuit-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const loadCircuit = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string);
        if (data.components && data.wires) {
          setComponents(data.components); setWires(data.wires);
          setSelectedIds(new Set()); setSelectedWireId(null); setConnectSource(null);
        }
      } catch (err) { alert('Ошибка загрузки: ' + err); }
    };
    reader.readAsText(file); e.target.value = '';
  };

  const exportSpice = () => {
    const lines: string[] = ['* Circuit Studio export', '* ' + new Date().toISOString()];
    const nodeMap = new Map<string, number>(); let nodeCounter = 1;
    const getNode = (compId: string, pinName: string): number => {
      const key = `${compId}:${pinName}`;
      if (!nodeMap.has(key)) nodeMap.set(key, nodeCounter++);
      return nodeMap.get(key)!;
    };
    let v = 1, r = 1, lamp = 1, led = 1, w = 1;
    for (const c of components) {
      if (c.type === 'battery') { lines.push(`V${v} ${getNode(c.id,'+')} ${getNode(c.id,'-')} DC ${(c.voltage??9).toFixed(2)}`); v++; }
      if (c.type === 'resistor') { lines.push(`R${r} ${getNode(c.id,'A')} ${getNode(c.id,'B')} ${(c.resistance??220).toFixed(2)}`); r++; }
      if (c.type === 'lamp') { lines.push(`Rlamp${lamp} ${getNode(c.id,'A')} ${getNode(c.id,'B')} ${((c.rating??1)*100).toFixed(2)}`); lamp++; }
      if (c.type === 'led') { lines.push(`Rled${led} ${getNode(c.id,'+')} ${getNode(c.id,'-')} 150`); led++; }
    }
    for (const wr of wires) {
      lines.push(`Rwire${w} ${getNode(wr.fromComp, wr.fromPin)} ${getNode(wr.toComp, wr.toPin)} 0.001`); w++;
    }
    lines.push('.op', '.end');
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `circuit-${Date.now()}.cir`; a.click();
    URL.revokeObjectURL(url);
  };

  const setCameraPreset = (preset: 'top' | 'front' | 'iso' | 'side' | 'reset') => {
    if (!controlsRef.current) return;
    const c = controlsRef.current;
    const target = new THREE.Vector3(0, 0, 0);
    const dist = 18;
    let pos = new THREE.Vector3(9, 8, 10);
    if (preset === 'top') pos = new THREE.Vector3(0, dist, 0.01);
    if (preset === 'front') pos = new THREE.Vector3(0, 4, dist);
    if (preset === 'side') pos = new THREE.Vector3(dist, 4, 0);
    if (preset === 'iso' || preset === 'reset') pos = new THREE.Vector3(9, 8, 10);
    c.object.position.copy(pos);
    c.target.copy(target);
    c.update();
  };

  const handleLampContextMenu = (compId: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation?.();
    // @ts-ignore
    const nativeEvent: MouseEvent = (e as any).nativeEvent || (e as any);
    setLampMenu({
      x: nativeEvent.clientX ?? 0,
      y: nativeEvent.clientY ?? 0,
      compId,
    });
    setSelectedIds(new Set([compId]));
    setSelectedWireId(null);
  };

  const handleComponentClick = (compId: string, e: ThreeEvent<MouseEvent>) => {
    // @ts-ignore
    const native: MouseEvent = (e as any).nativeEvent || (e as any);
    const isMulti = native.shiftKey || native.ctrlKey || native.metaKey;
    if (isMulti) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (next.has(compId)) next.delete(compId);
        else next.add(compId);
        return next;
      });
    } else {
      setSelectedIds(new Set([compId]));
    }
    setSelectedWireId(null);
  };

  const handlePinDown = (ref: { comp: string; pin: string }, _e: ThreeEvent<PointerEvent>) => {
    disableControls(); setConnectSource(ref); setSelectedWireId(null);
  };

  const handlePinUp = (ref: { comp: string; pin: string }) => {
    enableControls();
    if (!connectSource) return;
    if (connectSource.comp === ref.comp && connectSource.pin === ref.pin) { setConnectSource(null); return; }
    const exists = wires.some(
      (w) => (w.fromComp === connectSource.comp && w.fromPin === connectSource.pin && w.toComp === ref.comp && w.toPin === ref.pin) ||
             (w.toComp === connectSource.comp && w.toPin === connectSource.pin && w.fromComp === ref.comp && w.fromPin === ref.pin)
    );
    if (!exists) {
      setWires((prev) => [...prev, { id: crypto.randomUUID(), fromComp: connectSource.comp, fromPin: connectSource.pin, toComp: ref.comp, toPin: ref.pin }]);
      if (soundOn) playConnect();
    }
    setConnectSource(null);
  };

  const selectedComp = selectedIds.size === 1
    ? components.find((c) => c.id === selectedIds.values().next().value) || null
    : null;

  const getPinWorldPos = (comp: CircuitComponent, pinName: string): [number, number, number] | null => {
    const pin = PINS[comp.type].find((p) => p.name === pinName);
    if (!pin) return null;
    const rotated = rotateOffset3D(pin.offset, comp.rotation ?? [0,0,0]);
    return [comp.position[0] + rotated[0], comp.position[1] + rotated[1], comp.position[2] + rotated[2]];
  };

  if (screen === 'lessons') {
    return (
      <LessonsMap
        T={T}
        onSelectLesson={openLesson}
        onBack={() => setScreen('sandbox')}
      />
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, fontFamily: 'Inter, system-ui, sans-serif', background: T.sceneBg }}>
      {soundOn && components
        .filter((c) => c.type === 'lamp' && analysis.litLamps.has(c.id) && !analysis.burntLamps.has(c.id))
        .map((c) => (
          <LampHum
            key={c.id}
            active={true}
            volume={c.lampVolume ?? 0.5}
            muted={!!c.lampMuted}
          />
        ))}

      {flashScreen && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 999,
            background: '#fff',
            pointerEvents: 'none',
            animation: 'flashOut 0.12s ease-out forwards',
          }}
        />
      )}

      {screen === 'lesson-active' && activeLessonId && (
        <LessonView
          T={T}
          theme={theme}
          onChangeTheme={(k) => setTheme(k)}
          lessonId={activeLessonId}
          components={components}
          wires={wires}
          onBack={() => setScreen('lessons')}
          onComplete={completeLesson}
          onNextLesson={nextLesson}
          selectedId={selectedIds.size === 1 ? selectedIds.values().next().value : null}
          onRemoveSelected={removeSelected}
          onDuplicateSelected={duplicateSelected}
          onClearWires={() => { setWires([]); setConnectSource(null); setSelectedWireId(null); }}
          onUndo={undo}
          onRedo={redo}
          canUndo={historyIndexRef.current > 0}
          canRedo={historyIndexRef.current < historyRef.current.length - 1}
          soundOn={soundOn}
          onToggleSound={() => setSoundOn((v) => !v)}
          onRotate={(axis, delta) => rotateSelected(axis, delta)}
          onResetRotation={resetRotation}
          onCameraPreset={(p) => setCameraPreset(p)}
          cameraMode={cameraMode}
          onToggleOrbit={() => setCameraMode((m) => m === 'orbit' ? 'free' : 'orbit')}
          timeSeconds={lessonTime}
          onAddComponent={(type) => {
            const id = crypto.randomUUID();
            const x = (Math.random() - 0.5) * 6;
            const z = (Math.random() - 0.5) * 6;
            const base: CircuitComponent = { id, type, position: [x, 0, z], rotation: [0, 0, 0] };
            if (type === 'battery') base.voltage = 9;
            if (type === 'resistor') base.resistance = 220;
            if (type === 'lamp') { base.rating = 1; base.lampVolume = 0.5; base.lampMuted = false; }
            if (type === 'capacitor') base.capacitance = 100;
            if (type === 'inductor') base.inductance = 10;
            if (type === 'switch') base.closed = false;
            if (type === 'potentiometer') { base.resistance = 1000; base.wiper = 0.5; }
            setComponents((prev) => [...prev, base]);
            setSelectedIds(new Set([id]));
            setSelectedWireId(null);
          }}
          onClear={() => {
            setComponents([]);
            setWires([]);
            setSelectedIds(new Set());
            setSelectedWireId(null);
            setConnectSource(null);
          }}
          onCelebrate={() => setCelebrateKey((k) => k + 1)}
        />
      )}

      {screen !== 'lesson-active' && (
        <div data-ui-panel>
          <Sidebar
            T={T}
            theme={theme}
            user={user}
            currentScreen={screen}
            screens={{
              sandbox: () => setScreen('sandbox'),
              lessons: () => setScreen('lessons'),
            }}
            onAuth={() => setShowAuth(true)}
            onSignOut={signOut}
            onChangeTheme={(k) => setTheme(k)}
            sections={[
              {
                id: 'components',
                icon: '🧩',
                title: 'Компоненты',
                badge: `${components.length}`,
                content: (
                  <>
                    {(Object.keys(COMPONENT_LABELS) as ComponentType[]).map((type) => {
                      const info = COMPONENT_LABELS[type];
                      return (
                        <button key={type}
                          style={{
                            display: 'flex', alignItems: 'center', width: '100%',
                            marginBottom: 6, padding: '8px 12px',
                            background: T.buttonBg, color: T.text,
                            border: `1px solid ${T.buttonBorder}`, borderRadius: 10,
                            cursor: 'pointer', textAlign: 'left', fontSize: 13,
                            transition: 'all 0.15s', fontFamily: 'inherit',
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = T.buttonHoverBg; e.currentTarget.style.borderColor = info.color; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = T.buttonBg; e.currentTarget.style.borderColor = T.buttonBorder; }}
                          onClick={() => addComponent(type)}
                        >
                          <span style={{ fontSize: 16, marginRight: 8 }}>{info.icon}</span>
                          <span>{info.name}</span>
                        </button>
                      );
                    })}
                  </>
                ),
              },
              {
                id: 'blocks',
                icon: '📚',
                title: 'Библиотека блоков',
                content: (
                  <>
                    {PRESET_BLOCKS.map((block) => (
                      <button key={block.id}
                        style={{
                          display: 'flex', alignItems: 'center', width: '100%',
                          marginBottom: 6, padding: '8px 10px',
                          background: T.primarySoft, color: T.primary,
                          border: `1px solid ${T.primary}`, borderRadius: 8,
                          cursor: 'pointer', textAlign: 'left', fontSize: 12,
                          fontFamily: 'inherit', fontWeight: 600,
                        }}
                        onClick={() => addBlock(block)}
                      >
                        <span style={{ fontSize: 16, marginRight: 8 }}>{block.icon}</span>
                        <span>{block.name}</span>
                      </button>
                    ))}
                  </>
                ),
              },
              {
                id: 'cloud',
                icon: '☁️',
                title: 'Облако',
                badge: user ? '✓' : undefined,
                content: (
                  <CloudPanel
                    T={T}
                    user={user}
                    currentData={{ components, wires }}
                    onLoad={(data) => {
                      if (data.components && data.wires) {
                        setComponents(data.components as CircuitComponent[]);
                        setWires(data.wires as Wire[]);
                        setSelectedIds(new Set()); setSelectedWireId(null); setConnectSource(null);
                      }
                    }}
                    onRequestLogin={() => setShowAuth(true)}
                  />
                ),
              },
              {
                id: 'camera',
                icon: '🎥',
                title: 'Камера',
                content: (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                      <button style={presetBtn(T)} onClick={() => setCameraPreset('top')}>⬆️ Сверху</button>
                      <button style={presetBtn(T)} onClick={() => setCameraPreset('front')}>➡️ Спереди</button>
                      <button style={presetBtn(T)} onClick={() => setCameraPreset('side')}>⬅️ Сбоку</button>
                      <button style={presetBtn(T)} onClick={() => setCameraPreset('iso')}>📐 Изо</button>
                    </div>
                    <button
                      style={{ ...actionBtn(T), background: cameraMode === 'orbit' ? T.primarySoft : T.buttonBg, color: cameraMode === 'orbit' ? T.primary : T.textMuted, textAlign: 'center', marginBottom: 0 }}
                      onClick={() => setCameraMode((m) => m === 'orbit' ? 'free' : 'orbit')}
                    >
                      {cameraMode === 'orbit' ? '⏸ Остановить облёт' : '▶️ Облёт вокруг схемы'}
                    </button>
                  </>
                ),
              },
              {
                id: 'multiplayer',
                icon: '👥',
                title: 'Мультиплеер',
                badge: mpStatus === 'connected' ? '🟢' : undefined,
                content: (
                  <>
                    <input
                      type="text"
                      placeholder="ID комнаты (Enter)"
                      value={roomId}
                      onChange={(e) => setRoomId(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const url = new URL(window.location.href);
                          if (roomId) url.searchParams.set('room', roomId);
                          else url.searchParams.delete('room');
                          window.location.href = url.toString();
                        }
                      }}
                      style={{
                        width: '100%', padding: '8px 10px', fontSize: 12, fontFamily: 'inherit',
                        background: T.buttonBg, color: T.text, border: `1px solid ${T.buttonBorder}`,
                        borderRadius: 8, marginBottom: 6, boxSizing: 'border-box',
                      }}
                    />
                    <div style={{ fontSize: 11, marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: T.textMuted }}>
                      <span>
                        {mpStatus === 'off' && '⚪ Офлайн'}
                        {mpStatus === 'connecting' && '🟡 Подключение...'}
                        {mpStatus === 'connected' && '🟢 Онлайн'}
                      </span>
                      <span>{onlineUsers.length + (mpStatus === 'connected' ? 1 : 0)} чел.</span>
                    </div>
                    {onlineUsers.length > 0 && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {onlineUsers.map((u) => (
                          <div key={u.id} style={{ width: 14, height: 14, borderRadius: '50%', background: u.color, border: '2px solid ' + T.panelBg }} />
                        ))}
                      </div>
                    )}
                  </>
                ),
              },
              {
                id: 'actions',
                icon: '🛠️',
                title: 'Действия',
                content: (
                  <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <button style={{ ...smallBtn(T), opacity: historyIndexRef.current > 0 ? 1 : 0.4 }} disabled={historyIndexRef.current <= 0} onClick={undo}>↶ Undo</button>
                      <button style={{ ...smallBtn(T), opacity: historyIndexRef.current < historyRef.current.length - 1 ? 1 : 0.4 }} disabled={historyIndexRef.current >= historyRef.current.length - 1} onClick={redo}>↷ Redo</button>
                    </div>
                    <button style={{ ...actionBtn(T), background: soundOn ? T.primarySoft : T.buttonBg, color: soundOn ? T.primary : T.textDim, textAlign: 'center' }}
                      onClick={() => setSoundOn((v) => !v)}>
                      {soundOn ? '🔊 Звук: вкл' : '🔇 Звук: выкл'}
                    </button>
                    <button style={{ ...actionBtn(T), background: T.dangerSoft, color: T.danger, border: `1px solid ${T.danger}` }} disabled={selectedIds.size === 0} onClick={removeSelected}>
                      🗑 Удалить выбранные ({selectedIds.size})
                    </button>
                    <button style={{ ...actionBtn(T), background: T.buttonBg, color: T.textMuted }} disabled={selectedIds.size === 0} onClick={duplicateSelected}>
                      📄 Дублировать
                    </button>
                    <button style={{ ...actionBtn(T), background: T.buttonBg, color: T.textMuted }} onClick={() => { setWires([]); setConnectSource(null); setSelectedWireId(null); }}>
                      ✂ Очистить провода
                    </button>
                  </>
                ),
              },
              {
                id: 'file',
                icon: '💾',
                title: 'Файл',
                content: (
                  <>
                    <button style={{ ...actionBtn(T), background: T.primarySoft, color: T.primary }} onClick={saveCircuit}>
                      💾 Сохранить (JSON)
                    </button>
                    <label style={{ ...actionBtn(T), background: T.successSoft, color: T.success, display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                      📂 Загрузить (JSON)
                      <input type="file" accept=".json" onChange={loadCircuit} style={{ display: 'none' }} />
                    </label>
                    <button style={{ ...actionBtn(T), background: T.buttonBg, color: T.textMuted }} onClick={exportSpice}>
                      📋 Экспорт SPICE
                    </button>
                    <button style={{ ...actionBtn(T), background: T.buttonBg, color: T.textMuted }} onClick={saveScreenshot}>
                      📸 Скриншот (PNG)
                    </button>
                  </>
                ),
              },
              {
                id: 'help',
                icon: '❓',
                title: 'Управление',
                content: (
                  <div style={{ fontSize: 11, color: T.textDim, lineHeight: 1.7 }}>
                    <div>🖱 ЛКМ по компоненту → выделить</div>
                    <div>🖱 Shift/Alt+ЛКМ → мультивыбор</div>
                    <div>🖱 ЛКМ по фону + тащи → рамка</div>
                    <div>🖱 ПКМ на лампе → громкость</div>
                    <div>⌨ Q/E — Y ±15°</div>
                    <div>⌨ W/S — X ±15°</div>
                    <div>⌨ A/D — Z ±15°</div>
                    <div>⌨ Delete — удалить выбранные</div>
                    <div>⌨ Ctrl+Z/Y — undo/redo</div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}

      {selectedComp && screen !== 'lesson-active' && (
        <div data-ui-panel style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          background: T.panelBg, color: T.text, padding: 18, borderRadius: 16,
          width: 260, backdropFilter: 'blur(16px)', border: `1px solid ${T.panelBorder}`,
          boxShadow: T.panelShadow,
        }}>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${T.panelBorder}` }}>
            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, color: T.text }}>
              <span>{COMPONENT_LABELS[selectedComp.type].icon}</span><span>{COMPONENT_LABELS[selectedComp.type].name}</span>
            </div>
          </div>

          {selectedComp.type === 'battery' && <SliderField label="Напряжение (В)" value={selectedComp.voltage ?? 9} min={1} max={24} step={1} color={T.primary} theme={T} onChange={(v) => updateValue(selectedComp.id, 'voltage', v)} />}
          {selectedComp.type === 'resistor' && <SliderField label="Сопротивление (Ω)" value={selectedComp.resistance ?? 220} min={10} max={10000} step={10} color={T.accent1} theme={T} onChange={(v) => updateValue(selectedComp.id, 'resistance', v)} />}
          {selectedComp.type === 'lamp' && <SliderField label="Мощность (Вт)" value={selectedComp.rating ?? 1} min={0.1} max={10} step={0.1} color={T.success} theme={T} onChange={(v) => updateValue(selectedComp.id, 'rating', v)} />}
          {selectedComp.type === 'capacitor' && <SliderField label="Ёмкость (µF)" value={selectedComp.capacitance ?? 100} min={1} max={1000} step={1} color={T.accent1} theme={T} onChange={(v) => updateValue(selectedComp.id, 'capacitance', v)} />}
          {selectedComp.type === 'transistor' && (
            <>
              <SliderField
                label="Коэффициент усиления hFE"
                value={selectedComp.hFE ?? 100}
                min={10}
                max={500}
                step={10}
                color="#8b5cf6"
                theme={T}
                onChange={(v) => {
                  setComponents((prev) =>
                    prev.map((c) => (c.id === selectedComp.id ? { ...c, hFE: v } : c))
                  );
                }}
              />
              <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
                <span>Состояние</span>
                <b style={{ color: selectedComp.transistorOpen ? T.success : T.danger }}>
                  {selectedComp.transistorOpen ? 'Открыт ✅' : 'Закрыт ⛔'}
                </b>
              </div>
            </>
          )}

          {selectedComp.type === 'potentiometer' && (
            <>
              <SliderField
                label="Полное сопротивление (Ω)"
                value={selectedComp.resistance ?? 1000}
                min={100}
                max={10000}
                step={100}
                color="#f97316"
                theme={T}
                onChange={(v) => updateValue(selectedComp.id, 'resistance', v)}
              />
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: T.textMuted, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ползунок</span>
                  <b style={{ color: '#f97316' }}>{Math.round((selectedComp.wiper ?? 0.5) * 100)}%</b>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={selectedComp.wiper ?? 0.5}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setComponents((prev) =>
                      prev.map((c) => (c.id === selectedComp.id ? { ...c, wiper: v } : c))
                    );
                  }}
                  style={{ width: '100%', accentColor: '#f97316', height: 4 }}
                />
              </div>
            </>
          )}

          {selectedComp.type === 'lamp' && analysis.burntLamps.has(selectedComp.id) && (
            <div style={{ marginBottom: 12, padding: 12, background: T.dangerSoft, border: `1px solid ${T.danger}`, borderRadius: 8 }}>
              <div style={{ fontSize: 13, color: T.danger, fontWeight: 700, marginBottom: 8 }}>💥 Лампа перегорела</div>
              <button onClick={() => { setComponents((prev) => prev.map((c) => c.id === selectedComp.id ? { ...c, rating: (c.rating ?? 1) * 2 } : c)); if (soundOn) playConnect(); }}
                style={{ width: '100%', padding: '8px 10px', background: T.success, color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                ♻️ Заменить лампу
              </button>
            </div>
          )}

          {selectedComp.type === 'switch' && (
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>
              Состояние: <b style={{ color: selectedComp.closed ? T.success : T.danger }}>{selectedComp.closed ? 'Замкнут ✅' : 'Разомкнут ⛔'}</b>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: `1px solid ${T.panelBorder}`, margin: '14px 0' }} />
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: T.textDim, marginBottom: 8 }}>Поворот</div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>X (W/S)</span><b>{selectedComp.rotation[0]}°</b>
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>Y (Q/E)</span><b>{selectedComp.rotation[1]}°</b>
          </div>
          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 8, display: 'flex', justifyContent: 'space-between' }}>
            <span>Z (A/D)</span><b>{selectedComp.rotation[2]}°</b>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button style={smallBtn(T)} onClick={() => rotateSelected(0, -15)}>X↺</button>
            <button style={smallBtn(T)} onClick={() => rotateSelected(0, 15)}>X↻</button>
            <button style={smallBtn(T)} onClick={() => rotateSelected(1, -15)}>Y↺</button>
            <button style={smallBtn(T)} onClick={() => rotateSelected(1, 15)}>Y↻</button>
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <button style={smallBtn(T)} onClick={() => rotateSelected(2, -15)}>Z↺</button>
            <button style={smallBtn(T)} onClick={() => rotateSelected(2, 15)}>Z↻</button>
            <button style={smallBtn(T)} onClick={resetRotation}>⟲ 0°</button>
          </div>
        </div>
      )}

      {selectedIds.size > 1 && screen !== 'lesson-active' && (
        <div data-ui-panel style={{
          position: 'absolute', top: 16, right: 16, zIndex: 10,
          background: T.primarySoft, color: T.primary, padding: '10px 16px',
          borderRadius: 12, border: `1px solid ${T.primary}`, fontWeight: 700, fontSize: 13,
        }}>
          🎯 Выделено: {selectedIds.size}
        </div>
      )}

      {screen !== 'lesson-active' && (
        <div data-ui-panel style={{
          position: 'absolute', bottom: 16, left: 16, zIndex: 10,
          background: analysis.errors.length > 0 ? T.dangerSoft : T.successSoft,
          color: analysis.errors.length > 0 ? T.danger : T.success,
          padding: '12px 18px', borderRadius: 12, fontSize: 13,
          border: `1px solid ${analysis.errors.length > 0 ? T.danger : T.success}`,
          maxWidth: 400, fontWeight: 600, boxShadow: T.panelShadow,
        }}>
          {(selectedWireId || selectedWireIds.size > 0) && (
            <div style={{ marginBottom: 8, padding: '8px 10px', background: T.primarySoft, border: `1px solid ${T.primary}`, borderRadius: 8, color: T.primary, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔌 Выбрано проводов: {selectedWireIds.size + (selectedWireId ? 1 : 0)}</span>
              <button
                onClick={() => {
                  const ids = new Set(selectedWireIds);
                  if (selectedWireId) ids.add(selectedWireId);
                  setWires((prev) => prev.filter((w) => !ids.has(w.id)));
                  setSelectedWireIds(new Set());
                  setSelectedWireId(null);
                  if (soundOn) playClick();
                }}
                style={{ background: T.danger, color: '#fff', border: 'none', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                🗑 Удалить
              </button>
            </div>
          )}
          {analysis.errors.length === 0 ? '✅ Цепь замкнута, ток идёт' : analysis.errors.map((e, i) => <div key={i} style={{ marginBottom: 4 }}>{e}</div>)}
        </div>
      )}

      {analysis.closed && screen !== 'lesson-active' && (
        <div data-ui-panel style={{
          position: 'absolute', bottom: 16, right: 16, zIndex: 10,
          background: T.panelBg, color: T.text, padding: 18, borderRadius: 14, width: 260,
          border: `1px solid ${T.panelBorder}`, boxShadow: T.panelShadow, fontSize: 13,
          backdropFilter: 'blur(16px)',
        }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: T.primary }}>📊 Измерения</div>
          <MeasurementRow label="Напряжение" value={`${analysis.batteryVoltage} В`} theme={T} />
          <MeasurementRow label="Сопротивление" value={`${analysis.totalResistance.toFixed(1)} Ω`} theme={T} />
          <MeasurementRow label="Ток" value={`${(analysis.currentAmps * 1000).toFixed(1)} мА`} theme={T} />
          {Array.from(analysis.powerPerLamp.entries()).map(([id, power]) => {
            const comp = components.find((c) => c.id === id);
            if (!comp) return null;
            return <MeasurementRow key={id} label={`💡 Лампа`} value={`${power.toFixed(2)} Вт${analysis.burntLamps.has(id) ? ' 💥' : ''}`} highlight={analysis.burntLamps.has(id)} theme={T} />;
          })}
        </div>
      )}

      {screen !== 'lesson-active' && (
        <Oscilloscope
          T={T}
          voltage={analysis.batteryVoltage}
          frequency={50}
          running={analysis.closed}
          closed={analysis.closed}
        />
      )}

      {lampMenu && (() => {
        const comp = components.find((c) => c.id === lampMenu.compId);
        if (!comp) return null;
        return (
          <LampContextMenu
            T={T}
            x={lampMenu.x}
            y={lampMenu.y}
            muted={!!comp.lampMuted}
            volume={comp.lampVolume ?? 0.5}
            onChange={(patch) => updateLampSound(comp.id, patch)}
            onClose={() => setLampMenu(null)}
          />
        );
      })()}

      {screen === 'sandbox' && <RobotMascot celebrateKey={celebrateKey} />}

      {showAuth && (
        <AuthPanel
          T={T}
          onClose={() => setShowAuth(false)}
          onAuth={(u) => setUser(u)}
        />
      )}

      <Canvas
        shadows
        camera={{ position: [9, 8, 10], fov: 50 }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        onCreated={({ camera, size, raycaster, scene, pointer }) => {
          (window as any).__r3fCamera = camera;
          (window as any).__r3fSize = size;
          (window as any).__r3fRaycaster = raycaster;
          (window as any).__r3fScene = scene;
          (window as any).__r3fPointer = pointer;
            (window as any).__r3fCanvas = (scene as any).__r3f_canvas ?? (window as any).__r3f_canvas ?? document.querySelector('canvas[data-engine]');
        }}
      >
        <color attach="background" args={[T.sceneBg]} />
        <fog attach="fog" args={[T.fogColor, T.fogNear, T.fogFar]} />

        <ambientLight intensity={T.ambientIntensity} />
        <directionalLight position={[10, 15, 8]} intensity={T.directionalIntensity} castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0001} />
        <pointLight position={[-10, 8, -10]} intensity={0.4} color={T.accent1} />
        <pointLight position={[10, 5, 10]} intensity={0.3} color={T.accent2} />

        <Grid args={[40, 40]} cellSize={1} cellThickness={0.5} cellColor={T.gridCell} sectionSize={5} sectionThickness={1.2} sectionColor={T.gridSection} fadeDistance={50} fadeStrength={1} infiniteGrid />

        <ContactShadows position={[0, 0.001, 0]} opacity={theme === 'light' ? 0.4 : 0.6} scale={40} blur={2.5} far={4} color={theme === 'light' ? '#0f172a' : '#000'} />

        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
          userData={{ isBackground: true }}
          onContextMenu={() => {
            if (connectSource) {
              setConnectSource(null);
              enableControls();
            }
          }}
          onClick={() => {
            if (connectSource) {
              setConnectSource(null);
              enableControls();
              return;
            }
            setSelectedIds(new Set());
            setSelectedWireId(null);
            setSelectedWireIds(new Set());
            setLampMenu(null);
          }}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial visible={false} />
        </mesh>

        <CameraController mode={cameraMode} controlsRef={controlsRef} />
        <CameraShake trigger={shakeTrigger} />

        {components.map((comp) => (
          <DraggableComponent
            key={comp.id}
            comp={comp}
            selected={selectedIds.has(comp.id)}
            lit={analysis.litLamps.has(comp.id)}
            burnt={analysis.burntLamps.has(comp.id)}
            overheated={analysis.overheatedLamps.has(comp.id)}
            onClick={(e) => handleComponentClick(comp.id, e)}
            onDrag={(pos) => handleComponentDrag(comp, pos)}
            onDragStart={() => handleComponentDragStart(comp)}
            onDragEnd={() => { dragStartPositions.current.clear(); dragAnchorRef.current = null; }}
            disableControls={disableControls}
            enableControls={enableControls}
            connectSource={connectSource}
            onPinDown={handlePinDown}
            onPinUp={handlePinUp}
            onCancelConnect={() => {
              setConnectSource(null);
              enableControls();
            }}
            onToggleSwitch={() => toggleSwitch(comp.id)}
            onChangeWiper={(v) => {
              setComponents((prev) =>
                prev.map((c) => (c.id === comp.id ? { ...c, wiper: v } : c))
              );
            }}
            ammeterReadings={analysis.ammeterReadings}
            voltmeterReadings={analysis.voltmeterReadings}
            energized={analysis.closed}
            remoteUsers={onlineUsers}
            onLampContextMenu={handleLampContextMenu}
            draggedIds={selectedIds}
          />
        ))}

        {connectSource && (() => {
          const srcComp = components.find((c) => c.id === connectSource.comp);
          if (!srcComp) return null;
          const start = getPinWorldPos(srcComp, connectSource.pin);
          if (!start) return null;
          return <PendingWire3D start={start} />;
        })()}

        {wires.map((w) => {
          const fromComp = components.find((c) => c.id === w.fromComp);
          const toComp = components.find((c) => c.id === w.toComp);
          if (!fromComp || !toComp) return null;
          const from = getPinWorldPos(fromComp, w.fromPin);
          const to = getPinWorldPos(toComp, w.toPin);
          if (!from || !to) return null;
          const shorted = analysis.shortedWires.has(w.id);
          return (
            <group key={w.id}>
              <Wire3D
                from={from}
                to={to}
                energized={analysis.energizedWires.has(w.id)}
                shorted={shorted}
                current={analysis.energizedWires.has(w.id) ? analysis.currentAmps : 0}
                selected={selectedWireId === w.id || selectedWireIds.has(w.id)}
                onSelect={() => {
                  setSelectedWireIds(new Set([w.id]));
                  setSelectedWireId(w.id);
                  setSelectedIds(new Set());
                  if (soundOn) playConnect();
                }}
              />
            </group>
          );
        })}
        {onlineUsers
          .filter((u) => u.cursor)
          .map((u) => (
            <RemoteCursor
              key={`cursor-${u.id}`}
              cursor={{
                id: u.id,
                color: u.color,
                position: u.cursor!,
                name: u.name || u.id.slice(-4),
              }}
            />
          ))}
        <OrbitControls ref={controlsRef} makeDefault enableDamping dampingFactor={0.1} minDistance={4} maxDistance={45} maxPolarAngle={Math.PI / 2.1} />
      </Canvas>

      {marquee && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(marquee.startX, marquee.endX),
            top: Math.min(marquee.startY, marquee.endY),
            width: Math.abs(marquee.endX - marquee.startX),
            height: Math.abs(marquee.endY - marquee.startY),
            border: `1px solid ${T.primary}`,
            background: `${T.primary}22`,
            pointerEvents: 'none',
            zIndex: 500,
          }}
        />
      )}

      <style>{`
        @keyframes flashOut {
          from { opacity: 1; }
          to { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function CameraController({ mode, controlsRef }: { mode: 'free' | 'orbit'; controlsRef: React.MutableRefObject<any> }) {
  const angleRef = useRef(0);
  useFrame((_, delta) => {
    if (mode === 'orbit' && controlsRef.current) {
      angleRef.current += delta * 0.3;
      const r = 15;
      controlsRef.current.object.position.set(Math.cos(angleRef.current) * r, 8, Math.sin(angleRef.current) * r);
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
  });
  return null;
}

function SliderField({ label, value, min, max, step, color, theme, onChange }: {
  label: string; value: number; min: number; max: number; step: number; color: string; theme: Theme; onChange: (v: number) => void;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
        <span>{label}</span><b style={{ color }}>{value}</b>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: '100%', accentColor: color, height: 4 }} />
    </div>
  );
}

function MeasurementRow({ label, value, highlight, theme }: { label: string; value: string; highlight?: boolean; theme: Theme }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '6px 10px', background: highlight ? theme.dangerSoft : theme.buttonBg, borderRadius: 6, fontSize: 12 }}>
      <span style={{ color: theme.textMuted }}>{label}</span>
      <b style={{ color: highlight ? theme.danger : theme.primary }}>{value}</b>
    </div>
  );
}

const actionBtn = (T: Theme): React.CSSProperties => ({
  display: 'block', width: '100%', marginBottom: 6, padding: '10px 12px',
  border: `1px solid ${T.buttonBorder}`, borderRadius: 10, cursor: 'pointer',
  textAlign: 'left', fontSize: 13, fontFamily: 'inherit', fontWeight: 500,
});

const smallBtn = (T: Theme): React.CSSProperties => ({
  flex: 1, padding: '8px 10px', background: T.buttonBg, color: T.text,
  border: `1px solid ${T.buttonBorder}`, borderRadius: 8, cursor: 'pointer',
  fontSize: 12, fontFamily: 'inherit', fontWeight: 500,
});

const presetBtn = (T: Theme): React.CSSProperties => ({
  padding: '8px 6px', background: T.buttonBg, color: T.textMuted,
  border: `1px solid ${T.buttonBorder}`, borderRadius: 8, cursor: 'pointer',
  fontSize: 11, fontFamily: 'inherit', fontWeight: 500,
});

const labelStyle: React.CSSProperties = {
  color: '#1e293b', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
  pointerEvents: 'none', userSelect: 'none', background: 'rgba(255,255,255,0.95)',
  padding: '3px 8px', borderRadius: 6, border: '1px solid #e2e8f0',
  boxShadow: '0 2px 8px rgba(15,23,42,0.08)',
};

const pinLabelStyle: React.CSSProperties = {
  color: '#fff', fontSize: 12, fontWeight: 'bold', background: '#0ea5e9',
  padding: '2px 6px', borderRadius: 4, pointerEvents: 'none', userSelect: 'none',
};