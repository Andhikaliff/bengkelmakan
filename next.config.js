/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      "better-sqlite3",
      "@prisma/client",
      "@prisma/adapter-better-sqlite3",
    ],
  },
};

module.exports = nextConfig;