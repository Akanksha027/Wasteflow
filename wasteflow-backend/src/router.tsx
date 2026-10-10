import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { isStaleChunkError, tryRecoverFromStaleChunk } from "./lib/recoverable-error";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: ({ error, reset }) => {
      if (isStaleChunkError(error)) {
        tryRecoverFromStaleChunk(error);
        return (
          <div className="flex min-h-[40vh] items-center justify-center p-6 text-sm text-muted-foreground">
            Updating to the latest version…
          </div>
        );
      }
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-medium">This section didn't load</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Something went wrong. You can try again without leaving the app.
          </p>
          <button
            type="button"
            className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            Try again
          </button>
        </div>
      );
    },
  });

  return router;
};
