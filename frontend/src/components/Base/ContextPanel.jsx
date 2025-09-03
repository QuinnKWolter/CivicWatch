import React from 'react';
import PropTypes from 'prop-types';
import TimelineContext from './TimelineContext';
import LegislatorContext from '../LegislatorContext';

export default function ContextPanel({
  startDate,
  endDate,
  selectedTopics,
  keyword,
  legislator,
  setLegislator,
  activeTopics
}) {
  // If a legislator is selected, show the legislator context
  if (legislator) {
    return (
      <LegislatorContext
        legislator={legislator}
        setLegislator={setLegislator}
        startDate={startDate}
        endDate={endDate}
        selectedTopics={selectedTopics}
        keyword={keyword}
        activeTopics={activeTopics}
      />
    );
  }

  // Otherwise show the timeline context
  return (
    <TimelineContext
      startDate={startDate}
      endDate={endDate}
      selectedTopics={selectedTopics}
      keyword={keyword}
      setLegislator={setLegislator}
      activeTopics={activeTopics}
    />
  );
}

ContextPanel.propTypes = {
  startDate: PropTypes.object.isRequired,
  endDate: PropTypes.object.isRequired,
  selectedTopics: PropTypes.arrayOf(PropTypes.string).isRequired,
  keyword: PropTypes.string,
  legislator: PropTypes.object,
  setLegislator: PropTypes.func.isRequired,
  activeTopics: PropTypes.arrayOf(PropTypes.string).isRequired
};
