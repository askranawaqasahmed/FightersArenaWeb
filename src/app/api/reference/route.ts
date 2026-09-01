import { ApiReference } from "@scalar/nextjs-api-reference";

export const GET = ApiReference({
  url: "/api/openapi.json",
  theme: "kepler",
  darkMode: true,
  pageTitle: "eFightersArena API Reference",
});
