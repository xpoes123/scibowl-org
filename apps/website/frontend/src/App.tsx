import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { TournamentsPage } from "./features/tournaments";
import { isFeatureEnabled } from "./core/features";


function AppContent() {
  const tournamentsEnabled = isFeatureEnabled("tournaments");

  return (
    <div className="page">
      <div className="shell">
        <Routes>
          {tournamentsEnabled ? (
            <>
              <Route path="/" element={<TournamentsPage />} />
              <Route path="/tournaments" element={<Navigate to="/" replace />} />
              <Route path="/tournaments/:id" element={<Navigate to="/" replace />} />
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
    <BrowserRouter basename={import.meta.env.PROD ? "/scibowl-org" : ""}>
      <AppContent />
    </BrowserRouter>
  );
}

export default App;
