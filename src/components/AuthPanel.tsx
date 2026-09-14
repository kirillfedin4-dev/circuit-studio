import { useState } from 'react';
import { api, setToken } from '../api';
import type { Theme } from '../theme';

export default function AuthPanel({ T, onClose, onAuth }: {
  T: Theme; onClose: () => void; onAuth: (user: any) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError(''); setLoading(true);
    try {
      const fn = mode === 'register' ? api.register : api.login;
      const r = await fn(email, password);
      setToken(r.token);
      onAuth(r.user);
      onClose();
    } catch (e: any) {
      setError(e.message || 'Ошибка');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle(T)} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ color: T.text, marginTop: 0, marginBottom: 16 }}>
          {mode === 'login' ? '🔑 Войти' : '✨ Регистрация'}
        </h3>
        <input type="email" placeholder="Email" value={email}
          onChange={(e) => setEmail(e.target.value)} style={inputStyle(T)} />
        <input type="password" placeholder="Пароль (6+ символов)" value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          style={inputStyle(T)} />
        {error && <div style={{ color: T.danger, fontSize: 12, marginBottom: 8 }}>❌ {error}</div>}
        <button onClick={submit} disabled={loading || !email || password.length < 6}
          style={{ ...btnStyle(T), background: T.primary, color: '#fff', opacity: loading ? 0.5 : 1 }}>
          {loading ? '...' : mode === 'login' ? 'Войти' : 'Создать аккаунт'}
        </button>
        <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
          <span style={{ color: T.textDim }}>{mode === 'login' ? 'Нет аккаунта? ' : 'Уже есть? '}</span>
          <a onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(''); }}
            style={{ color: T.primary, cursor: 'pointer', fontWeight: 600 }}>
            {mode === 'login' ? 'Зарегистрироваться' : 'Войти'}
          </a>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const modalStyle = (T: Theme): React.CSSProperties => ({
  background: T.panelBg, padding: 24, borderRadius: 16, width: 340,
  border: `1px solid ${T.panelBorder}`, boxShadow: T.panelShadow,
});
const inputStyle = (T: Theme): React.CSSProperties => ({
  width: '100%', padding: '10px 12px', marginBottom: 10,
  background: T.buttonBg, color: T.text, border: `1px solid ${T.buttonBorder}`,
  borderRadius: 8, fontSize: 13, fontFamily: 'inherit', boxSizing: 'border-box',
});
const btnStyle = (T: Theme): React.CSSProperties => ({
  width: '100%', padding: '10px 12px',
  background: T.buttonBg, color: T.text, border: `1px solid ${T.buttonBorder}`,
  borderRadius: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
});