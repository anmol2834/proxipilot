import { DocArticleView, docMetadata } from "@/components/docs/DocArticleView";

const SLUG = "troubleshooting";

export const metadata = docMetadata(SLUG);

export default function TroubleshootingDocPage() {
  return <DocArticleView slug={SLUG} />;
}
