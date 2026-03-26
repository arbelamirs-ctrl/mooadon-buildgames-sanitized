import React from 'react';

export default function AvalancheLogo({ className = "w-4 h-4" }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="16" cy="16" r="16" fill="#E84142"/>
      <path d="M21.5 21H17.8L16 17.5L14.2 21H10.5L16 11L21.5 21Z" fill="white"/>
      <path d="M12.5 21H9L11.75 16L12.5 21Z" fill="white"/>
    </svg>
  );
}