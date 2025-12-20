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
import { ProfilePage, AvatarPreviewPage, Avatar } from "./features/profile";
import { AuthProvider, useAuth, LoginModal, SignupModal } from "./features/auth";
import { StudyPage, FlashcardPracticePage, ReadingPracticePage } from "./features/study";
import { TournamentsPage } from "./features/tournaments";
import { CoachingPage } from "./features/coaching";
import { MultiplayerPage } from "./features/multiplayer";
import { SocialPage } from "./features/social";
import { HomePage } from "./pages/HomePage";

function AppContent() {
  const { user, logout, loading } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex">
      {/* Sidebar */}
      <div
        className={`bg-slate-900/50 border-r border-purple-500/30 flex flex-col transition-all duration-300 ${
          sidebarCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        <div className="p-6 flex items-center justify-between">
          {!sidebarCollapsed ? (
            <Link to="/" className="flex items-center gap-3">
              <img src="/logo_big.png" alt="SciBowl" className="w-8 h-8" />
              <span className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-purple-200 bg-clip-text text-transparent">
                SciBowl
              </span>
            </Link>
          ) : (
            <Link to="/" className="flex items-center justify-center w-full">
              <img src="/logo_big.png" alt="SciBowl" className="w-8 h-8" />
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className={`p-2 rounded-lg hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-purple-300 ${sidebarCollapsed ? 'hidden' : ''}`}
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {sidebarCollapsed ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              )}
            </svg>
          </button>
        </div>

        <nav className="flex-1 px-3">
          <Link
            to="/study"
            className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-purple-300 transition-colors"
            title="Study"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            {!sidebarCollapsed && <span>Study</span>}
          </Link>
          <Link
            to="/multiplayer"
            className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-purple-300 transition-colors"
            title="Multiplayer"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            {!sidebarCollapsed && <span>Multiplayer</span>}
          </Link>
          <Link
            to="/tournaments"
            className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-purple-300 transition-colors"
            title="Tournaments"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            {!sidebarCollapsed && <span>Tournaments</span>}
          </Link>
          <Link
            to="/social"
            className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-purple-300 transition-colors"
            title="Social"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            {!sidebarCollapsed && <span>Social</span>}
          </Link>
          <Link
            to="/coaching"
            className="flex items-center gap-3 px-4 py-3 mb-1 rounded-lg text-slate-300 hover:bg-slate-800/50 hover:text-purple-300 transition-colors"
            title="Coaching"
          >
            <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
            {!sidebarCollapsed && <span>Coaching</span>}
          </Link>
        </nav>

        {!loading && (
          <div className="p-3 border-t border-purple-500/20">
            {user ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-800/50 transition-colors ${
                    sidebarCollapsed ? 'justify-center' : ''
                  }`}
                  title={user.username}
                >
                  <Avatar username={user.username} size={32} />
                  {!sidebarCollapsed && <span className="text-slate-300 text-sm truncate">{user.username}</span>}
                </button>

                {showDropdown && (
                  <div className={`absolute bottom-full mb-2 bg-slate-800 border border-purple-500/30 rounded-lg shadow-lg overflow-hidden ${
                    sidebarCollapsed ? 'left-0' : 'left-0 right-0'
                  }`}>
                    <button
                      onClick={handleProfileClick}
                      className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700 hover:text-purple-300 transition-colors whitespace-nowrap"
                    >
                      Profile
                    </button>
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-3 text-left text-slate-300 hover:bg-slate-700 hover:text-purple-300 transition-colors border-t border-purple-500/20 whitespace-nowrap"
                    >
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {sidebarCollapsed ? (
                  <>
                    <button
                      onClick={() => setShowLoginModal(true)}
                      className="w-full px-4 py-2 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
                      title="Login"
                    >
                      <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setShowSignupModal(true)}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                      title="Sign Up"
                    >
                      <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setShowLoginModal(true)}
                      className="w-full px-4 py-2 text-slate-300 hover:bg-slate-800/50 rounded-lg transition-colors"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => setShowSignupModal(true)}
                      className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/study" element={<StudyPage />} />
          <Route path="/multiplayer" element={<MultiplayerPage />} />
          <Route path="/tournaments" element={<TournamentsPage />} />
          <Route path="/social" element={<SocialPage />} />
          <Route path="/coaching" element={<CoachingPage />} />
          <Route path="/database" element={<DatabasePage />} />
          <Route path="/study/flashcard" element={<FlashcardPracticePage />} />
          <Route path="/study/reading" element={<ReadingPracticePage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/avatars" element={<AvatarPreviewPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

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
