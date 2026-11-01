import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  ArrowDown,
  BadgeCheck,
  Brain,
  Eye,
  Lightbulb,
  Megaphone,
  Menu,
  MousePointerClick,
  Radar,
  Rocket,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  Users,
  X as XIcon,
  Zap,
  Info,
  Scale,
} from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";
import { Logos } from "@/components/site/Logos";
import { Reveal, SectionHeading } from "@/components/site/Reveal";
import { IdeaHelper } from "@/components/site/IdeaHelper";
import { Button } from "@/components/ui/button";

import {
  CHALLENGE_ONE,
  CHALLENGE_TWO,
  EVENT_NAME,
  GOALS,
  HERO,
  HERO_KICKER,
  IMPACT,
  MECHANISM,
  NAV,
  TAGLINE,
  HELPERS,
  UI,
} from "@/lib/content";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ابتكار حلول رقمية لمواجهة التضليل الإعلامي" },
      {
        name: "description",
        content:
          "استكشف تحديات مواجهة التضليل الإعلامي وطوّر فكرتك الخاصة باستخدام مساعدات إرشادية مخصصة.",
      },
      { property: "og:title", content: "ابتكار حلول رقمية لمواجهة التضليل الإعلامي" },
      {
        property: "og:description",
        content:
          "فعالية ابتكار الحلول الرقمية لمواجهة التضليل الإعلامي — التحديات ومساعدات تطوير الأفكار.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const stepIcons = [MousePointerClick, Target, Lightbulb, Rocket, Send];
const problemIcons = [Eye, Activity, Megaphone, BadgeCheck];
const goalIcons = [ShieldCheck, Sparkles, Users, Zap, Lightbulb];
const impactIcons = [Search, TrendingDown, Brain, Info, Scale];

function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="border-b border-border/70 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <Logos />
      </div>
      <nav className="border-t border-border/60">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2">
          <div className="hidden items-center gap-2 md:flex">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="rounded-full px-4 py-1.5 text-sm font-medium text-muted-foreground transition-colors duration-300 hover:bg-secondary hover:text-primary"
              >
                {n.label}
              </a>
            ))}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label={UI.menu}
            onClick={() => setOpen(!open)}
          >
            {open ? <XIcon className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
        {open && (
          <div className="flex flex-col gap-1 border-t px-4 py-3 md:hidden">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="rounded-full px-3 py-2 text-sm font-medium transition-colors duration-300 hover:bg-secondary"
              >
                {n.label}
              </a>
            ))}
          </div>
        )}
      </nav>
    </header>
  );
}

