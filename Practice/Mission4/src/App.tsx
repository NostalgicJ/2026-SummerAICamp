import { Route, Routes } from "react-router-dom";
import SetListPage from "./pages/SetListPage";
import SettingsPage from "./pages/SettingsPage";
import StudyPage from "./pages/StudyPage";
import "./App.css";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SetListPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/study/:setId" element={<StudyPage />} />
    </Routes>
  );
}
