import { MapPin, ThumbsUp, MessageSquare, Check, Brain, Handshake, Waves } from "lucide-react";

const STAGES = [
  { label: "Submitted",            done: true },
  { label: "Team formed",          done: true },
  { label: "Proposal under review", current: true },
  { label: "Solution delivered" },
];

/** Illustrative product preview for the hero: an example challenge moving through the platform. */
export default function HeroPreview() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-label="Example of a challenge on SocioSolve-AI">
      <div className="absolute inset-0 -m-6 rounded-[2rem] bg-gradient-to-br from-primary-500/25 via-transparent to-accent-500/20 blur-2xl" aria-hidden />

      {/* Main challenge card */}
      <div className="relative glass p-5 sm:p-6 shadow-2xl shadow-black/40 bg-dark-800/80">
        <div className="flex items-center gap-3 mb-4">
          <span className="badge bg-accent-500/15 text-accent-400 border border-accent-500/30">Environment</span>
          <span className="text-[11px] uppercase tracking-wider text-white/40">Example challenge</span>
        </div>

        <div className="flex gap-3">
          <span className="w-11 h-11 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
            <Waves size={20} className="text-primary-300" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-white leading-snug">Pollution in the local river</h3>
            <p className="text-xs text-white/50 mt-1 flex items-center gap-1">
              <MapPin size={12} /> Reported by a citizens&apos; group
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 text-xs text-white/55">
          <span className="flex items-center gap-1.5"><ThumbsUp size={13} className="text-primary-300" /> Voted by students</span>
          <span className="flex items-center gap-1.5"><MessageSquare size={13} className="text-primary-300" /> Active discussion</span>
        </div>

        {/* Progress pipeline */}
        <ol className="mt-5 pt-5 border-t border-white/10 space-y-3">
          {STAGES.map((s) => (
            <li key={s.label} className="flex items-center gap-3 text-sm">
              <span
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 border ${
                  s.done
                    ? "bg-accent-500/20 border-accent-500/50"
                    : s.current
                      ? "bg-primary-500/25 border-primary-400"
                      : "border-white/15"
                }`}
              >
                {s.done && <Check size={13} className="text-accent-400" />}
                {s.current && <span className="w-2 h-2 rounded-full bg-primary-300 animate-pulse" />}
              </span>
              <span className={s.done ? "text-white/70" : s.current ? "text-white font-medium" : "text-white/35"}>
                {s.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Floating: AI recommendation */}
      <div className="hidden sm:flex float-slow absolute -left-8 -bottom-16 glass bg-dark-700/90 p-3.5 pr-5 gap-3 items-center shadow-xl shadow-black/40">
        <span className="w-9 h-9 rounded-lg bg-primary-500/20 flex items-center justify-center">
          <Brain size={17} className="text-primary-300" />
        </span>
        <div>
          <p className="text-xs font-semibold text-white">AI recommendation</p>
          <p className="text-[11px] text-white/50">Matches your skills in GIS &amp; data</p>
        </div>
      </div>

      {/* Floating: industry mentor */}
      <div className="hidden sm:flex float-slower absolute -right-4 -top-16 glass bg-dark-700/90 p-3.5 pr-5 gap-3 items-center shadow-xl shadow-black/40">
        <span className="w-9 h-9 rounded-lg bg-accent-500/20 flex items-center justify-center">
          <Handshake size={17} className="text-accent-400" />
        </span>
        <div>
          <p className="text-xs font-semibold text-white">Mentor joined</p>
          <p className="text-[11px] text-white/50">Industry partner shared a dataset</p>
        </div>
      </div>
    </div>
  );
}
