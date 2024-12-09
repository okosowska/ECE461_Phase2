import React, { useState, useEffect } from 'react';
import axios from 'axios';

const Dashboard = () => {
  const [packages, setPackages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios
      .post(
        'https://2uylc3v1a8.execute-api.us-east-2.amazonaws.com/Prod/',
        { Name: '*' }, // Query to fetch all packages
        { headers: { 'X-Authorization': 'your_token_here' } }
      )
      .then(response => setPackages(response.data))
      .catch(err => {
        console.error('Error:', err); // Log the entire error object
        setError(err.message);
      });
  }, []);

  return (
    <div className="container">
      <h1>Package Dashboard</h1>
      {error && <p className="text-danger">Error: {error}</p>}
      <table className="table table-bordered">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Version</th>
          </tr>
        </thead>
        <tbody>
          {packages.map(pkg => (
            <tr key={pkg.ID}>
              <td>{pkg.ID}</td>
              <td>{pkg.Name}</td>
              <td>{pkg.Version}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
};

export default Dashboard;
