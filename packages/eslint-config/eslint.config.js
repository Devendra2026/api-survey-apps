import js from "@eslint/js"

export default [
  js.configs.recommended,
  {
    rules: {
      // Add any custom rules you need here, or leave it empty for defaults
    },
    languageOptions: {
      globals: {
        // If you need global variables like 'window' or 'process'
        window: "readonly",
        process: "readonly",
      },
    },
  },
]
