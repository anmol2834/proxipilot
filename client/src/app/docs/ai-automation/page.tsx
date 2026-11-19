import { DocArticleView, docMetadata } from "@/components/docs/DocArticleView";

const SLUG = "ai-automation";

export const metadata = docMetadata(SLUG);

export default function AiAutomationDocPage() {
  return <DocArticleView slug={SLUG} />;
}
