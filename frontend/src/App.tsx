import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
} from "react-router-dom";
import { DatabasePage } from "./pages/QuestionsPage";
import { PracticePage } from "./pages/PracticePage";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.PROD ? "/scibowl-org" : ""}>
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
        </nav>

        <Routes>
          <Route path="/database" element={<DatabasePage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="*" element={<Navigate to="/practice" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
