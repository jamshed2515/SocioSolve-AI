import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Compass,
  PlusCircle,
  RotateCcw,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Layers,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import ChallengeCard from "../../components/challenges/ChallengeCard";
import ChallengeFilterBar from "../../components/challenges/ChallengeFilterBar";
import challengeService from "../../services/challengeService";
import { useAuth } from "../../context/AuthContext";

export default function ChallengeExplorePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // State
  const [challenges, setChallenges] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(Number(searchParams.get("page")) || 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters state initialized from query params if available
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    category: searchParams.get("category") || "",
    location: searchParams.get("location") || "",
    difficulty: searchParams.get("difficulty") || "",
    sortBy: searchParams.get("sortBy") || "newest",
    status: searchParams.get("status") || "published",
  });

  const limit = 9;

  // Fetch challenges from backend
  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page,
        limit,
        sortBy: filters.sortBy || "newest",
      };

      if (filters.search && filters.search.trim()) {
        params.search = filters.search.trim();
      }
      if (filters.category && filters.category !== "All Categories") {
        params.category = filters.category;
      }
      if (filters.location && filters.location.trim()) {
        params.location = filters.location.trim();
      }
      if (filters.difficulty) {
        params.difficulty = filters.difficulty;
      }
      if (filters.status && filters.status !== "all") {
        params.status = filters.status;
      }

      const res = await challengeService.getChallenges(params);
      setChallenges(res.challenges || []);
      setTotal(res.total || 0);
      setTotalPages(res.pages || 1);
    } catch (err) {
      console.error("Failed to load challenges:", err);
      const msg = err.response?.data?.detail || "Failed to load societal challenges. Please check your connection.";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, [filters, page, limit]);

  useEffect(() => {
    fetchChallenges();
  }, [fetchChallenges]);

  // Sync state to URL params
  useEffect(() => {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (filters.search) params.set("search", filters.search);
    if (filters.category && filters.category !== "All Categories") params.set("category", filters.category);
    if (filters.location) params.set("location", filters.location);
    if (filters.difficulty) params.set("difficulty", filters.difficulty);
    if (filters.sortBy && filters.sortBy !== "newest") params.set("sortBy", filters.sortBy);
    setSearchParams(params, { replace: true });
  }, [filters, page, setSearchParams]);

  const handleFilterChange = (newFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset to page 1 on filter modification
  };

  const handleClearFilters = () => {
    setFilters({
      search: "",
      category: "",
      location: "",
      difficulty: "",
      sortBy: "newest",
      status: "published",
    });
    setPage(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setPage(newPage);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleDelete = async (challenge) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${challenge.title}"? This action cannot be undone.`
    );
    if (!confirmed) return;

    try {
      await challengeService.deleteChallenge(challenge.id);
      toast.success("Challenge deleted successfully");
      fetchChallenges();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete challenge";
      toast.error(msg);
    }
  };

  const isCurrentAuthor = (challenge) => {
    if (!user) return false;
    return (
      challenge.authorId === user.id ||
      challenge.authorId === user._id ||
      challenge.createdBy === user.firebase_uid
    );
  };

  const isAdmin = user?.role === "admin";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header Banner */}
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-primary-900/40 via-surface-card to-secondary-900/20 p-6 md:p-8 backdrop-blur-xl">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-primary-500/10 text-primary-300 border border-primary-500/20">
                <Compass size={14} className="text-primary-400" />
                <span>Explore Societal Challenges</span>
              </div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
                Community Challenges Catalog
              </h1>
              <p className="text-sm md:text-base text-slate-300 leading-relaxed">
                Discover real-world civic, environmental, and healthcare problems submitted by
                citizens. Form collaborative teams and submit impactful technology proposals.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/my-challenges"
                className="btn-ghost inline-flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl border border-white/10 hover:bg-white/5 transition-all text-slate-200"
              >
                <Layers size={16} className="text-slate-400" />
                <span>My Challenges</span>
              </Link>
              <Link
                to="/challenges/new"
                className="btn-primary inline-flex items-center gap-2 text-sm px-5 py-2.5 rounded-xl shadow-lg shadow-primary-500/20 hover:shadow-primary-500/30 transition-all font-semibold"
              >
                <PlusCircle size={17} />
                <span>Submit Challenge</span>
              </Link>
            </div>
          </div>
          <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none" />
        </div>

        {/* Filter Bar Component */}
        <ChallengeFilterBar
          filters={filters}
          onFilterChange={handleFilterChange}
          onClear={handleClearFilters}
          totalCount={total}
          isLoading={loading}
        />

        {/* Loading State / Skeleton */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3, 4, 5, 6].map((idx) => (
              <div
                key={idx}
                className="glass rounded-2xl border border-white/10 p-6 space-y-4 animate-pulse"
              >
                <div className="flex items-center justify-between">
                  <div className="h-6 w-24 bg-white/5 rounded-full" />
                  <div className="h-5 w-16 bg-white/5 rounded" />
                </div>
                <div className="h-6 w-3/4 bg-white/10 rounded" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-white/5 rounded" />
                  <div className="h-4 w-5/6 bg-white/5 rounded" />
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <div className="h-4 w-28 bg-white/5 rounded" />
                  <div className="h-8 w-20 bg-white/10 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="glass rounded-2xl border border-rose-500/30 bg-rose-500/5 p-8 text-center space-y-4 max-w-lg mx-auto">
            <div className="inline-flex p-3 rounded-full bg-rose-500/10 text-rose-400">
              <AlertCircle size={28} />
            </div>
            <h3 className="text-lg font-semibold text-white">Failed to load challenges</h3>
            <p className="text-sm text-slate-300">{error}</p>
            <button
              onClick={fetchChallenges}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
            >
              <RotateCcw size={16} />
              <span>Try Again</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && challenges.length === 0 && (
          <div className="glass rounded-2xl border border-white/10 p-12 text-center space-y-5 max-w-xl mx-auto">
            <div className="inline-flex p-4 rounded-2xl bg-white/5 text-slate-400 border border-white/10">
              <Inbox size={36} />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-white">No challenges found</h3>
              <p className="text-sm text-slate-400">
                {filters.search || filters.category || filters.location || filters.difficulty
                  ? "No published challenges match your current search and filter criteria."
                  : "No published challenges are currently active in the community catalog."}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              {(filters.search || filters.category || filters.location || filters.difficulty) && (
                <button
                  onClick={handleClearFilters}
                  className="btn-ghost inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm border border-white/10 text-slate-200"
                >
                  <RotateCcw size={15} />
                  <span>Clear All Filters</span>
                </button>
              )}
              <Link
                to="/challenges/new"
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm"
              >
                <PlusCircle size={16} />
                <span>Submit First Challenge</span>
              </Link>
            </div>
          </div>
        )}

        {/* Challenges Grid */}
        {!loading && !error && challenges.length > 0 && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {challenges.map((challenge) => (
                <ChallengeCard
                  key={challenge.id}
                  challenge={challenge}
                  showStatus={true}
                  isAuthor={isCurrentAuthor(challenge)}
                  isAdmin={isAdmin}
                  onEdit={(c) => navigate(`/challenges/${c.id}/edit`)}
                  onDelete={handleDelete}
                />
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-white/10">
                <p className="text-xs text-slate-400">
                  Showing page <span className="font-semibold text-white">{page}</span> of{" "}
                  <span className="font-semibold text-white">{totalPages}</span> ({total} challenges)
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(page - 1)}
                    disabled={page <= 1}
                    className="p-2 rounded-xl border border-white/10 bg-surface-card hover:bg-white/5 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    aria-label="Previous Page"
                  >
                    <ChevronLeft size={18} />
                  </button>

                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                      .map((p, idx, arr) => {
                        const prev = arr[idx - 1];
                        return (
                          <React.Fragment key={p}>
                            {prev && p - prev > 1 && (
                              <span className="px-2 text-xs text-slate-500">...</span>
                            )}
                            <button
                              onClick={() => handlePageChange(p)}
                              className={`w-9 h-9 rounded-xl text-xs font-semibold transition-all ${
                                page === p
                                  ? "bg-primary-500 text-white shadow-lg shadow-primary-500/25"
                                  : "border border-white/10 bg-surface-card hover:bg-white/5 text-slate-300"
                              }`}
                            >
                              {p}
                            </button>
                          </React.Fragment>
                        );
                      })}
                  </div>

                  <button
                    onClick={() => handlePageChange(page + 1)}
                    disabled={page >= totalPages}
                    className="p-2 rounded-xl border border-white/10 bg-surface-card hover:bg-white/5 text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    aria-label="Next Page"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
