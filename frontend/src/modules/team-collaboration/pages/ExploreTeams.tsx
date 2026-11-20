import { Compass } from "lucide-react";
import PlaceholderPage from "../components/PlaceholderPage";

export default function ExploreTeams() {
  return (
    <PlaceholderPage
      title="Explore Teams"
      phaseLabel="Coming in Phase 3"
      description="Browse open societal innovation teams across Jharkhand districts, filter by skills or challenge domain, and submit join requests."
      icon={<Compass size={22} />}
      plannedFeatures={[
        "Search and filter public teams by district, domain, and open roles",
        "Inspect required skills and current member composition",
        "Submit join requests with a brief contributor note",
        "Track pending join request approvals in real time",
      ]}
    />
  );
}

