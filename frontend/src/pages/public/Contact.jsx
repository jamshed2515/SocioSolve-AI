import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Mail, Send, MessageSquare, Handshake, GraduationCap } from "lucide-react";
import PublicLayout from "../../components/layouts/PublicLayout";
import Reveal from "../../components/public/Reveal";
import { CONTACT_EMAIL } from "../../data/siteContent";

const TOPICS = [
  "General question",
  "Report a societal challenge",
  "University partnership",
  "Industry partnership / mentorship",
  "Technical support",
];

const schema = z.object({
  name:    z.string().trim().min(2, "Enter your name"),
  email:   z.string().trim().email("Enter a valid email"),
  topic:   z.string().min(1, "Choose a topic"),
  message: z.string().trim().min(10, "Message should be at least 10 characters"),
});

const REASONS = [
  { icon: MessageSquare, title: "Have a question?",        text: "Ask us anything about how the platform works." },
  { icon: GraduationCap, title: "Universities",            text: "Bring your students and faculty onto real challenges." },
  { icon: Handshake,     title: "Industry partners",       text: "Offer mentorship, datasets, funding or projects." },
];

export default function Contact() {
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { topic: "" },
  });

  const onSubmit = (data) => {
    if (!CONTACT_EMAIL) {
      toast.error("The contact email isn't set up yet. Please try again later.");
      return;
    }
    const subject = `[SocioSolve-AI] ${data.topic} – ${data.name}`;
    const body = `${data.message}\n\n—\nFrom: ${data.name}\nReply to: ${data.email}`;
    window.location.assign(
      `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
    );
    toast.success("Opening your email app to send the message…");
    reset();
  };

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-hero-gradient border-b border-white/10">
        <div className="absolute inset-0 bg-grid" aria-hidden />
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[36rem] h-72 rounded-full bg-primary-500/20 blur-3xl" aria-hidden />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-24 text-center animate-slide-up">
          <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-accent-400 mb-4">
            <span className="w-6 h-px bg-accent-400/60" aria-hidden /> Contact
          </p>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.08] tracking-tight">
            Let&apos;s solve something <span className="text-gradient">together</span>
          </h1>
          <p className="text-white/65 mt-5 leading-relaxed">
            Questions, partnership ideas or a challenge you want to share. Send us a message.
          </p>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 grid grid-cols-1 lg:grid-cols-5 gap-8">
        {/* ── Info column ────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {REASONS.map(({ icon: Icon, title, text }, i) => (
            <Reveal key={title} delay={i * 80} className="glass card-hover p-5 flex gap-4">
              <span className="w-10 h-10 rounded-xl bg-primary-500/15 border border-primary-500/30 flex items-center justify-center shrink-0">
                <Icon size={18} className="text-primary-300" />
              </span>
              <div>
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="text-sm text-white/55 mt-1">{text}</p>
              </div>
            </Reveal>
          ))}

          {CONTACT_EMAIL && (
            <a href={`mailto:${CONTACT_EMAIL}`} className="glass p-5 flex gap-4 hover:border-accent-500/40 transition-colors">
              <span className="w-10 h-10 rounded-xl bg-accent-500/15 border border-accent-500/30 flex items-center justify-center shrink-0">
                <Mail size={18} className="text-accent-400" />
              </span>
              <div className="min-w-0">
                <h2 className="font-semibold text-white">Email us directly</h2>
                <p className="text-sm text-accent-400 mt-1 break-all">{CONTACT_EMAIL}</p>
              </div>
            </a>
          )}

          <div className="glass p-5 text-sm text-white/60">
            Want to report a problem right away?{" "}
            <Link to="/register" className="text-primary-300 hover:text-primary-200 font-medium">Create an account</Link>{" "}
            and submit it as a challenge.
          </div>
        </div>

        {/* ── Form ───────────────────────────────────────── */}
        <Reveal as="form" onSubmit={handleSubmit(onSubmit)} noValidate className="lg:col-span-3 glass p-6 sm:p-8 space-y-5 shadow-2xl shadow-black/30 bg-dark-800/60">
          <div className="pb-2">
            <h2 className="text-xl font-semibold text-white">Send us a message</h2>
            <p className="text-sm text-white/50 mt-1">All fields are required.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="c-name" className="label">Your name</label>
              <input id="c-name" className="input" placeholder="Jane Doe" autoComplete="name" {...register("name")} />
              {errors.name && <p className="error-text">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="c-email" className="label">Email</label>
              <input id="c-email" type="email" className="input" placeholder="you@example.com" autoComplete="email" {...register("email")} />
              {errors.email && <p className="error-text">{errors.email.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="c-topic" className="label">Topic</label>
            <select id="c-topic" className="input" {...register("topic")}>
              <option value="" disabled>Choose a topic…</option>
              {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.topic && <p className="error-text">{errors.topic.message}</p>}
          </div>

          <div>
            <label htmlFor="c-message" className="label">Message</label>
            <textarea id="c-message" rows={6} className="input resize-y" placeholder="Tell us how we can help…" {...register("message")} />
            {errors.message && <p className="error-text">{errors.message.message}</p>}
          </div>

          <button type="submit" className="btn-primary w-full sm:w-auto">
            <Send size={17} /> Send message
          </button>
        </Reveal>
      </section>
    </PublicLayout>
  );
}
