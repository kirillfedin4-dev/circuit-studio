import type { CircuitComponent, Wire } from './types';

export interface LessonCheckResult {
  passed: boolean;
  message: string;
}

export interface Lesson {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  hint: string;
  requirements: string[];
  check: (components: CircuitComponent[], wires: Wire[]) => LessonCheckResult;
}

// ---------- Помощники ----------

function getOtherPin(type: string, pin: string): string | null {
  switch (type) {
    case 'resistor':
    case 'lamp':
    case 'inductor':
    case 'switch':
      return pin === 'A' ? 'B' : 'A';
    case 'led':
    case 'capacitor':
      return pin === '+' ? '-' : '+';
    case 'ammeter':
      return pin === 'IN' ? 'OUT' : 'IN';
    default:
      return null;
  }
}

export function isClosedCircuit(comps: CircuitComponent[], wires: Wire[]): boolean {
  const battery = comps.find((c) => c.type === 'battery');
  if (!battery) return false;
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
        if (!comp) continue;
        if (comp.type === 'switch' && !comp.closed) continue;
        if (comp.type !== 'battery') {
          const otherPin = getOtherPin(comp.type, next!.pin);
          if (otherPin) queue.push({ comp: comp.id, pin: otherPin });
        } else {
          queue.push(next);
        }
      }
    }
  }
  return false;
}

export function isInCircuit(compId: string, comps: CircuitComponent[], wires: Wire[]): boolean {
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
    for (const w of wires) {
      let next: { comp: string; pin: string } | null = null;
      if (w.fromComp === cur.comp && w.fromPin === cur.pin) {
        next = { comp: w.toComp, pin: w.toPin };
      } else if (w.toComp === cur.comp && w.toPin === cur.pin) {
        next = { comp: w.fromComp, pin: w.fromPin };
      }
      if (next) {
        const comp = comps.find((c) => c.id === next!.comp);
        if (!comp) continue;
        if (comp.type === 'switch' && !comp.closed) continue;
        if (comp.type !== 'battery') {
          const otherPin = getOtherPin(comp.type, next!.pin);
          if (otherPin) queue.push({ comp: comp.id, pin: otherPin });
        } else {
          queue.push(next);
        }
      }
    }
  }
  return found.has(compId);
}

// ---------- Уроки ----------

