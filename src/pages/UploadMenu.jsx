import DocumentUploadForm from "../../components/DocumentUploadForm";

function UploadMenu() {
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

export default UploadMenu;
