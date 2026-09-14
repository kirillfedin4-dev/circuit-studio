import { useEffect, useState } from 'react';
import type { Theme } from '../theme';

interface SuccessBannerProps {
  T: Theme;
  lessonTitle: string;
  nextLessonTitle: string | null;
  seconds: number;
  onNext: () => void;
  onClose: () => void;
}

function getSpeedComment(seconds: number): { text: string; color: string; emoji: string } {
  if (seconds < 15) return { text: 'Невероятно быстро!', color: '#f59e0b', emoji: '⚡' };
  if (seconds < 30) return { text: 'Очень быстро!', color: '#f97316', emoji: '🔥' };
  if (seconds < 60) return { text: 'Отлично!', color: '#10b981', emoji: '👍' };
  if (seconds < 120) return { text: 'Хорошо!', color: '#0ea5e9', emoji: '😊' };
  return { text: 'Спокойно, без спешки', color: '#a855f7', emoji: '🐢' };
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} сек`;
  return `${m} мин ${s} сек`;
}

export default function SuccessBanner({
  T,
  lessonTitle,
  nextLessonTitle,
  seconds,
  onNext,
  onClose,
}: SuccessBannerProps) {
  const [entered, setEntered] = useState(false);
  const comment = getSpeedComment(seconds);

  useEffect(() => {
    const t1 = setTimeout(() => setEntered(true), 30);
    const t2 = setTimeout(() => {
      setEntered(false);
      setTimeout(onClose, 400);
    }, 5500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onClose]);

  return (
    <div
      data-success-banner
      onClick={() => {
        setEntered(false);
        setTimeout(onClose, 300);
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: entered ? '#ffffff' : 'rgba(255,255,255,0)',
        transition: 'background 0.4s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        isolation: 'isolate',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          maxWidth: 900,
          width: '100%',
          transform: entered ? 'scale(1) translateY(0)' : 'scale(0.85) translateY(30px)',
          opacity: entered ? 1 : 0,
          transition: 'transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.4s ease',
        }}
      >
        {/* Робот + МОЛОДЕЦ */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Робот */}
          <div
            style={{
              width: 140,
              height: 140,
              flexShrink: 0,
              animation: entered ? 'robotEnter 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            }}
          >
            <img
              src="/robot.png"
              alt="Robot"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.15))',
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
                const parent = (e.target as HTMLImageElement).parentElement;
                if (parent && !parent.querySelector('.robot-fallback-big')) {
                  const span = document.createElement('span');
                  span.className = 'robot-fallback-big';
                  span.textContent = '🤖';
                  span.style.fontSize = '120px';
                  span.style.lineHeight = '1';
                  span.style.display = 'block';
                  parent.appendChild(span);
                }
              }}
            />
          </div>

          {/* МОЛОДЕЦ */}
          <div
            style={{
              fontSize: 'clamp(48px, 10vw, 120px)',
              fontWeight: 900,
              background: `linear-gradient(135deg, ${T.success}, ${T.primary}, ${T.accent1})`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              textTransform: 'uppercase',
              letterSpacing: '-0.04em',
              lineHeight: 1,
              animation: entered ? 'titleEnter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)' : 'none',
            }}
          >
            Молодец!
          </div>
        </div>

        {/* Название урока */}
        <div
          style={{
            fontSize: 16,
            color: '#64748b',
            textAlign: 'center',
            animation: entered ? 'fadeInUp 0.5s ease 0.3s backwards' : 'none',
          }}
        >
          Урок «{lessonTitle}» пройден
        </div>

        {/* Результат: время + комментарий */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            background: '#f8fafc',
            border: `2px solid ${comment.color}`,
            borderRadius: 20,
            padding: '18px 32px',
            animation: entered ? 'timeEnter 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s backwards' : 'none',
            boxShadow: `0 8px 30px ${comment.color}22`,
          }}
        >
          <span style={{ fontSize: 40 }}>{comment.emoji}</span>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 700, letterSpacing: 1.5 }}>
              ВРЕМЯ
            </div>
            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                color: comment.color,
                fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                lineHeight: 1.1,
              }}
            >
              {formatTime(seconds)}
            </div>
          </div>
          <div style={{ width: 2, height: 44, background: '#e2e8f0', margin: '0 4px' }} />
          <div style={{ fontSize: 18, fontWeight: 700, color: comment.color, maxWidth: 220 }}>
            {comment.text}
          </div>
        </div>

        {/* Кнопки */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            animation: entered ? 'fadeInUp 0.5s ease 0.4s backwards' : 'none',
          }}
        >
          {nextLessonTitle && (
            <button
              onClick={() => {
                setEntered(false);
                setTimeout(() => {
                  onNext();
                  onClose();
                }, 300);
              }}
              style={{
                padding: '14px 32px',
                background: `linear-gradient(135deg, ${T.success}, ${T.primary})`,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: 800,
                fontFamily: 'inherit',
                boxShadow: `0 8px 24px ${T.success}55`,
                transition: 'transform 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.05)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              Дальше →
            </button>
          )}
          <button
            onClick={() => {
              setEntered(false);
              setTimeout(onClose, 300);
            }}
            style={{
              padding: '14px 24px',
              background: '#f1f5f9',
              color: '#475569',
              border: '1px solid #e2e8f0',
              borderRadius: 12,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'inherit',
            }}
          >
            Остаться
          </button>
        </div>
      </div>

      <style>{`
        @keyframes robotEnter {
          from { opacity: 0; transform: translateX(-80px) rotate(-15deg); }
          to { opacity: 1; transform: translateX(0) rotate(0); }
        }
        @keyframes titleEnter {
          0% { opacity: 0; transform: scale(0.3); }
          60% { transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes timeEnter {
          from { opacity: 0; transform: translateY(30px) scale(0.8); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        /* Скрываем drei-метки и pin-метки, пока плашка на экране */
        body:has([data-success-banner]) [style*="pointer-events: none"] {
          visibility: hidden !important;
        }
      `}</style>
    </div>
  );
}