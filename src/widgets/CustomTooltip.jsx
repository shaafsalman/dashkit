// File: CustomTooltip.js
import React from 'react';
import { formatValue } from './dataUtils.js';

const CustomTooltip = ({ active, payload, barColor, decimal = true }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    
    // Get the appropriate value to display (use displayValue if available)
    const value = data.displayValue !== undefined ? data.displayValue : data.value;
    
    // Apply formatting with the decimal flag
    const formattedVal = formatValue(value, decimal);
    
    // Get percentage value (prefer displayPercentage if available)
    const percentageValue = data.displayPercentage !== undefined 
      ? data.displayPercentage 
      : (data.totalPercentage !== undefined ? data.totalPercentage : data.percentage);
    
    // Format the percentage based on decimal flag
    const formattedPercentage = decimal 
      ? percentageValue 
      : Math.round(percentageValue);
        
    return (
      <div className="bg-white p-4 rounded shadow-md border border-gray-100">
        <p className="text-xs font-semibold text-gray-800 mb-1">{data.name}</p>
        <div className="flex items-center space-x-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: barColor }}></div>
          {/* <p className="text-gray-700">
            <span className="font-medium">{formattedVal}</span>
            {percentageValue !== undefined && (
              <span className="ml-2 text-gray-500">({formattedPercentage}%)</span>
            )}
          </p> */}
        </div>
      </div>
    );
  }
  return null;
};

export default CustomTooltip;