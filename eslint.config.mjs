import tseslint from "typescript-eslint";
export default [{
 files: ["**/*.{js,mjs,ts,tsx}"],
 languageOptions: { parser: tseslint.parser, parserOptions: {ecmaFeatures: {jsx:true}} },
 rules: {"no-debugger":"error","no-dupe-keys":"error","no-fallthrough":"error","no-unsafe-finally":"error","no-unreachable":"error","no-self-assign":"error","no-async-promise-executor":"error"}
}];
