import { useEffect, useState } from 'react';

interface RobotMascotProps {
  /** Меняется при прохождении урока — робот прыгает */
  celebrateKey: number;
}

export default function RobotMascot({ celebrateKey }: RobotMascotProps) {
  const [bouncing, setBouncing] = useState(false);

  useEffect(() => {
    if (celebrateKey === 0) return;
    setBouncing(true);
    const t = setTimeout(() => setBouncing(false), 1000);
    return () => clearTimeout(t);
  }, [celebrateKey]);

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 16,
        left: 16,
        zIndex: 10,
        width: 80,
        height: 80,
        animation: bouncing
          ? 'robotJump 1s ease-in-out'
          : 'robotFloat 3s ease-in-out infinite',
        pointerEvents: 'none',
        filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))',
      }}
    >
      <img
        src="/robot.png"
        alt="Mascot"
        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = 'none';
          const parent = (e.target as HTMLImageElement).parentElement;
          if (parent && !parent.querySelector('.robot-fallback')) {
            const span = document.createElement('span');
            span.className = 'robot-fallback';
            span.textContent = '🤖';
            span.style.fontSize = '64px';
            span.style.lineHeight = '1';
            span.style.display = 'block';
            parent.appendChild(span);
          }
        }}
      />
      <style>{`
        @keyframes robotFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes robotJump {
          0% { transform: translateY(0) scale(1); }
          30% { transform: translateY(-20px) scale(1.15) rotate(-8deg); }
          60% { transform: translateY(-10px) scale(1.1) rotate(8deg); }
          100% { transform: translateY(0) scale(1) rotate(0); }
        }
      `}</style>
    </div>
  );
}