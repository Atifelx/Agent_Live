/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Increase for large document contexts and chat histories
    },
    responseLimit: false, // Required for streaming responses on Vercel
  },
}

module.exports = nextConfig
