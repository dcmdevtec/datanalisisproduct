/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: ['@supabase/supabase-js'],
  // Deshabilitar Edge Runtime para evitar problemas con Supabase
  experimental: {
    runtime: 'nodejs',
  },
  webpack: (config, { isServer, dev }) => {
    // Configuración específica para evitar problemas de Edge Runtime
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
        process: false,
        buffer: false,
        util: false,
      }
    }

    // Configuración específica para Supabase
    if (isServer) {
      config.externals = config.externals || []
      config.externals.push('@supabase/supabase-js')
    }

    return config
  },
  // Configuración específica para el build
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // Configuración de headers para evitar problemas de CORS
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

export default nextConfig
