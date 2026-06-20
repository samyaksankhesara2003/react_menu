import DocumentUploadForm from "../components/DocumentUploadForm";
import "./App.css";

function App() {
  return (
    <div className="app">
      <div className="app-header">
        <h1>Document Manager</h1>
        <p>Upload your PDF or DOCX files securely</p>
      </div>
      <DocumentUploadForm />
    </div>
  );
}

export default App;
