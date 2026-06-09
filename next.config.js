/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', '@react-pdf/renderer'],
    optimizePackageImports: ['sonner'],
  },
}

module.exports = nextConfig
