"use client";
import { ReactNode } from "react";
import { scoreColor } from "@/lib/utils";

// ── Spinner ──────────────────────────────────────────────────────
export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin h-4 w-4 ${className}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ── Loading dots ─────────────────────────────────────────────────
export function LoadingDots() {
  return (
    <span className="cp-dots">
      <span /><span /><span />
    </span>
  );
}

// ── Status badge ─────────────────────────────────────────────────
interface BadgeProps {
  label: string;
  color: string;
  bg: string;
}
export function StatusBadge({ label, color, bg }: BadgeProps) {
  return (
    <span
      className="cp-badge"
      style={{ color, backgroundColor: bg }}
    >
      {label}
    </span>
  );
}

// ── Score bar ─────────────────────────────────────────────────────
interface ScoreBarProps {
  label: string;
  score: number | null;
}
export function ScoreBar({ label, score }: ScoreBarProps) {
  if (score === null) return null;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-stone dark:text-fog w-32 shrink-0">{label}</span>
      <div className="cp-score-track">
        <div
          className="cp-score-fill"
          style={{ width: `${score}%`, backgroundColor: scoreColor(score) }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right" style={{ color: scoreColor(score) }}>
        {score}
      </span>
    </div>
  );
}

// ── Error message ─────────────────────────────────────────────────
export function ErrorMessage({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div className="cp-card-red text-coral text-sm">
      {message}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────
export function EmptyState({ message, sub }: { message: string; sub?: string }) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-stone dark:text-fog text-sm font-medium">{message}</div>
      {sub && <div className="text-xs text-stone/60 dark:text-fog/60 mt-1">{sub}</div>}
    </div>
  );
}

// ── Page back button ─────────────────────────────────────────────
export function BackButton({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} className="inline-flex items-center gap-1 text-sm text-stone dark:text-fog hover:text-forest dark:hover:text-sage transition-colors mb-4">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 12H5M12 19l-7-7 7-7" />
      </svg>
      {label}
    </a>
  );
}
