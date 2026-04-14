import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastContainer } from "./components/Toast";
import { HomePage } from "./pages/HomePage";
import { SubjectPage } from "./pages/SubjectPage";
import { ChallengePage } from "./pages/ChallengePage";
import { AgenticChallengePage } from "./pages/AgenticChallengePage";
import { AgenticHomePage } from "./pages/AgenticHomePage";
import { AgenticPracticePage } from "./pages/AgenticPracticePage";
import "./App.css";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/subjects/:subjectId" element={<SubjectPage />} />
          <Route path="/challenge/:challengeId" element={<ChallengePage />} />
          <Route path="/challenge/topic/:topicId" element={<ChallengePage />} />
          <Route
            path="/challenge/subject/:subjectId"
            element={<ChallengePage />}
          />
          {/* Agentic (Prompt Engineering) routes */}
          <Route path="/agentic" element={<AgenticHomePage />} />
          <Route
            path="/agentic/practice/:lessonId"
            element={<AgenticPracticePage />}
          />
          <Route
            path="/agentic-challenge/:challengeId"
            element={<AgenticChallengePage />}
          />
        </Routes>
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
