import React from 'react';
import type { ProcessingStep } from '../types';
import { AnalyzeIcon, CheckIcon, ErrorIcon, ShieldCheckIcon, WrenchIcon, VerifyIcon } from './icons';

interface StepDisplayProps {
  currentStep: ProcessingStep;
  error?: string | null;
}

const steps = [
  { id: 'ANALYZING', name: 'Analyzing Geometry', icon: <VerifyIcon /> },
  { id: 'GENERATING', name: 'Generating Code', icon: <AnalyzeIcon /> },
  { id: 'VERIFYING', name: 'Verifying Code', icon: <ShieldCheckIcon /> },
  { id: 'CORRECTING', name: 'Self-Correcting', icon: <WrenchIcon /> },
  { id: 'DONE', name: 'Completed', icon: <CheckIcon /> },
];

export const StepDisplay: React.FC<StepDisplayProps> = ({ currentStep, error }) => {
  const currentStepIndex = steps.findIndex(step => step.id === currentStep);

  if (currentStep === 'ERROR') {
    return (
      <div className="bg-red-900/50 border border-red-700 text-red-300 p-4 rounded-lg flex items-start gap-3 max-w-2xl w-full">
        <ErrorIcon className="w-6 h-6 flex-shrink-0 mt-1" />
        <div>
          <h3 className="font-bold">An Error Occurred</h3>
          <p className="text-sm whitespace-pre-wrap">{error || 'Something went wrong.'}</p>
          <p className="text-xs text-red-400 mt-2">
            You can try again with the same image or upload a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-x-2 gap-y-4">
      {steps.map((step, index) => {
        const isActive = currentStepIndex === index || (step.id === 'CORRECTING' && currentStep === 'VERIFYING'); // Keep correcting active during re-verify
        const isCompleted = currentStepIndex > index || currentStep === 'DONE' ;
        
        let connectorClass = 'bg-slate-600';
        if (isCompleted) {
          connectorClass = 'bg-green-600';
        }

        return (
          <React.Fragment key={step.id}>
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors duration-300 ${
                  isActive ? 'bg-indigo-600 animate-pulse' : isCompleted ? 'bg-green-600' : 'bg-slate-600'
                }`}
              >
                {step.icon}
              </div>
              <span className={`${isCompleted || isActive ? 'text-white' : 'text-slate-400'}`}>
                {step.name}
              </span>
            </div>
            {index < steps.length - 1 && (
               <div className={`hidden sm:block h-0.5 w-12 transition-colors duration-300 ${connectorClass}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
