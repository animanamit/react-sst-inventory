import type { Config } from "@react-router/dev/config";

export default {
  // Config options...
  // Disabled SSR to prevent hydration mismatches with dynamic content
  ssr: false,
} satisfies Config;
