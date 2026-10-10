import { createFileRoute, redirect } from "@tanstack/react-router";

/** Old "Today's Trips" URL — keep bookmarks working. */
export const Route = createFileRoute("/_authenticated/collection")({
  beforeLoad: () => {
    throw redirect({ to: "/schedule-trips" });
  },
});
