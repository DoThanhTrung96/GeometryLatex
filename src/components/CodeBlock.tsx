
import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from './icons';

interface CodeBlockProps {
  code: string;
  language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-slate-950 rounded-lg relative group">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 bg-slate-700 rounded-md text-slate-300 hover:bg-slate-600 transition-colors opacity-0 group-hover:opacity-100"
        aria-label="Copy code"
      >
        {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <CopyIcon className="w-4 h-4" />}
      </button>
      <pre className="p-4 overflow-x-auto text-sm text-slate-300">
        <code className={`language-${language}`}>{code}</code>
      </pre>
    </div>
  );
};
