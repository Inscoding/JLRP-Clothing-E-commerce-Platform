// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { dev }) => {
    if (dev) {
      // Tell webpack's watcher not to watch those troublesome Windows system files/paths.
      // Use forward slashes for glob patterns and escape backslashes for Windows paths if you like.
      config.watchOptions = {
        ignored: [
          '**/node_modules/**',
          'C:/pagefile.sys',
          'C:/hiberfil.sys',
          'C:/swapfile.sys',
          'C:/DumpStack.log.tmp',
        ],
      };
    }
    return config;
  },
};

module.exports = nextConfig;
