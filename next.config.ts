import type { NextConfig } from "next";

// Static site (S3 + CloudFront, see ../tls_aws_api/template.yml). All data is
// fetched in the browser from the web API, so there is no server.
const nextConfig: NextConfig = {
  output: "export",
  // /station/ -> station/index.html (CloudFront rewrites directories to index.html).
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
