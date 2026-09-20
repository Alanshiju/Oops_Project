import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    // Force scroll to top on every route change
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    // Fallback for custom scroll containers
    const rootEl = document.getElementById("root");
    if (rootEl) rootEl.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.body.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
