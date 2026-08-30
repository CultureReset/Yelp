import type { MetadataRoute } from 'next';

/** Installs to an Android home screen as a standalone app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Business Dashboard',
    short_name: 'Business',
    description: 'Manage your listing, reviews, messages, and advertising.',
    start_url: '/dashboard',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f7f8',
    theme_color: '#b3231e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
