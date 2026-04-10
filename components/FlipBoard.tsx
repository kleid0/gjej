'use client';

import { useEffect, useRef, useState } from 'react';

const ALPHANUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function FlipTile({
  target,
  delay,
  large,
}: {
  target: string;
  delay: number;
  large: boolean;
}) {
  const [char, setChar] = useState(() => ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)]);
  const [animKey, setAnimKey] = useState(0);
  const stopped = useRef(false);

  useEffect(() => {
    stopped.current = false;
    const finalChar = target.toUpperCase();
    if (!ALPHANUM.includes(finalChar)) {
      setChar(finalChar);
      return;
    }
    const totalFlips = large
      ? 20 + Math.floor(Math.random() * 10)
      : 8 + Math.floor(Math.random() * 6);
    let count = 0;

    const flip = () => {
      if (stopped.current) return;
      count++;
      const isLast = count >= totalFlips;
      const next = isLast
        ? finalChar
        : ALPHANUM[Math.floor(Math.random() * ALPHANUM.length)];
      setChar(next);
      setAnimKey((k) => k + 1);
      if (!isLast) {
        setTimeout(flip, Math.min(30 + count * 6, 100));
      }
    };

    const tid = setTimeout(flip, delay);
    return () => {
      stopped.current = true;
      clearTimeout(tid);
    };
  }, [target, delay, large]);

  return (
    <span className={`flip-tile${large ? ' flip-tile--lg' : ''}`}>
      <span key={animKey} className="flip-tile__char">
        {char}
      </span>
    </span>
  );
}

function FlipText({
  text,
  baseDelay,
  large = false,
}: {
  text: string;
  baseDelay: number;
  large?: boolean;
}) {
  let nonSpaceCount = 0;
  const items = text.split('').map((ch, i) => {
    if (ch === ' ') return { key: i, ch, isSpace: true, delay: 0 };
    const d = baseDelay + nonSpaceCount * 35;
    nonSpaceCount++;
    return { key: i, ch, isSpace: false, delay: d };
  });

  return (
    <>
      {items.map((item) =>
        item.isSpace ? (
          <span key={item.key} className={large ? 'flip-gap--lg' : 'flip-gap'} />
        ) : (
          <FlipTile key={item.key} target={item.ch} delay={item.delay} large={large} />
        ),
      )}
    </>
  );
}

export default function FlipBoard({ productCount }: { productCount: number }) {
  const numStr = String(productCount);
  // Row 1 has 16 non-space chars → finishes around 100 + 15*35 + ~800ms animation ≈ 1.5s
  const numDelay = 900;
  const bottomDelay = numDelay + numStr.length * 50 + 600;

  return (
    <div className="flip-board">
      <div className="flip-board__row">
        <FlipText text="CMIMET ME TE ULTA NE" baseDelay={100} />
      </div>
      <div className="flip-board__row flip-board__row--num">
        <FlipText text={numStr} baseDelay={numDelay} large />
      </div>
      <div className="flip-board__row">
        <FlipText text="PRODUKTE" baseDelay={bottomDelay} />
      </div>
    </div>
  );
}
