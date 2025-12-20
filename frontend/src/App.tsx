import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { QuestionsPage as DatabasePage } from "./features/questions";
import { PracticePage } from "./features/practice";
import { ProfilePage, AvatarPreviewPage, Avatar } from "./features/profile";
import { AuthProvider, useAuth, LoginModal, SignupModal } from "./features/auth";

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleSwitchToSignup = () => {
    setShowLoginModal(false);
    setShowSignupModal(true);
  };

  const handleSwitchToLogin = () => {
    setShowSignupModal(false);
    setShowLoginModal(true);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  const handleProfileClick = () => {
    setShowDropdown(false);
    navigate("/profile");
  };

  const handleLogout = () => {
    setShowDropdown(false);
    logout();
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
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center hover:opacity-80 transition-opacity"
                >
                  <Avatar username={user.username} size={40} />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-48 bg-slate-800 border border-purple-500/30 rounded-lg shadow-lg shadow-purple-500/10 overflow-hidden">
                    <button
                      onClick={handleProfileClick}
                      className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700 hover:text-purple-300 transition-colors"
                    >
                      Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700 hover:text-purple-300 transition-colors border-t border-purple-500/20"
                    >
                      Logout
                    </button>
                  </div>
                )}
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
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/avatars" element={<AvatarPreviewPage />} />
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
