import { Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import UploadMenu from "./pages/UploadMenu";
import Conversation from "./pages/Conversation";
import "./App.css";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/upload-menu" element={<UploadMenu />} />
      <Route path="/conversation" element={<Conversation />} />
    </Routes>
  );
}

export default App;
