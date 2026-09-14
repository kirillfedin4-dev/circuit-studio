import { ReactNode, useEffect, useState } from 'react';

interface AnimatedWrapperProps {
  children: ReactNode;
  delay?: number;
  type?: 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'pop' | 'fade';
  duration?: number;
  style?: React.CSSProperties;
}

const ANIMATIONS: Record<string, { from: React.CSSProperties; to: React.CSSProperties }> = {
  'slide-up': { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
  'slide-down': { from: { opacity: 0, transform: 'translateY(-20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
  'slide-left': { from: { opacity: 0, transform: 'translateX(20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
  'slide-right': { from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
  'pop': { from: { opacity: 0, transform: 'scale(0.85)' }, to: { opacity: 1, transform: 'scale(1)' } },
  'fade': { from: { opacity: 0 }, to: { opacity: 1 } },
};

export default function AnimatedWrapper({
  children,
  delay = 0,
  type = 'slide-up',
  duration = 400,
  style,
}: AnimatedWrapperProps) {
  const [visible, setVisible] = useState(false);
  const anim = ANIMATIONS[type] || ANIMATIONS['slide-up'];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  const currentStyle = visible ? anim.to : anim.from;

  return (
    <div
      style={{
        ...style,
        opacity: currentStyle.opacity,
        transform: currentStyle.transform,
        transition: `opacity ${duration}ms ease, transform ${duration}ms cubic-bezier(0.34, 1.2, 0.64, 1)`,
        willChange: 'opacity, transform',
      }}
    >
      {children}
    </div>
  );
}