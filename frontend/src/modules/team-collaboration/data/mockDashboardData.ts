import type {
  DashboardStatItem,
  PendingTaskItem,
  RecentTeamItem,
  TeamActivityItem,
  UpcomingMeetingItem,
} from "../types";

/**
 * Temporary Phase 1 mock data for the Team Collaboration Dashboard.
 * Represents sample Jharkhand societal innovation initiatives only —
 * NOT real database records. Replaced by live API data in Phases 2–6.
 */

export const MOCK_DASHBOARD_STATS: DashboardStatItem[] = [
  {
    id: "total-teams",
    label: "Total Teams",
    value: 24,
    changeText: "+4 active this month",
    iconName: "users",
    accentColor: "text-primary-400",
    accentBg: "bg-primary-500/15",
  },
  {
    id: "joined-teams",
    label: "Joined Teams",
    value: 3,
    changeText: "1 as Lead · 2 as Member",
    iconName: "user-check",
    accentColor: "text-accent-400",
    accentBg: "bg-accent-400/15",
  },
  {
    id: "pending-invitations",
    label: "Pending Invitations",
    value: 2,
    changeText: "Awaiting your response",
    iconName: "mail",
    accentColor: "text-amber-400",
    accentBg: "bg-amber-500/15",
  },
  {
    id: "assigned-tasks",
    label: "Assigned Tasks",
    value: 9,
    changeText: "4 due this week",
    iconName: "list-checks",
    accentColor: "text-cyan-400",
    accentBg: "bg-cyan-500/15",
  },
  {
    id: "completed-tasks",
    label: "Completed Tasks",
    value: 14,
    changeText: "78% sprint completion",
    iconName: "check-circle",
    accentColor: "text-emerald-400",
    accentBg: "bg-emerald-500/15",
  },
];

export const MOCK_RECENT_TEAMS: RecentTeamItem[] = [
  {
    id: "mock-team-1",
    name: "JalSetu Jharkhand",
    challengeTitle: "IoT Groundwater & Drinking Water Monitoring – Dhanbad",
    district: "Dhanbad",
    role: "Team Lead",
    memberCount: 5,
    maxMembers: 6,
    progressPercent: 72,
    status: "Active",
    lastUpdated: "2 hours ago",
  },
  {
    id: "mock-team-2",
    name: "VanShilp Digital Collective",
    challengeTitle: "Direct Market Access for Tribal Dokra & Sohrai Artisans",
    district: "Hazaribagh",
    role: "Core Member",
    memberCount: 4,
    maxMembers: 6,
    progressPercent: 54,
    status: "Recruiting",
    lastUpdated: "Yesterday",
  },
  {
    id: "mock-team-3",
    name: "GramShiksha AI",
    challengeTitle: "Multilingual Offline Learning Companion (Santhali & Mundari)",
    district: "Ranchi",
    role: "Contributor",
    memberCount: 6,
    maxMembers: 6,
    progressPercent: 86,
    status: "Review",
    lastUpdated: "3 days ago",
  },
];

export const MOCK_RECENT_ACTIVITIES: TeamActivityItem[] = [
  {
    id: "mock-act-1",
    actorName: "Ananya Kumari",
    actorInitials: "AK",
    action: "completed task",
    target: "Sensor calibration checklist for Block-3 wells",
    teamName: "JalSetu Jharkhand",
    timestamp: "35 mins ago",
    category: "task",
  },
  {
    id: "mock-act-2",
    actorName: "Rohan Mahato",
    actorInitials: "RM",
    action: "posted in discussion",
    target: "Artisan onboarding survey feedback from Hazaribagh",
    teamName: "VanShilp Digital Collective",
    timestamp: "2 hours ago",
    category: "discussion",
  },
  {
    id: "mock-act-3",
    actorName: "Dr. S. K. Sinha",
    actorInitials: "SS",
    action: "approved milestone",
    target: "Phase 1 Prototype Architecture Review",
    teamName: "GramShiksha AI",
    timestamp: "Yesterday",
    category: "milestone",
  },
  {
    id: "mock-act-4",
    actorName: "Priya Oraon",
    actorInitials: "PO",
    action: "joined team",
    target: "as UI/UX Researcher",
    teamName: "JalSetu Jharkhand",
    timestamp: "2 days ago",
    category: "member",
  },
];

export const MOCK_UPCOMING_MEETINGS: UpcomingMeetingItem[] = [
  {
    id: "mock-meet-1",
    title: "Weekly Sprint Sync & Field Pilot Planning",
    teamName: "JalSetu Jharkhand",
    dateLabel: "Tomorrow",
    timeLabel: "10:30 AM – 11:15 AM IST",
    mode: "Online Video",
    participantsCount: 5,
  },
  {
    id: "mock-meet-2",
    title: "Mentor Review – Artisan Catalog Wireframes",
    teamName: "VanShilp Digital Collective",
    dateLabel: "Fri, Nov 20",
    timeLabel: "4:00 PM – 4:45 PM IST",
    mode: "Campus Sync",
    participantsCount: 4,
  },
  {
    id: "mock-meet-3",
    title: "Voice Dataset Evaluation Check-in",
    teamName: "GramShiksha AI",
    dateLabel: "Mon, Nov 23",
    timeLabel: "6:00 PM – 6:30 PM IST",
    mode: "Field Check-in",
    participantsCount: 6,
  },
];

export const MOCK_PENDING_TASKS: PendingTaskItem[] = [
  {
    id: "mock-task-1",
    title: "Draft field deployment SOP for Dhanbad panchayat water sensors",
    teamName: "JalSetu Jharkhand",
    dueLabel: "Due in 2 days",
    priority: "High",
    status: "In Progress",
  },
  {
    id: "mock-task-2",
    title: "Compile regional craft cluster list with district coordinators",
    teamName: "VanShilp Digital Collective",
    dueLabel: "Due in 4 days",
    priority: "Medium",
    status: "To Do",
  },
  {
    id: "mock-task-3",
    title: "Review Santhali audio transcription accuracy report",
    teamName: "GramShiksha AI",
    dueLabel: "Due Nov 24",
    priority: "High",
    status: "In Progress",
  },
  {
    id: "mock-task-4",
    title: "Prepare stakeholder demo slides for BIT Mesra review panel",
    teamName: "JalSetu Jharkhand",
    dueLabel: "Due Nov 27",
    priority: "Low",
    status: "To Do",
  },
];

