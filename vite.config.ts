import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build as esbuild } from 'esbuild';
import fs from 'fs';
import path from 'path';
import { defineConfig, type Plugin } from 'vite';
import { injectManifest } from 'workbox-build';

interface AppSwSpec {
  id: 'client' | 'pos' | 'admin';
  scopePath: string;
  swSrc: string;
  swOutRel: string;
  globPatterns: string[];
}

const APP_SW_SPECS: AppSwSpec[] = [
  {
    id: 'client',
    scopePath: '/c/',
    swSrc: 'src/apps/client/sw.ts',
    swOutRel: 'c/sw.js',
    globPatterns: ['c/**/*.{html,js,css}', 'assets/**/*.{js,css}', 'icons/client-*.{png,svg}', 'c/manifest.webmanifest'],
  },
  {
    id: 'pos',
    scopePath: '/caja/',
    swSrc: 'src/apps/pos/sw.ts',
    swOutRel: 'caja/sw.js',
    globPatterns: ['caja/**/*.{html,js,css}', 'assets/**/*.{js,css}', 'icons/pos-*.{png,svg}', 'caja/manifest.webmanifest'],
  },
  {
    id: 'admin',
    scopePath: '/admin/',
    swSrc: 'src/apps/admin/sw.ts',
    swOutRel: 'admin/sw.js',
    globPatterns: ['admin/**/*.{html,js,css}', 'assets/**/*.{js,css}', 'icons/admin-*.{png,svg}', 'admin/manifest.webmanifest'],
  },
];

function multiPwaInjectManifestPlugin(): Plugin {
  const rootDir = __dirname;

  return {
    name: 'aitama-multi-pwa-inject-manifest',

    // En desarrollo: sirve SPA fallbacks por app y compila los 3 SWs al vuelo
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url || '/';
        const urlPath = rawUrl.split('?')[0];

        // 1. Servir Service Workers compilados al vuelo para cada app independiente
        const swMatch = APP_SW_SPECS.find((spec) => urlPath === `/${spec.swOutRel}`);
        if (swMatch) {
          try {
            const result = await esbuild({
              entryPoints: [path.resolve(rootDir, swMatch.swSrc)],
              bundle: true,
              write: false,
              format: 'esm',
              platform: 'browser',
              define: {
                'process.env.NODE_ENV': '"development"',
              },
              banner: {
                js: 'self.__WB_MANIFEST = [];',
              },
            });
            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
            res.setHeader('Service-Worker-Allowed', swMatch.scopePath);
            res.setHeader('Cache-Control', 'no-cache');
            res.end(result.outputFiles[0].text);
            return;
          } catch (err) {
            next(err);
            return;
          }
        }

        // 2. SPA History Fallback por app multi-page (ignora archivos con extensión y módulos Vite)
        const isAssetOrInternal =
          urlPath.includes('.') ||
          urlPath.startsWith('/@') ||
          urlPath.startsWith('/src/') ||
          urlPath.startsWith('/node_modules/') ||
          urlPath.startsWith('/api/');

        if (!isAssetOrInternal && req.method === 'GET') {
          if (urlPath === '/c' || urlPath.startsWith('/c/')) {
            req.url = '/c/index.html';
          } else if (urlPath === '/caja' || urlPath.startsWith('/caja/')) {
            req.url = '/caja/index.html';
          } else if (urlPath === '/admin' || urlPath.startsWith('/admin/')) {
            req.url = '/admin/index.html';
          }
        }

        next();
      });
    },

    // En build de producción: compila cada sw.ts con esbuild e inyecta su precache manifest con Workbox injectManifest
    async closeBundle(error?: Error) {
      if (error) return;
      const distDir = path.resolve(rootDir, 'dist');
      if (!fs.existsSync(distDir)) return;

      const tmpDir = path.resolve(rootDir, '.tmp-sw');
      fs.mkdirSync(tmpDir, { recursive: true });

      try {
        for (const spec of APP_SW_SPECS) {
          const bundledPath = path.join(tmpDir, `${spec.id}-sw.js`);
          await esbuild({
            entryPoints: [path.resolve(rootDir, spec.swSrc)],
            bundle: true,
            minify: true,
            format: 'esm',
            platform: 'browser',
            outfile: bundledPath,
            define: {
              'process.env.NODE_ENV': '"production"',
            },
          });

          await injectManifest({
            globDirectory: distDir,
            globPatterns: spec.globPatterns,
            swSrc: bundledPath,
            swDest: path.join(distDir, spec.swOutRel),
            maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          });
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      multiPwaInjectManifestPlugin(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." still resolve in production builds.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) return;
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, { recursive: true, force: true });
          }
        },
      },
    ],
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          client: path.resolve(__dirname, 'c/index.html'),
          pos: path.resolve(__dirname, 'caja/index.html'),
          admin: path.resolve(__dirname, 'admin/index.html'),
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
