// Import necessary icons
import { FaHospitalUser, FaFistRaised, FaLeaf, FaVirus, FaBalanceScale, FaGlobe } from 'react-icons/fa';
import { GiCapitol, GiBrickWall, GiPistolGun } from 'react-icons/gi';

// Export topic icons as components
export const topicIcons = {
  all: FaGlobe,
  abortion: FaHospitalUser,
  blacklivesmatter: FaFistRaised,
  capitol: GiCapitol,
  climate: FaLeaf,
  covid: FaVirus,
  gun: GiPistolGun,
  immigra: GiBrickWall,
  rights: FaBalanceScale
};

// Export color map
export const colorMap = {
  abortion: { D: '#1E3A8A', R: '#7F1D1D', M: '#4A1D8A' },
  blacklivesmatter: { D: '#1D4ED8', R: '#991B1B', M: '#6B2BD8' },
  capitol: { D: '#2563EB', R: '#B91C1C', M: '#7B2FEB' },
  climate: { D: '#3B82F6', R: '#DC2626', M: '#8B52F6' },
  covid: { D: '#60A5FA', R: '#EF4444', M: '#A875FA' },
  gun: { D: '#93C5FD', R: '#F87171', M: '#C395FD' },
  immigra: { D: '#BFDBFE', R: '#FCA5A5', M: '#DFB5FE' },
  rights: { D: '#E2EFFF', R: '#FFD5D5', M: '#F2D5FF' },
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