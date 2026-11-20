import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // the personalised link-preview image reads these files at runtime
  outputFileTracingIncludes: {
    '/i/**': ['./src/og/**/*'],
  },
};

export default nextConfig;
