import { DocArticleView, docMetadata } from "@/components/docs/DocArticleView";

const SLUG = "connect-outlook";

export const metadata = docMetadata(SLUG);

export default function ConnectOutlookDocPage() {
  return <DocArticleView slug={SLUG} />;
}
