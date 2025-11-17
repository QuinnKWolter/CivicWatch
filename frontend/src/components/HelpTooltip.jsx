import PropTypes from 'prop-types';
import { FaQuestionCircle } from 'react-icons/fa';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';

/**
 * A reusable help icon with a tooltip.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.content - The content to display inside the tooltip (string or JSX).
 * @param {string} [props.placement='top'] - The placement of the tooltip.
 * @param {string} [props.className] - Optional additional class names for the container.
 */
function HelpTooltip({ content, placement = 'top', className = '' }) {
  // Return null if there's no content to display
  if (!content) {
    return null;
  }

  return (
    <div className={`inline-block ${className}`}>
      <Tippy
        content={
          <div className="px-4 py-3 max-w-xs text-sm rounded-xl shadow-2xl backdrop-blur-md text-white" style={{
            background: 'linear-gradient(135deg, rgba(55, 65, 81, 0.95), rgba(31, 41, 55, 0.95))',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}>
            {content}
          </div>
        }
        allowHTML={true}
        animation="scale-subtle"
        placement={placement}
        arrow={true}
        duration={[200, 150]}
        delay={[100, 0]}
      >
        <span className="cursor-help text-base-content/50 hover:text-base-content/80">
          <FaQuestionCircle />
        </span>
      </Tippy>
    </div>
  );
}

HelpTooltip.propTypes = {
  content: PropTypes.node.isRequired,
  placement: PropTypes.string,
  className: PropTypes.string,
};

export default HelpTooltip;