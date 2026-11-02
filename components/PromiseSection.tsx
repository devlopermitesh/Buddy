"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";

const EASE = [0.22, 1, 0.36, 1] as const;

const PROMISES = [
  {
    num: "01 — I GET YOU",
    title: "Your brand has a personality.",
    body: "I learn your voice, your vibe, your audience and what makes your brand yours. No copy-paste content energy.",
  },
  {
    num: "02 — I MAKE THE PLAN",
    title: "Good ideas, on repeat.",
    body: "From fresh content ideas to campaign planning, I help keep your social presence moving with purpose.",
  },
  {
    num: "03 — I STAY ON IT",
    title: "Consistency is my thing.",
    body: "Less last-minute scrambling. More organised content, clear approvals and a smoother everyday workflow.",
  },
];

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: (index: number) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: index * 0.08, ease: EASE },
  }),
};

export default function PromiseSection() {
  const reduceMotion = useReducedMotion() ?? false;

  return (
    <section className="section" id="promise">
      <div className="wrap">
        <motion.div
          className="section-head"
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div>
            <div className="eyebrow">01 / THE BUDDY PROMISE</div>
            <h2>
              Social media.
              <br />
              <em>Without the</em> stress.
            </h2>
          </div>
          <p className="section-intro">
            You started a brand to build something you love. Not to spend every
            day wondering what to post. That&apos;s where I come in.
          </p>
        </motion.div>

        <div className="promise-grid">
          {PROMISES.map((promise, index) => (
            <motion.article
              key={promise.num}
              className="promise"
              custom={index}
              variants={cardVariants}
              initial={reduceMotion ? false : "hidden"}
              whileInView="show"
              viewport={{ once: true, margin: "-60px" }}
              whileHover={reduceMotion ? undefined : { y: -6 }}
            >
              <span className="num">{promise.num}</span>
              <span className="arrow" aria-hidden="true">
                ↗
              </span>
              <h3>{promise.title}</h3>
              <p>{promise.body}</p>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
