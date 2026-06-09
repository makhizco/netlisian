module.exports = {
  reactStrictMode: true,
  transpilePackages: ["@netlisian/softconfig"],
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
};
