import React, { useState } from 'react';
import axios from 'axios';

const Search = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    try {
      const response = await axios.post(
        'http://your-api-gateway-url/package/byRegEx',
        { RegEx: query },
        { headers: { 'X-Authorization': 'your_token_here' } }
      );
      setResults(response.data);
      setError(null);
    } catch (err) {
      setError(err.message);
      setResults([]);
    }
  };

  return (
    <div className="container">
      <h1>Search Packages</h1>
      <div className="mb-3">
        <input
          type="text"
          className="form-control"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Enter package name or regex"
        />
      </div>
      <button onClick={handleSearch} className="btn btn-primary">Search</button>
      {error && <p className="text-danger mt-3">Error: {error}</p>}
      <ul className="mt-3">
        {results.map(pkg => (
          <li key={pkg.ID}>
            {pkg.Name} - {pkg.Version}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Search;
