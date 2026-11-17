import React from 'react';

export const TitleLockup: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center select-none">
      <svg
        viewBox="0 0 360 88"
        className="w-[290px] sm:w-[340px] h-auto"
        role="img"
        aria-label="Iris Presisi"
      >
        {/* Minimal outline chef knife & precision slice motif */}
        <g transform="translate(180, 18)">
          {/* Left & right separated cut bar */}
          <rect
            x="-92"
            y="-4"
            width="50"
            height="8"
            rx="4"
            fill="#FDE073"
            stroke="#18181B"
            strokeWidth="2.2"
          />
          <rect
            x="-32"
            y="-4"
            width="50"
            height="8"
            rx="4"
            fill="#FDE073"
            stroke="#18181B"
            strokeWidth="2.2"
          />
          <rect
            x="28"
            y="-4"
            width="50"
            height="8"
            rx="4"
            fill="#FDE073"
            stroke="#18181B"
            strokeWidth="2.2"
          />
          {/* Vermilion precision cut markers */}
          <line x1="-37" y1="-12" x2="-37" y2="12" stroke="#E11D48" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 3" />
          <line x1="23" y1="-12" x2="23" y2="12" stroke="#E11D48" strokeWidth="2.4" strokeLinecap="round" strokeDasharray="3 3" />
        </g>

        {/* Wordmark */}
        <text
          x="180"
          y="72"
          textAnchor="middle"
          fill="#18181B"
          style={{
            fontFamily: '"Bricolage Grotesque", system-ui, sans-serif',
            fontWeight: 800,
            fontSize: '42px',
            letterSpacing: '-0.03em',
          }}
        >
          IRIS PRESISI
        </text>
      </svg>
    </div>
  );
};
