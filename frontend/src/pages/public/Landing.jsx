import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Plus, Check, CirclePlus } from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import Reveal, { SectionHeader } from "../../components/public/Reveal";
import HeroPreview from "../../components/public/HeroPreview";
import {
  TAGLINE, EXAMPLE_PROBLEMS, HOW_IT_WORKS, AUDIENCES, MODULES, FACTS, FAQS,
} from "../../data/siteContent";

const TONE = {
  primary: { icon: "text-primary-300", box: "bg-primary-500/15 border-primary-500/30", dot: "text-primary-300" },
  accent:  { icon: "text-accent-400",  box: "bg-accent-500/15 border-accent-500/30",   dot: "text-accent-400" },
};

export default function Landing() {
  return (
    <PublicLayout>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-gradient">
        <div className="absolute inset-0 bg-grid" aria-hidden />
        <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-primary-500/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-accent-500/10 blur-3xl" aria-hidden />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-20 sm:pt-24 sm:pb-28 grid lg:grid-cols-2 gap-16 lg:gap-12 items-center">
          <div className="text-center lg:text-left animate-slide-up">
            <span className="badge bg-primary-500/15 border border-primary-500/30 text-primary-200 gap-1.5 mb-6">
              <Sparkles size={13} /> AI-powered collaborative problem solving
            </span>
            <h1 className="text-4xl sm:text-5xl xl:text-6xl font-extrabold text-white leading-[1.08] tracking-tight">
              Real-world problems.
              <br />
              <span className="text-gradient">Solved together.</span>
            </h1>
            <p className="text-white/65 text-lg mt-6 max-w-xl mx-auto lg:mx-0 leading-relaxed">{TAGLINE}</p>

            <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to="/register" className="btn-primary group">
                Report a challenge
                <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a href="#how-it-works" className="btn-ghost">See how it works</a>
            </div>

            <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-2 justify-center lg:justify-start text-sm text-white/55">
              {["Citizens & NGOs", "Students", "Universities", "Industry"].map((r) => (
                <li key={r} className="flex items-center gap-1.5">
                  <Check size={14} className="text-accent-400" /> {r}
                </li>
              ))}
            </ul>
          </div>

          <div className="animate-fade-in px-2 sm:px-8 lg:px-4">
            <HeroPreview />
          </div>
        </div>
      </section>

      {/* ── Facts strip ──────────────────────────────────── */}
      <section className="border-y border-white/10 bg-dark-800/70">
        <dl className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-2 md:grid-cols-4 gap-6">
          {FACTS.map((f, i) => (
            <Reveal key={f.label} delay={i * 80} className="text-center">
              <dt className="sr-only">{f.label}</dt>
              <dd className="text-3xl sm:text-4xl font-extrabold text-gradient">{f.value}</dd>
              <dd className="text-sm text-white/55 mt-1">{f.label}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      {/* ── The problem ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <SectionHeader
          eyebrow="The problem"
          title="Challenges are everywhere. Solutions are scattered."
          text="These problems get reported in many different places, and students or companies rarely know which ones need innovative solutions. SocioSolve-AI brings them into one place."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {EXAMPLE_PROBLEMS.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 70} className="glass card-hover p-6 group">
              <span className="w-11 h-11 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center mb-4 transition-colors group-hover:bg-primary-500/25">
                <Icon size={20} className="text-primary-300" />
              </span>
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed mt-1.5">{text}</p>
            </Reveal>
          ))}
          <Reveal delay={350}>
            <Link
              to="/register"
              className="h-full min-h-[10rem] rounded-2xl border border-dashed border-white/20 hover:border-accent-400/60 p-6 flex flex-col items-center justify-center text-center gap-2 transition-colors group"
            >
              <CirclePlus size={26} className="text-accent-400 transition-transform group-hover:scale-110" />
              <span className="font-semibold text-white">Something else in your area?</span>
              <span className="text-sm text-white/50">Submit it as a new challenge</span>
            </Link>
          </Reveal>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section id="how-it-works" className="scroll-mt-16 relative border-y border-white/10 bg-dark-800/60 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[40rem] h-64 bg-primary-500/10 blur-3xl" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <SectionHeader eyebrow="How it works" title="From a reported problem to a working solution" />
          <ol className="relative grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <span className="hidden lg:block absolute top-6 left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-primary-500/0 via-primary-500/50 to-accent-500/0" aria-hidden />
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 110} className="relative text-center lg:px-2">
                <span className="relative z-10 mx-auto w-12 h-12 rounded-2xl bg-dark-700 border border-primary-500/40 flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <Icon size={20} className="text-primary-300" />
                </span>
                <p className="mt-5 text-xs font-semibold tracking-widest text-accent-400">STEP {i + 1}</p>
                <h3 className="font-semibold text-white text-lg mt-1">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed mt-2 max-w-xs mx-auto">{text}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <SectionHeader eyebrow="Who it's for" title="One platform, every role" text="Each role gets its own dashboard and tools." />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AUDIENCES.map(({ icon: Icon, title, text, can, tone }, i) => {
            const t = TONE[tone];
            return (
              <Reveal key={title} delay={i * 80} className="glass card-hover p-6 flex flex-col">
                <span className={`w-11 h-11 rounded-xl border flex items-center justify-center mb-4 ${t.box}`}>
                  <Icon size={21} className={t.icon} />
                </span>
                <h3 className="font-semibold text-white text-lg">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed mt-1.5">{text}</p>
                <ul className="mt-5 pt-4 border-t border-white/10 space-y-2 text-sm text-white/70">
                  {can.map((c) => (
                    <li key={c} className="flex gap-2">
                      <Check size={15} className={`mt-0.5 shrink-0 ${t.dot}`} /> {c}
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* ── Platform modules ─────────────────────────────── */}
      <section className="border-y border-white/10 bg-dark-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <SectionHeader
            eyebrow="Platform"
            title="Everything a solution needs"
            text="Six connected modules take a challenge from submission to an evaluated, tracked solution."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map(({ icon: Icon, name, points }, i) => (
              <Reveal key={name} delay={(i % 3) * 90} className="glass card-hover p-6 group">
                <div className="flex items-start justify-between mb-5">
                  <span className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary-500/30 to-accent-500/20 border border-white/10 flex items-center justify-center">
                    <Icon size={20} className="text-white" />
                  </span>
                  <span className="text-xs font-mono text-white/30 group-hover:text-primary-300 transition-colors">
                    0{i + 1}
                  </span>
                </div>
                <h3 className="font-semibold text-white leading-snug">{name}</h3>
                <ul className="mt-3 space-y-2">
                  {points.map((p) => (
                    <li key={p} className="text-sm text-white/60 flex gap-2">
                      <span className="mt-2 w-1 h-1 rounded-full bg-accent-400 shrink-0" />{p}
                    </li>
                  ))}
                </ul>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 grid lg:grid-cols-5 gap-10">
        <div className="lg:col-span-2">
          <SectionHeader
            align="left"
            eyebrow="FAQ"
            title="Questions, answered"
            text="Still curious? We're happy to help."
          />
          <Reveal className="-mt-6">
            <Link to="/contact" className="btn-ghost">Contact us</Link>
          </Reveal>
        </div>
        <div className="lg:col-span-3 space-y-3">
          {FAQS.map(({ q, a }, i) => (
            <Reveal key={q} delay={i * 60}>
              <details className="faq glass group open:border-primary-500/40 transition-colors">
                <summary className="cursor-pointer p-5 flex items-center justify-between gap-4 font-medium text-white">
                  {q}
                  <span className="faq-icon w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 transition-transform duration-200">
                    <Plus size={15} className="text-white/70" />
                  </span>
                </summary>
                <p className="px-5 pb-5 -mt-1 text-sm text-white/60 leading-relaxed">{a}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <Reveal className="relative overflow-hidden rounded-3xl border border-white/10 p-8 sm:p-14 text-center bg-gradient-to-br from-primary-600/40 via-dark-700 to-accent-600/25">
          <div className="absolute inset-0 bg-grid opacity-60" aria-hidden />
          <div className="relative">
            <h2 className="text-3xl sm:text-4xl font-bold text-white">Have a problem worth solving?</h2>
            <p className="text-white/70 mt-4 max-w-xl mx-auto">
              Join as a citizen, student, university or industry partner and help turn local challenges into real solutions.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register" className="btn-primary">Create your account <ArrowRight size={18} /></Link>
              <Link to="/about" className="btn-ghost bg-dark-900/30">Learn more about us</Link>
            </div>
          </div>
        </Reveal>
      </section>
    </PublicLayout>
  );
}
