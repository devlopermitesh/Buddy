"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function FinalCta() {
  const reduceMotion = useReducedMotion() ?? false;
  const year = new Date().getFullYear();

  return (
    <section className="final">
      <div className="wrap">
        <motion.div
          className="final-inner"
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
        >
          <span className="final-spark a" aria-hidden="true">
            ✳
          </span>
          <span className="final-spark b" aria-hidden="true">
            ✦
          </span>

          <div className="eyebrow" style={{ color: "#c9a27b" }}>
            OKAY, BESTIE. LET&apos;S MAKE CONTENT.
          </div>
          <h2>
            Less stress.
            <br />
            <span>More</span> slay.
          </h2>
          <p>
            Give your brand a buddy who gets it. Your content routine deserves a
            little less chaos and a lot more good energy.
          </p>
          <motion.a
            className="btn"
            href="mailto:hello@buddy.social?subject=Let's%20meet%20BUDDY"
            whileHover={reduceMotion ? undefined : { y: -3, scale: 1.02 }}
            whileTap={reduceMotion ? undefined : { scale: 0.98 }}
          >
            Let&apos;s meet, Buddy <span className="arrow">↗</span>
          </motion.a>
        </motion.div>

        <footer className="footer">
          <div>
            <strong>BUDDY.</strong>
            <br />
            Your 24/7 social media sidekick.
          </div>
          <div className="right">
            Made to make showing up easier.
            <br />© {year} BUDDY
          </div>
        </footer>
      </div>
    </section>
  );
}
