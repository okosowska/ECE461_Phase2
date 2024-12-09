import React, { useState, useEffect } from 'react';
import apiClient from './utils/apiClientHelper';


const Dashboard = () => {
  const [packages, setPackages] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPackages = async () => {
      try {
        await apiClient.authenticate();
        const response = await apiClient.post('/packages', { Name: '*' });
        setPackages(response.data);
      } catch (err) {
        setError(err.message);
      }
    };

    fetchPackages();
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
