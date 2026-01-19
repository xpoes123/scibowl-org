import {
  useLocation,
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Link,
  NavLink,
} from "react-router-dom";
import { useEffect } from "react";
import { TournamentDetailPage, TournamentsLandingPage, TournamentsPage } from "./features/tournaments";
import { isFeatureEnabled } from "./core/features";
import { PacketSetDetailPage, PacketsPage } from "./features/packets";

function TopNav() {
  const tournamentsEnabled = isFeatureEnabled("tournaments");
  const packetsEnabled = isFeatureEnabled("packets");

  return (
    <header className="sbTopNav" role="banner">
      <div className="sbTopNavInner">
        <Link to="/" className="sbTopNavBrand" aria-label="Go to home">
          <img src="/logo_big.png" alt="SciBowl" className="sbTopNavLogo" />
          <span className="sbTopNavBrandText">SciBowl</span>
        </Link>

        <nav aria-label="Primary" className="sbTopNavLinks">
          {tournamentsEnabled && (
            <NavLink
              to="/tournaments"
              className={({ isActive }) => (isActive ? "sbTopNavLink sbTopNavLinkActive" : "sbTopNavLink")}
            >
              Tournaments
            </NavLink>
          )}
          {packetsEnabled && (
            <NavLink
              to="/packets"
              className={({ isActive }) => (isActive ? "sbTopNavLink sbTopNavLinkActive" : "sbTopNavLink")}
            >
              Packets
            </NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}

function ScrollToTop() {
  const { pathname, search } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname, search]);

  return null;
}

function MossRedirectPage() {
  const location = useLocation();
  const mossBaseUrl =
    import.meta.env.VITE_MOSS_URL ?? (import.meta.env.DEV ? "http://localhost:5174/" : undefined);

  const targetHref = (() => {
    if (!mossBaseUrl) return undefined;

    const base = new URL(mossBaseUrl, window.location.origin);
    const suffix = location.pathname.replace(/^\/moss\/?/, "");

    if (suffix) {
      const basePath = base.pathname.endsWith("/") ? base.pathname : `${base.pathname}/`;
      base.pathname = `${basePath}${suffix.replace(/^\/+/, "")}`;
    }

    base.search = location.search;
    base.hash = location.hash;
    return base.toString();
  })();

  useEffect(() => {
    if (!targetHref) return;
    if (targetHref === window.location.href) return;
    window.location.replace(targetHref);
  }, [targetHref]);

  return (
    <div className="card sbCenter" role="status" aria-live="polite">
      <h1 className="sbTitle">MoSS</h1>
      {targetHref ? (
        <>
          <p className="sbMuted">Redirecting to the moderator platform...</p>
          <a className="sbHeaderLink sbTopSpace" href={targetHref}>
            Continue
          </a>
        </>
      ) : (
        <p className="sbMuted">
          MoSS is not configured for this deployment. Set <code>VITE_MOSS_URL</code> to enable this route.
        </p>
      )}
    </div>
  );
}

function AppContent() {
  const tournamentsEnabled = isFeatureEnabled("tournaments");
  const packetsEnabled = isFeatureEnabled("packets");
  const hasAnyFeatures = tournamentsEnabled || packetsEnabled;

  return (
    <div className="page">
      <TopNav />
      <ScrollToTop />
      <div className="shell">
        <Routes>
          <Route path="/moss/*" element={<MossRedirectPage />} />
          {hasAnyFeatures ? (
            <>
              {tournamentsEnabled ? (
                <Route path="/" element={<TournamentsLandingPage />} />
              ) : packetsEnabled ? (
                <Route path="/" element={<PacketsPage />} />
              ) : null}

              {tournamentsEnabled && (
                <>
                  <Route path="/tournaments" element={<TournamentsPage />} />
                  <Route path="/tournaments/:slug" element={<TournamentDetailPage />} />
                </>
              )}

              {packetsEnabled && (
                <>
                  <Route path="/packets" element={<PacketsPage />} />
                  <Route path="/packets/:slug" element={<PacketSetDetailPage />} />
                </>
              )}

              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route
                path="/"
                element={
                  <div className="card">
                    <h1 className="sbTitle">SciBowl</h1>
                    <p className="sbMuted">No features are enabled right now.</p>
                  </div>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
