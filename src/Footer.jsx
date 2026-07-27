// =====================================================================
//  Footer.jsx  —  site footer with links + compliance microcopy
//
//  Props:
//    onNavigate(pageName)  -> optional. Called when a footer link is
//                             clicked, e.g. onNavigate("legal").
//                             Defaults to doing nothing so this file
//                             also renders on its own.
// =====================================================================

import { GraduationCap } from "lucide-react";

const BRAND = { navy: "#142A4F" };
const SUBTLE_WHITE = "rgba(255,255,255,0.10)";

export default function Footer({ onNavigate = () => {} }) {
  const year = new Date().getFullYear();

  return (
    <footer className="text-white/80" style={{ backgroundColor: BRAND.navy }}>
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {/* Brand + one-line description */}
          <div>
            <div className="flex items-center gap-2">
              <div className="rounded-lg p-1.5" style={{ backgroundColor: SUBTLE_WHITE }}>
                <GraduationCap className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-white">JEENEETARD</span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              An independent, free directory that helps students find quality
              educational lectures. We link to videos — we don't host them.
            </p>
          </div>

          {/* Navigation links */}
          <div>
            <h3 className="text-sm font-semibold text-white">Explore</h3>
            <ul className="mt-1 text-sm">
              <li>
                <button
                  onClick={() => onNavigate("dashboard")}
                  className="flex min-h-11 min-w-11 items-center justify-center text-white/70 transition hover:text-white"
                >
                  Home
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("legal")}
                  className="flex min-h-11 min-w-11 items-center justify-center text-white/70 transition hover:text-white"
                >
                  Terms &amp; Disclaimer
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate("privacy")}
                  className="flex min-h-11 min-w-11 items-center justify-center text-white/70 transition hover:text-white"
                >
                  Privacy Policy
                </button>
              </li>
            </ul>
          </div>

          {/* Compliance / attribution */}
          <div>
            <h3 className="text-sm font-semibold text-white">Good to know</h3>
            <p className="mt-3 text-sm leading-relaxed text-white/70">
              Videos play through YouTube's official embedded player and remain
              the property of their respective creators. This site is not
              affiliated with, endorsed by, or sponsored by YouTube, Google, or
              any coaching institute.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-8 flex flex-col items-center justify-between gap-3 pt-6 text-xs text-white/70 sm:flex-row"
          style={{ borderTop: `1px solid ${SUBTLE_WHITE}` }}
        >
          <p>© {year} JEENEETARD. All institute names &amp; logos belong to their owners.</p>
          <p>Powered by the YouTube embedded player.</p>
        </div>
      </div>
    </footer>
  );
}
