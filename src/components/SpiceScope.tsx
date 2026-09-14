import { useEffect, useRef, useState } from 'react';
import type { Theme } from '../theme';
import type { CircuitComponent, Wire } from '../types';
import { buildNetlist, runSimulation, type SimulationResult } from '../spice';

interface SpiceScopeProps {
  T: Theme;
  components: CircuitComponent[];
  wires: Wire[];
  enabled: boolean;
}

const COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#a855f7', '#ec4899', '#ef4444', '#14b8a6', '#f97316'];

export default function SpiceScope({ T, components, wires, enabled }: SpiceScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [result, setResult] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [highlight, setHighlight] = useState<string | null>(null);

  // Запуск симуляции
  useEffect(() => {
    if (!enabled) return;
    if (components.length === 0) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setWarnings([]);

    console.log('[SPICE] Запуск симуляции...');

    const { netlist, warnings: warns } = buildNetlist(components, wires);
    console.log('[SPICE] Netlist:\n', netlist);
    if (warns.length) console.warn('[SPICE] Warnings:', warns);
    setWarnings(warns);

    (async () => {
      try {
        console.log('[SPICE] Загружаю engine...');
        const t0 = performance.now();
        const res = await runSimulation(netlist);
        const dt = (performance.now() - t0).toFixed(0);
        console.log(`[SPICE] Симуляция завершена за ${dt} мс`);
        if (cancelled) return;
        if (res.error) {
          console.error('[SPICE] Ошибка:', res.error);
          setError(res.error);
          setResult(null);
        } else {
          console.log('[SPICE] Узлы:', res.nodeNames);
          setResult(res);
          if (res.nodeNames.length > 0) {
            setHighlight(res.nodeNames[0]);
          }
        }
      } catch (e: any) {
        console.error('[SPICE] Исключение:', e);
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [enabled, components, wires]);

  // Рисование графика
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !result) return;
    const ctx = canvas.getContext('2d')!;
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = T.sceneBg;
    ctx.fillRect(0, 0, w, h);

    // Сетка
    ctx.strokeStyle = T.gridCell;
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const x = (i / 10) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      const y = (i / 10) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }

    // Центральная линия
    ctx.strokeStyle = T.gridSection;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke();

    // Если есть time — рисуем по времени
    const hasTime = result.time.length > 0;

    let colorIdx = 0;
    const nodesToDraw = highlight
      ? [highlight]
      : Array.from(result.voltages.keys());

    for (const nodeName of nodesToDraw) {
      const arr = result.voltages.get(nodeName);
      if (!arr || arr.length < 2) continue;

      const color = COLORS[colorIdx % COLORS.length];
      colorIdx++;

      let min = Infinity, max = -Infinity;
      for (const v of arr) { if (v < min) min = v; if (v > max) max = v; }
      if (!isFinite(min) || !isFinite(max)) continue;
      if (min === max) {
        // Прямая линия
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, h / 2);
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      } else {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let i = 0; i < arr.length; i++) {
          const x = hasTime
            ? (result.time[i] / result.time[result.time.length - 1]) * w
            : (i / (arr.length - 1)) * w;
          const norm = (arr[i] - min) / (max - min);
          const y = h - norm * h * 0.85 - h * 0.075;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Подпись шкалы
    ctx.fillStyle = T.textDim;
    ctx.font = '10px monospace';
    if (result.time.length > 0) {
      const totalMs = result.time[result.time.length - 1] * 1000;
      ctx.fillText(`${totalMs.toFixed(1)} ms`, w - 70, h - 6);
    } else {
      ctx.fillText('DC (op)', w - 60, h - 6);
    }
  }, [result, T, highlight]);

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
        display: 'flex',
        gap: 8,
      }}
    >
      {/* Список узлов */}
      {result && result.nodeNames.length > 0 && (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minWidth: 60,
          maxHeight: 160,
          overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, color: T.textDim, fontWeight: 700, padding: '0 4px' }}>УЗЛЫ</div>
          {result.nodeNames.map((node, i) => {
            const isActive = highlight === node;
            return (
              <button
                key={node}
                onClick={() => setHighlight(node)}
                style={{
                  background: isActive ? T.primarySoft : 'transparent',
                  border: `1px solid ${isActive ? T.primary : 'transparent'}`,
                  color: isActive ? T.primary : T.textMuted,
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: 11,
                  fontFamily: 'monospace',
                  fontWeight: 700,
                  cursor: 'pointer',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{
                  display: 'inline-block',
                  width: 8, height: 8, borderRadius: '50%',
                  background: COLORS[i % COLORS.length],
                }} />
                {node}
              </button>
            );
          })}
          {highlight && (
            <button
              onClick={() => setHighlight(null)}
              style={{
                background: 'transparent',
                border: `1px solid ${T.buttonBorder}`,
                color: T.textDim,
                borderRadius: 6,
                padding: '3px 6px',
                fontSize: 10,
                cursor: 'pointer',
                fontFamily: 'inherit',
                marginTop: 4,
              }}
            >
              все
            </button>
          )}
        </div>
      )}

      {/* Осциллограф */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, padding: '0 4px' }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: T.text }}>
            ⚡ SPICE-симуляция
          </span>
          <span style={{ fontSize: 10, color: T.textDim }}>
            {loading ? 'загрузка...' : error ? '❌ ошибка' : result ? '✓ готово' : '—'}
          </span>
        </div>
        <canvas
          ref={canvasRef}
          width={360}
          height={160}
          style={{ display: 'block', borderRadius: 6, border: `1px solid ${T.panelBorder}` }}
        />

        {warnings.length > 0 && (
          <div style={{
            fontSize: 10,
            color: '#f59e0b',
            marginTop: 6,
            maxWidth: 360,
            lineHeight: 1.4,
          }}>
            {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 10, color: T.danger, marginTop: 6, maxWidth: 360, wordBreak: 'break-word' }}>
            <b>Ошибка:</b> {translateError(error)}
          </div>
        )}

        {loading && (
          <div style={{ fontSize: 10, color: T.textDim, marginTop: 4 }}>
            Загрузка ngspice WASM (~39 MB, только первый раз)...
          </div>
        )}
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  if (msg.includes('singular matrix')) {
    return 'В схеме есть висящие узлы. Проверь, что все компоненты соединены проводами.';
  }
  if (msg.includes('timestep too small')) {
    return 'Схема слишком резко меняется. Попробуй уменьшить номиналы реактивных элементов.';
  }
  if (msg.includes('no writable vector')) {
    return 'Не удалось записать результат. Проверь, что цепь содержит батарею и хотя бы один резистор.';
  }
  return msg;
}