import nextra from "nextra";

const withNextra = nextra({
});

export default withNextra({
  transpilePackages: ['@netlisian/softconfig', '@netlisian/tailwind', '@measured/puck'],
  eslint: {
    ignoreDuringBuilds: true,
  },
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],
});
