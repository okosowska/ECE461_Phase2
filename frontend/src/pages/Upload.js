import React, { useState } from 'react';
import apiClient from './utils/apiClientHelper';


const Upload = () => {
  const [name, setName] = useState('');
  const [version, setVersion] = useState('');
  const [content, setContent] = useState(null);
  const [message, setMessage] = useState('');

  const handleSubmit = async e => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('Name', name);
    formData.append('Version', version);
    formData.append('Content', content);

    try {
      await apiClient.authenticate();
      const response = await apiClient.post('/package', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(`Package ${response.data.metadata.Name} uploaded successfully!`);
    } catch (err) {
      setMessage(`Error: ${err.response?.data?.message || err.message}`);
    }
  };

  return (
    <div className="container">
      <h1>Upload Package</h1>
      <form onSubmit={handleSubmit}>
        <div className="mb-3">
          <label className="form-label">Package Name</label>
          <input
            type="text"
            className="form-control"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Version</label>
          <input
            type="text"
            className="form-control"
            value={version}
            onChange={e => setVersion(e.target.value)}
            required
          />
        </div>
        <div className="mb-3">
          <label className="form-label">Package Content (ZIP File)</label>
          <input
            type="file"
            className="form-control"
            onChange={e => setContent(e.target.files[0])}
            required
          />
        </div>
        <button type="submit" className="btn btn-primary">Upload</button>
      </form>
      {message && <p className="mt-3">{message}</p>}
    </div>
  );
};

export default Upload;
