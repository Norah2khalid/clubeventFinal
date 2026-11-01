import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) {
          el.classList.add("is-visible");
          io.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={cn("reveal", className)} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}

export function SectionHeading({ eyebrow, title, light }: { eyebrow?: string; title: string; light?: boolean }) {
  return (
    <div className="mx-auto mb-14 max-w-3xl text-center">
      {eyebrow && (
        <span
          className={cn(
            "mb-4 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold",
            light ? "bg-navy-foreground/10 text-glow" : "bg-secondary text-primary",
          )}
        >
          <span className={cn("h-1.5 w-1.5 rounded-full", light ? "bg-glow" : "bg-primary")} aria-hidden />
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "text-3xl font-extrabold leading-[1.4] sm:text-4xl md:text-5xl",
          light ? "text-navy-foreground" : "text-foreground",
        )}
      >
        <span className={light ? "title-wash" : "title-wash-ink"}>{title}</span>
      </h2>
      <div className="mx-auto mt-6 flex items-center justify-center gap-2" aria-hidden>
        <span className={cn("h-px w-10", light ? "bg-glow/70" : "bg-primary/55")} />
        <span className={cn("h-1.5 w-1.5 rounded-full", light ? "bg-glow" : "bg-primary")} />
        <span className={cn("h-px w-10", light ? "bg-glow/70" : "bg-primary/55")} />
      </div>
    </div>
  );
}
