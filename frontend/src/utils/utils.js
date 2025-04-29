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

// Export color map with new color scheme
export const colorMap = {
  capitol:          { D: '#b2ebf2', R: '#ffe0b2' }, // very light
  immigra:          { D: '#81deea', R: '#ffcc80' },
  abortion:         { D: '#4dd0e1', R: '#ffb74d' },
  blacklivesmatter: { D: '#26c6da', R: '#ffa726' },
  climate:          { D: '#00acc1', R: '#ff9800' },
  gun:              { D: '#00838f', R: '#fb8c00' },
  rights:           { D: '#006064', R: '#ef6c00' },
  covid:            { D: '#004d40', R: '#e65100' }  // darkest
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