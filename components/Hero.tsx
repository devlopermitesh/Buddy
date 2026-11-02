"use client";

import Image from "next/image";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type Variants,
} from "framer-motion";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const STICKERS = [
  { one: "24/7 energy ↗", two: "Zero grumpy days :)" },
  { one: "On-brand, always ↗", two: "Your voice, not mine :)" },
  { one: "Planning ahead ↗", two: "Approvals stay yours :)" },
];

const headingVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.085, delayChildren: 0.12 },
  },
};

const lineVariants: Variants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, ease: EASE },
  },
};

export default function Hero() {
  const reduceMotion = useReducedMotion() ?? false;
  const [stickerIndex, setStickerIndex] = useState(0);

  const stageRef = useRef<HTMLDivElement>(null);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 110, damping: 18, mass: 0.6 });
  const y = useSpring(pointerY, { stiffness: 110, damping: 18, mass: 0.6 });
  const rotate = useTransform(x, [-18, 18], [-5, 5]);

  const sticker = STICKERS[stickerIndex];

  useEffect(() => {
    if (reduceMotion) return;

    const interval = window.setInterval(() => {
      setStickerIndex((current) => (current + 1) % STICKERS.length);
    }, 3800);

    return () => window.clearInterval(interval);
  }, [reduceMotion]);

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (reduceMotion || event.pointerType !== "mouse") return;

    const stage = stageRef.current;
    if (!stage) return;

    const rect = stage.getBoundingClientRect();
    const relativeX = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const relativeY = (event.clientY - rect.top - rect.height / 2) / (rect.height / 2);

    pointerX.set(Math.max(-1, Math.min(1, relativeX)) * 16);
    pointerY.set(Math.max(-1, Math.min(1, relativeY)) * 12);
  }

  function resetPointer() {
    pointerX.set(0);
    pointerY.set(0);
  }

  return (
    <section className="hero">
      <div className="wrap">
        <div className="topline">
          <div className="wordmark">
            BUDDY<span>YOUR AI SIDEKICK</span>
          </div>
          <div className="top-note">
            <span className="live-dot" aria-hidden="true" />
            Always on. Always on-brand.
          </div>
        </div>

        <div className="hero-grid">
          <div className="hero-copy">
            <motion.span
              className="pill"
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <span className="dot" aria-hidden="true" />
              YOUR 24/7 SOCIAL MEDIA BUDDY
            </motion.span>

            <motion.h1
              aria-label="You do the big stuff."
              variants={headingVariants}
              initial={reduceMotion ? false : "hidden"}
              animate="show"
            >
              <motion.span className="hero-line" variants={lineVariants}>
                YOU DO
              </motion.span>
              <motion.span className="hero-line" variants={lineVariants}>
                THE <span className="outline">BIG</span>
              </motion.span>
              <motion.span className="hero-line" variants={lineVariants}>
                <span className="italic">stuff.</span>
              </motion.span>
            </motion.h1>

            <motion.p
              className="hero-desc"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.42, ease: EASE }}
            >
              I&apos;ll keep your brand showing up. Meet the smiling sidekick
              that gets to know your brand, plans your content, and takes the
              everyday social media stress off your plate.
            </motion.p>

            <motion.div
              className="hero-actions"
              initial={reduceMotion ? false : { opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.54, ease: EASE }}
            >
              <a className="btn" href="#how">
                Meet your Buddy <span className="arrow">↗</span>
              </a>
              <a className="btn secondary" href="#promise">
                What I take care of <span className="arrow">↓</span>
              </a>
            </motion.div>

            <motion.div
              className="tiny-proof"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.72 }}
            >
              A little less content chaos. A lot more consistency.
            </motion.div>
          </div>

          <div
            className="mascot-stage"
            ref={stageRef}
            onPointerMove={handlePointerMove}
            onPointerLeave={resetPointer}
          >
            <div className="mascot-halo" aria-hidden="true" />
            <span className="spark a" aria-hidden="true">
              ✳
            </span>
            <span className="spark b" aria-hidden="true">
              ✦
            </span>

            <motion.div
              className="mascot-wrap"
              style={reduceMotion ? undefined : { x, y, rotate }}
            >
              <Image
                className="mascot"
                src="/buddy.png"
                alt="BUDDY smiling mascot character"
                width={261}
                height={259}
                priority
                sizes="(max-width: 760px) 245px, 300px"
              />
            </motion.div>

            <div className="sticker one" aria-hidden="true">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`sticker-one-${stickerIndex}`}
                  className="sticker-text"
                  initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {sticker.one}
                </motion.span>
              </AnimatePresence>
            </div>

            <div className="sticker two" aria-hidden="true">
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={`sticker-two-${stickerIndex}`}
                  className="sticker-text"
                  initial={{ opacity: 0, y: 8, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(3px)" }}
                  transition={{ duration: 0.3, ease: EASE }}
                >
                  {sticker.two}
                </motion.span>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
