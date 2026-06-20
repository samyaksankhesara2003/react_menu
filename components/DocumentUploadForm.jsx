import React, { useState } from "react";
import styles from "./DocumentUploadForm.module.css";

function DocumentUploadForm() {
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];

    if (!selectedFile) return;

    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    if (!allowedTypes.includes(selectedFile.type)) {
      setError("Only PDF and DOCX files are allowed.");
      setFile(null);
      return;
    }

    setError("");
    setFile(selectedFile);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!file) {
      alert("Please select a document.");
      return;
    }

    const formData = new FormData();
    formData.append("document", file);

    // Example API call
    // fetch("/api/upload", {
    //   method: "POST",
    //   body: formData,
    // });

    console.log("Uploading:", file.name);
  };

  return (
    <form onSubmit={handleSubmit} className={styles.container}>
      <p className={styles.title}>Upload Document</p>

      <div className={styles.dropzone}>
        <input
          type="file"
          id="document"
          accept=".pdf,.docx"
          onChange={handleFileChange}
        />
        <span className={styles.uploadIcon}>📄</span>
        <p className={styles.dropzoneText}>Click to browse or drag & drop</p>
        <p className={styles.dropzoneHint}>Supported formats: PDF, DOCX</p>
      </div>

      {file && (
        <div className={styles.fileInfo}>
          <span className={styles.fileIcon}>✅</span>
          <span className={styles.fileName}>{file.name}</span>
        </div>
      )}

      {error && (
        <div className={styles.error}>
          <span>⚠️</span>
          {error}
        </div>
      )}

      <button type="submit" className={styles.submitBtn} disabled={!file}>
        Upload Document
      </button>
    </form>
  );
}

export default DocumentUploadForm;