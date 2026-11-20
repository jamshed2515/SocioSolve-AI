import { CalendarClock } from "lucide-react";
import PlaceholderPage from "../components/PlaceholderPage";

export default function TeamMeetings() {
  return (
    <PlaceholderPage
      title="Meetings & Milestones"
      phaseLabel="Coming in Phase 6"
      description="Schedule team syncs, capture meeting agendas, and track project milestones toward Smart India Hackathon and Jharkhand pilot goals."
      icon={<CalendarClock size={22} />}
      plannedFeatures={[
        "Schedule recurring or one-off team meetings with agendas",
        "Define challenge milestones with target dates and deliverables",
        "Track mentor sign-offs and milestone completion percentages",
        "Unified upcoming schedule synced to the Module 3 dashboard",
      ]}
    />
  );
}

