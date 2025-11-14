/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Common image configuration
  images: {
    unoptimized: process.env.NODE_ENV !== 'production', // Unoptimized in dev, optimized in production
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Common server external packages
  serverExternalPackages: ['@supabase/supabase-js'],

  // Compiler options
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },

  // Webpack configuration
  webpack: (config, { isServer, dev }) => {
    // Fallback for client-side bundles
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

    // Supabase specific configuration for server-side
    if (isServer && process.env.NODE_ENV === 'production') { // Only for production server builds
      config.externals = config.externals || []
      config.externals.push('@supabase/supabase-js')
    }

    // Development specific webpack optimizations
    if (dev) {
      config.devtool = 'eval'
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
        minimize: false,
        concatenateModules: false,
        usedExports: false,
        sideEffects: false,
      }
      config.resolve.symlinks = false
      config.cache = false
      config.watchOptions = {
        poll: false,
        aggregateTimeout: 200,
        ignored: ['**/node_modules', '**/.next'],
      }
    }

    return config
  },

  // Experimental features
  experimental: {
    runtime: process.env.NODE_ENV === 'production' ? 'nodejs' : undefined,
    optimizePackageImports: process.env.NODE_ENV === 'development'
      ? ['lucide-react']
      : ['@radix-ui/react-icons', 'lucide-react', '@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-tabs'],
    optimizeCss: process.env.NODE_ENV === 'production',
    turbo: process.env.NODE_ENV === 'development' ? false : undefined,
  },

  // Headers configuration (from build config, but only for production)
  async headers() {
    if (process.env.NODE_ENV === 'production') {
      return [
        {
          source: '/(.*)',
          headers: [
            { key: 'X-Content-Type-Options', value: 'nosniff' },
            { key: 'X-Frame-Options', value: 'DENY' },
            { key: 'X-XSS-Protection', value: '1; mode=block' },
          ],
        },
      ]
    }
    return []
  },

  // Development specific settings
  reactStrictMode: process.env.NODE_ENV !== 'development', // true for production, false for dev
  poweredByHeader: process.env.NODE_ENV !== 'development', // true for production, false for dev
};

export default nextConfig;