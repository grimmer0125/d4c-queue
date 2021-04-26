# D4C Queue

Pass a `aync` function, a function returning a promise, or a normal function into task queues. Do them sequentially.

## Features:

1. Three ways to use
   1. Instance. Ref: p-queue [https://www.npmjs.com/package/p-queue](https://www.npmjs.com/package/p-queue) which does not support require & browser environment
   2. Global.
   3. Decorator.
2. Use third party library Denque to implement a FIFO queue for O(1) speed. Using built-in JavaScript array will have O(n) issue.
3. Optional parameter to inherit previous error
4. Able to pass arguments and get return value for each task function
5. \*Support browser/node.js [need testing]
6. Typescript typing
7. Support `async function`, a function to return `promise`, and a normal function.

## Tutorial & Usage

WIP

## Todo

- Refactor
- publish target:
  1. typescript import
  2. javascript node.js require(CommonJS ??) ? https ://eddychang.me/node-es6-module
  3. javascript browser/TypeScript browser.js import. (....ref: comlink)

Currently the below is removed sine they will make errors on `yarn test`

```
1. "test:prettier": "prettier \"src/**/*.ts\" --list-different"
2. "test:spelling": "cspell \"{README.md,.github/\_.md,src/\*\*/\*.ts}\"",
```

## Bootstrap tool

This bootstrap project is https://github.com/bitjson/typescript-starter

`run-s` is from `npm-run-all`

### Other TypeScript Bootstrap tool

- https://github.com/alexjoverm/typescript-library-starter
- https://github.com/jsynowiec/node-typescript-boilerplate
