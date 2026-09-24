import { useState, useEffect } from 'react';
import type { Theme, ThemeKey } from '../theme';
import type { CircuitComponent, Wire, ComponentType } from '../types';
import { LESSONS } from '../lessons';
import SuccessBanner from './SuccessBanner';
import Timer from './Timer';
import AnimatedWrapper from './AnimatedWrapper';
import LessonToolbar from './LessonToolbar';

const LESSON_COMPONENTS: { type: ComponentType; icon: string; label: string }[] = [
  { type: 'battery', icon: '🔋', label: 'Батарея' },
  { type: 'resistor', icon: '⚡', label: 'Резистор' },
  { type: 'lamp', icon: '💡', label: 'Лампа' },
  { type: 'led', icon: '🟢', label: 'LED' },
  { type: 'switch', icon: '🔀', label: 'Ключ' },
  { type: 'capacitor', icon: '🔌', label: 'Конд.' },
  { type: 'inductor', icon: '🌀', label: 'Катушка' },
  { type: 'ammeter', icon: '📏', label: 'Амп.' },
  { type: 'voltmeter', icon: '📐', label: 'Вольт.' },
  { type: 'ground', icon: '⏚', label: 'GND' },
  { type: 'transistor', icon: '🔺', label: 'Транзистор' },
  { type: 'diode', icon: '🔷', label: 'Диод' },
  { type: 'potentiometer', icon: '🎚️', label: 'Потенц.' },
];

interface LessonViewProps {
  T: Theme;
  theme: ThemeKey;
  onChangeTheme: (k: ThemeKey) => void;
  lessonId: string;
  components: CircuitComponent[];
  wires: Wire[];
  onBack: () => void;
  onComplete: (lessonId: string) => void;
  onNextLesson: () => void;
  onAddComponent: (type: ComponentType) => void;
  onClear: () => void;
  onCelebrate: () => void;
  selectedId: string | null;
  onRemoveSelected: () => void;
  onDuplicateSelected: () => void;
  onClearWires: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onRotate: (axis: 0 | 1 | 2, delta: number) => void;
  onResetRotation: () => void;
  onCameraPreset: (p: 'top' | 'front' | 'side' | 'iso') => void;
  cameraMode: 'free' | 'orbit';
  onToggleOrbit: () => void;
  timeSeconds: number;
}

