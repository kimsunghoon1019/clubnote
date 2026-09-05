import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["xlsx", "cfb", "aes-js", "js-sha1", "js-sha256", "js-sha512"],
};

export default nextConfig;
