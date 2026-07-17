/**
 * OrderConfirmedAnimation.jsx
 * ─────────────────────────────────────────────────────────────────
 * Drop-in replacement for the green tick + glow section on the
 * Order Status / Order Confirmed screen.
 *
 * Animation sequence (synced to the sound):
 *  0ms    — component mounts, everything invisible
 *  0ms    — sound starts playing (fade-in 120ms)
 *  0ms    — haptic fires
 *  80ms   — outer glow ring starts expanding (scale 0 → 1.4 → 1)
 *  160ms  — green circle pops in with spring bounce
 *  320ms  — checkmark draws itself (stroke-dashoffset animation)
 *  500ms  — glow pulses once in sync with sound peak
 *  700ms  — "Order Confirmed" text fades + slides up
 *  900ms  — subtitle text fades in
 *  1100ms — cards stagger in from below
 *  loop   — outer ring does slow breathing glow (matches sound sustain)
 *
 * USAGE:
 *   import OrderConfirmedAnimation from './OrderConfirmedAnimation';
 *
 *   // Replace your existing green tick + title section with:
 *   <OrderConfirmedAnimation />
 *
 * Props:
 *   onAnimationComplete?: () => void  — called when all animations finish
 * ─────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useState } from 'react';

// ── CSS keyframes injected once into <head> ──────────────────────
const STYLES = `
@keyframes ob-outer-ring {
  0%   { transform: scale(0.2); opacity: 0; }
  40%  { transform: scale(1.45); opacity: 0.5; }
  70%  { transform: scale(0.92); opacity: 0.8; }
  100% { transform: scale(1);    opacity: 1; }
}
@keyframes ob-circle-pop {
  0%   { transform: scale(0);    opacity: 0; }
  50%  { transform: scale(1.18); opacity: 1; }
  70%  { transform: scale(0.93); }
  85%  { transform: scale(1.05); }
  100% { transform: scale(1);    opacity: 1; }
}
@keyframes ob-check-draw {
  0%   { stroke-dashoffset: 60; opacity: 0; }
  20%  { opacity: 1; }
  100% { stroke-dashoffset: 0;  opacity: 1; }
}
@keyframes ob-glow-pulse {
  0%   { box-shadow: 0 0 0px  0px  rgba(34,197,94,0),
                     0 0 0px  0px  rgba(34,197,94,0); }
  30%  { box-shadow: 0 0 32px 18px rgba(34,197,94,0.55),
                     0 0 80px 40px rgba(34,197,94,0.2); }
  60%  { box-shadow: 0 0 20px 10px rgba(34,197,94,0.35),
                     0 0 60px 30px rgba(34,197,94,0.12); }
  100% { box-shadow: 0 0 14px 6px  rgba(34,197,94,0.25),
                     0 0 40px 20px rgba(34,197,94,0.08); }
}
@keyframes ob-glow-breathe {
  0%,100% { box-shadow: 0 0 14px 6px  rgba(34,197,94,0.22),
                        0 0 40px 20px rgba(34,197,94,0.07); }
  50%     { box-shadow: 0 0 22px 10px rgba(34,197,94,0.38),
                        0 0 60px 30px rgba(34,197,94,0.13); }
}
@keyframes ob-ripple {
  0%   { transform: scale(1);   opacity: 0.6; }
  100% { transform: scale(2.4); opacity: 0;   }
}
@keyframes ob-fade-slide-up {
  0%   { opacity: 0; transform: translateY(14px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes ob-card-slide-up {
  0%   { opacity: 0; transform: translateY(24px); }
  100% { opacity: 1; transform: translateY(0); }
}
@keyframes ob-particle-burst {
  0%   { transform: translate(0,0) scale(1); opacity: 1; }
  100% { transform: translate(var(--px), var(--py)) scale(0); opacity: 0; }
}
`;

function injectStyles() {
  if (document.getElementById('ob-keyframes')) return;
  const tag = document.createElement('style');
  tag.id = 'ob-keyframes';
  tag.textContent = STYLES;
  document.head.appendChild(tag);
}

// ── Particle burst config ────────────────────────────────────────
const PARTICLES = [
  { angle: 0,   dist: 55, color: '#22C55E', size: 7  },
  { angle: 45,  dist: 62, color: '#4ADE80', size: 5  },
  { angle: 90,  dist: 58, color: '#86EFAC', size: 6  },
  { angle: 135, dist: 65, color: '#22C55E', size: 4  },
  { angle: 180, dist: 55, color: '#4ADE80', size: 7  },
  { angle: 225, dist: 60, color: '#86EFAC', size: 5  },
  { angle: 270, dist: 58, color: '#22C55E', size: 6  },
  { angle: 315, dist: 63, color: '#4ADE80', size: 4  },
];

function toRad(deg) { return (deg * Math.PI) / 180; }

// ── Main component ───────────────────────────────────────────────
export default function OrderConfirmedAnimation({ onAnimationComplete, reduceMotion = false }) {
  const [phase, setPhase] = useState(reduceMotion ? 'done' : 'idle');
  // idle → ring → circle → check → pulse → breathe → done
  const hasPlayed = useRef(false);

  useEffect(() => {
    injectStyles();
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      onAnimationComplete?.();
      return;
    }
    if (hasPlayed.current) return;
    hasPlayed.current = true;

    // Animation timeline
    const t = (delay, fn) => setTimeout(fn, delay);
    const timers = [
      t(0,    () => setPhase('ring')),
      t(160,  () => setPhase('circle')),
      t(420,  () => setPhase('check')),
      t(520,  () => setPhase('pulse')),
      t(1400, () => setPhase('breathe')),
      t(2200, () => { setPhase('done'); onAnimationComplete?.(); }),
    ];
    return () => timers.forEach(clearTimeout);
  }, [onAnimationComplete, reduceMotion]);

  const showRing    = ['ring','circle','check','pulse','breathe','done'].includes(phase);
  const showCircle  = ['circle','check','pulse','breathe','done'].includes(phase);
  const showCheck   = ['check','pulse','breathe','done'].includes(phase);
  const showPulse   = ['pulse','breathe','done'].includes(phase);
  const showBreathe = ['breathe','done'].includes(phase);
  const showText    = ['pulse','breathe','done'].includes(phase);
  const showCards   = ['breathe','done'].includes(phase);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>

      {/* ── Tick + Glow Section ─────────────────────────────────── */}
      <div style={{
        position: 'relative',
        width: 160,
        height: 160,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 28,
      }}>

        {/* Ripple rings — fire on pulse phase */}
        {showPulse && !reduceMotion && [0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute',
            width: 96,
            height: 96,
            borderRadius: '50%',
            border: '2px solid rgba(34,197,94,0.6)',
            animation: `ob-ripple 1.2s ${i * 280}ms cubic-bezier(0.15,0.5,0.5,1) forwards`,
            pointerEvents: 'none',
          }} />
        ))}

        {/* Particle burst — fires on check phase */}
        {showCheck && !reduceMotion && PARTICLES.map((p, i) => {
          const px = Math.cos(toRad(p.angle)) * p.dist;
          const py = Math.sin(toRad(p.angle)) * p.dist;
          return (
            <div key={i} style={{
              position: 'absolute',
              width: p.size,
              height: p.size,
              borderRadius: '50%',
              background: p.color,
              '--px': `${px}px`,
              '--py': `${py}px`,
              animation: `ob-particle-burst 600ms ${i * 30}ms cubic-bezier(0.25,0.46,0.45,0.94) forwards`,
              pointerEvents: 'none',
              zIndex: 2,
            }} />
          );
        })}

        {/* Outer soft glow ring */}
        {showRing && (
          <div style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(34,197,94,0.18) 0%, rgba(34,197,94,0.04) 60%, transparent 75%)',
            animation: showRing && !reduceMotion ? 'ob-outer-ring 500ms cubic-bezier(0.34,1.56,0.64,1) forwards' : 'none',
          }} />
        )}

        {/* Green circle (the main button) */}
        {showCircle && (
          <div style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: '#22C55E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            zIndex: 3,
            animation: reduceMotion
              ? 'none'
              : showPulse
              ? 'ob-glow-pulse 800ms cubic-bezier(0.34,1.56,0.64,1) forwards'
              : showBreathe
              ? 'none'
              : 'ob-circle-pop 550ms cubic-bezier(0.34,1.56,0.64,1) forwards',
            // Static glow after pulse settles
            boxShadow: showBreathe || showPulse
              ? undefined
              : '0 0 14px 6px rgba(34,197,94,0.25), 0 0 40px 20px rgba(34,197,94,0.08)',
          }}>

            {/* SVG checkmark — draws itself */}
            <svg
              width="40"
              height="40"
              viewBox="0 0 40 40"
              fill="none"
              style={{ overflow: 'visible' }}
            >
              <path
                d="M8 20 L16.5 29 L32 13"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                strokeDasharray="60"
                strokeDashoffset={showCheck ? 0 : 60}
                style={showCheck && !reduceMotion ? {
                  animation: 'ob-check-draw 420ms 0ms cubic-bezier(0.4,0,0.2,1) forwards',
                } : {
                  strokeDashoffset: showCheck ? 0 : 60,
                  opacity: showCheck ? 1 : 0,
                }}
              />
            </svg>
          </div>
        )}
      </div>

      {/* ── "Order Confirmed" text ──────────────────────────────── */}
      {showText && (
        <div style={{
          textAlign: 'center',
          animation: reduceMotion ? 'none' : 'ob-fade-slide-up 500ms cubic-bezier(0.4,0,0.2,1) forwards',
          marginBottom: 8,
        }}>
          <h2 style={{
            fontSize: 24,
            fontWeight: 700,
            color: '#0F172A',
            margin: '0 0 8px',
            letterSpacing: '-0.025em',
          }}>
            Order Confirmed
          </h2>
          <p style={{
            fontSize: 14,
            color: '#64748B',
            margin: 0,
            lineHeight: 1.5,
            padding: '0 32px',
            animation: reduceMotion ? 'none' : 'ob-fade-slide-up 500ms 150ms cubic-bezier(0.4,0,0.2,1) both',
          }}>
            Your order has been placed successfully<br />
            and is being shared with the chef.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * ── HOW TO INTEGRATE ────────────────────────────────────────────
 *
 * In your OrderStatus.jsx / OrderConfirmed.jsx page:
 *
 * BEFORE (what you have now):
 * ─────────────────────────────
 * <div class="flex flex-col items-center mb-12 relative">
 *   <div class="glow-layer-outer rounded-full">
 *     <div class="w-24 h-24 rounded-full bg-green-500/20 ...">
 *       <span class="material-symbols-outlined ...">check_circle</span>
 *     </div>
 *   </div>
 *   <h2>Order Confirmed</h2>
 *   <p>Your order has been placed...</p>
 * </div>
 *
 * AFTER (replace that entire block with):
 * ─────────────────────────────
 * import OrderConfirmedAnimation from './OrderConfirmedAnimation';
 *
 * <OrderConfirmedAnimation
 *   onAnimationComplete={() => {
 *     // optional: do something after all animations finish
 *   }}
 * />
 *
 * That's it. The cards below (Order ID, Payment, Items)
 * don't need to change — they will naturally appear after
 * the animation because they're below the animated section.
 *
 * OPTIONAL — stagger the cards too:
 * Add this style to each card div in order:
 *   style={{ animation: 'ob-card-slide-up 500ms Xms ease both' }}
 * where X = 900, 1050, 1200 for cards 1, 2, 3
 * ──────────────────────────────────────────────────────────────
 */
