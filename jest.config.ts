import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/__tests__"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/$1" },
  setupFiles: ["<rootDir>/test/setup.ts"],
  clearMocks: true,
  collectCoverageFrom: ["lib/**/*.ts"],
  testPathIgnorePatterns: ["/node_modules/", "/.next/"]
};

export default config;
