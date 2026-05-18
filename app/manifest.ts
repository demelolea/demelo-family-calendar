import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name:             'De Melo Family',
    short_name:       'DeMelo',
    description:      'The De Melo family calendar — locations, stays, guests & Phoebe',
    start_url:        '/',
    display:          'standalone',
    background_color: '#FAF8F3',
    theme_color:      '#44403C',
    orientation:      'portrait-primary',
    icons: [
      {
        src:     '/api/icon?size=192',
        sizes:   '192x192',
        type:    'image/png',
        purpose: 'any',
      },
      {
        src:     '/api/icon?size=512',
        sizes:   '512x512',
        type:    'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
