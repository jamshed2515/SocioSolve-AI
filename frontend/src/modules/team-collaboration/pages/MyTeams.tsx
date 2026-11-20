import { Users } from "lucide-react";
import PlaceholderPage from "../components/PlaceholderPage";

export default function MyTeams() {
  return (
    <PlaceholderPage
      title="My Teams"
      phaseLabel="Coming in Phase 2"
      description="Create, configure, and manage the innovation teams you lead or belong to across Jharkhand societal challenges."
      icon={<Users size={22} />}
      plannedFeatures={[
        "Create new challenge-linked teams with required skill tags",
        "Manage team roster, member roles, and capacity limits",
        "View team progress snapshots and challenge submission readiness",
        "Archive or transfer team leadership with RBAC checks",
      ]}
    />
  );
}

