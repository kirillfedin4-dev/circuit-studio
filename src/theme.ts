export type ThemeKey = 'light' | 'dark' | 'sunset' | 'lab';

export interface Theme {
  name: string;
  icon: string;

  // Фон сцены
  sceneBg: string;
  fogColor: string;
  fogNear: number;
  fogFar: number;

  // Сетка
  gridCell: string;
  gridSection: string;

  // Свет
  ambientIntensity: number;
  directionalIntensity: number;
  accent1: string;
  accent2: string;

  // UI
  panelBg: string;
  panelBorder: string;
  panelShadow: string;
  text: string;
  textMuted: string;
  textDim: string;

  // Кнопки
  buttonBg: string;
  buttonBorder: string;
  buttonHoverBg: string;

  // Специальные акценты
  primary: string;
  primaryDim: string;
  primarySoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  successSoft: string;
}

export const THEMES: Record<ThemeKey, Theme> = {
  light: {
    name: 'Светлая',
    icon: '☀️',
    sceneBg: '#f8fafc',
    fogColor: '#f8fafc',
    fogNear: 30,
    fogFar: 70,
    gridCell: '#cbd5e1',
    gridSection: '#94a3b8',
    ambientIntensity: 0.7,
    directionalIntensity: 1.2,
    accent1: '#a855f7',
    accent2: '#0ea5e9',
    panelBg: 'rgba(255,255,255,0.95)',
    panelBorder: '#e2e8f0',
    panelShadow: '0 8px 32px rgba(15,23,42,0.08)',
    text: '#1e293b',
    textMuted: '#475569',
    textDim: '#94a3b8',
    buttonBg: '#fff',
    buttonBorder: '#e2e8f0',
    buttonHoverBg: '#f8fafc',
    primary: '#0ea5e9',
    primaryDim: '#0284c7',
    primarySoft: '#eff6ff',
    danger: '#dc2626',
    dangerSoft: '#fee2e2',
    success: '#10b981',
    successSoft: '#f0fdf4',
  },
  dark: {
    name: 'Тёмная',
    icon: '🌙',
    sceneBg: '#0a0a14',
    fogColor: '#0a0a14',
    fogNear: 20,
    fogFar: 50,
    gridCell: '#1a3355',
    gridSection: '#00d4ff',
    ambientIntensity: 0.35,
    directionalIntensity: 1.4,
    accent1: '#a855f7',
    accent2: '#00d4ff',
    panelBg: 'rgba(15,15,30,0.92)',
    panelBorder: 'rgba(255,255,255,0.08)',
    panelShadow: '0 8px 32px rgba(0,0,0,0.5)',
    text: '#fff',
    textMuted: '#cbd5e1',
    textDim: '#64748b',
    buttonBg: 'rgba(30,30,50,0.7)',
    buttonBorder: 'rgba(255,255,255,0.1)',
    buttonHoverBg: 'rgba(40,40,65,0.9)',
    primary: '#00d4ff',
    primaryDim: '#0284c7',
    primarySoft: 'rgba(0,212,255,0.15)',
    danger: '#ff4444',
    dangerSoft: 'rgba(255,68,68,0.15)',
    success: '#00ff88',
    successSoft: 'rgba(0,255,136,0.12)',
  },
  sunset: {
    name: 'Закат',
    icon: '🌆',
    sceneBg: '#2a1a2e',
    fogColor: '#2a1a2e',
    fogNear: 25,
    fogFar: 60,
    gridCell: '#5a3050',
    gridSection: '#ff6b9d',
    ambientIntensity: 0.5,
    directionalIntensity: 1.3,
    accent1: '#ff6b9d',
    accent2: '#ffa94d',
    panelBg: 'rgba(42,26,46,0.92)',
    panelBorder: 'rgba(255,150,180,0.2)',
    panelShadow: '0 8px 32px rgba(255,100,150,0.2)',
    text: '#ffe4ec',
    textMuted: '#d8a8b8',
    textDim: '#8a5060',
    buttonBg: 'rgba(60,35,65,0.7)',
    buttonBorder: 'rgba(255,150,180,0.2)',
    buttonHoverBg: 'rgba(80,45,85,0.9)',
    primary: '#ff6b9d',
    primaryDim: '#d94e7a',
    primarySoft: 'rgba(255,107,157,0.15)',
    danger: '#ff4444',
    dangerSoft: 'rgba(255,68,68,0.15)',
    success: '#7dd87d',
    successSoft: 'rgba(125,216,125,0.12)',
  },
  lab: {
    name: 'Лаборатория',
    icon: '🧪',
    sceneBg: '#0f1419',
    fogColor: '#0f1419',
    fogNear: 20,
    fogFar: 55,
    gridCell: '#1e2a35',
    gridSection: '#4a9eff',
    ambientIntensity: 0.4,
    directionalIntensity: 1.3,
    accent1: '#4a9eff',
    accent2: '#7dd87d',
    panelBg: 'rgba(20,28,35,0.94)',
    panelBorder: 'rgba(74,158,255,0.15)',
    panelShadow: '0 8px 32px rgba(0,0,0,0.4)',
    text: '#dbeafe',
    textMuted: '#93b4d4',
    textDim: '#5a7a9a',
    buttonBg: 'rgba(30,42,53,0.7)',
    buttonBorder: 'rgba(74,158,255,0.15)',
    buttonHoverBg: 'rgba(40,55,70,0.9)',
    primary: '#4a9eff',
    primaryDim: '#2a7edf',
    primarySoft: 'rgba(74,158,255,0.15)',
    danger: '#ff4444',
    dangerSoft: 'rgba(255,68,68,0.15)',
    success: '#7dd87d',
    successSoft: 'rgba(125,216,125,0.12)',
  },
};