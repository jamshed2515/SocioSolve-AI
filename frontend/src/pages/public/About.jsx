import { Link } from "react-router-dom";
import { ArrowRight, Target, Eye, Lightbulb, Check } from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import Reveal, { SectionHeader } from "../../components/public/Reveal";
import { TAGLINE, HOW_IT_WORKS, MODULES, PROPOSAL_STAGES, FACTS } from "../../data/siteContent";

const PILLARS = [
  {
    icon: Target,
    title: "Our mission",
    text: "Give every societal challenge one common home where it can be submitted, discussed, assigned to a team and tracked until a solution is delivered.",
  },
  {
    icon: Eye,
    title: "Our vision",
    text: "Communities, universities and industry working as one network, so good ideas reach the people who need them faster.",
  },
  {
    icon: Lightbulb,
    title: "Our approach",
    text: "Crowdsource the problems, let students and universities build the solutions, and bring in industry for mentorship, data and funding.",
  },
];

export default function About() {
  return (
    <PublicLayout>
      {/* ── Intro ────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-gradient border-b border-white/10">
        <div className="absolute inset-0 bg-grid" aria-hidden />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-72 rounded-full bg-primary-500/20 blur-3xl" aria-hidden />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center animate-slide-up">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-400 mb-4">
            <span className="w-6 h-px bg-accent-400/60" aria-hidden /> About SocioSolve-AI
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight">
            Where people report problems and <span className="text-gradient">teams solve them</span>
          </h1>
          <p className="text-white/65 text-lg mt-6 leading-relaxed max-w-2xl mx-auto">{TAGLINE}</p>
        </div>
      </section>

      {/* ── In simple words + facts ──────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 grid lg:grid-cols-2 gap-10 items-center">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-400 mb-3">In simple words</p>
          <p className="text-2xl sm:text-3xl font-semibold text-white leading-snug">
            A website where people report real-world problems, and students, universities, experts and companies
            work together to find and implement solutions.
          </p>
        </Reveal>
        <div className="grid grid-cols-2 gap-4">
          {FACTS.map((f, i) => (
            <Reveal key={f.label} delay={i * 80} className="glass p-6">
              <p className="text-4xl font-extrabold text-gradient">{f.value}</p>
              <p className="text-sm text-white/55 mt-1">{f.label}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── Mission / vision / approach ──────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PILLARS.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 100} className="glass card-hover p-7">
              <span className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500/30 to-accent-500/20 border border-white/10 flex items-center justify-center mb-5">
                <Icon size={21} className="text-white" />
              </span>
              <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
              <p className="text-sm text-white/60 leading-relaxed">{text}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ── The journey ──────────────────────────────────── */}
      <section className="border-y border-white/10 bg-dark-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <SectionHeader eyebrow="The journey" title="How a challenge becomes a solution" />
          <ol className="relative ml-5">
            <span className="absolute left-0 top-2 bottom-2 w-px bg-gradient-to-b from-primary-500/60 via-primary-500/30 to-accent-500/60" aria-hidden />
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
              <Reveal as="li" key={title} delay={i * 100} className="relative pl-10 pb-10 last:pb-0">
                <span className="absolute -left-5 top-0 w-10 h-10 rounded-xl bg-dark-700 border border-primary-500/40 flex items-center justify-center shadow-lg shadow-primary-500/20">
                  <Icon size={17} className="text-primary-300" />
                </span>
                <div className="glass p-5 sm:p-6">
                  <p className="text-xs font-semibold text-accent-400 tracking-widest">STEP {i + 1}</p>
                  <h3 className="text-lg font-semibold text-white mt-1">{title}</h3>
                  <p className="text-white/60 mt-1.5 leading-relaxed text-sm sm:text-base">{text}</p>
                </div>
              </Reveal>
            ))}
          </ol>

          <Reveal className="mt-12 glass p-5 sm:p-6">
            <p className="text-sm font-semibold text-white mb-4">Every proposal shows where it stands</p>
            <ol className="flex flex-col sm:flex-row sm:items-center gap-3">
              {PROPOSAL_STAGES.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className="badge bg-primary-500/15 border border-primary-500/30 text-primary-200 gap-1.5">
                    <Check size={12} /> {s}
                  </span>
                  {i < PROPOSAL_STAGES.length - 1 && <ArrowRight size={15} className="hidden sm:block text-white/30" />}
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      {/* ── What we're building ──────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <SectionHeader
          eyebrow="The team"
          title="What the platform is made of"
          text="Built as a capstone project by a team of six, with one module each."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(({ icon: Icon, name }, i) => (
            <Reveal key={name} delay={(i % 3) * 80} className="glass card-hover p-5 flex items-center gap-4">
              <span className="w-11 h-11 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                <Icon size={19} className="text-primary-300" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Module {i + 1}</p>
                <p className="font-semibold text-white leading-snug">{name}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="text-center mt-14">
          <Link to="/register" className="btn-primary">Join the platform <ArrowRight size={18} /></Link>
        </Reveal>
      </section>
    </PublicLayout>
  );
}