export const LESSONS: Lesson[] = [
  {
    id: 'lamp-on',
    title: 'Зажги лампочку',
    shortTitle: 'Лампочка',
    icon: '💡',
    description: 'Собери простейшую цепь: батарея → лампа → обратно к батарее.',
    hint: 'Соедини + батареи с пином A лампы, а − батареи с пином B лампы.',
    requirements: ['🔋 Батарея', '💡 Лампа', '2 провода'],
    check: (comps, wires) => {
      const hasBat = comps.some((c) => c.type === 'battery');
      const hasLamp = comps.some((c) => c.type === 'lamp');
      if (!hasBat || !hasLamp) return { passed: false, message: 'Нужны батарея и лампа' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Цепь не замкнута. Соедини лампу с батареей с двух сторон.' };
      }
      return { passed: true, message: 'Лампа горит! Урок пройден 🎉' };
    },
  },
  {
    id: 'resistor',
    title: 'Защити лампу резистором',
    shortTitle: 'Резистор',
    icon: '⚡',
    description: 'Слишком большое напряжение сжигает лампу. Добавь резистор последовательно.',
    hint: 'Поставь резистор 220Ω–1kΩ между батареей и лампой.',
    requirements: ['🔋 Батарея', '⚡ Резистор', '💡 Лампа'],
    check: (comps, wires) => {
      const lamp = comps.find((c) => c.type === 'lamp');
      const res = comps.find((c) => c.type === 'resistor');
      if (!lamp || !res) return { passed: false, message: 'Нужны лампа И резистор' };
      if (!isClosedCircuit(comps, wires)) return { passed: false, message: 'Цепь не замкнута' };
      if (!isInCircuit(res.id, comps, wires)) {
        return { passed: false, message: 'Резистор не в цепи — поставь его последовательно' };
      }
      const rating = lamp.rating ?? 1;
      const bat = comps.find((c) => c.type === 'battery');
      const voltage = bat?.voltage ?? 9;
      const R = (res.resistance ?? 220) + rating * 100;
      const P = (voltage / R) ** 2 * (rating * 100);
      if (P > rating * 1.5) {
        return { passed: false, message: `Лампа перегорает (${P.toFixed(2)} Вт > ${rating} Вт). Увеличь сопротивление.` };
      }
      return { passed: true, message: 'Лампа горит в безопасном режиме! 🎉' };
    },
  },
  {
    id: 'switch',
    title: 'Управляй выключателем',
    shortTitle: 'Выключатель',
    icon: '🔀',
    description: 'Добавь переключатель, чтобы включать и выключать лампу.',
    hint: 'Поставь переключатель последовательно. Замкни его — лампа горит.',
    requirements: ['🔋 Батарея', '🔀 Переключатель', '💡 Лампа'],
    check: (comps, wires) => {
      const sw = comps.find((c) => c.type === 'switch');
      const lamp = comps.find((c) => c.type === 'lamp');
      if (!sw || !lamp) return { passed: false, message: 'Нужны выключатель и лампа' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Цепь не замкнута или выключатель разомкнут. Кликни по его рычагу!' };
      }
      if (!isInCircuit(sw.id, comps, wires)) {
        return { passed: false, message: 'Выключатель не в цепи' };
      }
      return { passed: true, message: 'Лампа горит, выключатель работает! 🎉' };
    },
  },
  {
    id: 'led',
    title: 'LED с резистором',
    shortTitle: 'LED',
    icon: '🟢',
    description: 'Светодиод без резистора сгорит. Поставь защитный резистор 330Ω.',
    hint: 'Соедини + батареи → резистор → LED.+ и LED.− → − батареи. Резистор 300–400Ω.',
    requirements: ['🔋 Батарея', '⚡ Резистор', '🟢 LED'],
    check: (comps, wires) => {
      const led = comps.find((c) => c.type === 'led');
      const res = comps.find((c) => c.type === 'resistor');
      if (!led || !res) return { passed: false, message: 'Нужны LED и резистор' };
      if (!isClosedCircuit(comps, wires)) return { passed: false, message: 'Цепь не замкнута' };
      if (!isInCircuit(led.id, comps, wires) || !isInCircuit(res.id, comps, wires)) {
        return { passed: false, message: 'И LED, и резистор должны быть в цепи' };
      }
      const r = res.resistance ?? 0;
      if (r < 100) return { passed: false, message: `Резистор слишком мал (${r}Ω). Поставь минимум 300Ω.` };
      return { passed: true, message: 'LED светится! Урок пройден 🎉' };
    },
  },
  {
    id: 'divider',
    title: 'Делитель напряжения',
    shortTitle: 'Делитель',
    icon: '📐',
    description: 'Два резистора одинакового номинала делят напряжение пополам.',
    hint: 'Поставь два резистора одинакового номинала последовательно.',
    requirements: ['🔋 Батарея', '⚡ Резистор ×2', '📐 Вольтметр'],
    check: (comps, wires) => {
      const resistors = comps.filter((c) => c.type === 'resistor');
      if (resistors.length < 2) return { passed: false, message: 'Нужно минимум 2 резистора' };
      if (!isClosedCircuit(comps, wires)) return { passed: false, message: 'Цепь не замкнута' };
      const r1 = resistors[0].resistance ?? 0;
      const r2 = resistors[1].resistance ?? 0;
      if (r1 === 0 || r2 === 0) return { passed: false, message: 'Резисторы должны иметь номинал' };
      const ratio = Math.min(r1, r2) / Math.max(r1, r2);
      if (ratio < 0.8) {
        return { passed: false, message: `Резисторы разного номинала (${r1}Ω и ${r2}Ω). Поставь одинаковые.` };
      }
      return { passed: true, message: 'Делитель напряжения собран! 🎉' };
    },
  },
];