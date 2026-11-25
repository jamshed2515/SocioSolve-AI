import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import {
  TAGLINE, EXAMPLE_PROBLEMS, HOW_IT_WORKS, AUDIENCES, MODULES,
} from "../../data/siteContent";

function SectionHeader({ eyebrow, title, text }) {
  return (
    <div className="max-w-2xl mx-auto text-center mb-12">
      <p className="text-xs font-semibold uppercase tracking-widest text-accent-400 mb-3">{eyebrow}</p>
      <h2 className="text-3xl sm:text-4xl font-bold text-white">{title}</h2>
      {text && <p className="text-white/60 mt-4 leading-relaxed">{text}</p>}
    </div>
  );
}

export default function Landing() {
  return (
    <PublicLayout>
      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-gradient">
        <div className="absolute -top-40 -left-40 w-[28rem] h-[28rem] rounded-full bg-primary-500/20 blur-3xl" aria-hidden />
        <div className="absolute -bottom-40 -right-40 w-[28rem] h-[28rem] rounded-full bg-accent-500/10 blur-3xl" aria-hidden />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <span className="badge bg-primary-500/15 border border-primary-500/30 text-primary-200 gap-1.5 mb-6">
            <Sparkles size={13} /> Citizens · Students · Universities · Industry
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight max-w-4xl mx-auto">
            Real-world problems.{" "}
            <span className="text-gradient">Solved together.</span>
          </h1>
          <p className="text-white/65 text-lg mt-6 max-w-2xl mx-auto leading-relaxed">{TAGLINE}</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="btn-primary">
              Report a challenge <ArrowRight size={18} />
            </Link>
            <Link to="/about" className="btn-ghost">How it works</Link>
          </div>
        </div>
      </section>

      {/* ── The problem ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <SectionHeader
          eyebrow="The problem"
          title="Challenges are everywhere. Solutions are scattered."
          text="Today these problems are reported in many different places, and students or companies rarely know which ones need innovative solutions. SocioSolve-AI brings them into one place."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {EXAMPLE_PROBLEMS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="stat-card">
              <Icon size={22} className="text-primary-300" />
              <h3 className="font-semibold text-white">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────── */}
      <section className="border-y border-white/10 bg-dark-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeader
            eyebrow="How it works"
            title="From a reported problem to a working solution"
          />
          <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="glass p-6 relative">
                <span className="absolute top-5 right-5 text-4xl font-extrabold text-white/5">0{i + 1}</span>
                <span className="w-11 h-11 rounded-xl bg-accent-500/15 border border-accent-500/30 flex items-center justify-center mb-4">
                  <Icon size={20} className="text-accent-400" />
                </span>
                <h3 className="font-semibold text-white mb-2">{title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Who it's for ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <SectionHeader eyebrow="Who it's for" title="One platform, every role" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {AUDIENCES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="glass p-6">
              <Icon size={24} className="text-primary-300 mb-3" />
              <h3 className="font-semibold text-white mb-1.5">{title}</h3>
              <p className="text-sm text-white/55 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────── */}
      <section className="border-t border-white/10 bg-dark-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <SectionHeader
            eyebrow="Platform"
            title="Everything a solution needs"
            text="Six connected modules take a challenge from submission to an evaluated, tracked solution."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {MODULES.map(({ icon: Icon, name, points }) => (
              <div key={name} className="glass p-6 hover:border-primary-500/40 transition-colors">
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                    <Icon size={19} className="text-primary-300" />
                  </span>
                  <h3 className="font-semibold text-white leading-snug">{name}</h3>
                </div>
                <ul className="space-y-2">
                  {points.map((p) => (
                    <li key={p} className="text-sm text-white/60 flex gap-2">
                      <span className="text-accent-400 mt-0.5">•</span>{p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="glass glow p-8 sm:p-12 text-center bg-gradient-to-br from-primary-500/15 to-accent-500/5">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">Have a problem worth solving?</h2>
          <p className="text-white/65 mt-4 max-w-xl mx-auto">
            Join as a citizen, student, university or industry partner and help turn local challenges into real solutions.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/register" className="btn-primary">Create a free account <ArrowRight size={18} /></Link>
            <Link to="/contact" className="btn-ghost">Contact us</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