function Hero() {
  return (
    <section
      id="top"
      className="relative isolate overflow-hidden bg-navy-deep text-navy-foreground"
    >
      <img
        src={heroBg}
        alt=""
        width={1920}
        height={1088}
        className="absolute inset-0 -z-20 h-full w-full object-cover opacity-80"
      />
      <div className="absolute inset-0 -z-10 grid-pattern opacity-40" />
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-navy-deep/30 via-navy-deep/50 to-navy-deep" />
      <div className="mx-auto flex min-h-[60vh] max-w-5xl flex-col items-center justify-center px-4 py-24 text-center">
        <p className="animate-fade-up mb-6 max-w-3xl rounded-full bg-navy-foreground/8 px-5 py-2 text-balance text-base font-semibold leading-relaxed text-glow sm:text-xl">
          {HERO_KICKER}
        </p>
        <h1
          className="animate-fade-up text-4xl font-black leading-[1.3] sm:text-5xl md:text-7xl"
          style={{ animationDelay: "120ms" }}
        >
          ابتكار حلول رقمية <br className="hidden sm:block" />
          <span className="text-gradient">لمواجهة التضليل الإعلامي</span>
        </h1>
        <p
          className="animate-fade-up mt-7 max-w-2xl text-lg leading-[1.95] text-navy-foreground/80 sm:text-xl"
          style={{ animationDelay: "240ms" }}
        >
          {HERO.description}
        </p>
        <div
          className="animate-fade-up mt-10 flex flex-col gap-4 sm:flex-row"
          style={{ animationDelay: "360ms" }}
        >
          <Button
            asChild
            size="lg"
            className="h-14 bg-gradient-brand px-8 text-base font-bold shadow-glow"
          >
            <a href="#challenges">
              {UI.explore} <ArrowDown className="h-5 w-5" />
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function Mechanism() {
  return (
    <section id="mechanism" className="scroll-mt-8 px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow={UI.mechanismEyebrow} title={MECHANISM.title} />
        </Reveal>
        <Reveal>
          <blockquote className="mx-auto mb-12 max-w-3xl rounded-3xl border border-primary/15 border-s-4 border-s-primary/80 bg-card p-5 text-base leading-[1.85] shadow-soft sm:p-7 sm:text-lg">
            «{MECHANISM.text}»
          </blockquote>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {MECHANISM.steps.map((s, i) => {
            const Icon = stepIcons[i] ?? Sparkles;
            return (
              <Reveal key={s} delay={i * 90}>
                <div className="group flex h-full flex-col rounded-3xl border border-border/80 bg-card p-4 shadow-soft transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow sm:p-5">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-display text-3xl font-black leading-none text-secondary">
                      {i + 1}
                    </span>
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground shadow-glow transition-transform group-hover:scale-110">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <p className="text-sm font-semibold leading-relaxed sm:text-base">{s}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

const challengeTitleHighlight = "title-wash";

function Challenges() {
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <section
      id="challenges"
      className="relative scroll-mt-8 overflow-hidden bg-gradient-navy px-4 py-24 text-navy-foreground"
    >
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="relative mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow={UI.challengesEyebrow} title={UI.challengesTitle} light />
        </Reveal>

        <Reveal>
          <div className="glass rounded-3xl p-4 sm:p-8">
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-navy-foreground text-navy-deep shadow-soft">
                <span className="font-display text-2xl font-black">𝕏</span>
              </div>
              <div>
                <span className="inline-flex rounded-full bg-glow/15 px-3 py-1 text-sm font-semibold text-glow">
                  {CHALLENGE_ONE.label}
                </span>
                <h3 className="mt-2 text-2xl font-extrabold leading-[1.45] sm:text-3xl">
                  <span className="title-wash">{CHALLENGE_ONE.title}</span>
                </h3>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {CHALLENGE_ONE.problems.map((p, i) => {
                const Icon = problemIcons[i] ?? Sparkles;
                const helper = HELPERS[i];
                return (
                  <div
                    key={p.title}
                    className="group rounded-3xl border border-navy-foreground/10 bg-navy-deep/45 p-4 shadow-soft transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-glow/35 hover:shadow-glow sm:p-5"
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="font-display text-sm font-semibold text-glow/80">
                        {UI.problem} {i + 1}
                      </span>
                      <Icon className="h-6 w-6 text-glow" />
                    </div>
                    <h4 className="mb-2 text-base font-extrabold leading-snug">
                      <span className={challengeTitleHighlight}>{p.title}</span>
                    </h4>
                    <p className="text-sm leading-relaxed text-navy-foreground/75 sm:text-base">{p.text}</p>
                    {helper && (
                      <IdeaHelper
                        helper={helper}
                        showTitle={false}
                        open={openId === helper.id}
                        onOpenChange={(next) => setOpenId(next ? helper.id : null)}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>

        <Reveal className="mt-6">
          <div className="relative overflow-hidden rounded-[1.9rem] bg-gradient-brand p-px shadow-soft">
            <div className="rounded-[1.85rem] bg-navy-deep p-4 sm:p-8">
              <div className="flex items-center justify-between gap-6">
                <div className="min-w-0">
                  <span className="inline-flex rounded-full bg-glow/15 px-3 py-1 text-sm font-semibold text-glow">
                    {CHALLENGE_TWO.label}
                  </span>
                  <h3 className="mt-3 text-2xl font-extrabold leading-[1.45] sm:text-3xl">
                    <span className="title-wash">{CHALLENGE_TWO.title}</span>
                  </h3>
                  <p className="mt-4 max-w-3xl text-lg leading-[1.9] text-navy-foreground/75">
                    {CHALLENGE_TWO.text}
                  </p>
                </div>
                <div className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-brand shadow-glow sm:h-24 sm:w-24">
                  <Radar className="h-10 w-10 text-primary-foreground" />
                </div>
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {CHALLENGE_TWO.cards.map((card) => {
                  const helper = HELPERS.find((item) => item.id === card.helperId);
                  if (!helper) return null;
                  return (
                    <article
                      key={card.helperId}
                      className="flex h-full flex-col rounded-[1.6rem] border border-glow/15 bg-navy/35 p-4 shadow-soft transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-glow/40 hover:shadow-glow sm:p-5"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-extrabold leading-snug">{card.number}</span>
                        <h4 className="text-lg font-extrabold leading-snug">
                          <span className={challengeTitleHighlight}>{card.name}</span>
                        </h4>
                      </div>
                      <p className="mt-3 text-base font-semibold leading-relaxed text-navy-foreground">{card.summary}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-navy-foreground/70 sm:text-base">{card.note}</p>
                      <IdeaHelper
                        helper={helper}
                        flush
                        showTitle={false}
                        showSummary={false}
                        showIntro={false}
                        open={openId === helper.id}
                        onOpenChange={(next) => setOpenId(next ? helper.id : null)}
                      />
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Goals() {
  return (
    <section id="goals" className="scroll-mt-8 px-4 py-24">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow={UI.goalsEyebrow} title={UI.goalsTitle} />
        </Reveal>
        <div className="flex flex-wrap justify-center gap-3">
          {GOALS.map((g, i) => {
            const Icon = goalIcons[i] ?? Sparkles;
            return (
              <Reveal
                key={g}
                delay={i * 80}
                className="w-full sm:w-[calc(50%-6px)] lg:w-[calc(33.333%-8px)]"
              >
                <div className="flex h-full items-start gap-3 rounded-3xl border border-border/80 bg-card p-4 shadow-soft transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-glow sm:p-5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="pt-1.5 text-sm font-semibold leading-relaxed text-foreground sm:text-base">{g}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Impact() {
  return (
    <section className="relative overflow-hidden bg-navy-deep px-4 py-24 text-navy-foreground">
      <div className="relative mx-auto max-w-5xl">
        <Reveal>
          <SectionHeading eyebrow={UI.impactEyebrow} title={IMPACT.title} light />
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {IMPACT.items.map((t, i) => {
            const Icon = impactIcons[i] ?? Sparkles;
            return (
              <Reveal key={t} delay={i * 80}>
                <div className="glass flex h-full flex-col items-center rounded-3xl p-4 text-center shadow-soft transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-glow sm:p-5">
                  <div
                    className="mb-3 flex h-12 w-12 animate-float items-center justify-center rounded-full bg-gradient-brand"
                    style={{ animationDelay: `${i * 400}ms` }}
                  >
                    <Icon className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <p className="text-sm font-semibold leading-relaxed text-navy-foreground/90 sm:text-base">{t}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gradient-navy px-4 pb-8 pt-16 text-navy-foreground">
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl bg-card p-5 shadow-soft">
          <Logos />
        </div>
        <div className="mt-10 grid gap-8 text-center md:grid-cols-2 md:text-right">
          <div>
            <h3 className="text-xl font-extrabold">{EVENT_NAME}</h3>
            <p className="mt-2 text-lg text-gradient font-bold">{TAGLINE}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-3 md:justify-end">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="text-navy-foreground/75 hover:text-glow">
                {n.label}
              </a>
            ))}
          </div>
        </div>
        <div className="mt-10 border-t border-navy-foreground/10 pt-6 text-center text-sm text-navy-foreground/60">
          © {new Date().getFullYear()} {EVENT_NAME}. {UI.rights}
        </div>
      </div>
    </footer>
  );
}

function Index() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <Mechanism />
        <Challenges />
        <Goals />
        <Impact />
      </main>
      <Footer />
    </div>
  );
}
