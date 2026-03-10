import { ExpandableFeedbackCard } from "@/components/reports/expandable-feedback-card";
import type { RecentFeedbackItem } from "@/components/reports/report-types";

type RecentFeedbackListProps = {
  items: RecentFeedbackItem[];
  emptyMessage: string;
  previewLength?: number;
};

export function RecentFeedbackList(props: RecentFeedbackListProps) {
  if (!props.items.length) {
    return <p className="mt-3 text-sm text-gray-700">{props.emptyMessage}</p>;
  }

  return (
    <div className="mt-3 space-y-3">
      {props.items.map((item) => (
        <ExpandableFeedbackCard key={item.id} item={item} previewLength={props.previewLength} />
      ))}
    </div>
  );
}