export default function LessonView({
  T,
  theme,
  onChangeTheme,
  lessonId,
  components,
  wires,
  onBack,
  onComplete,
  onNextLesson,
  onAddComponent,
  onClear,
  onCelebrate,
  selectedId,
  onRemoveSelected,
  onDuplicateSelected,
  onClearWires,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  soundOn,
  onToggleSound,
  onRotate,
  onResetRotation,
  onCameraPreset,
  cameraMode,
  onToggleOrbit,
  timeSeconds,
}: LessonViewProps) {
  const lesson = LESSONS.find((l) => l.id === lessonId);
  const [result, setResult] = useState<{ passed: boolean; message: string } | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [seconds, setSeconds] = useState(0);

  // ============ MOBILE ============
  const [isMobile, setIsMobile] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => {
    setResult(null);
    setShowBanner(false);
    setExpanded(!isMobile); // на мобильном задание свёрнуто
    setSeconds(0);
  }, [lessonId, isMobile]);

  useEffect(() => {
    if (showBanner) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [lessonId, showBanner]);

  if (!lesson) return null;

  const currentIndex = LESSONS.findIndex((l) => l.id === lessonId);
  const selectedComp = components.find((c) => c.id === selectedId);
  const rotation: [number, number, number] | null = selectedComp?.rotation ?? null;
  const isLast = currentIndex === LESSONS.length - 1;
  const nextLesson = !isLast ? LESSONS[currentIndex + 1] : null;

  const check = () => {
    const r = lesson.check(components, wires);
    setResult(r);
    if (r.passed) {
      onComplete(lesson.id);
      onCelebrate();
      setShowBanner(true);
    }
  };

  return (
    <>
      {showBanner && (
        <SuccessBanner
          T={T}
          lessonTitle={lesson.title}
          nextLessonTitle={nextLesson ? nextLesson.title : null}
          seconds={seconds}
          onNext={onNextLesson}
          onClose={() => setShowBanner(false)}
        />
      )}

      <Timer key={lessonId} T={T} resetKey={lessonId} paused={showBanner} externalSeconds={seconds} />

      {/* ============ ПАЛИТРА КОМПОНЕНТОВ ============ */}
      <AnimatedWrapper
        type="slide-down"
        delay={100}
        style={{
          position: 'absolute',
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: isMobile ? 'calc(100% - 24px)' : 'auto',
          maxWidth: isMobile ? 'calc(100% - 24px)' : 'calc(100vw - 200px)',
        }}
      >
        <div
          style={{
            background: T.panelBg,
            border: `1px solid ${T.panelBorder}`,
            borderRadius: 14,
            padding: isMobile ? '6px 8px' : '8px 10px',
            boxShadow: T.panelShadow,
            backdropFilter: 'blur(16px)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: isMobile ? 'nowrap' : 'wrap',
            justifyContent: isMobile ? 'flex-start' : 'center',
            overflowX: isMobile ? 'auto' : 'visible',
            overflowY: 'hidden',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {LESSON_COMPONENTS.map((c, i) => (
            <button
              key={c.type}
              onClick={() => onAddComponent(c.type)}
              title={c.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
                padding: isMobile ? '5px 8px' : '6px 10px',
                background: T.buttonBg,
                color: T.text,
                border: `1px solid ${T.buttonBorder}`,
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 10,
                fontFamily: 'inherit',
                fontWeight: 600,
                minWidth: isMobile ? 44 : 56,
                flexShrink: 0,
                transition: 'all 0.15s',
                animation: `popIn 0.3s ease ${i * 30}ms backwards`,
              }}
            >
              <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>{c.icon}</span>
              {!isMobile && <span style={{ fontSize: 10, color: T.textMuted }}>{c.label}</span>}
            </button>
          ))}

          <div style={{ width: 1, height: 40, background: T.panelBorder, margin: '0 4px', flexShrink: 0 }} />

          <button
            onClick={() => {
              if (confirm('Очистить сцену?')) {
                onClear();
                setResult(null);
              }
            }}
            title="Очистить сцену"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: isMobile ? '5px 8px' : '6px 10px',
              background: T.dangerSoft,
              color: T.danger,
              border: `1px solid ${T.danger}`,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              fontWeight: 600,
              minWidth: isMobile ? 44 : 56,
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: isMobile ? 18 : 20, lineHeight: 1 }}>🧹</span>
            {!isMobile && <span style={{ fontSize: 10 }}>Очистить</span>}
          </button>
        </div>
      </AnimatedWrapper>

      {/* ============ ЗАДАНИЕ УРОКА ============ */}
      <AnimatedWrapper
        type="slide-up"
        delay={250}
        style={{
          position: 'absolute',
          bottom: isMobile ? 8 : 16,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          width: isMobile ? 'calc(100% - 16px)' : 'calc(100% - 32px)',
          maxWidth: 640,
        }}
      >
        <div
          style={{
            background: T.panelBg,
            border: `1px solid ${T.panelBorder}`,
            borderRadius: 14,
            boxShadow: T.panelShadow,
            backdropFilter: 'blur(16px)',
            overflow: 'hidden',
          }}
        >
          <div
            onClick={() => setExpanded((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isMobile ? 6 : 10,
              padding: isMobile ? '8px 10px' : '10px 14px',
              cursor: 'pointer',
              userSelect: 'none',
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); onBack(); }}
              style={{
                padding: isMobile ? '5px 8px' : '6px 10px',
                background: T.buttonBg,
                color: T.text,
                border: `1px solid ${T.buttonBorder}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: isMobile ? 11 : 12,
                fontFamily: 'inherit',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              ← Карта
            </button>
            {!isMobile && (
              <div style={{ fontSize: 11, color: T.textDim, fontWeight: 600 }}>
                УРОК {currentIndex + 1}/{LESSONS.length}
              </div>
            )}
            <div style={{ flex: 1, fontSize: isMobile ? 12 : 14, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {lesson.icon} {lesson.title}
            </div>
            <span style={{ color: T.textDim, fontSize: 14, transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}>
              ▼
            </span>
          </div>

          {expanded && (
            <div style={{ padding: isMobile ? '0 10px 10px' : '0 14px 14px', borderTop: `1px solid ${T.panelBorder}` }}>
              <div style={{ fontSize: isMobile ? 11 : 12, color: T.textMuted, margin: '10px 0', lineHeight: 1.5 }}>
                {lesson.description}
              </div>

              <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
                {lesson.requirements.map((r) => (
                  <span
                    key={r}
                    style={{
                      background: T.buttonBg,
                      color: T.textMuted,
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      border: `1px solid ${T.buttonBorder}`,
                    }}
                  >
                    {r}
                  </span>
                ))}
              </div>

              <details style={{ marginBottom: 10 }}>
                <summary style={{ cursor: 'pointer', fontSize: isMobile ? 11 : 12, color: T.primary, fontWeight: 600, padding: '4px 0' }}>
                  💡 Подсказка
                </summary>
                <div style={{ background: T.primarySoft, color: T.primary, padding: 8, borderRadius: 6, fontSize: isMobile ? 11 : 12, marginTop: 6, lineHeight: 1.5 }}>
                  {lesson.hint}
                </div>
              </details>

              {result && (
                <div
                  style={{
                    padding: 8,
                    borderRadius: 8,
                    marginBottom: 8,
                    fontSize: isMobile ? 11 : 12,
                    background: result.passed ? T.successSoft : T.dangerSoft,
                    color: result.passed ? T.success : T.danger,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    animation: 'popIn 0.3s ease',
                  }}
                >
                  <span style={{ fontSize: 16 }}>{result.passed ? '✅' : '❌'}</span>
                  <span>{result.message}</span>
                </div>
              )}

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={check}
                  style={{
                    flex: 1,
                    padding: isMobile ? '10px 12px' : '10px 14px',
                    background: T.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    fontSize: isMobile ? 13 : 13,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                  }}
                >
                  🔍 Проверить
                </button>
                {result?.passed && (
                  <button
                    onClick={isLast ? onBack : onNextLesson}
                    style={{
                      flex: 1,
                      padding: isMobile ? '10px 12px' : '10px 14px',
                      background: T.success,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: isMobile ? 13 : 13,
                      fontWeight: 700,
                      fontFamily: 'inherit',
                      animation: 'popIn 0.3s ease',
                    }}
                  >
                    {isLast ? '🏆 Завершить' : 'Дальше →'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </AnimatedWrapper>

      {/* ============ ПРАВАЯ ПАНЕЛЬ ИНСТРУМЕНТОВ ============ */}
      {/* На мобильном скрываем — там своя палитра снизу из App.tsx */}
      {!isMobile && (
        <LessonToolbar
          T={T}
          theme={theme}
          onChangeTheme={onChangeTheme}
          soundOn={soundOn}
          onToggleSound={onToggleSound}
          hasSelection={!!selectedId}
          onRemove={onRemoveSelected}
          onDuplicate={onDuplicateSelected}
          onClearWires={onClearWires}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
          rotation={rotation}
          onRotate={onRotate}
          onResetRotation={onResetRotation}
          onCameraPreset={onCameraPreset}
          cameraMode={cameraMode}
          onToggleOrbit={onToggleOrbit}
        />
      )}

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.85); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}