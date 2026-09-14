import type { Theme } from '../theme';

interface LampSoundControlProps {
  T: Theme;
  muted: boolean;
  volume: number;
  onChange: (patch: { lampMuted?: boolean; lampVolume?: number }) => void;
  onClose: () => void;
}

export default function LampSoundControl({ T, muted, volume, onChange, onClose }: LampSoundControlProps) {
  return (
    <div
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      style={{
        background: T.panelBg,
        border: `1px solid ${T.panelBorder}`,
        borderRadius: 12,
        padding: '8px 10px',
        boxShadow: T.panelShadow,
        backdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        animation: 'lampSoundIn 0.2s ease',
        pointerEvents: 'auto',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ fontSize: 14 }}>💡</span>

      <button
        onClick={(e) => {
          e.stopPropagation();
          onChange({ lampMuted: !muted });
        }}
        title={muted ? 'Включить звук' : 'Выключить звук'}
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
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        disabled={muted}
        style={{
          width: 100,
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

      <button
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        title="Закрыть"
        style={{
          background: 'transparent',
          color: T.textDim,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontSize: 14,
          padding: '4px 6px',
          fontFamily: 'inherit',
          marginLeft: 4,
        }}
      >
        ✕
      </button>

      <style>{`
        @keyframes lampSoundIn {
          from { opacity: 0; transform: translateY(6px) scale(0.9); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}