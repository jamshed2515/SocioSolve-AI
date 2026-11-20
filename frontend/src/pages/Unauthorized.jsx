import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-hero-gradient flex items-center justify-center p-4">
      <div className="glass p-8 max-w-md w-full text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center mx-auto mb-4">
          <ShieldAlert className="text-red-400" size={28} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
        <p className="text-sm text-white/50 mb-6">
          You do not have permission to view this page with your current role.
        </p>
        <Link to="/login" className="btn-primary text-sm">
          <ArrowLeft size={16} /> Back to Sign In
        </Link>
      </div>
    </div>
  );
}

