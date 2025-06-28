import React, { useState, useEffect } from 'react';
import { FiSun, FiMoon, FiDownload } from 'react-icons/fi';
import PropTypes from 'prop-types';
import logo from '../../images/logo.png';

export default function Navbar({ 
  toggleSidebar, 
  toggleAbout, 
  toggleInfo, 
  startDate,
  endDate,
  topics,
  keyword,
  legislator
}) {
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'dark'
  );
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };
  
  const handleExportCSV = async () => {
  
    if (isExporting) return;
    
    setIsExporting(true);
    
    
    const params = new URLSearchParams();
    
    if (startDate && typeof startDate.format === 'function') {
      params.append('start_date', startDate.format('YYYY-MM-DD'));
    }
    
    if (endDate && typeof endDate.format === 'function') {
      params.append('end_date', endDate.format('YYYY-MM-DD'));
    }
    
    if (topics && Array.isArray(topics) && topics.length > 0) {
      params.append('topics', topics.join(','));
    }
    
    if (keyword) {
      params.append('keyword', keyword);
    }
    
    if (legislator?.name) {
      params.append('legislator', legislator.name);
    }
    
    
    const exportUrl = `/api/export-posts-csv/?${params.toString()}`;
    
    try {
     
      const response = await fetch(exportUrl);
      
      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`);
      }
      
    
      const blob = await response.blob();
      
     
      const url = window.URL.createObjectURL(blob);
      
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `civicwatch_export_${new Date().toISOString().slice(0, 10)}.csv`;
      
     
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
   
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again later.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <header className="bg-base-200 text-base-content shadow-md fixed top-0 inset-x-0 z-10 transition-all duration-300">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        <div className="flex items-center">
          <img src={logo} alt="CivicWatch Logo" className="h-8 w-8 mr-2" />
          <h1 className="text-xl font-bold hover:text-primary transition-colors duration-300">
            CivicWatch
          </h1>
        </div>
        <nav className="flex items-center space-x-4">
          <button
            onClick={handleExportCSV}
            className="flex items-center hover:text-primary transition-colors duration-300"
            title="Export data as CSV"
            disabled={isExporting}
          >
            <FiDownload className="mr-1" /> 
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>
          <button
            onClick={toggleAbout}
            className="hover:text-primary transition-colors duration-300"
          >
            About
          </button>
          <button
            onClick={toggleInfo}
            className="hover:text-primary transition-colors duration-300"
          >
            Info
          </button>
          <button
            onClick={toggleSidebar}
            className="hover:text-primary transition-colors duration-300"
          >
            Settings
          </button>
          <label className="swap swap-rotate ml-4 cursor-pointer">
            <input
              type="checkbox"
              onChange={toggleTheme}
              checked={theme === 'dark'}
            />
            <FiSun className="swap-on w-6 h-6" />
            <FiMoon className="swap-off w-6 h-6" />
          </label>
        </nav>
      </div>
    </header>
  );
}


Navbar.propTypes = {
  toggleSidebar: PropTypes.func.isRequired,
  toggleAbout: PropTypes.func.isRequired,
  toggleInfo: PropTypes.func.isRequired,
  startDate: PropTypes.object,
  endDate: PropTypes.object,
  topics: PropTypes.array,
  keyword: PropTypes.string,
  legislator: PropTypes.object
};
