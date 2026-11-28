/**
 * Public-site content, taken from the "Capstone Details" project brief.
 * Kept in one place so the Landing, About and Contact pages stay consistent.
 */
import {
  Recycle, Droplets, Car, HeartPulse, Waves,
  Send, Search, Handshake, Rocket,
  ShieldCheck, FileText, Users, ClipboardCheck, Brain, ChartColumn,
  Landmark, GraduationCap, Building2, Factory,
} from "lucide-react";

export const TAGLINE =
  "A digital platform to crowdsource societal challenges and facilitate collaborative problem solving through universities and industry partnerships.";

/** Where the Contact form sends messages. Set VITE_CONTACT_EMAIL on Vercel / in frontend/.env. */
export const CONTACT_EMAIL = import.meta.env.VITE_CONTACT_EMAIL || "";

export const EXAMPLE_PROBLEMS = [
  { icon: Recycle,    title: "Waste management",      text: "Poor garbage collection and recycling in growing cities." },
  { icon: Droplets,   title: "Water shortages",       text: "Villages without reliable access to clean water." },
  { icon: Car,        title: "Traffic congestion",    text: "Gridlock near colleges and busy campus roads." },
  { icon: HeartPulse, title: "Affordable healthcare", text: "Communities lacking accessible medical facilities." },
  { icon: Waves,      title: "River pollution",       text: "Local rivers damaged by waste and runoff." },
];

export const HOW_IT_WORKS = [
  {
    icon: Send,
    title: "Submit a challenge",
    text: "Citizens, NGOs, government bodies and organizations describe a problem, its location, its impact, and add photos or documents.",
  },
  {
    icon: Search,
    title: "Discover & evaluate",
    text: "Students and universities browse submitted problems, vote on the important ones, comment, and propose potential solutions.",
  },
  {
    icon: Handshake,
    title: "Collaborate with industry",
    text: "Companies provide mentors, technical expertise, datasets, funding or project opportunities. Teams can request support.",
  },
  {
    icon: Rocket,
    title: "Develop & track solutions",
    text: "Teams submit proposals, track milestones, upload prototypes and share results while administrators review progress.",
  },
];

export const AUDIENCES = [
  {
    icon: Landmark, title: "Citizens & NGOs", tone: "accent",
    text: "Report real problems in your community and follow them until they are solved.",
    can: ["Submit challenges with photos & location", "Track progress on your reports"],
  },
  {
    icon: GraduationCap, title: "Students", tone: "primary",
    text: "Find meaningful challenges that match your skills, form teams and build solutions.",
    can: ["Vote, comment and join teams", "Submit solution proposals"],
  },
  {
    icon: Building2, title: "Universities", tone: "accent",
    text: "Guide student teams and turn coursework into real-world societal impact.",
    can: ["Mentor multidisciplinary teams", "Review and score proposals"],
  },
  {
    icon: Factory, title: "Industry partners", tone: "primary",
    text: "Offer mentorship, datasets and funding, and discover talent and ideas early.",
    can: ["Offer mentors, data and funding", "Sponsor project opportunities"],
  },
];

/** Facts about the platform itself (no invented usage numbers). */
export const FACTS = [
  { value: "5", label: "user roles" },
  { value: "6", label: "integrated modules" },
  { value: "4", label: "steps from problem to solution" },
  { value: "1", label: "shared platform" },
];

export const FAQS = [
  {
    q: "Who can submit a challenge?",
    a: "Citizens, NGOs, government bodies and organizations can describe a problem, its location and its impact, and attach supporting photos or documents.",
  },
  {
    q: "What happens after a challenge is submitted?",
    a: "Students and universities browse it, vote on the important ones and comment. Teams then form around a challenge and submit solution proposals.",
  },
  {
    q: "How are solution proposals evaluated?",
    a: "Reviewers score each proposal with a structured rubric and leave feedback. Every proposal shows its status: submitted, under review, accepted or rejected.",
  },
  {
    q: "How does the AI help?",
    a: "It flags duplicate or similar challenges, recommends challenges that fit a student's skills and interests, and matches teams with suitable industry mentors, with an explanation for each match.",
  },
  {
    q: "How can a company get involved?",
    a: "Industry partners can offer mentors, technical expertise, datasets, funding or project opportunities, and teams can request their support directly.",
  },
];

export const MODULES = [
  {
    icon: ShieldCheck,
    name: "Authentication & User Management",
    points: ["Registration, login and password reset", "Role-based access for every user type", "Profiles with skills, interests and organizations"],
  },
  {
    icon: FileText,
    name: "Societal Challenge Management",
    points: ["Submit challenges with location and attachments", "Categories like healthcare, education, environment", "Search, filter, sort and view details"],
  },
  {
    icon: Users,
    name: "Team Formation & Collaboration",
    points: ["Create teams and invite members", "Discussions, comments and notifications", "Roles, tasks, meetings and milestones"],
  },
  {
    icon: ClipboardCheck,
    name: "Solution Proposals & Evaluation",
    points: ["Submit solutions against published challenges", "Prototype links, documents and plans", "Rubric reviews, feedback and approval"],
  },
  {
    icon: Brain,
    name: "AI-Powered Recommendations",
    points: ["Detect duplicate or similar challenges", "Recommend challenges from your skills", "Match teams with the right mentors"],
  },
  {
    icon: ChartColumn,
    name: "Industry Partnerships & Analytics",
    points: ["University and industry organization profiles", "Mentorship, resources and opportunities", "Admin dashboards and impact analytics"],
  },
];

export const PROPOSAL_STAGES = ["Submitted", "Under review", "Accepted or rejected"];
