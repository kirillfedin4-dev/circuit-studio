import { useState, useEffect } from 'react';
import type { Theme } from '../theme';
import type { CircuitComponent, Wire } from '../types';

export interface Lesson {
  id: string;
  title: string;
  description: string;
  icon: string;
  hint: string;
  // Функция проверки: получает текущую схему, возвращает true, если урок пройден
  check: (components: CircuitComponent[], wires: Wire[]) => {
    passed: boolean;
    message: string;
  };
  // Какие компоненты нужны для урока (показываем в описании)
  requirements: string[];
}

interface LessonsPanelProps {
  T: Theme;
  components: CircuitComponent[];
  wires: Wire[];
  onLoadStarter: (starter: { components: CircuitComponent[]; wires: Wire[] }) => void;
}

const LESSONS: Lesson[] = [
  {
    id: 'lamp-on',
    title: 'Урок 1. Зажги лампочку',
    description: 'Соедини батарею и лампу в замкнутую цепь.',
    icon: '💡',
    hint: 'Соедини + батареи с пином A лампы, а − батареи с пином B лампы. Или наоборот — важно, чтобы цепь была замкнута.',
    requirements: ['🔋 Батарея', '💡 Лампа', '2 провода'],
    check: (comps, wires) => {
      const hasBat = comps.some((c) => c.type === 'battery');
      const hasLamp = comps.some((c) => c.type === 'lamp');
      if (!hasBat || !hasLamp) {
        return { passed: false, message: 'Нужны батарея и лампа на сцене' };
      }
      // Проверяем, что есть замкнутая цепь через лампу
      const closed = isClosedThroughLamp(comps, wires);
      if (!closed) {
        return {
          passed: false,
          message: 'Цепь не замкнута. Соедини оба пина лампы с разными полюсами батареи.',
        };
      }
      return { passed: true, message: 'Лампа горит! Урок пройден 🎉' };
    },
  },
  {
    id: 'resistor',
    title: 'Урок 2. Защити лампу резистором',
    description: 'Слишком большое напряжение сжигает лампу. Добавь резистор последовательно.',
    icon: '⚡',
    hint: 'Поставь резистор 220Ω–1kΩ между батареей и лампой. Тогда часть напряжения упадёт на резисторе, и лампа выживет.',
    requirements: ['🔋 Батарея', '⚡ Резистор', '💡 Лампа', '3 провода'],
    check: (comps, wires) => {
      const lamp = comps.find((c) => c.type === 'lamp');
      const res = comps.find((c) => c.type === 'resistor');
      if (!lamp || !res) {
        return { passed: false, message: 'Нужны лампа И резистор на сцене' };
      }
      const closed = isClosedThroughLamp(comps, wires);
      if (!closed) {
        return { passed: false, message: 'Цепь не замкнута' };
      }
      // Проверяем, что резистор в той же цепи
      const resInCircuit = isComponentInPath(res.id, comps, wires);
      if (!resInCircuit) {
        return {
          passed: false,
          message: 'Резистор не в цепи. Поставь его последовательно с лампой.',
        };
      }
      // Проверяем, что не перегорела
      const rating = lamp.rating ?? 1;
      const bat = comps.find((c) => c.type === 'battery');
      const voltage = bat?.voltage ?? 9;
      const R = (res.resistance ?? 220) + rating * 100;
      const P = (voltage / R) ** 2 * (rating * 100);
      if (P > rating * 1.5) {
        return {
          passed: false,
          message: `Лампа перегорает (${P.toFixed(2)} Вт > ${rating} Вт). Увеличь сопротивление резистора.`,
        };
      }
      return { passed: true, message: 'Лампа горит в безопасном режиме! Урок пройден 🎉' };
    },
  },
  {
    id: 'switch',
    title: 'Урок 3. Управляй выключателем',
    description: 'Добавь переключатель, чтобы включать и выключать лампу.',
    icon: '🔀',
    hint: 'Поставь переключатель последовательно в цепь. Замкни его — лампа горит. Разомкни — гаснет.',
    requirements: ['🔋 Батарея', '🔀 Переключатель', '💡 Лампа'],
    check: (comps, wires) => {
      const sw = comps.find((c) => c.type === 'switch');
      const lamp = comps.find((c) => c.type === 'lamp');
      if (!sw || !lamp) {
        return { passed: false, message: 'Нужны выключатель и лампа' };
      }
      const closed = isClosedThroughLamp(comps, wires);
      if (!closed) {
        return {
          passed: false,
          message: 'Цепь не замкнута или выключатель разомкнут. Замкни его!',
        };
      }
      const swInCircuit = isComponentInPath(sw.id, comps, wires);
      if (!swInCircuit) {
        return { passed: false, message: 'Выключатель не в цепи' };
      }
      return { passed: true, message: 'Лампа горит, выключатель работает! 🎉' };
    },
  },
  {
    id: 'led',
    title: 'Урок 4. LED с резистором',
    description: 'Светодиод нельзя без резистора — сгорит. Поставь 330Ω.',
    icon: '🟢',
    hint: 'Соедини + батареи → резистор → LED.+ и LED.− → − батареи. Резистор 300–400Ω.',
    requirements: ['🔋 Батарея', '⚡ Резистор', '🟢 LED'],
    check: (comps, wires) => {
      const led = comps.find((c) => c.type === 'led');
      const res = comps.find((c) => c.type === 'resistor');
      if (!led || !res) {
        return { passed: false, message: 'Нужны LED и резистор' };
      }
      const closed = isClosedThroughLamp(comps, wires);
      if (!closed) return { passed: false, message: 'Цепь не замкнута' };
      const ledIn = isComponentInPath(led.id, comps, wires);
      const resIn = isComponentInPath(res.id, comps, wires);
      if (!ledIn || !resIn) {
        return { passed: false, message: 'И LED, и резистор должны быть в цепи' };
      }
      const r = res.resistance ?? 0;
      if (r < 100) {
        return { passed: false, message: `Резистор слишком мал (${r}Ω). Поставь минимум 300Ω.` };
      }
      return { passed: true, message: 'LED светится! Урок пройден 🎉' };
    },
  },
  {
    id: 'divider',
    title: 'Урок 5. Делитель напряжения',
    description: 'Два резистора делят напряжение пополам. Проверь вольтметром.',
    icon: '📐',
    hint: 'Поставь два резистора ОДИНАКОВОГО номинала последовательно. Точка между ними — половина напряжения.',
    requirements: ['🔋 Батарея', '⚡ Резистор ×2', '📐 Вольтметр'],
    check: (comps, wires) => {
      const resistors = comps.filter((c) => c.type === 'resistor');
      if (resistors.length < 2) {
        return { passed: false, message: 'Нужно минимум 2 резистора' };
      }
      const closed = isClosedThroughLamp(comps, wires);
      if (!closed) return { passed: false, message: 'Цепь не замкнута' };
      const r1 = resistors[0].resistance ?? 0;
      const r2 = resistors[1].resistance ?? 0;
      if (r1 === 0 || r2 === 0) {
        return { passed: false, message: 'Резисторы должны иметь номинал' };
      }
      const ratio = Math.min(r1, r2) / Math.max(r1, r2);
      if (ratio < 0.8) {
        return {
          passed: false,
          message: `Резисторы слишком разного номинала (${r1}Ω и ${r2}Ω). Поставь одинаковые.`,
        };
      }
      return { passed: true, message: 'Делитель напряжения собран! 🎉' };
    },
  },
];

