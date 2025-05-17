export default {
  preset: "ts-jest",
  testEnvironment: "node",
  nativeEsm: true,
  transform: {
    "^.+\\\\\\\\.tsx?$": "ts-jest",
    "^.+\\.(js|jsx|ts|tsx|mjs)$": "babel-jest",
  },
  plugins: ["@babel/plugin-transform-modules-commonjs"],
};
