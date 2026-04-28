/** @type {import('next').NextConfig} */
const nextConfig = {
    // Rewrites for API and documentation endpoints
    rewrites: async () => {
        return {
            fallback: [
                {
                    source: "/api/:path*",
                    destination:
                        process.env.NODE_ENV === "development"
                            ? "http://127.0.0.1:8000/api/:path*"
                            : "/api/",
                },
                {
                    source: "/docs",
                    destination:
                        process.env.NODE_ENV === "development"
                            ? "http://127.0.0.1:8000/docs"
                            : "/api/docs",
                },
                {
                    source: "/openapi.json",
                    destination:
                        process.env.NODE_ENV === "development"
                            ? "http://127.0.0.1:8000/openapi.json"
                            : "/api/openapi.json",
                },
            ]
        };
    },
    // Webpack configuration
    webpack: (config) => {
        // Add externals to webpack configuration
        config.externals.push({
            "utf-8-validate": "commonjs utf-8-validate",
            bufferutil: "commonjs bufferutil",
            canvas: "commonjs canvas",
        });

        // Uncomment to enable infrastructure logging
        // config.infrastructureLogging = { debug: /PackFileCache/ };

        return config;
    },

    // Uncomment to enable React Strict Mode
    // reactStrictMode: false,
};

export default nextConfig;
