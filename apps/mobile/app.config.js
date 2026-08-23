const { resolveExpoConfig } = require("./config/resolve-api-base-url.cjs");

module.exports = ({ config }) => resolveExpoConfig({ config, env: process.env });
