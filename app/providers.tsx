"use client"

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from 'next-themes'
import { useState } from 'react'
import { PwaProvider } from '@/components/pwa/pwa-provider'

/*
In React 19 / Next.js 16, next-themes renders an inline <script> to detect system theme
before page hydration and prevent a light/dark mode flash (FOUC).
React 19 logs a development-only warning for this valid pattern during SSR and client render.
We filter this known false-positive in development to keep the console clean.
*/
if (process.env.NODE_ENV === 'development') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Encountered a script tag')) {
      return;
    }
    originalError.apply(console, args);
  };
}

export default function Providers({ children }: { children: React.ReactNode }) {
  // We use useState to ensure the QueryClient is only initialized once per session.
  // This prevents the cache from being thrown away if React suspends or re-renders.
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // With Next.js App Router, it's generally better to let the server handle
            // initial data, and rely on React Query for client-side interactions.
            staleTime: 60 * 1000, // Data remains fresh for 1 minute
            refetchOnWindowFocus: false, // Prevents spamming your Elysia API
          },
        },
      })
  )

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <QueryClientProvider client={queryClient}>
        <PwaProvider>
          {children}
        </PwaProvider>
        {/* DevTools will automatically hide in production builds */}
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </ThemeProvider>
  )
}