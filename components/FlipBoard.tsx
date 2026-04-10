'use client';

import { useEffect, useRef, useState } from 'react';

const DIGITS = '0123456789';

function FlipDigit({ target, delay }: { target: string; delay: number }) {
  const [char, setChar] = useState('0');
  const [animKey, setAnimKey] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    const totalFlips = 30 + Math.floor(Math.random() * 8);
    let count = 0;

    const flip = () => {
      if (stopped.current) return;
      count++;
      const isLast = count >= totalFlips;
      const next = isLast ? target : DIGITS[Math.floor(Math.random() * 10)];
      setChar(next);
      setAnimKey((k) => k + 1);
      if (!isLast) {
        // Quadratic ease-out: blazing fast at the start, crawling at the end
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
  }, [target, delay]);

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
          <FlipDigit key={i} target={d} delay={i * 55} />
        ))}
    </div>
  );
}
