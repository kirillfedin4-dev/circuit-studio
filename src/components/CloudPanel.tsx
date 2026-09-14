import { useEffect, useState } from 'react';
import { api, type ApiUser, type ApiCircuitMeta } from '../api';
import type { Theme } from '../theme';

export default function CloudPanel({ T, user, currentData, onLoad, onRequestLogin }: {
  T: Theme;
  user: ApiUser | null;
  currentData: { components: any[]; wires: any[] };
  onLoad: (data: { components: any[]; wires: any[] }) => void;
  onRequestLogin: () => void;
}) {
  const [tab, setTab] = useState<'my' | 'public'>('my');
  const [items, setItems] = useState<ApiCircuitMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveName, setSaveName] = useState('');

 const load = async () => {
    setLoading(true);
    try {
      const list = tab === 'my' ? await api.listMy() : await api.listPublic();
      setItems(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

   useEffect(() => {
    if (tab === 'my' && !user) {
      setItems([]);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, user?.id]);

  const save = async (isPublic: boolean) => {
    if (!user) { onRequestLogin(); return; }
    const name = saveName.trim() || `Схема ${new Date().toLocaleString('ru-RU')}`;
    setLoading(true);
    try {
      await api.createCircuit(name, currentData, isPublic);
      setSaveName('');
      await load();
    } catch (e: any) { alert('Ошибка: ' + e.message); }
    finally { setLoading(false); }
  };

  const remove = async (id: string) => {
    if (!confirm('Удалить схему?')) return;
    await api.deleteCircuit(id);
    load();
  };

  const loadOne = async (id: string) => {
    try {
      const c = await api.getCircuit(id);
      onLoad(c.data);
    } catch (e: any) { alert(e.message); }
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: T.textDim, marginBottom: 8 }}>
        Облако
      </div>

      {!user ? (
        <button style={btnStyle(T)} onClick={onRequestLogin}>🔑 Войти для облака</button>
      ) : (
        <>
          <input placeholder="Название схемы" value={saveName}
            onChange={(e) => setSaveName(e.target.value)} style={inputStyle(T)} />
          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            <button style={{ ...btnStyle(T), flex: 1 }} onClick={() => save(false)} disabled={loading}>💾 Личная</button>
            <button style={{ ...btnStyle(T), flex: 1, background: T.primarySoft, color: T.primary }} onClick={() => save(true)} disabled={loading}>🌍 Публичная</button>
          </div>

          <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
            <button style={{ ...smallTab(T), background: tab === 'my' ? T.primarySoft : 'transparent', color: tab === 'my' ? T.primary : T.textDim }} onClick={() => setTab('my')}>Мои</button>
            <button style={{ ...smallTab(T), background: tab === 'public' ? T.primarySoft : 'transparent', color: tab === 'public' ? T.primary : T.textDim }} onClick={() => setTab('public')}>Публичные</button>
          </div>

          <div style={{ maxHeight: 240, overflowY: 'auto' }}>
            {loading && <div style={{ fontSize: 12, color: T.textDim, textAlign: 'center', padding: 8 }}>Загрузка...</div>}
            {!loading && items.length === 0 && (
              <div style={{ fontSize: 12, color: T.textDim, textAlign: 'center', padding: 8 }}>Пусто</div>
            )}
            {items.map((c) => (
              <div key={c.id} style={{
                background: T.buttonBg, border: `1px solid ${T.buttonBorder}`,
                borderRadius: 8, padding: 8, marginBottom: 6, fontSize: 12,
              }}>
                <div style={{ color: T.text, fontWeight: 600, marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                  <span>{c.name}</span>
                  {c.is_public && <span style={{ fontSize: 10, color: T.primary }}>🌍</span>}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={miniBtn(T)} onClick={() => loadOne(c.id)}>📂</button>
                  {tab === 'my' && <button style={{ ...miniBtn(T), color: T.danger }} onClick={() => remove(c.id)}>🗑</button>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

const inputStyle = (T: Theme): React.CSSProperties => ({
  width: '100%', padding: '8px 10px', marginBottom: 8,
  background: T.buttonBg, color: T.text, border: `1px solid ${T.buttonBorder}`,
  borderRadius: 8, fontSize: 12, fontFamily: 'inherit', boxSizing: 'border-box',
});
const btnStyle = (T: Theme): React.CSSProperties => ({
  padding: '8px 10px', background: T.buttonBg, color: T.text,
  border: `1px solid ${T.buttonBorder}`, borderRadius: 8,
  cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  width: '100%', marginBottom: 0,
});
const smallTab = (T: Theme): React.CSSProperties => ({
  flex: 1, padding: '6px 8px', border: `1px solid ${T.buttonBorder}`,
  borderRadius: 6, cursor: 'pointer', fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
});
const miniBtn = (T: Theme): React.CSSProperties => ({
  padding: '4px 8px', background: 'transparent', color: T.textMuted,
  border: `1px solid ${T.buttonBorder}`, borderRadius: 6, cursor: 'pointer',
  fontSize: 12, fontFamily: 'inherit',
});