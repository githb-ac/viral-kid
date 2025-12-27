"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "react-hot-toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "rgba(20, 20, 20, 0.95)",
            color: "#fafafa",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            backdropFilter: "blur(8px)",
          },
          success: {
            iconTheme: {
              primary: "#22c55e",
              secondary: "#fafafa",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#fafafa",
            },
          },
        }}
      />
    </QueryClientProvider>
  );
}
