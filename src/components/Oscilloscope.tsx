import { useEffect, useRef } from 'react';
import type { Theme } from '../theme';

interface Props {
  T: Theme;
  voltage: number;
  frequency: number;
  running: boolean;
  closed: boolean;
}

export default function Oscilloscope({ T, voltage, frequency, running, closed }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (running) tRef.current += dt;

      const w = canvas.width;
      const h = canvas.height;

      // Фон
      ctx.fillStyle = T.sceneBg;
      ctx.fillRect(0, 0, w, h);

      // Сетка
      ctx.strokeStyle = T.gridCell;
      ctx.lineWidth = 1;
      for (let i = 0; i <= 10; i++) {
        const x = (i / 10) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
        const y = (i / 10) * h;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Центральная линия
      ctx.strokeStyle = T.gridSection;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Синусоида
      if (closed && voltage > 0) {
        ctx.strokeStyle = T.primary;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = T.primary;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        const amplitude = (h / 2) * 0.85;
        const cycles = 3;
        for (let px = 0; px < w; px++) {
          const phase = (px / w) * cycles * Math.PI * 2 + tRef.current * 2;
          const y = h / 2 - Math.sin(phase) * amplitude * Math.min(1, voltage / 24);
          if (px === 0) ctx.moveTo(px, y);
          else ctx.lineTo(px, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.strokeStyle = T.textDim;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        for (let px = 0; px < w; px++) {
          ctx.lineTo(px, h / 2 + (Math.random() - 0.5) * 2);
        }
        ctx.stroke();
      }

      // Подписи
      ctx.fillStyle = T.textDim;
      ctx.font = '10px monospace';
      ctx.fillText(`${voltage.toFixed(1)}V`, 6, 14);
      ctx.fillText(`${frequency}Hz`, 6, h - 6);

      raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [T, voltage, frequency, running, closed]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 10,
        background: T.panelBg,
        border: `1px solid ${T.panelBorder}`,
        borderRadius: 12,
        padding: 8,
        boxShadow: T.panelShadow,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 6,
          padding: '0 4px',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>📈 Осциллограф</span>
        <span style={{ fontSize: 10, color: T.textDim }}>
          {closed ? 'сигнал' : 'шум'}
        </span>
      </div>
      <canvas
        ref={canvasRef}
        width={360}
        height={140}
        style={{
          display: 'block',
          borderRadius: 6,
          border: `1px solid ${T.panelBorder}`,
        }}
      />
    </div>
  );
}