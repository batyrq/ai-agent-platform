/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone — компактный self-contained сервер для Docker-образа.
  output: 'standalone',
};

module.exports = nextConfig;
