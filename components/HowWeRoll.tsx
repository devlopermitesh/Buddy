"use client";

import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useEffect, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const STEPS = [
  {
    n: "01",
    title: "First, I listen.",
    body: "We get your brand basics, tone, audience and goals in one place.",
  },
  {
    n: "02",
    title: "Then, I get creative.",
    body: "I help turn your brand direction into content ideas and a practical plan.",
  },
  {
    n: "03",
    title: "You stay in the loop.",
    body: "Review, refine and approve. Your brand voice and final say stay yours.",
  },
  {
    n: "04",
    title: "We keep showing up.",
    body: "Keep your content organised and your social workflow moving.",
  },
];

const stepVariants: Variants = {
  hidden: { opacity: 0, x: 18 },
  show: (index: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.5, delay: index * 0.07, ease: EASE },
  }),
};

export default function HowWeRoll() {
  const reduceMotion = useReducedMotion() ?? false;
  const [activeStep, setActiveStep] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (reduceMotion || paused) return;

    const interval = window.setInterval(() => {
      setActiveStep((current) => (current + 1) % STEPS.length);
    }, 3400);

    return () => window.clearInterval(interval);
  }, [reduceMotion, paused]);

  return (
    <section className="split" id="how">
      <div className="wrap split-grid">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 26 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.65, ease: EASE }}
        >
          <div className="eyebrow" style={{ color: "#c9a27b" }}>
            02 / HOW WE ROLL
          </div>
          <h2>
            Human-led.
            <br />
            <em>Buddy-powered.</em>
          </h2>
          <p>
            I&apos;m the extra pair of hands behind your brand—not another
            complicated tool you need to babysit. You stay in control. I help
            you stay consistent.
          </p>
        </motion.div>

        <div
          className="steps"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {STEPS.map((step, index) => (
            <motion.div
              key={step.n}
              className={`step${index === activeStep ? " active" : ""}`}
              custom={index}
              variants={stepVariants}
              initial={reduceMotion ? false : "hidden"}
              whileInView="show"
              viewport={{ once: true, margin: "-50px" }}
              onMouseEnter={() => setActiveStep(index)}
            >
              <div className="n">{step.n}</div>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
