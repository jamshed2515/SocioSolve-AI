import React, { useState } from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  MapPin,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";

export const CATEGORY_OPTIONS = [
  "All Categories",
  "Healthcare",
  "Education",
  "Agriculture",
  "Environment & Water",
  "Waste Management",
  "Smart Cities & Mobility",
  "Renewable Energy",
  "Other",
];

export const DIFFICULTY_OPTIONS = [
  { value: "", label: "All Difficulties" },
  { value: "Easy", label: "Easy" },
  { value: "Medium", label: "Medium" },
  { value: "Hard", label: "Hard" },
];

export const SORT_OPTIONS = [
  { value: "newest", label: "Newest First" },
  { value: "oldest", label: "Oldest First" },
  { value: "views", label: "Most Viewed" },
  { value: "proposals", label: "Most Proposals" },
  { value: "deadline", label: "Closest Deadline" },
];

export default function ChallengeFilterBar({
  filters = {},
  onFilterChange,
  onClear,
  totalCount,
  isLoading = false,
}) {
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const {
    search = "",
    category = "",
    location = "",
    difficulty = "",
    sortBy = "newest",
    status = "",
  } = filters;

  const isFiltered = Boolean(search || category || location || difficulty || (status && status !== "published") || sortBy !== "newest");

  const handleTextChange = (field, value) => {
    onFilterChange?.({ ...filters, [field]: value });
  };

  return (
    <div className="glass p-4 sm:p-5 mb-6 space-y-4">
      {/* Top Bar: Search Input, Quick Category Select, Mobile Filter Toggle */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => handleTextChange("search", e.target.value)}
            placeholder="Search by title, description, code, or tags..."
            className="input pl-10 pr-9 py-2.5 text-sm"
            aria-label="Search challenges"
          />
          {search && (
            <button
              type="button"
              onClick={() => handleTextChange("search", "")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white p-1 rounded-full transition"
              title="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Category selector */}
        <div className="w-full sm:w-56">
          <select
            value={category}
            onChange={(e) => handleTextChange("category", e.target.value === "All Categories" ? "" : e.target.value)}
            className="input py-2.5 text-sm cursor-pointer"
            aria-label="Filter by category"
          >
            {CATEGORY_OPTIONS.map((cat) => (
              <option key={cat} value={cat === "All Categories" ? "" : cat} className="bg-dark-800 text-white">
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Mobile toggle button */}
        <button
          type="button"
          onClick={() => setMobileExpanded((prev) => !prev)}
          className={`sm:hidden btn-ghost py-2.5 text-sm justify-between ${
            mobileExpanded || isFiltered ? "border-primary-400 text-primary-300" : ""
          }`}
        >
          <span className="flex items-center gap-2">
            <SlidersHorizontal size={16} /> Filters
          </span>
          {isFiltered && <span className="w-2 h-2 rounded-full bg-accent-400" />}
        </button>
      </div>

      {/* Filter controls row (always visible on desktop, toggleable on mobile) */}
      <div className={`${mobileExpanded ? "block" : "hidden"} sm:block pt-3 border-t border-white/10`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Location filter */}
          <div className="relative">
            <MapPin
              size={16}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <input
              type="text"
              value={location}
              onChange={(e) => handleTextChange("location", e.target.value)}
              placeholder="Filter location (city/state)..."
              className="input pl-10 pr-3 py-2 text-xs"
              aria-label="Filter by location"
            />
          </div>

          {/* Difficulty filter */}
          <div>
            <select
              value={difficulty}
              onChange={(e) => handleTextChange("difficulty", e.target.value)}
              className="input py-2 text-xs cursor-pointer"
              aria-label="Filter by difficulty"
            >
              {DIFFICULTY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-dark-800 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Sort selector */}
          <div className="relative">
            <ArrowUpDown
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
            />
            <select
              value={sortBy}
              onChange={(e) => handleTextChange("sortBy", e.target.value)}
              className="input pl-9 py-2 text-xs cursor-pointer"
              aria-label="Sort challenges by"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-dark-800 text-white">
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Clear filters button & count indicator */}
          <div className="flex items-center justify-between sm:justify-end gap-3">
            {isFiltered && (
              <button
                type="button"
                onClick={onClear}
                className="btn-ghost py-1.5 px-3 text-xs text-rose-300 hover:text-rose-200 border-rose-500/30 hover:border-rose-400"
              >
                <RotateCcw size={13} /> Clear Filters
              </button>
            )}

            {typeof totalCount === "number" && (
              <span className="text-xs text-white/50 whitespace-nowrap">
                {isLoading ? (
                  "Loading..."
                ) : (
                  <>
                    <strong className="text-white">{totalCount}</strong>{" "}
                    {totalCount === 1 ? "challenge" : "challenges"}
                  </>
                )}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
