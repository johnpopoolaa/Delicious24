'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const RETRY_SECONDS = 15;

interface ErrorInfo {
  title: string;
  detail: string;
  icon: string;
}

function classify(error: Error): ErrorInfo {
  const msg = error.message ?? '';

  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('network') ||
    msg.includes('ECONNREFUSED') ||
    (error instanceof TypeError && msg.includes('fetch'))
  ) {
    return {
      icon: '📡',
      title: 'Cannot reach the server',
      detail:
        'The app could not connect to the API server. This usually means the server is temporarily down, restarting, or your internet connection dropped. The page will retry automatically.',
    };
  }

  const statusMatch = msg.match(/^(\d{3})\s/);
  if (statusMatch) {
    const status = parseInt(statusMatch[1], 10);

    if (status === 401) {
      return {
        icon: '🔐',
        title: 'Authentication required',
        detail:
          'The server rejected the request because no valid API key was provided. Make sure the API_KEY environment variable is set correctly on the server and restart it.',
      };
    }
    if (status === 403) {
      return {
        icon: '🚫',
        title: 'Access denied',
        detail:
          'The server understood the request but refused to complete it. Your account does not have permission to access this resource.',
      };
    }
    if (status === 404) {
      return {
        icon: '🔍',
        title: 'Resource not found',
        detail:
          'The page or data you were looking for does not exist. It may have been deleted or the link is incorrect.',
      };
    }
    if (status === 429) {
      return {
        icon: '⏳',
        title: 'Too many requests',
        detail:
          'The server is rate-limiting requests. This resolves on its own — the page will retry automatically in a moment.',
      };
    }
    if (status === 502 || status === 503 || status === 504) {
      return {
        icon: '🔧',
        title: 'Server temporarily unavailable',
        detail: `The API server is not reachable right now (${status}). It may be restarting or under maintenance. The page will retry automatically.`,
      };
    }
    if (status >= 500) {
      return {
        icon: '💥',
        title: 'Server error',
        detail: `The API server ran into an internal problem (${status}). This is not your fault — it is likely a temporary issue. The page will retry automatically.`,
      };
    }
    if (status >= 400) {
      return {
        icon: '⚠️',
        title: `Request error (${status})`,
        detail:
          'The server could not process this request. If this keeps happening, try going back to the dashboard.',
      };
    }
  }

  return {
    icon: '⚠️',
    title: 'Something went wrong',
    detail:
      'The app encountered an unexpected error on this page. This might be a temporary glitch — try again or go back to the dashboard.',
  };
}

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { icon, title, detail } = classify(error);
  const [countdown, setCountdown] = useState(RETRY_SECONDS);
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    if (countdown <= 0) {
      reset();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, reset]);

  function handleRetry() {
    setCountdown(RETRY_SECONDS);
    reset();
  }

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <div className="w-full max-w-lg rounded-xl border border-red-100 bg-white p-8 shadow-sm">
        {/* Icon + title */}
        <div className="mb-2 text-4xl">{icon}</div>
        <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

        {/* Human-readable explanation */}
        <p className="mt-3 text-sm leading-relaxed text-gray-600">{detail}</p>

        {/* Countdown bar */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-xs text-gray-400">
            <span>Auto-retrying in {countdown}s</span>
            <span>{RETRY_SECONDS - countdown}s elapsed</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-orange-400 transition-all duration-1000"
              style={{ width: `${((RETRY_SECONDS - countdown) / RETRY_SECONDS) * 100}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={handleRetry}
            className="rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            Try again now
          </button>
          <Link
            href="/"
            className="rounded-md border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Go to dashboard
          </Link>
        </div>

        {/* Technical details (collapsed by default) */}
        <div className="mt-6 text-left">
          <button
            onClick={() => setShowTechnical((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showTechnical ? '▲ Hide' : '▼ Show'} technical details
          </button>
          {showTechnical && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-gray-50 p-3 text-xs text-gray-500">
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
