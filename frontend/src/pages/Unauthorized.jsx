import { Link } from "react-router-dom";
import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Unauthorized() {
  const { user } = useAuth();
  const homePath = user?.role ? `/dashboard/${user.role}` : "/login";

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-6">
      <div className="glass max-w-md w-full p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
          <ShieldAlert className="text-red-400" size={32} />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Access Restricted</h1>
        <p className="text-white/60 text-sm mb-6">
          Your account role does not have permission to access this resource.
        </p>
        <Link to={homePath} className="btn-primary w-full">
          <ArrowLeft size={16} /> Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
