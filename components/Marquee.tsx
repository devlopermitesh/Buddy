import { Fragment } from "react";

const ITEMS = [
  "YOUR BRAND, UNDERSTOOD",
  "CONTENT, HANDLED",
  "YOUR 24/7 SIDEKICK",
  "LESS CHAOS, MORE CONSISTENCY",
];

function MarqueeItems() {
  return (
    <>
      {ITEMS.map((item) => (
        <Fragment key={item}>
          <span>{item}</span>
          <span className="star">✳</span>
        </Fragment>
      ))}
    </>
  );
}

export default function Marquee() {
  return (
    <div
      className="marquee"
      role="region"
      aria-label="Brand understanding, content planning, everyday consistency"
    >
      <div className="marquee-track" aria-hidden="true">
        <MarqueeItems />
        <MarqueeItems />
      </div>
    </div>
  );
}
