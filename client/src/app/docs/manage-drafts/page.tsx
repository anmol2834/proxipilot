import { DocArticleView, docMetadata } from "@/components/docs/DocArticleView";

const SLUG = "manage-drafts";

export const metadata = docMetadata(SLUG);

export default function ManageDraftsDocPage() {
  return <DocArticleView slug={SLUG} />;
}
