/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  devIndicators: false,
  turbopack: {
    root: process.cwd()
  }
};

export default nextConfig;
