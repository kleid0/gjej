'use client';

import { useEffect, useRef, useState } from 'react';

const DIGITS = '0123456789';

function FlipDigit({ target, delay }: { target: string; delay: number }) {
  const [char, setChar] = useState('0');
  const [animKey, setAnimKey] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    const totalFlips = 14 + Math.floor(Math.random() * 8);
    let count = 0;

    const flip = () => {
      if (stopped.current) return;
      count++;
      const isLast = count >= totalFlips;
      const next = isLast ? target : DIGITS[Math.floor(Math.random() * 10)];
      setChar(next);
      setAnimKey((k) => k + 1);
      if (!isLast) setTimeout(flip, Math.min(28 + count * 7, 95));
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
  const digits = String(productCount).split('');
  return (
    <div className="flip-board-number">
      {digits.map((d, i) => (
        <FlipDigit key={i} target={d} delay={100 + i * 130} />
      ))}
    </div>
  );
}
