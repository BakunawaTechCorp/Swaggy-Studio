import Link from "next/link";
import { LibraryView } from "./_components/LibraryView";

export default function LibraryPage() {
  return (
    <main className="canvas">
      <Link href="/create" className="back-link">
        ← Back to Create
      </Link>
      <LibraryView />
    </main>
  );
}
