import React from 'react';

interface ResultCardProps {
  title: string;
  children: React.ReactNode;
}

export const ResultCard: React.FC<ResultCardProps> = ({ title, children }) => {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-md overflow-hidden h-full">
      <div className="p-4 h-full flex flex-col">
        <h3 className="text-lg font-semibold text-indigo-400 mb-3">{title}</h3>
        {children}
      </div>
    </div>
  );
};