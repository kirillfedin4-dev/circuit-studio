import { useEffect, useRef } from 'react';
import type { Theme } from '../theme';

interface LampContextMenuProps {
  T: Theme;
  x: number;
  y: number;
  muted: boolean;
  volume: number;
  onChange: (patch: { lampMuted?: boolean; lampVolume?: number }) => void;
  onClose: () => void;
}

export default function LampContextMenu({
  T,
  x,
  y,
  muted,
  volume,
  onChange,
  onClose,
}: LampContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Закрытие по клику вне меню и по Escape
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Небольшая задержка, чтобы не поймать тот же клик, что открыл меню
    const t = setTimeout(() => {
      window.addEventListener('mousedown', handleClick);
    }, 50);
    window.addEventListener('keydown', handleKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Проверяем, чтобы меню не вылезало за экран
  const menuWidth = 240;
  const menuHeight = 110;
  const adjustedX = Math.min(x, window.innerWidth - menuWidth - 12);
  const adjustedY = Math.min(y, window.innerHeight - menuHeight - 12);

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedX,
        top: adjustedY,
        zIndex: 10000,
        background: T.panelBg,
        border: `1px solid ${T.panelBorder}`,
        borderRadius: 12,
        padding: '10px 12px',
        boxShadow: T.panelShadow,
        backdropFilter: 'blur(16px)',
        width: menuWidth,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        animation: 'lampMenuIn 0.15s ease',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>💡</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: T.text, flex: 1 }}>
          Звук лампы
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            color: T.textDim,
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            fontFamily: 'inherit',
            padding: '2px 4px',
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => onChange({ lampMuted: !muted })}
          title={muted ? 'Включить' : 'Выключить'}
          style={{
            background: muted ? T.dangerSoft : T.primarySoft,
            color: muted ? T.danger : T.primary,
            border: `1px solid ${muted ? T.danger : T.primary}`,
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 14,
            padding: '4px 8px',
            fontFamily: 'inherit',
          }}
        >
          {muted ? '🔇' : '🔊'}
        </button>

        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(e) => onChange({ lampVolume: Number(e.target.value) / 100 })}
          disabled={muted}
          style={{
            flex: 1,
            accentColor: T.primary,
            opacity: muted ? 0.4 : 1,
            cursor: muted ? 'not-allowed' : 'pointer',
          }}
        />

        <span
          style={{
            fontSize: 11,
            color: T.textDim,
            fontFamily: 'ui-monospace, monospace',
            minWidth: 32,
            textAlign: 'right',
          }}
        >
          {Math.round(volume * 100)}%
        </span>
      </div>

      <style>{`
        @keyframes lampMenuIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}