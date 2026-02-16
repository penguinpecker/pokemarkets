/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Polyfill Node.js modules for Drift SDK in browser
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        os: false,
        path: false,
        crypto: false,
        stream: false,
        http: false,
        https: false,
        zlib: false,
        url: false,
        net: false,
        tls: false,
        child_process: false,
        readline: false,
        worker_threads: false,
      };
    }

    // Ignore .node native modules
    config.module.rules.push({
      test: /\.node$/,
      use: "node-loader",
      type: "javascript/auto",
    });

    return config;
  },
  // Silence build warnings from Anchor/Drift
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
