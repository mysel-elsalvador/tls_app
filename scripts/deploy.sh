#!/usr/bin/env bash
# Builds the static site with the settings of the hub-web-<env> stack
# (../tls_aws_api) and uploads it to its S3 bucket behind CloudFront.
#   scripts/deploy.sh [dev|prod]
set -euo pipefail
cd "$(dirname "$0")/.."
stack=hub-web-${1:-dev}

out() {
  aws cloudformation describe-stacks --stack-name "$stack" \
    --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text
}

cat > .env.production.local <<EOF
NEXT_PUBLIC_API_URL=$(out ApiUrl)
NEXT_PUBLIC_USER_POOL_ID=$(out UserPoolId)
NEXT_PUBLIC_USER_POOL_CLIENT_ID=$(out UserPoolClientId)
EOF
npm run build

bucket=$(out WebBucketName)
# Hashed assets first and never deleted, so pages already open in a
# browser keep working; then the pages, which browsers always revalidate.
aws s3 sync out/_next "s3://$bucket/_next" --cache-control "public,max-age=31536000,immutable"
aws s3 sync out "s3://$bucket" --exclude "_next/*" --cache-control "no-cache" --delete
aws cloudfront create-invalidation --distribution-id "$(out WebDistributionId)" --paths "/*" \
  --query Invalidation.Id --output text >/dev/null
echo "deployed: $(out WebUrl)"
