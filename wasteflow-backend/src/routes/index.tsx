import { createFileRoute } from "@tanstack/react-router";
import { LandingHome } from "@/landing/home";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "AR ECOSYS — Waste Management" },
      {
        name: "description",
        content:
          "AR ECOSYS tracks municipal and commercial waste collection: QR scans, routes, vehicles, diesel and waybills.",
      },
    ],
  }),
  component: LandingHome,
});
