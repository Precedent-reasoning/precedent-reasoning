import type { Metadata } from "next";

// Search results here show case names/party names. NSW Caselaw's publishing
// policy asks that pages linking to decisions preferably exclude
// search-engine indexing where party names are visible — see DATA_LICENSE.md.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
