const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@netlisian/softconfig",
    "@netlisian/tailwind",
    "@puckeditor/core",
  ],
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@puckeditor/core$": require.resolve("@puckeditor/core"),
    };
    return config;
  },
};

module.exports = nextConfig;
