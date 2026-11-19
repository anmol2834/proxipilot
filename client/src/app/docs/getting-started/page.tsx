import { DocArticleView, docMetadata } from "@/components/docs/DocArticleView";

const SLUG = "getting-started";

export const metadata = docMetadata(SLUG);

export default function GettingStartedDocPage() {
  return <DocArticleView slug={SLUG} />;
}
