import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@expressmx/database',
    '@expressmx/types',
    '@expressmx/utils',
    '@expressmx/validations',
  ],
  async redirects() {
    return [
      {
        source: '/api/mobile/:path*',
        destination: '/api/v1/mobile/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
