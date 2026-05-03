'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-gray-50 p-8 font-sans text-gray-900">
        <div className="w-full max-w-md rounded-xl border border-red-100 bg-white p-8 text-center shadow-sm">
          <div className="mb-2 text-4xl">💥</div>
          <h1 className="text-xl font-semibold">The app could not load</h1>
          <p className="mt-3 text-sm leading-relaxed text-gray-600">
            A critical error prevented the page from rendering. This is usually caused by a
            misconfigured environment variable or a failed dependency at startup. Try refreshing —
            if the problem persists, check that the API server is running and all environment
            variables are set correctly.
          </p>
          {error.message && (
            <pre className="mt-4 max-h-32 overflow-auto rounded bg-gray-50 p-3 text-left text-xs text-gray-400">
              {error.message}
              {error.digest ? `\nDigest: ${error.digest}` : ''}
            </pre>
          )}
          <button
            onClick={reset}
            className="mt-6 rounded-md bg-orange-500 px-5 py-2 text-sm font-medium text-white hover:bg-orange-600"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
