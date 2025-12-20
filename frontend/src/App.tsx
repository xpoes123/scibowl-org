import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";
import { useState } from "react";
import { DatabasePage } from "./pages/QuestionsPage";
import { PracticePage } from "./pages/PracticePage";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { LoginModal } from "./components/LoginModal";
import { SignupModal } from "./components/SignupModal";

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  const handleSwitchToSignup = () => {
    setShowLoginModal(false);
    setShowSignupModal(true);
  };

  const handleSwitchToLogin = () => {
    setShowSignupModal(false);
    setShowLoginModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <nav className="sticky top-0 z-50 flex items-center gap-6 px-6 py-4 border-b border-purple-500/30 bg-slate-900/90 backdrop-blur-lg shadow-lg shadow-purple-500/10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent mr-auto">
          SciBowl
        </h1>
        <Link
          to="/database"
          className="text-slate-300 hover:text-purple-300 font-medium transition-all duration-200 hover:scale-105 transform"
        >
          Database
        </Link>
        <Link
          to="/practice"
          className="text-slate-300 hover:text-purple-300 font-medium transition-all duration-200 hover:scale-105 transform"
        >
          Practice
        </Link>

        {!loading && (
          <>
            {user ? (
              <div className="flex items-center gap-4">
                <span className="text-slate-300">
                  Welcome, <span className="text-purple-400 font-medium">{user.username}</span>
                </span>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded transition-colors"
                >
                  Logout
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="px-4 py-2 text-slate-300 hover:text-purple-300 font-medium transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => setShowSignupModal(true)}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-500 text-white font-medium rounded hover:from-purple-700 hover:to-purple-600 transition-all"
                >
                  Sign Up
                </button>
              </div>
            )}
          </>
        )}
      </nav>

      <Routes>
        <Route path="/database" element={<DatabasePage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="*" element={<Navigate to="/practice" replace />} />
      </Routes>

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSwitchToSignup={handleSwitchToSignup}
      />
      <SignupModal
        isOpen={showSignupModal}
        onClose={() => setShowSignupModal(false)}
        onSwitchToLogin={handleSwitchToLogin}
      />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.PROD ? "/scibowl-org" : ""}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
