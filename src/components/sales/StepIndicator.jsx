import React from 'react';
import { Check } from 'lucide-react';

const STEPS = [
  { number: 1, label: 'Choose POS' },
  { number: 2, label: 'Setup Method' },
  { number: 3, label: 'Test & Go Live' },
];

export default function StepIndicator({ currentStep }) {
  return (
    <div className="flex items-center justify-center mb-8">
      {STEPS.map((step, i) => {
        const done = currentStep > step.number;
        const active = currentStep === step.number;
        return (
          <React.Fragment key={step.number}>
            <div className="flex flex-col items-center">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm border-2 transition-all ${
                done ? 'bg-teal-500 border-teal-500 text-white' :
                active ? 'bg-[#1f2128] border-teal-500 text-teal-400' :
                'bg-[#1f2128] border-gray-600 text-gray-500'
              }`}>
                {done ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span className={`text-xs mt-1.5 font-medium ${active ? 'text-teal-400' : done ? 'text-teal-500' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`h-0.5 w-16 mx-2 mb-4 transition-all ${currentStep > step.number ? 'bg-teal-500' : 'bg-gray-700'}`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}