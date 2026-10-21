import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Há um package-lock.json na pasta do usuário; a raiz do projeto é esta.
  turbopack: { root: import.meta.dirname },
};

export default nextConfig;
