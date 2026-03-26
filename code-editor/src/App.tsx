import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastContainer } from "./components/Toast";
import { HomePage } from "./pages/HomePage";
import { SubjectPage } from "./pages/SubjectPage";
import { ChallengePage } from "./pages/ChallengePage";
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
        </Routes>
        <ToastContainer />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
