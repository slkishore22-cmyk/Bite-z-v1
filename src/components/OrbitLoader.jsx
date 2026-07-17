import { useEffect, useRef } from 'react';

const OrbitLoader = ({ size = 88 }) => {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    const W = size, H = size;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = W / 2, cy = H / 2;
    const outerRadius = W * 0.42;
    const innerRadius = W * 0.33;
    const outerDotSize = Math.max(2, W * 0.05);
    const innerDotSize = Math.max(1.5, W * 0.028);
    const stroke = Math.max(1, W * 0.0083 * 1.2);
    const outerArcs = [
      { start: -0.4, sweep: 1.0 },
      { start: 2.6,  sweep: 1.0 },
      { start: 4.2,  sweep: 1.0 },
    ];
    const innerArc = { start: 0.2, sweep: 5.0 };
    const outerDotAngle = 0.6;
    const innerDotAngle = 5.2;
    const trailLength = Math.PI * 0.10;

    const drawCometTrail = (rotation, radius, localDotAngle, dotRadius, clockwise) => {
      const worldAngle = localDotAngle + (clockwise ? rotation : -rotation);
      const trailSteps = 18;
      for (let i = 0; i <= trailSteps; i++) {
        const t = i / trailSteps;
        const trailAngle = worldAngle - (clockwise ? 1 : -1) * trailLength * (1 - t);
        const x = cx + radius * Math.cos(trailAngle);
        const y = cy + radius * Math.sin(trailAngle);
        const opacity = Math.pow(t, 4) * 0.55;
        const size = dotRadius * Math.pow(t, 1.8) * 0.85;
        if (size < 0.3) continue;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(26,26,26,${opacity})`;
        ctx.fill();
      }
      const headX = cx + radius * Math.cos(worldAngle);
      const headY = cy + radius * Math.sin(worldAngle);
      ctx.beginPath();
      ctx.arc(headX, headY, dotRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();
    };

    const drawArcs = (rotation, radius, arcs, clockwise) => {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(clockwise ? rotation : -rotation);
      ctx.translate(-cx, -cy);
      ctx.strokeStyle = '#1a1a1a';
      ctx.lineWidth = stroke;
      ctx.lineCap = 'round';
      arcs.forEach((arc) => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, arc.start, arc.start + arc.sweep, false);
        ctx.stroke();
      });
      ctx.restore();
    };

    let start = null;
    const duration = 2200;
    const animate = (ts) => {
      if (!start) start = ts;
      const rotation = (((ts - start) % duration) / duration) * Math.PI * 2;
      ctx.clearRect(0, 0, W, H);
      drawArcs(rotation, outerRadius, outerArcs, true);
      drawArcs(rotation, innerRadius, [innerArc], false);
      drawCometTrail(rotation, outerRadius, outerDotAngle, outerDotSize, true);
      drawCometTrail(rotation, innerRadius, innerDotAngle, innerDotSize, false);
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [size]);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
};

export default OrbitLoader;