import React from 'react';

const HoverTooltip = ({ 
  isVisible, 
  position = 'top-right', 
  name, 
  value, 
  percentage, 
  subtitle = null,
  className = "",
  multiline = false 
}) => {
  if (!isVisible) return null;

  const getPositionClasses = () => {
    switch (position) {
      case 'top-left':
        return 'top-4 left-4';
      case 'top-right':
        return 'top-4 right-4';
      case 'bottom-left':
        return 'bottom-4 left-4';
      case 'bottom-right':
        return 'bottom-4 right-4';
      default:
        return 'top-4 right-4';
    }
  };

  const formatValue = (val) => {
    if (multiline && typeof val === 'string' && val.includes('\n')) {
      return val.split('\n').map((line, index) => (
        <div key={index} className="flex justify-between items-center py-1 px-2 rounded-md bg-slate-50/50 border border-slate-100/80 mb-1 last:mb-0">
          <span className="text-xs font-semibold text-slate-600">{line.split(':')[0]}:</span>
          <span className="text-xs font-bold text-slate-800 ml-2">{line.split(':').slice(1).join(':').trim()}</span>
        </div>
      ));
    }
    return (
      <div className="text-xl font-bold text-slate-900 tracking-tight">
        {val}
      </div>
    );
  };

  return (
    <div className={`absolute ${getPositionClasses()} z-50 pointer-events-none ${className}`}>
      <div className={`transform transition-all duration-300 ease-out ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
      }`}>
        <div className="relative">
          {/* Main tooltip container with advanced glassmorphism */}
          <div className="bg-white/90 backdrop-blur-xl border border-white/20 rounded-md shadow-md shadow-slate-900/20 p-4 min-w-[200px] max-w-[320px] relative overflow-hidden">
            
            {/* Gradient overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-slate-50/30 rounded-md" />
            
            {/* Subtle inner border */}
            <div className="absolute inset-0.5 border border-white/30 rounded-md" />
            
            {/* Content container */}
            <div className="relative z-10">
              
              {/* Header section */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 pr-3">
                  <h4 className="text-sm font-bold text-slate-800 truncate leading-tight">
                    {name}
                  </h4>
            
                </div>
                
                {percentage && !multiline && (
                  <div className="shrink-0">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md shadow-gray-500/25 border border-gray-400/30">
                      {percentage}%
                    </span>
                  </div>
                )}
              </div>

              {/* Value section with enhanced styling */}
              <div className="space-y-2">
                {multiline ? (
                  <div className="space-y-1.5">
                    {formatValue(value)}
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-slate-50/80 to-white/60 rounded-md p-3 border border-slate-100/60">
                    {formatValue(value)}
                  </div>
                )}
              </div>

          
            </div>

            {/* Decorative elements */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-gray-400 via-emerald-400 to-gray-500 rounded-t-2xl opacity-80" />
            
            {/* Subtle glow effect */}
            <div className="absolute -inset-1 bg-gradient-to-r from-gray-400/10 via-emerald-400/10 to-gray-500/10 rounded-md blur-sm -z-10" />
          </div>

        </div>
      </div>
    </div>
  );
};

export default HoverTooltip;