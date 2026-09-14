import { ReactNode, useState } from 'react';
import type { Theme, ThemeKey } from '../theme';
import { THEMES } from '../theme';
import type { ApiUser } from '../api';

export interface SidebarSection {
  id: string;
  icon: string;
  title: string;
  badge?: string;
  content: ReactNode;
}

interface SidebarProps {
  T: Theme;
  theme: ThemeKey;
  user: ApiUser | null;
  screens: {
    sandbox: () => void;
    lessons: () => void;
  };
  currentScreen: 'sandbox' | 'lessons' | 'lesson-active';
  onAuth: () => void;
  onSignOut: () => void;
  onChangeTheme: (k: ThemeKey) => void;
  sections: SidebarSection[];
}

export default function Sidebar({
  T,
  theme,
  user,
  screens,
  currentScreen,
  onAuth,
  onSignOut,
  onChangeTheme,
  sections,
}: SidebarProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (id: string) => {
    setOpenSection((prev) => (prev === id ? null : id));
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 10,
        width: 260,
        maxHeight: 'calc(100vh - 32px)',
        overflowY: 'auto',
        background: T.panelBg,
        color: T.text,
        borderRadius: 16,
        border: `1px solid ${T.panelBorder}`,
        boxShadow: T.panelShadow,
        backdropFilter: 'blur(16px)',
        transition: 'background 0.3s, color 0.3s, border-color 0.3s',
      }}
    >
      {/* Хедер */}
      <div
        style={{
          padding: 16,
          borderBottom: `1px solid ${T.panelBorder}`,
        }}
      >
        <div
          style={{
            fontSize: 17,
            fontWeight: 800,
            background: `linear-gradient(135deg, ${T.primary} 0%, ${T.accent1} 100%)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Wire Way
        </div>
        <div style={{ fontSize: 10, color: T.textDim, marginTop: 2 }}>
          3D редактор цепей
        </div>
      </div>

      {/* Переключатель режимов */}
      <div style={{ display: 'flex', gap: 0, borderBottom: `1px solid ${T.panelBorder}` }}>
        <button
          onClick={screens.sandbox}
          style={{
            flex: 1,
            padding: '12px 8px',
            background: currentScreen === 'sandbox' ? T.primarySoft : 'transparent',
            color: currentScreen === 'sandbox' ? T.primary : T.textMuted,
            border: 'none',
            borderBottom: currentScreen === 'sandbox' ? `2px solid ${T.primary}` : '2px solid transparent',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 700,
          }}
        >
          🧪 Песочница
        </button>
        <button
          onClick={screens.lessons}
          style={{
            flex: 1,
            padding: '12px 8px',
            background: 'transparent',
            color: T.textMuted,
            border: 'none',
            borderBottom: '2px solid transparent',
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
            fontWeight: 700,
          }}
        >
          🎓 Уроки
        </button>
      </div>

      {/* Профиль — компактный */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${T.panelBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: user ? T.primary : T.buttonBg,
            color: user ? '#fff' : T.textDim,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            flexShrink: 0,
          }}
        >
          {user ? '👤' : '👥'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          {user ? (
            <div
              style={{
                fontSize: 11,
                color: T.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={user.email}
            >
              {user.email}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: T.textDim }}>Не авторизован</div>
          )}
        </div>
        {user ? (
          <button
            onClick={onSignOut}
            style={{
              padding: '4px 8px',
              background: T.buttonBg,
              color: T.textMuted,
              border: `1px solid ${T.buttonBorder}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            Выйти
          </button>
        ) : (
          <button
            onClick={onAuth}
            style={{
              padding: '4px 8px',
              background: T.primarySoft,
              color: T.primary,
              border: `1px solid ${T.primary}`,
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 10,
              fontFamily: 'inherit',
              fontWeight: 600,
            }}
          >
            Войти
          </button>
        )}
      </div>

      {/* Тема — компактные иконки */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${T.panelBorder}`,
        }}
      >
        <div
          style={{
            fontSize: 10,
            color: T.textDim,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: 1,
            marginBottom: 6,
          }}
        >
          Тема
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(Object.keys(THEMES) as ThemeKey[]).map((k) => {
            const th = THEMES[k];
            const isActive = k === theme;
            return (
              <button
                key={k}
                onClick={() => onChangeTheme(k)}
                title={th.name}
                style={{
                  flex: 1,
                  padding: '6px 4px',
                  background: isActive ? T.primarySoft : T.buttonBg,
                  color: isActive ? T.primary : T.textMuted,
                  border: `1px solid ${isActive ? T.primary : T.buttonBorder}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontSize: 16,
                  fontFamily: 'inherit',
                  lineHeight: 1,
                }}
              >
                {th.icon}
              </button>
            );
          })}
        </div>
      </div>

      {/* Секции — аккордеон */}
      {sections.map((s) => {
        const isOpen = openSection === s.id;
        return (
          <div
            key={s.id}
            style={{
              borderBottom: `1px solid ${T.panelBorder}`,
            }}
          >
            <button
              onClick={() => toggle(s.id)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                background: isOpen ? T.primarySoft : 'transparent',
                color: isOpen ? T.primary : T.text,
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16 }}>{s.icon}</span>
              <span style={{ flex: 1 }}>{s.title}</span>
              {s.badge && (
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    background: T.buttonBg,
                    color: T.textMuted,
                    borderRadius: 4,
                    fontWeight: 700,
                  }}
                >
                  {s.badge}
                </span>
              )}
              <span
                style={{
                  fontSize: 10,
                  color: T.textDim,
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0)',
                  transition: 'transform 0.15s',
                }}
              >
                ▼
              </span>
            </button>
            {isOpen && (
              <div style={{ padding: '0 14px 14px' }}>{s.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}