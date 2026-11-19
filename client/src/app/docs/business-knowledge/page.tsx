import { DocArticleView, docMetadata } from "@/components/docs/DocArticleView";

const SLUG = "business-knowledge";

export const metadata = docMetadata(SLUG);

export default function BusinessKnowledgeDocPage() {
  return <DocArticleView slug={SLUG} />;
}
