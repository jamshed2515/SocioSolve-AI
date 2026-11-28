import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X, Zap } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const NAV = [
  { to: "/",        label: "Home" },
  { to: "/about",   label: "About" },
  { to: "/contact", label: "Contact" },
];

const YEAR = new Date().getFullYear();

function navClass({ isActive }) {
  return `text-sm font-medium transition-colors ${
    isActive ? "text-white" : "text-white/60 hover:text-white"
  }`;
}

/** Shared header + footer for the public marketing pages (Landing, About, Contact). */
export default function PublicLayout({ children }) {
  const { user, ROLE_DASHBOARD } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Start each page at the top. The mobile menu closes via its links' onClick.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const dashboardPath = user ? ROLE_DASHBOARD?.[user.role] || "/profile" : null;

  return (
    <div className="min-h-screen flex flex-col bg-dark-900">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-dark-900/80 backdrop-blur-md">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="w-9 h-9 rounded-xl bg-primary-500/20 border border-primary-500/40 flex items-center justify-center">
              <Zap size={18} className="text-primary-300" />
            </span>
            <span className="font-bold text-lg text-gradient">SocioSolve-AI</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end className={navClass}>{n.label}</NavLink>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-3">
            {dashboardPath ? (
              <Link to={dashboardPath} className="btn-primary px-5 py-2.5 text-sm">Go to dashboard</Link>
            ) : (
              <>
                <Link to="/login" className="text-sm font-medium text-white/70 hover:text-white px-3">Sign in</Link>
                <Link to="/register" className="btn-primary px-5 py-2.5 text-sm">Get started</Link>
              </>
            )}
          </div>

          <button
            type="button"
            className="md:hidden p-2 -mr-2 text-white/80"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </nav>

        {open && (
          <div
            className="md:hidden border-t border-white/10 px-4 py-4 space-y-1 bg-dark-900"
            onClick={(e) => { if (e.target.closest("a")) setOpen(false); }}
          >
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end
                className={({ isActive }) =>
                  `block px-3 py-2.5 rounded-xl text-sm font-medium ${
                    isActive ? "bg-white/10 text-white" : "text-white/70"
                  }`
                }
              >
                {n.label}
              </NavLink>
            ))}
            <div className="pt-3 flex gap-3">
              {dashboardPath ? (
                <Link to={dashboardPath} className="btn-primary flex-1 py-2.5 text-sm">Go to dashboard</Link>
              ) : (
                <>
                  <Link to="/login" className="btn-ghost flex-1 py-2.5 text-sm">Sign in</Link>
                  <Link to="/register" className="btn-primary flex-1 py-2.5 text-sm">Get started</Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col md:flex-row gap-6 md:items-center md:justify-between">
          <div>
            <p className="font-bold text-gradient">SocioSolve-AI</p>
            <p className="text-sm text-white/50 mt-1">Crowdsourcing societal challenges. Solving them together.</p>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/60">
            {NAV.map((n) => (
              <Link key={n.to} to={n.to} className="hover:text-white">{n.label}</Link>
            ))}
            <Link to="/login" className="hover:text-white">Sign in</Link>
            <Link to="/register" className="hover:text-white">Register</Link>
          </div>
        </div>
        <p className="text-center text-xs text-white/40 pb-8">
          © {YEAR} SocioSolve-AI · Capstone project
        </p>
      </footer>
    </div>
  );
}
