import { Mail } from "lucide-react";
import PlaceholderPage from "../components/PlaceholderPage";

export default function TeamInvitations() {
  return (
    <PlaceholderPage
      title="Invitations"
      phaseLabel="Coming in Phase 3"
      description="Send collaborator invitations as a team lead and accept or decline incoming invitations from peers and mentors."
      icon={<Mail size={22} />}
      plannedFeatures={[
        "Accept or decline incoming team invitations with one click",
        "Invite students, faculty mentors, or industry partners by email",
        "Review incoming join requests for teams you lead",
        "View invitation history and expiration status",
      ]}
    />
  );
}

