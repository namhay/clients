/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  compress: true,
  experimental: {
    serverComponentsExternalPackages: [
      'bcryptjs',
      '@react-pdf/renderer',
      'sharp',
      '@resvg/resvg-js',
    ],
    optimizePackageImports: ['sonner'],
    outputFileTracingIncludes: {
      '/api/invoices/[id]/pdf': [
        './public/fonts/**/*',
        './public/invoice-logo.png',
        './public/invoice-stamp.png',
        './public/aba-qr.png',
        './node_modules/@resvg/resvg-js/**/*',
      ],
      '/api/settings/branding': [
        './node_modules/@resvg/resvg-js/**/*',
      ],
    },
  },
}

module.exports = nextConfig
