import { DocArticleView, docMetadata } from "@/components/docs/DocArticleView";

const SLUG = "connect-gmail";

export const metadata = docMetadata(SLUG);

export default function ConnectGmailDocPage() {
  return <DocArticleView slug={SLUG} />;
}
