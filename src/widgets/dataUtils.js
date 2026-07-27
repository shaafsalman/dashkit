// File: utils/dataUtils.js

// Format value for display based on magnitude
export const formatValue = (value,showPercentage=false) => {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  if(showPercentage){
    return `${value}%`;
  }
  return value;
};

// Format label for axis
export const formatLabel = (value,showPercentage) => {
  if (value >= 1000000) return `${(value/1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value/1000).toFixed(1)}K`;
    if(showPercentage){
    return `${value}%`;
  }
  return value;
};

// Calculate statistics from a dataset
export const calculateStats = (data, getItemValue) => {
  if (data.length === 0) return {
    total: '0',
    average: '0',
    sum: '0',
    highest: '0',
    lowest: '0'
  };
  
  const values = data.map(item => getItemValue(item) || 0);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const avg = sum / values.length;
  const highest = Math.max(...values);
  const lowest = Math.min(...values);
  
  return {
    total: sum.toFixed(0),
    average: avg.toFixed(1),
    sum: sum.toFixed(0),
    highest: highest.toFixed(0),
    lowest: lowest.toFixed(0)
  };
};