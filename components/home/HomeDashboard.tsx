"use client";

import { CreditBalance } from "@/components/home/CreditBalance";
import { QuickstartGrid } from "@/components/home/QuickstartGrid";
import { RoleToggle } from "@/components/marketplace/RoleToggle";

export function HomeDashboard() {
  return (
    <main className="canvas">
      <div className="topbar">
        <div className="greeting">Welcome back</div>
        <div className="topbar-right">
          <RoleToggle />
          <CreditBalance />
        </div>
      </div>
      <QuickstartGrid />
      <footer className="canvas-footer">Swaggy Studio · v1.0</footer>
    </main>
  );
}
