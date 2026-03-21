/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Avoid `jest-worker` child_process forking on some locked-down Windows setups (EPERM spawn).
    webpackBuildWorker: false,
    workerThreads: true
  }
};

module.exports = nextConfig;
