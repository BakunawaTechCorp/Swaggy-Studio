import Link from "next/link";
import { Bookmark, Sparkles } from "lucide-react";

export function QuickstartGrid() {
  return (
    <>
      <div className="section-title">
        <div>
          <h2>
            What do you want to <span className="italic">make</span>?
          </h2>
          <p>One brief. Caption, image, campaign — I figure out what you need.</p>
        </div>
      </div>

      <Link href="/create" className="create-hero-card">
        <div className="create-hero-icon">
          <Sparkles size={28} />
        </div>
        <div className="create-hero-content">
          <div className="create-hero-title">Create</div>
          <div className="create-hero-sub">
            Type what you want, get a finished post
          </div>
        </div>
      </Link>

      <div className="home-secondary-row">
        <Link href="/library" className="home-secondary-card">
          <Bookmark size={18} />
          <div>
            <div>Your Library</div>
            <div className="muted">Saved captions, images, strategies</div>
          </div>
        </Link>
      </div>
    </>
  );
}
