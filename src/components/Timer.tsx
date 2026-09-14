import { useEffect, useState } from 'react';
import type { Theme } from '../theme';

export default function Timer({ T, externalSeconds, paused }: {
  T: Theme;
  resetKey?: string;
  externalSeconds: number;
  paused?: boolean;
}) {
  const seconds = externalSeconds;

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        right: 16,
        zIndex: 10,
        background: T.panelBg,
        border: `1px solid ${T.panelBorder}`,
        borderRadius: 10,
        padding: '8px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        boxShadow: T.panelShadow,
        backdropFilter: 'blur(16px)',
        fontSize: 15,
        fontWeight: 700,
        color: T.text,
        fontFamily: 'ui-monospace, SFMono-Regular, monospace',
        animation: 'fadeIn 0.4s ease',
      }}
    >
      <span style={{ fontSize: 13 }}>⏱</span>
      <span>{mm}:{ss}</span>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}