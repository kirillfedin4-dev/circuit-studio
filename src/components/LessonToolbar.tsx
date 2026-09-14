import { useState } from 'react';
import type { Theme, ThemeKey } from '../theme';
import { THEMES } from '../theme';

interface LessonToolbarProps {
  T: Theme;
  theme: ThemeKey;
  onChangeTheme: (k: ThemeKey) => void;
  soundOn: boolean;
  onToggleSound: () => void;
  // Действия
  hasSelection: boolean;
  onRemove: () => void;
  onDuplicate: () => void;
  onClearWires: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Поворот
  rotation: [number, number, number] | null;
  onRotate: (axis: 0 | 1 | 2, delta: number) => void;
  onResetRotation: () => void;
  // Камера
  onCameraPreset: (p: 'top' | 'front' | 'side' | 'iso') => void;
  cameraMode: 'free' | 'orbit';
  onToggleOrbit: () => void;
}

export default function LessonToolbar({
  T,
  theme,
  onChangeTheme,
  soundOn,
  onToggleSound,
  hasSelection,
  onRemove,
  onDuplicate,
  onClearWires,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  rotation,
  onRotate,
  onResetRotation,
  onCameraPreset,
  cameraMode,
  onToggleOrbit,
}: LessonToolbarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        position: 'absolute',
        top: 70,
        right: 16,
        zIndex: 11,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      {/* Кнопка-переключатель */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Инструменты"
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: open ? T.primary : T.panelBg,
          color: open ? '#fff' : T.text,
          border: `1px solid ${open ? T.primary : T.panelBorder}`,
          cursor: 'pointer',
          fontSize: 20,
          fontFamily: 'inherit',
          boxShadow: T.panelShadow,
          backdropFilter: 'blur(16px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {open ? '✕' : '🛠️'}
      </button>

      {/* Панель */}
      {open && (
        <div
          style={{
            background: T.panelBg,
            border: `1px solid ${T.panelBorder}`,
            borderRadius: 14,
            padding: 10,
            boxShadow: T.panelShadow,
            backdropFilter: 'blur(16px)',
            width: 220,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            maxHeight: 'calc(100vh - 140px)',
            overflowY: 'auto',
            animation: 'toolbarIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}
        >
          {/* Undo / Redo / звук */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              disabled={!canUndo}
              onClick={onUndo}
              title="Undo (Ctrl+Z)"
              style={smallBtn(T, canUndo)}
            >
              ↶
            </button>
            <button
              disabled={!canRedo}
              onClick={onRedo}
              title="Redo (Ctrl+Y)"
              style={smallBtn(T, canRedo)}
            >
              ↷
            </button>
            <button
              onClick={onToggleSound}
              title={soundOn ? 'Звук: вкл' : 'Звук: выкл'}
              style={{
                ...smallBtn(T, true),
                background: soundOn ? T.primarySoft : T.buttonBg,
                color: soundOn ? T.primary : T.textMuted,
              }}
            >
              {soundOn ? '🔊' : '🔇'}
            </button>
          </div>

          {/* Удалить / дублировать / очистить */}
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              disabled={!hasSelection}
              onClick={onRemove}
              title="Удалить выбранный (Delete)"
              style={{
                ...smallBtn(T, hasSelection),
                background: hasSelection ? T.dangerSoft : T.buttonBg,
                color: hasSelection ? T.danger : T.textDim,
              }}
            >
              🗑
            </button>
            <button
              disabled={!hasSelection}
              onClick={onDuplicate}
              title="Дублировать (Ctrl+D)"
              style={smallBtn(T, hasSelection)}
            >
              📄
            </button>
            <button
              onClick={onClearWires}
              title="Очистить все провода"
              style={smallBtn(T, true)}
            >
              ✂
            </button>
          </div>

          {/* Поворот */}
          {rotation && (
            <>
              <div style={sectionTitle(T)}>Поворот</div>
              <div style={{ fontSize: 10, color: T.textMuted, display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
                <span>X: {rotation[0]}°</span>
                <span>Y: {rotation[1]}°</span>
                <span>Z: {rotation[2]}°</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={smallBtn(T, true)} onClick={() => onRotate(0, -15)} title="X -15° (W)">X↺</button>
                <button style={smallBtn(T, true)} onClick={() => onRotate(0, 15)} title="X +15° (S)">X↻</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={smallBtn(T, true)} onClick={() => onRotate(1, -15)} title="Y -15° (Q)">Y↺</button>
                <button style={smallBtn(T, true)} onClick={() => onRotate(1, 15)} title="Y +15° (E)">Y↻</button>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={smallBtn(T, true)} onClick={() => onRotate(2, -15)} title="Z -15° (A)">Z↺</button>
                <button style={smallBtn(T, true)} onClick={() => onRotate(2, 15)} title="Z +15° (D)">Z↻</button>
              </div>
              <button style={{ ...smallBtn(T, true), width: '100%' }} onClick={onResetRotation}>
                ⟲ Сбросить углы
              </button>
            </>
          )}

          {/* Камера */}
          <div style={sectionTitle(T)}>Камера</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <button style={smallBtn(T, true)} onClick={() => onCameraPreset('top')}>⬆️</button>
            <button style={smallBtn(T, true)} onClick={() => onCameraPreset('front')}>➡️</button>
            <button style={smallBtn(T, true)} onClick={() => onCameraPreset('side')}>⬅️</button>
            <button style={smallBtn(T, true)} onClick={() => onCameraPreset('iso')}>📐</button>
          </div>
          <button
            onClick={onToggleOrbit}
            style={{
              ...smallBtn(T, true),
              width: '100%',
              background: cameraMode === 'orbit' ? T.primarySoft : T.buttonBg,
              color: cameraMode === 'orbit' ? T.primary : T.textMuted,
            }}
          >
            {cameraMode === 'orbit' ? '⏸ Стоп облёт' : '▶️ Облёт'}
          </button>

          {/* Тема */}
          <div style={sectionTitle(T)}>Тема</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
              const th = THEMES[k];
              const isActive = k === theme;
              return (
                <button
                  key={k}
                  onClick={() => onChangeTheme(k)}
                  title={th.name}
                  style={{
                    padding: '6px 0',
                    background: isActive ? T.primarySoft : T.buttonBg,
                    border: `1px solid ${isActive ? T.primary : T.buttonBorder}`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 14,
                    fontFamily: 'inherit',
                  }}
                >
                  {th.icon}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <style>{`
        @keyframes toolbarIn {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

const smallBtn = (T: Theme, enabled: boolean): React.CSSProperties => ({
  flex: 1,
  padding: '8px 0',
  background: T.buttonBg,
  color: enabled ? T.text : T.textDim,
  border: `1px solid ${T.buttonBorder}`,
  borderRadius: 8,
  cursor: enabled ? 'pointer' : 'not-allowed',
  fontSize: 12,
  fontFamily: 'inherit',
  fontWeight: 600,
  opacity: enabled ? 1 : 0.4,
});

const sectionTitle = (T: Theme): React.CSSProperties => ({
  fontSize: 10,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: 1.2,
  color: T.textDim,
  marginTop: 4,
});