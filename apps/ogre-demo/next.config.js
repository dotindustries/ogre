const withTM = require('next-transpile-modules')(['@dotinc/ogre-react'])

/** @type {import('next').NextConfig} */
const nextConfig = withTM({
  reactStrictMode: true
})

module.exports = nextConfig
