const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const nextConfig = {
  env: {
    NEXT_PUBLIC_API_URL: backendUrl,
  },
  async rewrites() {
    return [
      {
        source: "/api/proxy/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;