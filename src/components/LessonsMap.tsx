import { useEffect, useState } from 'react';
import type { Theme } from '../theme';
import { LESSONS } from '../lessons';

interface LessonsMapProps {
  T: Theme;
  onSelectLesson: (id: string) => void;
  onBack: () => void;
}

const STORAGE_KEY = 'circuit-studio-lessons-progress';

export default function LessonsMap({ T, onSelectLesson, onBack }: LessonsMapProps) {
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [completed]);

  const activeIndex = LESSONS.findIndex((l) => !completed.includes(l.id));
  const allDone = activeIndex === -1;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: T.sceneBg,
        overflowY: 'auto',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          background: T.panelBg,
          backdropFilter: 'blur(16px)',
          borderBottom: `1px solid ${T.panelBorder}`,
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <button
          onClick={onBack}
          style={{
            padding: '8px 14px',
            background: T.buttonBg,
            color: T.text,
            border: `1px solid ${T.buttonBorder}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          ← Песочница
        </button>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>
          🎓 Уроки — {completed.length}/{LESSONS.length}
        </div>
                <button
          onClick={() => {
            if (confirm('Сбросить весь прогресс уроков?')) {
              setCompleted([]);
              localStorage.removeItem(STORAGE_KEY);
            }
          }}
          style={{
            padding: '8px 14px',
            background: T.dangerSoft,
            color: T.danger,
            border: `1px solid ${T.danger}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 600,
          }}
        >
          🗑 Сброс
        </button>
        <div style={{ width: 100 }} />
      </div>

      <div style={{ height: 6, background: T.buttonBg, overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${(completed.length / LESSONS.length) * 100}%`,
            background: `linear-gradient(90deg, ${T.primary}, ${T.accent1})`,
            transition: 'width 0.5s ease',
          }}
        />
      </div>

      <div
        style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '40px 20px 100px',
          position: 'relative',
        }}
      >
        {LESSONS.map((lesson, index) => {
          const isDone = completed.includes(lesson.id);
          const isActive = index === activeIndex;
          const isLocked = !isDone && index > activeIndex;
          const offsetX = index % 2 === 0 ? -60 : 60;

          return (
            <div
              key={lesson.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                marginBottom: isLocked ? 52 : 32,
                transform: `translateX(${offsetX}px)`,
              }}
            >
              <button
                onClick={() => {
                  if (isLocked) return;
                  if (isDone || isActive) onSelectLesson(lesson.id);
                }}
                disabled={isLocked}
                style={{
                  position: 'relative',
                  width: 110,
                  height: 110,
                  borderRadius: '50%',
                  border: `5px solid ${isDone ? T.success : isActive ? T.primary : T.buttonBorder}`,
                  background: isDone
                    ? `linear-gradient(135deg, ${T.success}, ${T.success}aa)`
                    : isActive
                    ? `linear-gradient(135deg, ${T.primary}, ${T.accent1})`
                    : T.buttonBg,
                  cursor: isLocked ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isDone || isActive ? '#fff' : T.textDim,
                  fontSize: 32,
                  fontFamily: 'inherit',
                  boxShadow: isActive
                    ? `0 0 0 8px ${T.primary}33, 0 8px 24px rgba(0,0,0,0.2)`
                    : isDone
                    ? `0 0 0 8px ${T.success}33, 0 4px 12px rgba(0,0,0,0.15)`
                    : '0 4px 12px rgba(0,0,0,0.1)',
                  transition: 'all 0.2s ease',
                  opacity: isLocked ? 0.5 : 1,
                }}
              >
                <span style={{ lineHeight: 1 }}>{isDone ? '✓' : isLocked ? '🔒' : lesson.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {lesson.shortTitle}
                </span>
                <div
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: T.panelBg,
                    color: T.text,
                    border: `2px solid ${isDone ? T.success : isActive ? T.primary : T.buttonBorder}`,
                    fontSize: 12,
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {index + 1}
                </div>
              </button>

              {isLocked && (
                <div style={{ marginTop: 6, fontSize: 10, color: T.textDim, textAlign: 'center', maxWidth: 140 }}>
                  🔒 Сначала пройди предыдущий
                </div>
              )}
            </div>
          );
        })}

        {allDone && (
          <div
            style={{
              textAlign: 'center',
              padding: 30,
              background: `linear-gradient(135deg, ${T.primarySoft}, ${T.panelBg})`,
              border: `2px solid ${T.primary}`,
              borderRadius: 20,
              marginTop: 20,
            }}
          >
            <div style={{ fontSize: 56, marginBottom: 10 }}>🏆</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: T.primary, marginBottom: 8 }}>
              Все уроки пройдены!
            </div>
            <div style={{ fontSize: 13, color: T.textMuted }}>
              Ты освоил основы электрических цепей
            </div>
          </div>
        )}
      </div>
    </div>
  );
}