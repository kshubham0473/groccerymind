/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},
  outputFileTracingIncludes: {
    // Include corpus JSON files in all API route bundles that use them
    '/api/onboarding/starter': ['./lib/dishes-meta.json', './lib/dishes-embeddings.json'],
    '/api/onboarding/reassign': ['./lib/dishes-meta.json', './lib/dishes-embeddings.json'],
    '/api/suggest/dish': ['./lib/dishes-meta.json', './lib/dishes-embeddings.json'],
    // Image resolution needs the corpus for its borrow tier — meta ONLY.
    // meta is ~350KB; embeddings are ~40MB and would blow the serverless
    // bundle limit on routes that have no reason to do similarity search.
    '/api/meal-plan': ['./lib/dishes-meta.json'],
  },
}

module.exports = nextConfig
