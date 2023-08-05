module.exports = {
  root: true,
  "parser": "@typescript-eslint/parser",
  env: {
    browser: true,
    node: true,
    es6: true
  },
  plugins: ["@typescript-eslint"],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended"
  ],
  globals: {
    atom: true
  },
  rules: {
    "@typescript-eslint/semi": ["error", "always"],
    "@typescript-eslint/no-unused-vars": "off",
    "no-unused-vars": "off",
    "semi": ["error", "always"],
    "prefer-const": "off",
    "space-before-function-paren": ["error", {
      "named": "never",
      "asyncArrow": "always",
      "anonymous": "always"
    }],
    "no-cond-assign": "off"
  }
};
