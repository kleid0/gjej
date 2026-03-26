/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.samsung.com" },
      { protocol: "https", hostname: "store.storeimages.cdn-apple.com" },
      { protocol: "https", hostname: "i02.appmifile.com" },
      { protocol: "https", hostname: "gscs-b2c.lge.com" },
      { protocol: "https", hostname: "i.dell.com" },
      { protocol: "https", hostname: "p1-ofp.static.pub" },
      { protocol: "https", hostname: "gmedia.playstation.com" },
      { protocol: "https", hostname: "img-prod-cms-rt-microsoft-com.akamaized.net" },
      { protocol: "https", hostname: "media3.bosch-home.com" },
    ],
  },
};

module.exports = nextConfig;
