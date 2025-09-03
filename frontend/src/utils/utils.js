// Import necessary icons
import { FaHospitalUser, FaFistRaised, FaLeaf, FaVirus, FaBalanceScale, FaGlobe } from 'react-icons/fa';
import { GiCapitol, GiBrickWall, GiPistolGun } from 'react-icons/gi';

// Export topic icons as components
export const topicIcons = {
  all: FaGlobe,
  capitol: GiCapitol,
  immigra: GiBrickWall,
  abortion: FaHospitalUser,
  blacklivesmatter: FaFistRaised,
  climate: FaLeaf,
  gun: GiPistolGun,
  rights: FaBalanceScale,
  covid: FaVirus
};

// Export color map with accessible color scheme (no party differentiation)
export const colorMap = {
  capitol:          { color: '#3B82F6' }, // Blue
  immigra:          { color: '#10B981' }, // Green
  abortion:         { color: '#F59E0B' }, // Amber
  blacklivesmatter: { color: '#EF4444' }, // Red
  climate:          { color: '#8B5CF6' }, // Purple
  gun:              { color: '#F97316' }, // Orange
  rights:           { color: '#06B6D4' }, // Cyan
  covid:            { color: '#84CC16' }  // Lime
};

// Topic name mapping for display
export const topicNames = {
  capitol: 'Capitol',
  immigra: 'Immigration',
  abortion: 'Abortion',
  blacklivesmatter: 'Black Lives Matter',
  climate: 'Climate Change',
  gun: 'Gun Rights',
  rights: 'Civil Rights',
  covid: 'COVID-19'
};

// Function to format numbers with optional decimal truncation
export const formatNumber = (num) => {
  if (num >= 1000000) {
    const formatted = (num / 1000000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.round(num / 1000000)}M` : `${formatted}M`;
  }
  if (num >= 1000) {
    const formatted = (num / 1000).toFixed(1);
    return formatted.endsWith('.0') ? `${Math.round(num / 1000)}K` : `${formatted}K`;
  }
  return num.toString();
}; 