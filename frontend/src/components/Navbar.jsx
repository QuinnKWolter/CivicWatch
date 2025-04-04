import React, { useState, useEffect } from 'react';

function Navbar({ toggleSidebar }) {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'light' ? 'dark' : 'light');
  };

  const toggleModal = () => {
    setIsModalOpen(!isModalOpen);
  };

  return (
    <header className="bg-base-200 text-base-content p-4 fixed top-0 left-0 right-0 z-10 shadow-md transition-all duration-300">
      <div className="container mx-auto flex justify-between items-center">
        <div className="text-xl font-bold hover:text-primary transition-colors duration-300">CivicWatch</div>
        <nav className="flex items-center space-x-4">
          <button
            onClick={toggleModal}
            className="text-base-content relative transition-colors duration-300"
          >
            About
          </button>
          <button
            onClick={toggleSidebar}
            className="text-base-content relative transition-colors duration-300"
          >
            Settings
          </button>
          <label className="swap swap-rotate ml-4" style={{ width: '30px', height: '30px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <input type="checkbox" onChange={toggleTheme} checked={theme === 'dark'} />

            {/* Sun icon */}
            <svg
              className={`swap-off fill-current w-8 h-8 ${theme === 'light' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            >
              <path d="M5.64,17l-.71.71a1,1,0,0,0,0,1.41,1,1,0,0,0,1.41,0l.71-.71A1,1,0,0,0,5.64,17ZM5,12a1,1,0,0,0-1-1H3a1,1,0,0,0,0,2H4A1,1,0,0,0,5,12Zm7-7a1,1,0,0,0,1-1V3a1,1,0,0,0-2,0V4A1,1,0,0,0,12,5ZM5.64,7.05a1,1,0,0,0,.7.29,1,1,0,0,0,.71-.29,1,1,0,0,0,0-1.41l-.71-.71A1,1,0,0,0,4.93,6.34Zm12,.29a1,1,0,0,0,.7-.29l.71-.71a1,1,0,1,0-1.41-1.41L17,5.64a1,1,0,0,0,0,1.41A1,1,0,0,0,17.66,7.34ZM21,11H20a1,1,0,0,0,0,2h1a1,1,0,0,0,0-2Zm-9,8a1,1,0,0,0-1,1v1a1,1,0,0,0,2,0V20A1,1,0,0,0,12,19ZM18.36,17A1,1,0,0,0,17,18.36l.71.71a1,1,0,0,0,1.41,0,1,1,0,0,0,0-1.41ZM12,6.5A5.5,5.5,0,1,0,17.5,12,5.51,5.51,0,0,0,12,6.5Zm0,9A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z" />
            </svg>

            {/* Moon icon */}
            <svg
              className={`swap-on fill-current w-8 h-8 ${theme === 'dark' ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }}
            >
              <path d="M21.64,13a1,1,0,0,0-1.05-.14,8.05,8.05,0,0,1-3.37.73A8.15,8.15,0,0,1,9.08,5.49a8.59,8.59,0,0,1,.25-2A1,1,0,0,0,8,2.36,10.14,10.14,0,1,0,22,14.05,1,1,0,0,0,21.64,13Zm-9.5,6.69A8.14,8.14,0,0,1,7.08,5.22v.27A10.15,10.15,0,0,0,17.22,15.63a9.79,9.79,0,0,0,2.1-.22A8.11,8.11,0,0,1,12.14,19.73Z" />
            </svg>
          </label>
        </nav>
      </div>

      {/* About Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-base-100 text-base-content p-8 rounded-lg shadow-2xl w-11/12 max-w-lg mx-auto">
            <h2 className="text-3xl font-bold mb-6 text-center">About CivicWatch</h2>
            <p className="mb-6 text-center">CivicWatch is a platform dedicated to monitoring and analyzing civic engagement and political discourse.</p>
            <div className="mb-6">
              <h3 className="text-2xl font-semibold mb-2">Developers</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Lead Developer: Quinn K Wolter</li>
                <li>Lead Backend Developer: Radhita Purohit</li>
                <li>Lead Frontend Developer: Chase Lahner</li>
              </ul>
            </div>
            <div className="mb-6">
              <h3 className="text-2xl font-semibold mb-2">Advisors</h3>
              <ul className="list-disc list-inside space-y-1">
                <li>Dr. Yu-ru Lin</li>
                <li>Ahana Biswas</li>
                <li>Dr. Yongsu Ahn</li>
              </ul>
            </div>
            <div className="flex justify-center">
              <button
                onClick={toggleModal}
                className="bg-primary text-primary-content py-2 px-6 rounded-full hover:bg-primary-focus transition-colors duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

export default Navbar; 