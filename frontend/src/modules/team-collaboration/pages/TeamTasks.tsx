import { CheckSquare } from "lucide-react";
import PlaceholderPage from "../components/PlaceholderPage";

export default function TeamTasks() {
  return (
    <PlaceholderPage
      title="My Tasks"
      phaseLabel="Coming in Phase 5"
      description="Organize team deliverables, assign owners, set priorities, and track completion across every innovation sprint."
      icon={<CheckSquare size={22} />}
      plannedFeatures={[
        "Create, assign, and update collaborative team tasks",
        "Filter tasks by status, priority, team, and due date",
        "Kanban and list views for sprint coordination",
        "Task activity logs synced to dashboard statistics",
      ]}
    />
  );
}

