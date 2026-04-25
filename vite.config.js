import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.ts',
      build: {
        fileName: 'discogs-submitter.user.js',
        autoGrant: false,
      },
      userscript: {
        'name': 'Discogs Submitter',
        'namespace': `${pkg.name}`,
        'version': `${pkg.version}`,
        'description': `${pkg.description}`,
        'author': `${pkg.author}`,
        'license': `${pkg.license}`,
        'icon': 'https://raw.githubusercontent.com/denis-g/userscript-discogs-submitter/master/src/assets/icon-main.svg',
        'updateURL': 'https://raw.githubusercontent.com/denis-g/userscript-discogs-submitter/master/discogs-submitter.user.js',
        'downloadURL': 'https://raw.githubusercontent.com/denis-g/userscript-discogs-submitter/master/discogs-submitter.user.js',
        'supportURL': `${pkg.bugs.url}`,
        'homepage': `${pkg.homepage}`,
        'match': [
          'https://*.bandcamp.com/album/*',
          'https://web.archive.org/web/*/*://*.bandcamp.com/album/*',
          'https://*.qobuz.com/*',
          'https://*.junodownload.com/*',
          'https://*.beatport.com/*',
          'https://*.7digital.com/artist/*/release/*',
          'https://bleep.com/*',
          'https://*.hdtracks.com/*',
          'https://*.amazon.co.jp/*',
          'https://*.amazon.com/*',
          'https://*.amazon.ae/*',
          'https://*.amazon.co.uk/*',
          'https://*.amazon.it/*',
          'https://*.amazon.in/*',
          'https://*.amazon.eg/*',
          'https://*.amazon.com.au/*',
          'https://*.amazon.nl/*',
          'https://*.amazon.ca/*',
          'https://*.amazon.sa/*',
          'https://*.amazon.sg/*',
          'https://*.amazon.se/*',
          'https://*.amazon.es/*',
          'https://*.amazon.de/*',
          'https://*.amazon.com.tr/*',
          'https://*.amazon.com.br/*',
          'https://*.amazon.fr/*',
          'https://*.amazon.com.be/*',
          'https://*.amazon.pl/*',
          'https://*.amazon.com.mx/*',
          'https://*.amazon.cn/*',
        ],
        'connect': [
          'discogs.com',
          // Bandcamp
          'bandcamp.com',
          'bcbits.com',
          // Qobuz
          'qobuz.com',
          'static.qobuz.com',
          // Juno Download
          'junodownload.com',
          'imagescdn.junodownload.com',
          // Beatport
          'beatport.com',
          'api.beatport.com',
          'geo-media.beatport.com',
          // 7digital
          '7digital.com',
          'api.7digital.com',
          'artwork-cdn.7static.com',
          // Amazon Music
          'm.media-amazon.com',
          // Bleep
          'cloudfront.net',
          // HDtracks
          'cdn.hdtracks.com',
        ],
        'grant': [
          'GM_xmlhttpRequest',
          'GM_setClipboard',
          'GM_openInTab',
          'GM_info',
          'unsafeWindow',
        ],
        'run-at': 'document-end',
      },
    }),
  ],
  build: {
    outDir: './',
    emptyOutDir: false,
    minify: false,
    cssMinify: false,
    rollupOptions: {
      output: {
        format: 'iife',
        manualChunks: undefined,
      },
    },
    // Prevent esbuild from stripping some things during bundling
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
