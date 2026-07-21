import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  allowedDevOrigins: ['172.17.5.16', '127.0.0.1', 'localhost'],
};

export default nextConfig;
