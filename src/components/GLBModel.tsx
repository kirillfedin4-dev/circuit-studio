import { Suspense, Component, ReactNode, useState, useEffect } from 'react';
import { useGLTF } from '@react-three/drei';

class GLBErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

interface GLBModelProps {
  path: string;
  fallback: ReactNode;
  scale?: number | [number, number, number];
  position?: [number, number, number];
  rotation?: [number, number, number];
}

function LoadedGLB({
  path,
  scale = 1,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: Omit<GLBModelProps, 'fallback'>) {
  const { scene } = useGLTF(path);
  const cloned = scene.clone(true);
  return (
    <primitive
      object={cloned}
      scale={scale}
      position={position}
      rotation={rotation}
    />
  );
}

export default function GLBModel({ path, fallback, scale, position, rotation }: GLBModelProps) {
  // Проверяем, существует ли файл. Пока не знаем — показываем fallback.
  const [exists, setExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(path, { method: 'HEAD' })
      .then((r) => {
        if (cancelled) return;
        const ct = r.headers.get('content-type') || '';
        const ok = r.ok && !ct.includes('text/html');
        setExists(ok);
      })
      .catch(() => {
        if (!cancelled) setExists(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path]);

  // Пока проверяем — показываем fallback (не даём React Suspense висеть)
  if (exists !== true) return <>{fallback}</>;

  return (
    <GLBErrorBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <LoadedGLB path={path} scale={scale} position={position} rotation={rotation} />
      </Suspense>
    </GLBErrorBoundary>
  );
}