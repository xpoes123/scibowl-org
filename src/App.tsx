import "./App.css";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate
} from "react-router-dom";
import { DatabasePage } from "./pages/QuestionsPage";
import { PracticePage } from "./pages/PracticePage";

function App() {
  return (
    <BrowserRouter>
      <nav
        style={{
          display: "flex",
          gap: "12px",
          padding: "12px 16px",
          borderBottom: "1px solid #ddd",
          marginBottom: "16px",
        }}>
          <Link to="/database">Database</Link>
          <Link to="/practice">Practice</Link>
        </nav>

        <Routes>
          <Route path="/database" element={<DatabasePage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="*" element={<Navigate to="/questions" replace />} />
        </Routes>
    </BrowserRouter>
  );
}

export default App;