# D4C

## Features:

1. Three ways to use
   1. Instance. Ref: p-queue [https://www.npmjs.com/package/p-queue](https://www.npmjs.com/package/p-queue) which does not support require & browser environment
   2. Global.
   3. Decorator.
2. Use third party library Denque to implement a FIFO queue for O(1) speed. Using built-in JavaScript array will have O(n) issue.
3. Optional parameter to inherit previous error
4. Able to pass arguents and get return value for each task function
5. Support browser/node.js
6. Typescript typing

## Tutorial & Usage

WIP

## Todo

- Refactor
- publish target:
  1. typescript import
  2. javascript node.js require(CommonJS ??) ? https ://eddychang.me/node-es6-module
  3. javascript browser/TypeScript browser.js import. (....ref: comlink)
- fix linter part:
  1. Handle eslint readonly arrays error, about `"test:lint": "eslint src --ext .ts"`,
  2. prettier / spelling

Currently the below is removed

```
1. "test:prettier": "prettier \"src/\*\*/\_.ts\" --list-different"
2. "test:spelling": "cspell \"{README.md,.github/\_.md,src/\*\*/\*.ts}\"",
3. "test:lint": "eslint src --ext .ts",

```

## Bootstrap tool

This bootstrap project is https://github.com/bitjson/typescript-starter

`run-s` is from `npm-run-all`

### Other TypeScript Bootstrap tool

- https://github.com/alexjoverm/typescript-library-starter
- https://github.com/jsynowiec/node-typescript-boilerplate