// Помощник: замкнута ли цепь через лампу/LED
function isClosedThroughLamp(comps: CircuitComponent[], wires: Wire[]): boolean {
  const battery = comps.find((c) => c.type === 'battery');
  if (!battery) return false;
  // BFS от + батареи
  const visited = new Set<string>();
  const queue: { comp: string; pin: string }[] = [{ comp: battery.id, pin: '+' }];
  while (queue.length) {
    const cur = queue.shift()!;
    const key = `${cur.comp}:${cur.pin}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (cur.comp === battery.id && cur.pin === '-') return true;
    for (const w of wires) {
      let next: { comp: string; pin: string } | null = null;
      if (w.fromComp === cur.comp && w.fromPin === cur.pin) {
        next = { comp: w.toComp, pin: w.toPin };
      } else if (w.toComp === cur.comp && w.toPin === cur.pin) {
        next = { comp: w.fromComp, pin: w.fromPin };
      }
      if (next) {
        const comp = comps.find((c) => c.id === next!.comp);
        if (comp && comp.type === 'switch' && !comp.closed) continue;
        if (comp && comp.type === 'lamp') {
          // лампа пропускает ток только если не перегорела
          // но мы не знаем перегорела ли — проверим грубо
        }
        if (comp && comp.type !== 'battery') {
          const otherPin = comp.type === 'resistor' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'lamp' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'led' ? (next!.pin === '+' ? '-' : '+')
            : comp.type === 'capacitor' ? (next!.pin === '+' ? '-' : '+')
            : comp.type === 'inductor' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'switch' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'ammeter' ? (next!.pin === 'IN' ? 'OUT' : 'IN')
            : comp.type === 'voltmeter' ? null
            : null;
          if (otherPin) queue.push({ comp: comp.id, pin: otherPin });
        } else {
          queue.push(next);
        }
      }
    }
  }
  return false;
}

// Проверка, что компонент в активной цепи
function isComponentInPath(compId: string, comps: CircuitComponent[], wires: Wire[]): boolean {
  const battery = comps.find((c) => c.type === 'battery');
  if (!battery) return false;
  const visited = new Set<string>();
  const queue: { comp: string; pin: string }[] = [{ comp: battery.id, pin: '+' }];
  const found = new Set<string>();
  while (queue.length) {
    const cur = queue.shift()!;
    const key = `${cur.comp}:${cur.pin}`;
    if (visited.has(key)) continue;
    visited.add(key);
    found.add(cur.comp);
    if (cur.comp === battery.id && cur.pin === '-') break;
    for (const w of wires) {
      let next: { comp: string; pin: string } | null = null;
      if (w.fromComp === cur.comp && w.fromPin === cur.pin) {
        next = { comp: w.toComp, pin: w.toPin };
      } else if (w.toComp === cur.comp && w.toPin === cur.pin) {
        next = { comp: w.fromComp, pin: w.fromPin };
      }
      if (next) {
        const comp = comps.find((c) => c.id === next!.comp);
        if (comp && comp.type === 'switch' && !comp.closed) continue;
        if (comp && comp.type !== 'battery') {
          const otherPin = comp.type === 'resistor' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'lamp' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'led' ? (next!.pin === '+' ? '-' : '+')
            : comp.type === 'capacitor' ? (next!.pin === '+' ? '-' : '+')
            : comp.type === 'inductor' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'switch' ? (next!.pin === 'A' ? 'B' : 'A')
            : comp.type === 'ammeter' ? (next!.pin === 'IN' ? 'OUT' : 'IN')
            : null;
          if (otherPin) queue.push({ comp: comp.id, pin: otherPin });
        } else {
          queue.push(next);
        }
      }
    }
  }
  return found.has(compId);
}

const STORAGE_KEY = 'circuit-studio-lessons-progress';

export default function LessonsPanel({ T, components, wires, onLoadStarter }: LessonsPanelProps) {
  const [activeLessonId, setActiveLessonId] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });
  const [checkResult, setCheckResult] = useState<{ passed: boolean; message: string } | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(completed));
  }, [completed]);

  const activeLesson = LESSONS.find((l) => l.id === activeLessonId);

  const runCheck = () => {
    if (!activeLesson) return;
    const result = activeLesson.check(components, wires);
    setCheckResult(result);
    if (result.passed && !completed.includes(activeLesson.id)) {
      const next = [...completed, activeLesson.id];
      setCompleted(next);
      if (next.length === LESSONS.length) {
        setTimeout(() => setShowCertificate(true), 500);
      }
    }
  };

  const loadStarter = () => {
    // Пустая сцена для нового урока
    onLoadStarter({ components: [], wires: [] });
    setCheckResult(null);
  };

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.5, color: T.textDim, marginBottom: 8 }}>
        🎓 Уроки ({completed.length}/{LESSONS.length})
      </div>

      {LESSONS.map((lesson) => {
        const isActive = lesson.id === activeLessonId;
        const isDone = completed.includes(lesson.id);
        return (
          <button
            key={lesson.id}
            onClick={() => {
              setActiveLessonId(lesson.id);
              setCheckResult(null);
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              width: '100%',
              marginBottom: 6,
              padding: '8px 10px',
              background: isDone
                ? 'rgba(16,185,129,0.15)'
                : isActive
                ? T.primarySoft
                : T.buttonBg,
              color: isDone ? T.success : isActive ? T.primary : T.textMuted,
              border: `1px solid ${isDone ? T.success : isActive ? T.primary : T.buttonBorder}`,
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 12,
              fontFamily: 'inherit',
              fontWeight: 500,
            }}
          >
            <span style={{ fontSize: 16, marginRight: 8 }}>{isDone ? '✅' : lesson.icon}</span>
            <span style={{ flex: 1 }}>{lesson.title}</span>
          </button>
        );
      })}

      {activeLesson && (
        <div
          style={{
            marginTop: 10,
            padding: 12,
            background: T.buttonBg,
            border: `1px solid ${T.primary}`,
            borderRadius: 10,
            fontSize: 12,
            color: T.text,
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 6, color: T.primary }}>
            {activeLesson.icon} {activeLesson.title}
          </div>
          <div style={{ opacity: 0.85, marginBottom: 8, lineHeight: 1.5 }}>
            {activeLesson.description}
          </div>
          <div style={{ marginBottom: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {activeLesson.requirements.map((r) => (
              <span
                key={r}
                style={{
                  background: T.primarySoft,
                  color: T.primary,
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 10,
                  fontWeight: 600,
                }}
              >
                {r}
              </span>
            ))}
          </div>

          <div
            style={{
              background: 'rgba(0,0,0,0.15)',
              padding: 8,
              borderRadius: 6,
              fontSize: 11,
              marginBottom: 10,
              lineHeight: 1.5,
              opacity: 0.9,
            }}
          >
            💡 {activeLesson.hint}
          </div>

          {checkResult && (
            <div
              style={{
                padding: 8,
                borderRadius: 6,
                marginBottom: 8,
                fontSize: 11,
                background: checkResult.passed ? T.successSoft : T.dangerSoft,
                color: checkResult.passed ? T.success : T.danger,
                fontWeight: 600,
              }}
            >
              {checkResult.passed ? '✅ ' : '❌ '}
              {checkResult.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={runCheck}
              style={{
                flex: 1,
                padding: '8px 10px',
                background: T.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                fontFamily: 'inherit',
              }}
            >
              🔍 Проверить
            </button>
            <button
              onClick={loadStarter}
              style={{
                padding: '8px 10px',
                background: T.buttonBg,
                color: T.textMuted,
                border: `1px solid ${T.buttonBorder}`,
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: 'inherit',
              }}
              title="Очистить сцену для нового урока"
            >
              🧹
            </button>
          </div>
        </div>
      )}

      {showCertificate && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
          onClick={() => setShowCertificate(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: `linear-gradient(135deg, ${T.panelBg}, ${T.primarySoft})`,
              border: `2px solid ${T.primary}`,
              borderRadius: 20,
              padding: 40,
              maxWidth: 500,
              textAlign: 'center',
              boxShadow: `0 0 60px ${T.primary}66`,
            }}
          >
            <div style={{ fontSize: 64, marginBottom: 12 }}>🏆</div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 800,
                background: `linear-gradient(135deg, ${T.primary}, ${T.accent1})`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                marginBottom: 8,
              }}
            >
              Сертификат выдан!
            </div>
            <div style={{ color: T.text, fontSize: 14, marginBottom: 20, lineHeight: 1.6 }}>
              Ты прошёл все {LESSONS.length} уроков Circuit Studio.
              <br />
              Теперь ты знаешь:
            </div>
            <div
              style={{
                color: T.textMuted,
                fontSize: 13,
                textAlign: 'left',
                marginBottom: 20,
                lineHeight: 1.8,
              }}
            >
              ✓ Замыкать цепь из батареи и лампы
              <br />
              ✓ Защищать компоненты резистором
              <br />
              ✓ Управлять цепью выключателем
              <br />
              ✓ Подключать светодиоды
              <br />
              ✓ Делить напряжение
            </div>
            <button
              onClick={() => setShowCertificate(false)}
              style={{
                padding: '12px 32px',
                background: T.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                fontSize: 14,
                fontWeight: 700,
                fontFamily: 'inherit',
              }}
            >
              Продолжить
            </button>
          </div>
        </div>
      )}
    </div>
  );
}