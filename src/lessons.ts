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
          case 'potentiometer':
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
    {
    id: 'two-lamps-series',
    title: 'Две лампы последовательно',
    shortTitle: 'Последоват.',
    icon: '💡💡',
    description: 'Соедини две лампы последовательно — ток идёт через обе. Они будут гореть тусклее, чем одна.',
    hint: 'Батарея → лампа 1 → лампа 2 → батарея. Пины A и B у ламп.',
    requirements: ['🔋 Батарея', '💡 Лампа ×2', '3 провода'],
    check: (comps, wires) => {
      const lamps = comps.filter((c) => c.type === 'lamp');
      if (lamps.length < 2) return { passed: false, message: 'Нужно минимум 2 лампы' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Цепь не замкнута. Соедини лампы последовательно.' };
      }
      // Проверяем, что обе лампы в цепи
      if (!isInCircuit(lamps[0].id, comps, wires) || !isInCircuit(lamps[1].id, comps, wires)) {
        return { passed: false, message: 'Обе лампы должны быть в цепи' };
      }
      return { passed: true, message: 'Две лампы горят последовательно! 🎉' };
    },
  },
  {
    id: 'two-lamps-parallel',
    title: 'Две лампы параллельно',
    shortTitle: 'Параллельно',
    icon: '💡⚡',
    description: 'Соедини две лампы параллельно — каждая получит полное напряжение батареи.',
    hint: 'Оба пина A обеих ламп — к +, оба пина B — к −. Или через промежуточные провода.',
    requirements: ['🔋 Батарея', '💡 Лампа ×2', '4 провода'],
    check: (comps, wires) => {
      const lamps = comps.filter((c) => c.type === 'lamp');
      if (lamps.length < 2) return { passed: false, message: 'Нужно минимум 2 лампы' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Цепь не замкнута' };
      }
      // Проверяем, что у каждой лампы есть отдельный путь к + и -
      // Упрощённо: обе лампы в цепи и у них общие узлы
      const bothInCircuit =
        isInCircuit(lamps[0].id, comps, wires) &&
        isInCircuit(lamps[1].id, comps, wires);
      if (!bothInCircuit) {
        return { passed: false, message: 'Обе лампы должны быть в цепи' };
      }
      // Эвристика: если ламп больше 1 и они не соединены последовательно —
      // значит, параллельно. Проверим через наличие провода между A→B ламп.
      const seriesWire = wires.some(
        (w) =>
          (w.fromComp === lamps[0].id && w.toComp === lamps[1].id) ||
          (w.fromComp === lamps[1].id && w.toComp === lamps[0].id),
      );
      if (seriesWire) {
        return {
          passed: false,
          message: 'Похоже на последовательное соединение. Для параллельного обе лампы должны быть подключены к одним и тем же узлам.',
        };
      }
      return { passed: true, message: 'Параллельное соединение собрано! 🎉' };
    },
  },
  {
    id: 'ammeter',
    title: 'Измерь ток амперметром',
    shortTitle: 'Амперметр',
    icon: '📏',
    description: 'Амперметр включается ПОСЛЕДОВАТЕЛЬНО с нагрузкой. Он покажет ток в цепи.',
    hint: 'Батарея → амперметр (IN) → лампа → батарея. Пин OUT амперметра — к следующему элементу.',
    requirements: ['🔋 Батарея', '📏 Амперметр', '💡 Лампа'],
    check: (comps, wires) => {
      const am = comps.find((c) => c.type === 'ammeter');
      const lamp = comps.find((c) => c.type === 'lamp');
      if (!am || !lamp) return { passed: false, message: 'Нужны амперметр и лампа' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Цепь не замкнута' };
      }
      if (!isInCircuit(am.id, comps, wires)) {
        return { passed: false, message: 'Амперметр должен быть в цепи последовательно' };
      }
      if (!isInCircuit(lamp.id, comps, wires)) {
        return { passed: false, message: 'Лампа должна быть в цепи' };
      }
      return { passed: true, message: 'Ток измерен! Посмотри на показания амперметра 📏' };
    },
  },
  {
    id: 'voltmeter',
    title: 'Измерь напряжение вольтметром',
    shortTitle: 'Вольтметр',
    icon: '📐',
    description: 'Вольтметр включается ПАРАЛЛЕЛЬНО участку, на котором меряем напряжение.',
    hint: 'Собери цепь с батареей и лампой. Вольтметр подключи параллельно лампе: + вольтметра к + лампы, − вольтметра к − лампы.',
    requirements: ['🔋 Батарея', '💡 Лампа', '📐 Вольтметр'],
    check: (comps, wires) => {
      const vm = comps.find((c) => c.type === 'voltmeter');
      const lamp = comps.find((c) => c.type === 'lamp');
      if (!vm || !lamp) return { passed: false, message: 'Нужны вольтметр и лампа' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Основная цепь не замкнута' };
      }
      // Проверяем, что вольтметр подключён хотя бы одним пином к проводу
      const vmWires = wires.filter(
        (w) => w.fromComp === vm.id || w.toComp === vm.id,
      );
      if (vmWires.length < 2) {
        return {
          passed: false,
          message: 'Вольтметр должен быть подключён двумя проводами параллельно лампе',
        };
      }
      // Проверяем, что один из пинов вольтметра соединён с лампой (напрямую или через узел)
      const connectedToLamp = vmWires.some(
        (w) =>
          w.fromComp === lamp.id ||
          w.toComp === lamp.id ||
          w.fromComp === vm.id && w.toComp === lamp.id ||
          w.fromComp === lamp.id && w.toComp === vm.id,
      );
      if (!connectedToLamp) {
        return {
          passed: false,
          message: 'Подключи вольтметр к той же точке, где находится лампа',
        };
      }
      return { passed: true, message: 'Вольтметр подключён параллельно! 📐' };
    },
  },
    {
    id: 'diode-forward',
    title: 'Диод пропускает ток',
    shortTitle: 'Диод',
    icon: '🔷',
    description: 'Диод проводит ток только в одну сторону: от анода (A) к катоду (K). Собери цепь с диодом в прямом включении.',
    hint: 'Батарея.+ → Резистор → Диод.A, Диод.K → Лампа.A, Лампа.B → Батарея.−. Пин A диода — слева, K — справа.',
    requirements: ['🔋 Батарея', '🔷 Диод', '💡 Лампа'],
    check: (comps, wires) => {
      const diode = comps.find((c) => c.type === 'diode');
      const lamp = comps.find((c) => c.type === 'lamp');
      const bat = comps.find((c) => c.type === 'battery');
      if (!diode || !lamp || !bat) return { passed: false, message: 'Нужны батарея, диод и лампа' };
      if (!isClosedCircuit(comps, wires)) {
        return {
          passed: false,
          message: 'Цепь не замкнута. Проверь направление диода: анод (A) должен смотреть в сторону + батареи.',
        };
      }
      if (!isInCircuit(diode.id, comps, wires)) {
        return { passed: false, message: 'Диод не в цепи — включи его последовательно' };
      }
      return {
        passed: true,
        message: 'Ток идёт от A к K, диод открыт! 🎉',
      };
    },
  },
  {
    id: 'diode-reverse',
    title: 'Обратное включение диода',
    shortTitle: 'Диод назад',
    icon: '🔶',
    description: 'Если перевернуть диод — ток не пойдёт. Убедись, что цепь не замыкается.',
    hint: 'Поверни диод на 180° (выдели → кнопка Y↻ или клавиша E). Лампа не должна гореть.',
    requirements: ['🔋 Батарея', '🔷 Диод (перевёрнут)', '💡 Лампа'],
    check: (comps, wires) => {
      const diode = comps.find((c) => c.type === 'diode');
      const lamp = comps.find((c) => c.type === 'lamp');
      const bat = comps.find((c) => c.type === 'battery');
      if (!diode || !lamp || !bat) return { passed: false, message: 'Нужны батарея, диод и лампа' };
      if (isClosedCircuit(comps, wires)) {
        return {
          passed: false,
          message: 'Цепь всё ещё замкнута — значит, диод пропускает ток. Поверни его так, чтобы катод (K) смотрел в сторону +.',
        };
      }
      // Дополнительно: убедимся, что провод к диоду есть, но ток не идёт
      const wiresToDiode = wires.filter(
        (w) => w.fromComp === diode.id || w.toComp === diode.id
      );
      if (wiresToDiode.length < 2) {
        return { passed: false, message: 'Диод должен быть подключён двумя проводами' };
      }
      return {
        passed: true,
        message: 'Диод закрыт, ток не идёт — правильно! 🎉',
      };
    },
  },
  {
    id: 'potentiometer-dim',
    title: 'Регулировка яркости',
    shortTitle: 'Потенциометр',
    icon: '🎚️',
    description: 'Потенциометр позволяет плавно менять сопротивление. Чем больше сопротивление — тем тусклее лампа.',
    hint: 'Собери цепь как с обычным резистором, но вместо него — потенциометр. Потяни рукоятку в сторону, чтобы изменить яркость.',
    requirements: ['🔋 Батарея', '🎚️ Потенциометр', '💡 Лампа'],
    check: (comps, wires) => {
      const pot = comps.find((c) => c.type === 'potentiometer');
      const lamp = comps.find((c) => c.type === 'lamp');
      const bat = comps.find((c) => c.type === 'battery');
      if (!pot || !lamp || !bat) return { passed: false, message: 'Нужны батарея, потенциометр и лампа' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Цепь не замкнута' };
      }
      if (!isInCircuit(pot.id, comps, wires)) {
        return { passed: false, message: 'Потенциометр должен быть в цепи' };
      }
      // Проверяем, что wiper не на минимуме и не на максимуме — то есть им пользовались
      const wiper = pot.wiper ?? 0.5;
      if (wiper < 0.05 || wiper > 0.95) {
        return {
          passed: false,
          message: `Ползунок на краю (${Math.round(wiper * 100)}%). Подвигай его, чтобы понять, как он влияет на яркость.`,
        };
      }
      return { passed: true, message: 'Потенциометр в цепи, яркость регулируется! 🎉' };
    },
  },
  {
    id: 'transistor-switch',
    title: 'Транзистор как ключ',
    shortTitle: 'Транзистор',
    icon: '🔺',
    description: 'Транзистор может работать как управляемый выключатель. Собери цепь с транзистором и лампой.',
    hint: 'Батарея.+ → Лампа.A, Лампа.B → Транзистор.C, Транзистор.E → Батарея.−. База (B) управляет открытием.',
    requirements: ['🔋 Батарея', '🔺 Транзистор', '💡 Лампа'],
    check: (comps, wires) => {
      const tr = comps.find((c) => c.type === 'transistor');
      const lamp = comps.find((c) => c.type === 'lamp');
      const bat = comps.find((c) => c.type === 'battery');
      if (!tr || !lamp || !bat) return { passed: false, message: 'Нужны батарея, транзистор и лампа' };
      // Проверим, что к транзистору подключены хотя бы 3 провода (B, C, E)
      const trWires = wires.filter(
        (w) => w.fromComp === tr.id || w.toComp === tr.id
      );
      if (trWires.length < 3) {
        return {
          passed: false,
          message: `К транзистору подключено ${trWires.length} провода. Нужно 3: база (B), коллектор (C), эмиттер (E).`,
        };
      }
      // Проверим, что лампа в цепи
      if (!isInCircuit(lamp.id, comps, wires)) {
        return { passed: false, message: 'Лампа должна быть в цепи' };
      }
      return {
        passed: true,
        message: 'Транзистор подключён по схеме с общим эмиттером! 🎉',
      };
    },
  },
  {
    id: 'voltmeter-parallel',
    title: 'Вольтметр на лампе',
    shortTitle: 'Вольтметр',
    icon: '📐',
    description: 'Вольтметр включается параллельно тому участку, напряжение на котором мы измеряем.',
    hint: 'Собери цепь батарея → лампа → резистор → батарея. Вольтметр подключи параллельно лампе: + к +, − к −.',
    requirements: ['🔋 Батарея', '💡 Лампа', '📐 Вольтметр'],
    check: (comps, wires) => {
      const vm = comps.find((c) => c.type === 'voltmeter');
      const lamp = comps.find((c) => c.type === 'lamp');
      const bat = comps.find((c) => c.type === 'battery');
      if (!vm || !lamp || !bat) return { passed: false, message: 'Нужны батарея, лампа и вольтметр' };
      if (!isClosedCircuit(comps, wires)) {
        return { passed: false, message: 'Основная цепь не замкнута' };
      }
      const vmWires = wires.filter(
        (w) => w.fromComp === vm.id || w.toComp === vm.id
      );
      if (vmWires.length < 2) {
        return { passed: false, message: 'К вольтметру нужно 2 провода — он подключается параллельно' };
      }
      return {
        passed: true,
        message: 'Вольтметр подключён параллельно! Смотри показания. 🎉',
      };
    },
  },
];