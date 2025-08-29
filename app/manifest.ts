import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Datanalisis',
    short_name: 'Datanalisis',
    description: 'A comprehensive survey platform for data collection and analysis',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#00CED1',
    icons: [
      {
        src: '/favicon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
      {
        src: '/logo.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/logo.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}
