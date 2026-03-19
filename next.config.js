/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  outputFileTracingIncludes: {
    // Include corpus JSON files in all API route bundles that use them
    '/api/onboarding/starter': ['./lib/dishes-meta.json', './lib/dishes-embeddings.json'],
    '/api/onboarding/reassign': ['./lib/dishes-meta.json', './lib/dishes-embeddings.json'],
    '/api/suggest/dish': ['./lib/dishes-meta.json', './lib/dishes-embeddings.json'],
  },
}

module.exports = nextConfig
