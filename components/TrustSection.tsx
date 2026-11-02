"use client";

import { motion, useReducedMotion } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

export default function TrustSection() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section className="trust">
      <div className="wrap">
        <motion.div
          className="trust-card"
          style={{ transformPerspective: 1200 }}
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          whileHover={
            reduceMotion ? undefined : { rotateX: -1.2, rotateY: 1.4 }
          }
        >
          <div>
            <div className="eyebrow">03 / NO WEIRD BUSINESS</div>
            <h2>
              Your brand.
              <br />
              Your rules.
            </h2>
            <p>
              Trust isn&apos;t a cute tagline. You stay in control of your
              accounts, your content and every important decision. Buddy helps
              with the work; approvals stay with you. No surprise publishing, no
              pretending to be you, no mystery moves.
            </p>
          </div>

          <motion.div
            className="trust-stamp"
            animate={reduceMotion ? undefined : { rotate: [8, 13, 8] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          >
            YOUR BRAND
            <br />
            YOUR VOICE
            <br />
            YOUR FINAL
            <br />
            CALL ✳
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
