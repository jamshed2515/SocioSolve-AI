import { useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  FileText,
  FileEdit,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Filter,
  RotateCcw,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Star,
  ExternalLink,
  ClipboardCheck,
  FolderKanban,
  Calendar,
} from "lucide-react";
import DashboardLayout from "../../components/layouts/DashboardLayout";
import ProposalStatusBadge, { STATUS_CONFIG } from "../../components/proposals/ProposalStatusBadge";
import proposalService from "../../services/proposalService";
import { useAuth } from "../../context/AuthContext";

export default function ProposalDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalProposals: 0,
    draftProposals: 0,
    submittedProposals: 0,
    underReviewProposals: 0,
    acceptedProposals: 0,
    rejectedProposals: 0,
    statusDistribution: [],
    recentProposals: [],
  });
  const [challenges, setChallenges] = useState([]);
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);

  // Search, Filter, Sort & Pagination state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [challengeFilter, setChallengeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const limit = 8;

  const isReviewerOrAdmin = ["admin", "university", "industry"].includes(user?.role);
  const canCreateProposal = ["student", "citizen", "university", "admin"].includes(user?.role);

  const loadDashboardOverview = useCallback(async () => {
    try {
      setLoading(true);
      const [statsData, challengesData] = await Promise.all([
        proposalService.getDashboardStats("all"),
        proposalService.getPublishedChallenges(),
      ]);
      setStats(statsData);
      setChallenges(challengesData.challenges || []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load proposal dashboard metrics.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadProposalsList = useCallback(async () => {
    try {
      setListLoading(true);
      const params = {
        page,
        limit,
        sortBy,
      };
      if (search.trim()) params.search = search.trim();
      if (statusFilter !== "all") params.status = statusFilter;
      if (challengeFilter !== "all") params.challengeId = challengeFilter;
      if (dateFrom) params.dateFrom = dateFrom;
      if (dateTo) params.dateTo = dateTo;

      const data = await proposalService.listProposals(params);
      setProposals(data.items || []);
      setTotalPages(data.totalPages || 1);
      setTotalItems(data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to fetch proposals.");
    } finally {
      setListLoading(false);
    }
  }, [page, limit, sortBy, search, statusFilter, challengeFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadDashboardOverview();
  }, [loadDashboardOverview]);

  useEffect(() => {
    loadProposalsList();
  }, [loadProposalsList]);

  const handleClearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setChallengeFilter("all");
    setDateFrom("");
    setDateTo("");
    setSortBy("newest");
    setPage(1);
  };

  const hasActiveFilters =
    search.trim() !== "" ||
    statusFilter !== "all" ||
    challengeFilter !== "all" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    sortBy !== "newest";

  const kpiCards = [
    {
      label: "Total Proposals",
      value: stats.totalProposals,
      icon: FileText,
      color: "text-primary-400",
      bg: "bg-primary-500/15",
      filterVal: "all",
    },
    {
      label: "Draft Proposals",
      value: stats.draftProposals,
      icon: FileEdit,
      color: "text-slate-300",
      bg: "bg-slate-500/15",
      filterVal: "draft",
    },
    {
      label: "Submitted",
      value: stats.submittedProposals,
      icon: Send,
      color: "text-blue-400",
      bg: "bg-blue-500/15",
      filterVal: "submitted",
    },
    {
      label: "Under Review",
      value: stats.underReviewProposals,
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/15",
      filterVal: "under_review",
    },
    {
      label: "Accepted",
      value: stats.acceptedProposals,
      icon: CheckCircle2,
      color: "text-emerald-400",
      bg: "bg-emerald-500/15",
      filterVal: "accepted",
    },
    {
      label: "Rejected",
      value: stats.rejectedProposals,
      icon: XCircle,
      color: "text-rose-400",
      bg: "bg-rose-500/15",
      filterVal: "rejected",
    },
  ];

  return (
    <DashboardLayout title="Solution Proposals & Evaluation">
      {/* Header Banner */}
      <div className="glass p-6 mb-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-primary-500/20">
        <div>
          <span className="badge bg-primary-500/20 text-primary-300 mb-2">
            Module 4 · Solution Proposals & Evaluation
          </span>
          <h2 className="text-xl font-bold text-white">
            Collaborative Solution Proposals Hub
          </h2>
          <p className="text-sm text-white/60 mt-1">
            Submit innovative solutions for published societal challenges, track evaluation status, and review team prototypes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link to="/proposals/my" className="btn-ghost text-sm px-4 py-2.5">
            <FolderKanban size={16} /> My Proposals
          </Link>
          {isReviewerOrAdmin && (
            <Link
              to="/proposals/review-queue"
              className="btn-ghost text-sm px-4 py-2.5 border-amber-500/40 text-amber-300 hover:border-amber-400"
            >
              <ClipboardCheck size={16} /> Review Queue
            </Link>
          )}
          {canCreateProposal && (
            <Link to="/proposals/new" className="btn-primary text-sm px-5 py-2.5">
              <Plus size={16} /> Create Proposal
            </Link>
          )}
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
        {kpiCards.map(({ label, value, icon: Icon, color, bg, filterVal }) => {
          const isSelected = statusFilter === filterVal;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                setStatusFilter(filterVal);
                setPage(1);
              }}
              className={`stat-card text-left cursor-pointer ${
                isSelected ? "border-primary-500 ring-1 ring-primary-500/40" : ""
              }`}
            >
              <div className="flex items-center justify-between w-full">
                <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
                  <Icon className={color} size={20} />
                </div>
                {isSelected && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary-400">
                    Active
                  </span>
                )}
              </div>
              <p className="text-2xl font-bold text-white mt-1">
                {loading ? "—" : value}
              </p>
              <p className="text-xs text-white/50">{label}</p>
            </button>
          );
        })}
      </div>

      {/* Status Distribution & Recent Proposals Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Status Distribution */}
        <div className="glass p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">
              Proposal Status Distribution
            </h3>
            <span className="text-xs text-white/40">
              {stats.totalProposals} total
            </span>
          </div>

          <div className="space-y-3.5">
            {(stats.statusDistribution || []).map((item) => {
              const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.draft;
              return (
                <div key={item.status} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-white/80 font-medium flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                      {item.label}
                    </span>
                    <span className="text-white/60">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${cfg.barClass}`}
                      style={{ width: `${Math.max(item.percentage, item.count > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Proposals */}
        <div className="glass p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-white">
              Recent Activity & Submissions
            </h3>
            <Link
              to="/proposals/my"
              className="text-xs text-primary-400 hover:text-primary-300 font-medium"
            >
              View My Proposals →
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-14 rounded-xl bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : (stats.recentProposals || []).length === 0 ? (
            <div className="text-center py-8 bg-white/5 rounded-xl border border-white/5">
              <p className="text-sm text-white/60 mb-3">
                No proposals have been created yet.
              </p>
              <Link to="/proposals/new" className="btn-primary text-xs px-4 py-2">
                <Plus size={14} /> Submit First Proposal
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {stats.recentProposals.map((prop) => (
                <div
                  key={prop.id}
                  onClick={() => navigate(`/proposals/${prop.id}`)}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-primary-400">
                        {prop.proposalCode}
                      </span>
                      <p className="text-sm font-medium text-white truncate">
                        {prop.title}
                      </p>
                    </div>
                    <p className="text-xs text-white/50 truncate mt-0.5">
                      Challenge: {prop.challengeTitle} · By {prop.authorName}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                    {prop.reviewSummary?.reviewCount > 0 && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        {prop.reviewSummary.totalScore}/50
                      </span>
                    )}
                    <ProposalStatusBadge status={prop.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Search, Filter, Sort & Proposals Table */}
      <div className="glass p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-base font-semibold text-white">
              All Authorized Proposals
            </h3>
            <p className="text-xs text-white/50">
              Showing {proposals.length} of {totalItems} proposals
            </p>
          </div>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-300 hover:text-rose-200 bg-rose-500/15 px-3 py-1.5 rounded-lg self-start md:self-auto"
            >
              <RotateCcw size={13} /> Clear Filters
            </button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
          {/* Search by Title or Proposal ID */}
          <div className="sm:col-span-2 relative">
            <Search
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by title, Proposal ID (PROP-...), or author..."
              className="input pl-10 py-2.5 text-sm"
            />
          </div>

          {/* Filter by Status */}
          <div className="relative">
            <Filter
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="input pl-9 py-2.5 text-sm appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="under_review">Under Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>

          {/* Filter by Challenge */}
          <div>
            <select
              value={challengeFilter}
              onChange={(e) => {
                setChallengeFilter(e.target.value);
                setPage(1);
              }}
              className="input py-2.5 text-sm"
            >
              <option value="all">All Challenges</option>
              {challenges.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.title}
                </option>
              ))}
            </select>
          </div>

          {/* Filter by Date From */}
          <div className="relative">
            <Calendar
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              title="Filter from date"
              className="input pl-9 py-2.5 text-sm"
            />
          </div>

          {/* Sort By */}
          <div className="relative">
            <ArrowUpDown
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="input pl-9 py-2.5 text-sm appearance-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="score_desc">Highest Score</option>
              <option value="score_asc">Lowest Score</option>
              <option value="updated">Recently Updated</option>
            </select>
          </div>
        </div>

        {/* Proposals Table / List */}
        {listLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-16 rounded-xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-white/5 border border-white/5">
            <FileText className="mx-auto text-white/30 mb-3" size={36} />
            <h4 className="text-base font-semibold text-white mb-1">
              No matching proposals found
            </h4>
            <p className="text-xs text-white/50 max-w-md mx-auto mb-4">
              {hasActiveFilters
                ? "Try clearing your active search or status filters to see more proposals."
                : "Start by browsing published societal challenges and submitting a solution proposal."}
            </p>
            {hasActiveFilters ? (
              <button type="button" onClick={handleClearFilters} className="btn-ghost text-xs px-4 py-2">
                Clear Filters
              </button>
            ) : (
              <Link to="/proposals/new" className="btn-primary text-xs px-4 py-2">
                <Plus size={14} /> Create Proposal
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-white/40">
                  <th className="py-3 px-4">Proposal</th>
                  <th className="py-3 px-4">Related Challenge</th>
                  <th className="py-3 px-4">Author / Team</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-sm">
                {proposals.map((prop) => (
                  <tr
                    key={prop.id}
                    className="hover:bg-white/5 transition group"
                  >
                    <td className="py-3.5 px-4">
                      <span className="text-[11px] font-mono text-primary-400 block">
                        {prop.proposalCode}
                      </span>
                      <Link
                        to={`/proposals/${prop.id}`}
                        className="font-semibold text-white group-hover:text-primary-300 transition line-clamp-1"
                      >
                        {prop.title}
                      </Link>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs text-white/80 line-clamp-1">
                        {prop.challengeTitle}
                      </span>
                      <span className="text-[11px] text-white/40 block">
                        {prop.challengeCategory}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-xs text-white/80 font-medium block">
                        {prop.authorName}
                      </span>
                      {prop.teamName && (
                        <span className="text-[11px] text-accent-400 block">
                          Team: {prop.teamName}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <ProposalStatusBadge status={prop.status} />
                    </td>
                    <td className="py-3.5 px-4">
                      {prop.reviewSummary?.reviewCount > 0 ? (
                        <div>
                          <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-300">
                            <Star size={13} className="fill-amber-400 text-amber-400" />
                            {prop.reviewSummary.totalScore}/50
                          </span>
                          <span className="block text-[11px] text-white/40">
                            Avg: {prop.reviewSummary.averageScore}/10
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-white/30">Not scored</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-white/50 whitespace-nowrap">
                      {new Date(prop.submittedAt || prop.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <Link
                        to={`/proposals/${prop.id}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-400 hover:text-primary-300 bg-primary-500/10 hover:bg-primary-500/20 px-3 py-1.5 rounded-lg transition"
                      >
                        View <ExternalLink size={12} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-5 mt-4 border-t border-white/10">
            <p className="text-xs text-white/50">
              Page <span className="text-white font-semibold">{page}</span> of{" "}
              <span className="text-white font-semibold">{totalPages}</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="btn-ghost px-3 py-1.5 text-xs disabled:opacity-40"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
