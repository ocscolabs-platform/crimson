import type { InsightsBody } from "@/lib/insights-body";
import { renderInsightsBody } from "@/lib/insights-renderer";

export default function ReadOnlyArticleBody({ body }: { body: InsightsBody }) {
  return <div className="insights-rendered-body">{renderInsightsBody(body)}</div>;
}
