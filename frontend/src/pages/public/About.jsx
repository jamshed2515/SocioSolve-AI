import { Link } from "react-router-dom";
import { ArrowRight, Target, Eye, Lightbulb } from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import { TAGLINE, HOW_IT_WORKS, MODULES, PROPOSAL_STAGES } from "../../data/siteContent";

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
      <section className="bg-hero-gradient border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-accent-400 mb-3">About SocioSolve-AI</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
            Where people report problems and <span className="text-gradient">teams solve them</span>
          </h1>
          <p className="text-white/65 text-lg mt-6 leading-relaxed">{TAGLINE}</p>
          <p className="text-white/50 mt-4 leading-relaxed">
            In simple words: a website where people report real-world problems, and students, universities,
            experts and companies work together to find and implement solutions.
          </p>
        </div>
      </section>

      {/* ── Mission / vision / approach ──────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PILLARS.map(({ icon: Icon, title, text }) => (
            <div key={title} className="glass p-7">
              <span className="w-11 h-11 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center mb-4">
                <Icon size={20} className="text-primary-300" />
              </span>
              <h2 className="text-lg font-semibold text-white mb-2">{title}</h2>
              <p className="text-sm text-white/60 leading-relaxed">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The journey ──────────────────────────────────── */}
      <section className="border-y border-white/10 bg-dark-800/60">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">The journey of a challenge</h2>
          <ol className="relative border-l border-white/15 ml-4 space-y-10">
            {HOW_IT_WORKS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="pl-8 relative">
                <span className="absolute -left-[1.15rem] top-0 w-9 h-9 rounded-full bg-dark-700 border border-accent-500/40 flex items-center justify-center">
                  <Icon size={16} className="text-accent-400" />
                </span>
                <p className="text-xs font-semibold text-accent-400 uppercase tracking-wider">Step {i + 1}</p>
                <h3 className="text-lg font-semibold text-white mt-1">{title}</h3>
                <p className="text-white/60 mt-1.5 leading-relaxed">{text}</p>
              </li>
            ))}
          </ol>
          <div className="glass p-5 mt-12 text-sm text-white/65">
            <span className="font-semibold text-white">Proposal status is always visible: </span>
            {PROPOSAL_STAGES.join(" → ")}.
          </div>
        </div>
      </section>

      {/* ── What we're building ──────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white">What the platform is made of</h2>
          <p className="text-white/60 mt-3">Built as a capstone project by a team of six, one module each.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map(({ icon: Icon, name }, i) => (
            <div key={name} className="glass p-5 flex items-center gap-4">
              <span className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-primary-300" />
              </span>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-white/40">Module {i + 1}</p>
                <p className="font-semibold text-white leading-snug">{name}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="text-center mt-12">
          <Link to="/register" className="btn-primary">Join the platform <ArrowRight size={18} /></Link>
        </div>
      </section>
    </PublicLayout>
  );
}
