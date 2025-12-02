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
    <BrowserRouter basename="/scibowl-org">
      <nav className="sticky top-0 z-50 flex items-center gap-6 px-6 py-4 border-b border-[#7d70f1]/30 bg-gradient-to-r from-slate-900/90 to-slate-800/90 backdrop-blur-lg shadow-lg shadow-[#7d70f1]/10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#7d70f1] to-[#b4a8ff] bg-clip-text text-transparent mr-auto">
          SciBowl
        </h1>
        <Link
          to="/database"
          className="text-slate-300 hover:text-[#b4a8ff] font-medium transition-all duration-200 hover:scale-105 transform"
        >
          Database
        </Link>
        <Link
          to="/practice"
          className="text-slate-300 hover:text-[#b4a8ff] font-medium transition-all duration-200 hover:scale-105 transform"
        >
          Practice
        </Link>
      </nav>

      <Routes>
        <Route path="/database" element={<DatabasePage />} />
        <Route path="/practice" element={<PracticePage />} />
        <Route path="*" element={<Navigate to="/practice" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
