import type { NextConfig } from "next";

const getRemotePatterns = () => {
  const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiUrl) return [];

  try {
    const url = new URL(apiUrl);
    return [
      {
        protocol: url.protocol.replace(":", "") as "http" | "https",
        hostname: url.hostname,
        port: url.port || undefined,
        pathname: "/uploads/**",
      },
    ];
  } catch (error) {
    console.error("Invalid NEXT_PUBLIC_API_BASE_URL in next.config.ts:", error);
    return [];
  }
};
const nextConfig: NextConfig = {
  /* config options here */
  env: {
    DIRECTUS_STATIC_TOKEN: process.env.DIRECTUS_STATIC_TOKEN || "",
  },
  allowedDevOrigins: ['msi-andrie', 'msi-jake', '100.81.225.79', '100.124.104.46', 'msi-eulysis', "100.119.3.44", "100.114.249.96", "192.168.10.176", '192.168.10.37', "vertex-dev", "100.81.9.23", "msi-lo"],
  images: {
    remotePatterns: getRemotePatterns(),
  },
};


export default nextConfig;