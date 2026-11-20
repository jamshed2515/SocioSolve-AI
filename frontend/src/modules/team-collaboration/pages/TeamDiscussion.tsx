import { MessageSquare } from "lucide-react";
import PlaceholderPage from "../components/PlaceholderPage";

export default function TeamDiscussion() {
  return (
    <PlaceholderPage
      title="Discussions"
      phaseLabel="Coming in Phase 4"
      description="Real-time team discussion threads and project channels powered by FastAPI WebSockets / Socket.IO."
      icon={<MessageSquare size={22} />}
      plannedFeatures={[
        "Dedicated real-time discussion channels per project team",
        "Threaded replies, announcements, and pinned decisions",
        "Live typing & presence indicators via WebSockets / Socket.IO",
        "Attachment links and challenge reference tagging",
      ]}
    />
  );
}

