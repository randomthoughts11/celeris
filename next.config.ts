import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/companies/:slug/tasks",
        destination: "/companies/:slug/board",
        permanent: true,
      },
      {
        source: "/companies/:slug/scheduler",
        destination: "/companies/:slug/publish",
        permanent: true,
      },
      {
        source: "/companies/:slug/ringcentral",
        destination: "/companies/:slug/calls",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
