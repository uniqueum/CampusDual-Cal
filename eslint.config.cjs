module.exports = [
  {
    rules: {
      "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
      "no-console": "off",
    },
    languageOptions: {
      globals: {
        window: "readonly",
        document: "readonly",
      },
    },
  },
];
