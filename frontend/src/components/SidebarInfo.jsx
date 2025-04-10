import React from 'react';
import { FaTimes, FaChartBar, FaBalanceScale, FaExclamationTriangle } from 'react-icons/fa';
import { BsInfoCircleFill, BsGraphUp, BsQuestionCircle } from 'react-icons/bs';
import { IoMdSettings } from 'react-icons/io';

const SidebarInfo = ({ infoOpen, toggleInfo }) => {
  const terms = [
    {
      term: "Civility Score",
      definition: "A binary indicator, representing the degree of civility in online discourse, with 0 denoting and 1 indicating toxicity below and above the threshold of 0.86 for a given tweet's text through Python's Detoxifier library."
    },
    {
      term: "Misinformation Index",
      definition: "A binary indicator, derived from the presence or absence of links to documented manipulative domains within tweets, used to assess the inclusion of false or misleading content in political communications."
    },
    {
      term: "Bipartite Flow",
      definition: "A visualization showing the connections between legislators and the topics they discuss."
    }
  ];

  return (
    <div className={`fixed top-16 h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out z-30
      ${infoOpen ? 'left-0' : '-left-64'}`}
    >
      <div className="w-64 h-full bg-base-200 shadow-xl overflow-y-auto">
        <div className="p-4 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-accent">
              <BsInfoCircleFill className="inline-block mr-2" />
              Project Info
            </h2>
            <button 
              onClick={toggleInfo}
              className="btn btn-circle btn-sm btn-ghost"
              aria-label="Close info panel"
            >
              <FaTimes />
            </button>
          </div>

          <div className="divider"></div>
          
          <div className="prose">
            <p className="text-sm">
              CivicWatch provides data-driven insights into civic discourse, helping users understand political communication patterns and identify trends in topics, civility, and information quality.
            </p>
          </div>

          <div className="card bg-base-300 shadow-md">
            <div className="card-body p-4">
              <h3 className="card-title flex items-center text-md">
                <BsQuestionCircle className="mr-2" /> Key Terms
              </h3>
              <div className="space-y-3">
                {terms.map((item, idx) => (
                  <div key={idx} className="collapse collapse-arrow bg-base-200">
                    <input type="checkbox" /> 
                    <div className="collapse-title text-sm font-semibold py-2">
                      {item.term}
                    </div>
                    <div className="collapse-content text-xs">
                      <p>{item.definition}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card bg-base-300 shadow-md">
            <div className="card-body p-3">
            <h3 className="card-title flex items-center text-md">
                <IoMdSettings className="mr-2" /> Data Range
              </h3>
              <div className="flex items-center text-sm">
                January 1st, 2020 - December 31st, 2021
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SidebarInfo; 