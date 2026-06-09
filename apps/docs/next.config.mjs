import nextra from "nextra";

const withNextra = nextra({});

export default withNextra({
  transpilePackages: [
    "@netlisian/softconfig",
    "@netlisian/tailwind",
    "@puckeditor/core",
  ],
  pageExtensions: ["js", "jsx", "ts", "tsx", "md", "mdx"],
});
