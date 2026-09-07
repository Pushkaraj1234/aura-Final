import React from "react";
import { Loader2 } from "lucide-react";

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-[#EFE8E2] shadow-xs ${className}`}>{children}</div>
);

export const PageHeader: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode }> = ({
  title,
  subtitle,
  action,
}) => (
  <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
    <div>
      <h1 className="text-2xl font-black text-[#3C3530]">{title}</h1>
      {subtitle && <p className="text-sm text-[#7F8C8D] mt-1">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const Badge: React.FC<{ tone?: "neutral" | "good" | "warn" | "bad"; children: React.ReactNode }> = ({
  tone = "neutral",
  children,
}) => {
  const tones: Record<string, string> = {
    neutral: "bg-[#FDF9F5] text-[#5A5049] border-[#EFE8E2]",
    good: "bg-[#EAF3EC] text-[#2F6B4F] border-[#CFE6D6]",
    warn: "bg-[#FCEFE1] text-[#A55D25] border-[#F3DCC0]",
    bad: "bg-[#FBE7E4] text-[#B23A2E] border-[#F1C9C3]",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${tones[tone]}`}>
      {children}
    </span>
  );
};

export const Spinner: React.FC<{ label?: string }> = ({ label = "Loading..." }) => (
  <div className="flex items-center gap-2 text-sm text-[#7F8C8D] py-8 justify-center">
    <Loader2 size={16} className="animate-spin" />
    <span>{label}</span>
  </div>
);

export const ErrorBanner: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-[#FBE7E4] border border-[#F1C9C3] text-[#B23A2E] text-sm font-medium rounded-xl px-4 py-3 mb-4">
    {message}
  </div>
);

export const EmptyState: React.FC<{ message: string }> = ({ message }) => (
  <div className="text-center text-sm text-[#7F8C8D] py-12">{message}</div>
);

export const PrimaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
  <button
    {...props}
    className={`px-4 py-2 rounded-xl bg-[#3C3530] text-white font-bold text-xs hover:bg-[#3F4E4E] transition-all shadow-xs active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  />
);

export const SecondaryButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
  <button
    {...props}
    className={`px-4 py-2 rounded-xl bg-white border border-[#EFE8E2] text-[#3C3530] font-bold text-xs hover:bg-[#FDF9F5] transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  />
);

export const DangerButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
  <button
    {...props}
    className={`px-4 py-2 rounded-xl bg-white border border-[#F1C9C3] text-[#B23A2E] font-bold text-xs hover:bg-[#FBE7E4] transition-all active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
  />
);
