/**
 * Configuración de optimizaciones de rendimiento para la aplicación
 */

export const PERFORMANCE_CONFIG = {
  // Configuración de prefetching
  PREFETCH: {
    // Rutas principales para prefetch inmediato
    IMMEDIATE: [
      '/dashboard',
      '/projects',
      '/surveys'
    ],
    // Rutas para prefetch con delay
    DELAYED: [
      '/companies',
      '/users',
      '/zones',
      '/reports',
      '/settings'
    ],
    // Delay en ms para prefetch diferido
    DELAY_MS: 2000,
    // Rutas relacionadas por contexto
    RELATED: {
      '/projects': ['/surveys', '/companies'],
      '/surveys': ['/projects', '/reports'],
      '/companies': ['/projects', '/users'],
      '/users': ['/companies', '/surveyors'],
      '/zones': ['/projects', '/surveys']
    }
  },

  // Configuración de lazy loading
  LAZY_LOADING: {
    // Componentes para lazy loading
    COMPONENTS: [
      'map-with-drawing',
      'map-with-choropleth',
      'tiptap-editor',
      'rich-text-editor'
    ],
    // Delay para carga diferida
    DELAY_MS: 1000,
    // Threshold para intersection observer
    THRESHOLD: 0.1
  },

  // Configuración de caché
  CACHE: {
    // Tiempo de vida del caché en segundos
    TTL: {
      USER_DATA: 300, // 5 minutos
      PROJECT_DATA: 600, // 10 minutos
      SURVEY_DATA: 900, // 15 minutos
      ZONE_DATA: 1800, // 30 minutos
    },
    // Tamaño máximo del caché
    MAX_SIZE: 100,
    // Estrategia de evicción
    EVICTION_STRATEGY: 'LRU' // Least Recently Used
  },

  // Configuración de debounce
  DEBOUNCE: {
    SEARCH: 300,
    FORM_INPUT: 500,
    SCROLL: 100,
    RESIZE: 250
  },

  // Configuración de throttling
  THROTTLE: {
    SCROLL: 16, // 60fps
    RESIZE: 100,
    MOUSE_MOVE: 16
  },

  // Configuración de transiciones
  TRANSITIONS: {
    PAGE: 300,
    COMPONENT: 200,
    HOVER: 150,
    FOCUS: 100
  },

  // Configuración de bundle splitting
  BUNDLE_SPLITTING: {
    // Chunks principales
    MAIN_CHUNKS: ['vendor', 'common', 'app'],
    // Tamaño máximo de chunks
    MAX_CHUNK_SIZE: 244 * 1024, // 244KB
    // Chunks para rutas específicas
    ROUTE_CHUNKS: {
      '/dashboard': ['dashboard', 'charts'],
      '/projects': ['projects', 'forms'],
      '/surveys': ['surveys', 'editor'],
      '/zones': ['maps', 'geojson']
    }
  },

  // Configuración de imágenes
  IMAGES: {
    // Formatos soportados
    FORMATS: ['webp', 'avif', 'jpeg'],
    // Tamaños de dispositivo
    DEVICE_SIZES: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    // Tamaños de imagen
    IMAGE_SIZES: [16, 32, 48, 64, 96, 128, 256, 384],
    // Calidad por defecto
    QUALITY: 75,
    // Lazy loading threshold
    LAZY_THRESHOLD: 0.1
  },

  // Configuración de monitoreo
  MONITORING: {
    // Métricas a monitorear
    METRICS: [
      'FCP', // First Contentful Paint
      'LCP', // Largest Contentful Paint
      'FID', // First Input Delay
      'CLS', // Cumulative Layout Shift
      'TTFB', // Time to First Byte
      'TBT'  // Total Blocking Time
    ],
    // Thresholds de rendimiento
    THRESHOLDS: {
      FCP: 1800, // 1.8s
      LCP: 2500, // 2.5s
      FID: 100,  // 100ms
      CLS: 0.1,  // 0.1
      TTFB: 800, // 800ms
      TBT: 300   // 300ms
    }
  }
}

/**
 * Configuración específica para desarrollo vs producción
 */
export const ENV_PERFORMANCE_CONFIG = {
  development: {
    LOGGING: true,
    PROFILING: true,
    CACHE_ENABLED: false,
    PREFETCH_ENABLED: true,
    LAZY_LOADING_ENABLED: true
  },
  production: {
    LOGGING: false,
    PROFILING: false,
    CACHE_ENABLED: true,
    PREFETCH_ENABLED: true,
    LAZY_LOADING_ENABLED: true
  }
}

/**
 * Utilidades para optimización de rendimiento
 */
export const PERFORMANCE_UTILS = {
  // Verificar si el dispositivo es lento
  isSlowDevice: () => {
    if (typeof navigator === 'undefined') return false
    
    const connection = (navigator as any).connection
    if (connection) {
      return connection.effectiveType === 'slow-2g' || 
             connection.effectiveType === '2g' ||
             connection.downlink < 1
    }
    
    return false
  },

  // Verificar si el usuario prefiere movimiento reducido
  prefersReducedMotion: () => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  },

  // Verificar si el dispositivo tiene poca memoria
  isLowMemoryDevice: () => {
    if (typeof navigator === 'undefined') return false
    
    const memory = (navigator as any).deviceMemory
    if (memory) {
      return memory < 4 // Menos de 4GB
    }
    
    return false
  },

  // Obtener configuración optimizada para el dispositivo
  getOptimizedConfig: () => {
    const isSlow = PERFORMANCE_UTILS.isSlowDevice()
    const prefersReducedMotion = PERFORMANCE_UTILS.prefersReducedMotion()
    const isLowMemory = PERFORMANCE_UTILS.isLowMemoryDevice()

    return {
      prefetchEnabled: !isSlow,
      lazyLoadingEnabled: !isLowMemory,
      animationsEnabled: !prefersReducedMotion,
      cacheEnabled: !isLowMemory,
      imageQuality: isSlow ? 50 : PERFORMANCE_CONFIG.IMAGES.QUALITY
    }
  }
}
