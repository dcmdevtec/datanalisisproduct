/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuración ultra-rápida para desarrollo
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Optimizaciones agresivas para desarrollo
  reactStrictMode: false,
  poweredByHeader: false,
  
  // Deshabilitar optimizaciones que ralentizan el desarrollo
  experimental: {
    optimizePackageImports: [
      'lucide-react', // Solo las más esenciales
    ],
    optimizeCss: false, // Deshabilitar en desarrollo
    turbo: false, // Deshabilitar turbo en desarrollo para evitar conflictos
  },
  
  // Configuración de imágenes simplificada
  images: {
    unoptimized: true, // Deshabilitar optimización en desarrollo
  },
  
  // Webpack ultra-optimizado para desarrollo
  webpack: (config, { isServer, dev }) => {
    if (dev) {
      // Configuración ultra-rápida para desarrollo
      config.devtool = 'eval' // El más rápido
      
      // Deshabilitar TODAS las optimizaciones que ralentizan el desarrollo
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
      
      // Deshabilitar source maps detallados
      config.resolve.symlinks = false
      
      // Deshabilitar cache de webpack en desarrollo
      config.cache = false
      
      // Configuración rápida para HMR
      config.watchOptions = {
        poll: false,
        aggregateTimeout: 200,
        ignored: ['**/node_modules', '**/.next'],
      }
    }
    
    return config
  },
  
  // Headers mínimos
  async headers() {
    return []
  },
}

export default nextConfig
