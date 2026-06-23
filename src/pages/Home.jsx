import { useNavigate } from "react-router-dom";

function Home() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <div className="app-header">
        <h1>Document Manager</h1>
        <p>Manage your documents and conversations</p>
      </div>
      <div className="home-actions">
        <button onClick={() => navigate("/upload-menu")}>Go to upload menu</button>
        <button onClick={() => navigate("/conversation")}>Start conversation</button>
      </div>
    </div>
  );
}

export default Home;
