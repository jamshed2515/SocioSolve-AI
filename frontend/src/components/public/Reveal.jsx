import { useEffect, useRef, useState } from "react";

/**
 * Fades its children in when they scroll into view.
 * Uses the `.reveal` classes in index.css (disabled for prefers-reduced-motion).
 */
export default function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
  const ref = useRef(null);
  // Without IntersectionObserver (very old browsers) just show everything.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === "undefined");

  useEffect(() => {
    const el = ref.current;
    if (!el || visible) return undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -60px 0px", threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visible]);

  return (
    <Tag
      ref={ref}
      className={`reveal ${visible ? "is-visible" : ""} ${className}`}
      style={{ "--reveal-delay": `${delay}ms` }}
      {...rest}
    >
      {children}
    </Tag>
  );
}

/** Centered eyebrow + title + intro used by every public section. */
export function SectionHeader({ eyebrow, title, text, align = "center" }) {
  const alignCls = align === "left" ? "text-left" : "text-center mx-auto";
  return (
    <Reveal className={`max-w-2xl mb-12 ${alignCls}`}>
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-400 mb-3">
        <span className="w-6 h-px bg-accent-400/60" aria-hidden />
        {eyebrow}
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white leading-tight">{title}</h2>
      {text && <p className="text-white/60 mt-4 leading-relaxed">{text}</p>}
    </Reveal>
  );
}
