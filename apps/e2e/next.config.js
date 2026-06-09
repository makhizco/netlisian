const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@netlisian/softconfig", "@netlisian/tailwind", "@measured/puck"],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@measured/puck$": require.resolve("@measured/puck"),
    };
    return config;
  },
};

module.exports = nextConfig;
