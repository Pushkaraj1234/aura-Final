import React from 'react';

export const TOTAL_STEPS = 8;

interface StepHeaderProps {
  step: number;
  title: string;
  children?: React.ReactNode;
}

/** Heading block shared by each step of the assessment. */
export const StepHeader: React.FC<StepHeaderProps> = ({ step, title, children }) => (
  <div className="mb-6">
    <p className="text-xs font-medium text-stone-500">
      Step {step} of {TOTAL_STEPS}
    </p>
    <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
    {children && <div className="mt-2 max-w-prose text-sm leading-relaxed text-stone-600">{children}</div>}
  </div>
);
