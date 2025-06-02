import React, { useState, useEffect } from 'react';
import { FiSun, FiMoon } from 'react-icons/fi';
import logo from '../../images/logo.png';

export default function Navbar({ toggleSidebar, toggleAbout, toggleInfo }) {
  const [theme, setTheme] = useState(
    localStorage.getItem('theme') || 'dark'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
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
