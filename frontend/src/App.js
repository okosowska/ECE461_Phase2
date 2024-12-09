import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Upload from './pages/Upload';
import Search from './pages/Search';
import Details from './pages/Details';

const App = () => {
  return (
    <Router>
      <nav>
        <Link to="/">Dashboard</Link> | <Link to="/upload">Upload</Link> | <Link to="/search">Search</Link>
      </nav>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/search" element={<Search />} />
        <Route path="/package/:id" element={<Details />} />
      </Routes>
    </Router>
  );
};

export default App;
