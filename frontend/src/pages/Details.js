import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from './utils/apiClientHelper';



const Details = () => {
  const { id } = useParams();
  const [packageDetails, setPackageDetails] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPackageDetails = async () => {
      try {
        await apiClient.authenticate(); // Ensure authentication
        const response = await apiClient.get(`/package/${id}`);
        setPackageDetails(response.data);
      } catch (err) {
        setError(err.message);
      }
    };
  
    fetchPackageDetails();
  }, [id]);
  

  return (
    <div className="container">
      <h1>Package Details</h1>
      {error && <p className="text-danger">{error}</p>}
      {packageDetails ? (
        <div>
          <h2>{packageDetails.metadata.Name} ({packageDetails.metadata.Version})</h2>
          <pre>{packageDetails.data.Content}</pre>
        </div>
      ) : (
        <p>Loading...</p>
      )}
    </div>
  );
};

export default Details;
