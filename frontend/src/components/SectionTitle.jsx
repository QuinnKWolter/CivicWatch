import React from 'react';
import PropTypes from 'prop-types';
import HelpTooltip from './HelpTooltip'; // Adjust the import path as needed

/**
 * A section header with an icon, title, and an optional help tooltip on the right.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.icon - The icon to display before the title.
 * @param {string} props.text - The title text.
 * @param {React.ReactNode} [props.helpContent] - The content for the help tooltip. If provided, a help icon will be displayed.
 */
function SectionTitle({ icon, text, helpContent }) {
  return (
    <div className="flex justify-between items-center w-full mb-2">
      <h2 className="text-lg flex items-center font-bold">
        <span className="mr-2">{icon}</span>
        {text}
      </h2>
      {helpContent && <HelpTooltip content={helpContent} />}
    </div>
  );
}

SectionTitle.propTypes = {
  icon: PropTypes.node.isRequired,
  text: PropTypes.string.isRequired,
  helpContent: PropTypes.node,
};

export default SectionTitle;