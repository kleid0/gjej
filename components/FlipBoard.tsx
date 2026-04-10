'use client';

import { useEffect, useRef, useState } from 'react';

const DIGITS = '0123456789';

// Each digit gets a fixed number of flips; more flips = lands later.
// With the quadratic ease-out curve, adding 4 flips per position
// spaces landings ~440 ms apart, so digit 0 locks first, then 1, 2…
const BASE_FLIPS = 18;
const FLIPS_PER_DIGIT = 4;

function FlipDigit({
  target,
  delay,
  totalFlips,
}: {
  target: string;
  delay: number;
  totalFlips: number;
}) {
  const [char, setChar] = useState('0');
  const [animKey, setAnimKey] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    let count = 0;

    const flip = () => {
      if (stopped.current) return;
      count++;
      const isLast = count >= totalFlips;
      const next = isLast ? target : DIGITS[Math.floor(Math.random() * 10)];
      setChar(next);
      setAnimKey((k) => k + 1);
      if (!isLast) {
        // Quadratic ease-out: blazing fast at start, slow deliberate ticks at end
        const progress = count / totalFlips;
        const interval = 14 + 290 * (progress * progress);
        setTimeout(flip, interval);
      }
    };

    const tid = setTimeout(flip, delay);
    return () => {
      stopped.current = true;
      clearTimeout(tid);
    };
  }, [target, delay, totalFlips]);

  return (
    <span className="flip-digit">
      <span key={animKey} className="flip-digit__char">
        {char}
      </span>
    </span>
  );
}

export default function FlipBoard({ productCount }: { productCount: number }) {
  return (
    <div className="flip-board-number">
      {String(productCount)
        .split('')
        .map((d, i) => (
          <FlipDigit
            key={i}
            target={d}
            delay={i * 30}
            totalFlips={BASE_FLIPS + i * FLIPS_PER_DIGIT}
          />
        ))}
    </div>
  );
}
