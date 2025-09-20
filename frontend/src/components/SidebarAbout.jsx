import React from 'react';
import { FaTimes, FaGithub, FaTwitter, FaLinkedin } from 'react-icons/fa';
import { BsPeopleFill, BsLightbulbFill } from 'react-icons/bs';
import { MdOutlineWavingHand } from 'react-icons/md';

const SidebarAbout = ({ aboutOpen, toggleAbout }) => {
  const teamMembers = [
    { 
      name: "Quinn K Wolter", 
      role: "Lead Developer",
      social: { github: "https://github.com/QuinnKWolter", linkedin: "https://www.linkedin.com/in/quinn-k-wolter-4b68bb8b/" }
    },
    { 
      name: "Radhika Purohit", 
      role: "Backend Developer",
      social: { github: "https://github.com/Radhika710", linkedin: "https://www.linkedin.com/in/radhika-purohit/" }
    },
    { 
      name: "Chase Lahner", 
      role: "Frontend Developer",
      social: { github: "https://github.com/chase-lahner", linkedin: "https://www.linkedin.com/in/chase-lahner/" }
    }
  ];

  const advisors = [
    { name: "Dr. Yu-ru Lin", title: "Research Advisor" },
    { name: "Ahana Biswas", title: "Data Expert" },
    { name: "Dr. Yongsu Ahn", title: "Data Expert" }
  ];

  return (
    <div className={`fixed top-16 h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out z-30
      ${aboutOpen ? 'left-0' : '-left-64'}`}
    >
      <div className="w-64 h-full bg-base-200 shadow-xl overflow-y-auto">
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-primary">
              <MdOutlineWavingHand className="inline-block mr-2" />
              About Us
            </h2>
            <button 
              onClick={toggleAbout}
              className="btn btn-circle btn-sm btn-ghost"
              aria-label="Close about panel"
            >
              <FaTimes />
            </button>
          </div>

          <div className="divider"></div>
          
          <div className="prose">
            <p className="text-sm">
              CivicWatch is a visual analytics platform dedicated to bringing transparency to political discourse and civic engagement through data visualization and analysis.
            </p>
          </div>

          <div className="card bg-base-300 shadow-md">
            <div className="card-body p-4">
              <h3 className="card-title flex items-center text-md">
                <BsPeopleFill className="mr-2" /> Our Team
              </h3>
              <div className="space-y-3">
                {teamMembers.map((member, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="font-semibold">{member.name}</span>
                    <span className="text-xs opacity-70">{member.role}</span>
                    <span className="flex mt-1 space-x-2">
                      <a href={member.social.github} className="text-xs hover:text-primary" target="_blank" rel="noopener noreferrer">
                        <FaGithub />
                      </a>
                      <a href={member.social.linkedin} className="text-xs hover:text-primary" target="_blank" rel="noopener noreferrer">
                        <FaLinkedin />
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card bg-base-300 shadow-md">
            <div className="card-body p-4">
              <h3 className="card-title flex items-center text-md">
                <BsLightbulbFill className="mr-2" /> Advisors
              </h3>
              <div className="space-y-2">
                {advisors.map((advisor, idx) => (
                  <div key={idx}>
                    <span className="font-semibold">{advisor.name}</span>
                    <p className="text-xs opacity-70">{advisor.title}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarAbout; 