import { GlobalNavbar } from "@/components/navigation/GlobalNavbar";
import { LandingFooter } from "@/components/landing/LandingFooter";
import styles from "@/components/help/help.module.css";

export default function HelpLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.shell}>
      <GlobalNavbar />
      <main className={styles.main}>{children}</main>
      <LandingFooter />
    </div>
  );
}
