/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  experimental: {
    serverComponentsExternalPackages: ['bcryptjs', '@react-pdf/renderer', 'sharp'],
    optimizePackageImports: ['sonner'],
    outputFileTracingIncludes: {
      '/api/invoices/[id]/pdf': [
        './public/fonts/**/*',
        './public/invoice-logo.png',
        './public/invoice-stamp.png',
        './public/aba-qr.png',
      ],
    },
  },
}

module.exports = nextConfig
