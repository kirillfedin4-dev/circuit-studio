export type ComponentType =
  | 'battery' | 'resistor' | 'lamp' | 'capacitor' | 'inductor'
  | 'led' | 'switch' | 'ground' | 'ammeter' | 'voltmeter';

export interface Pin { name: string; offset: [number, number, number]; }

export interface CircuitComponent {
  id: string;
  type: ComponentType;
  position: [number, number, number];
  rotation: [number, number, number];
  voltage?: number;
  resistance?: number;
  rating?: number;
  capacitance?: number;
  inductance?: number;
  closed?: boolean;
  /** Звук лампы: отключён */
  lampMuted?: boolean;
  /** Звук лампы: громкость 0..1 */
  lampVolume?: number;
}

export interface Wire {
  id: string;
  fromComp: string;
  fromPin: string;
  toComp: string;
  toPin: string;
}

export interface PinRef { comp: string; pin: string; }