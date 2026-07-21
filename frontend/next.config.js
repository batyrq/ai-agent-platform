/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone — a compact self-contained server for the Docker image.
  output: 'standalone',
};

module.exports = nextConfig;
