# D4C Queue

[![npm version](https://img.shields.io/npm/v/d4c-queue.svg)](https://www.npmjs.com/package/d4c-queue) ![example workflow](https://github.com/grimmer0125/d4c-queue/actions/workflows/node.js.yml/badge.svg) [![Coverage Status](https://coveralls.io/repos/github/grimmer0125/d4c-queue/badge.svg)](https://coveralls.io/github/grimmer0125/d4c-queue)

Wrap an [async](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function)/[promise-returning](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises)/`sync` function as a queue-ready async function, which is enqueued while being called. This is convenient to reuse it. In synchronization mode, task queues execute original functions sequentially by default (equivalently `concurrency limit = 1`). In concurrency mode, it allows changing concurrency limit to have concurrent tasks executed. It also supports `@synchronized`/`@concurrent` [decorator](https://www.typescriptlang.org/docs/handbook/decorators.html) on instance or static methods. Passing arguments and using `await` to get return values are also supported.

## Features

1. Two usages
   1. D4C instance: synchronization mode & concurrency mode.
   2. Class, instance, and static method decorators on classes: synchronization mode & concurrency mode.
2. Wrap a function to a new queue-ready async function. It is convenient to re-use this function. Also, it is able to pass arguments and get return value for each task function.
3. Support `async function`, a `promise-returning` function, and a `sync` function.
4. Sub queues system (via tags).
5. Support Browser and Node.js.
6. Fully Written in TypeScript and its `.d.ts` typing is out of box. JavaScript is supported, too.
7. This library implements a FIFO task queue for O(1) speed. Using built-in JavaScript array will have O(n) issue.
8. Well tested.
9. Optional parameter, `inheritPreErr`. If current task is waiting for previous tasks, set it as `true` to inherit the error of the previous task and the task will not be executed and throw a custom error `new PreviousError(task.preError.message ?? task.preError)`. If this parameter is omitted or set as `false`, the task will continue whether previous tasks happen errors or not.
10. Optional parameter, `noBlockCurr`. Set it as `true` to forcibly execute the current task in the another (microtask) execution of the event loop. This is useful if you pass a sync function as the first task but do not want it to block the current event loop.

## Installation

This package includes two builds.

- ES6 build (ES2015) with CommonJS module for `main` build in package.json.
- ES6 build (ES2015) with ES6 module for `module` build. Some tools will follow the `module` field in `package.json`, like Rollup, Webpack, or Parcel. It is good to let build tools can tree-shake this module build to import only the code they need.

Either `npm install d4c-queue` or `yarn add d4c-queue`. Then import this package.

**ES6 import**

```typescript
import { D4C, synchronized, QConcurrency, concurrent } from 'd4c-queue'
```

**CommonJS**

```typescript
const { D4C, synchronized, QConcurrency, concurrent } = require('d4c-queue')
```

It is possible to use the `module` build with CommonJS require syntax in TypeScript or other build tools.

### Extra optional steps if you want to use decorators from this library

Keep in mind that `decorators` are JavaScript proposals and may vary in the future.

#### TypeScript users

Modify your tsconfig.json to include the following settings

```json
{
  "experimentalDecorators": true
}
```

#### JavaScript users

You can use Babel to support decorators, install `@babel/plugin-proposal-decorators`.

For the users using **Create React App** JavaScript version, you can either use `eject` or [CRACO](https://github.com/gsoft-inc/craco) to customize your babel setting. Using create React App TypeScript Version just needs to modify `tsconfig.json.`

See [babel.config.json](#babelconfigjson) in [Appendix](#Appendix).

See [CRACO Setting](#craco-setting) in [Appendix](#Appendix).

## Usage example

Keep in mind that a function will not be enqueued into a task queue even it becomes a new function after wrapping. A task will be enqueued only when it is executed.

### Designed queue system

Each queue is isolated with the others.

- Two instance of your decorated class will have two individual queue system.
  - The default queue in instance method queues is something like `@synchronized(self)` in other languages.
- Each D4C instance will have its own queue system.

```
D4C queues (decorator) injected into your class:
  - instance method queues (per instance):
      - default queue
      - tag1 queue
      - tag2 queue
  - static method queues
      - default queue
      - tag1 queue
      - tag2 queue
D4C instance queues (per D4C object):
  - default queue
  - tag1 queue
  - tag2 queue
```

### D4C instance usage

#### Synchronization mode

```typescript
const d4c = new D4C()

/**
 * in some execution of event loop
 * you can choose to await the result or not.
 */
const asyncFunResult = await d4c.wrap(asyncFun)(
  'asyncFun_arg1',
  'asyncFun_arg2'
)
/**
 * in another execution of event loop. Either async or
 * sync function is ok. E.g., pass a sync function,
 * it will wait for asyncFun's finishing, then use await to get
 * the new wrapped async function's result.
 */
const syncFunFunResult = await d4c.wrap(syncFun)('syncFun_arg1')
```

Alternatively, you can use below

```typescript
d4c.apply(syncFun, { args: ['syncFun_arg1'] })
```

#### Concurrency mode

Is it useful for rate-limiting tasks. For example, setup some concurrency limit to avoid send GitHub GraphQL API requests too fast, since it has rate limits control.

Default concurrency limit of D4C instance is `1` in this library.

Usage:

```ts
/** change concurrency limit applied on default queues */
const d4c = new D4C([{ concurrency: { limit: 100 }}])

/** setup concurrency for specific queue: "2" */
const d4c = new D4C([{ concurrency: { limit: 100, tag: '2' }}])
```

You can adjust concurrency via `setConcurrency`.

```ts
const d4c = new D4C()
/** change concurrency limit on default queue*/
d4c.setConcurrency([{ limit: 10 }])

/** change concurrency limit for queue2 */
d4c.setConcurrency([{ limit: 10, tag: 'queue2' }])
```

### Decorators usage

#### Synchronization mode

```typescript
class ServiceAdapter {
  @synchronized
  async connect() {}

  @synchronized
  async client_send_message_wait_connect(msg: string) {
    // ...
  }

  //** parameters are optional */
  @synchronized({ tag: 'world', inheritPreErr: true, noBlockCurr: true })
  static async staticMethod(text: string) {
    return text
  }
}
```

#### Concurrency mode

`isStatic` is to specify this queue setting is for static method and default is false. omitting tag refers default queue.

```ts
/** if omitting @QConcurrency, @concurrent will use its
 * default concurrency Infinity*/
@QConcurrency([
  { limit: 100, isStatic: true },
  { limit: 50, tag: '2' },
])
class TestController {
  @concurrent
  static async fetchData(url: string) {}

  @concurrent({ tag: '2' })
  async fetchData2(url: string) {}

  /** You can still use @synchronized, as long as
   * they are different queues*/
  @synchronized({tag:'3')
  async connect() {}
}
```

#### Arrow function property

Using decorators on `arrow function property` does not work since some limitation. If you need the effect of arrow function, you can bind by yourself (e.g. `this.handleChange = this.handleChange.bind(this);`) or consider [autobind-decorator](https://www.npmjs.com/package/autobind-decorator)

```typescript
@autobind
@synchronized // should be the second line
client_send_message_wait_connect(msg: string) {
  // ...
}
```

Using D4C instance on `arrow function property` works well.

```ts
class TestController {
  // alternative way
  // @autobind
  // bindMethodByArrowPropertyOrAutobind(){
  // }

  bindMethodByArrowPropertyOrAutobind = async () => {
    /** access some property in this. accessible after wrapping*/
  }
}
const d4c = new D4C()
const res = await d4c.apply(testController.bindMethodByArrowPropertyOrAutobind)
```

## Motivation and more detailed user scenario about Synchronization mode

### Causality

Sometimes a task function is better to be executed after the previous task function is finished. For example, assume you are writing a adapter to use a network client library to connect to a service, either in a React frontend or a Node.js backend program, and you do not want to block current event loop (e.g. using a UI indicator to wait) for this case, so `connect` is called first, later `send_message` is triggered in another UI event. In the adapter code, usually a flag can be used and do something like

```typescript
send_message(msg: string) {
  if (this.connectingStatus === 'Connected') {
    // send message
  } else if (this.connectingStatus === 'Connecting') {
    // Um...how to wait for connecting successfully?
  } else (this.connectingStatus === 'Disconnected') {
    // try to re-connect
  }
}
```

`Connecting` status is more ambiguous then `Disconnected` status. Now you can use a task queue to solve them. E.g.,

```typescript
class ServiceAdapter {
  async send_message(msg: string) {
    if (this.connectingStatus === 'Connected') {
      /** send message */
      await client_send_message_without_wait_connect(msg)
    } else if (this.connectingStatus === 'Connecting') {
      /** send message */
      await client_send_message_wait_connect(msg)
    } else {
      //..
    }
  }

  @synchronized
  async connect() {
    // ...
  }

  @synchronized
  async client_send_message_wait_connect(msg: string) {
    // ...
  }

  async client_send_message_without_wait_connect(msg: string) {
    // ...
  }
}
```

#### Another case: use D4C instance to guarantee the execution order

The code snippet is from [embedded-pydicom-react-viewer](https://github.com/grimmer0125/embedded-pydicom-react-viewer). Some function only can be executed after init function is finished.

```typescript
const d4c = new D4C()
export const initPyodide = d4c.wrap(async () => {
  /** init Pyodide*/
})

/** without d4c-queue, it will throw exception while being called
 * before 'initPyodide' is finished */
export const parseByPython = d4c.wrap(async (buffer: ArrayBuffer) => {
  /** execute python code in browser */
})
```

### Race condition

Concurrency may make race condition. And we usually use a synchronization mechanism (e.g. mutex) to solve it. A task queue can achieve this.

It is similar to causality. Sometimes two function which access same data within and will result race condition if they are executed concurrently. Although JavaScript is single thread (except Node.js Worker threads, Web Workers and JS runtime), the intrinsic property of event loop may result in some unexpected race condition, e.g.

```typescript
const func1 = async () => {
  console.log('func1 start, execution1 in event loop')
  await func3()
  console.log('func1 end, should not be same event loop execution1')
}

const func2 = async () => {
  console.log('func2')
}

async function testRaceCondition() {
  func1() // if add await will result in no race condition
  func2()
}
testRaceCondition()
```

`func2` will be executed when `func1` is not finished.

#### Real world cases

In backend, the practical example is to compare `Async/await` in [Express](https://expressjs.com/) framework and [Apollo](https://www.apollographql.com/docs/apollo-server/)/[NestJS](https://nestjs.com/) frameworks. [NestJS' GraphQL part](https://docs.nestjs.com/graphql/quick-start) is using Apollo and they have a different implementation than ExpressJS. [NestJS' Restful part](https://docs.nestjs.com/controllers) is the same as ExpressJS.

No race condition on two API call in `Express`, any API will be executed one by one. After async handler callback function is finished, another starts to be executed.

```typescript
/** Express case */
app.post('/testing', async (req, res) => {
  // Do something here
})
```

However, race condition may happen on two API call in `Apollo`/`NestJS`.

```typescript
/** Apollo server case */
const resolvers = {
  Mutation: {
    orderBook: async (_, { email, book }, { dataSources }) => {},
  },
  Query: {
    books: async () => books,
  },
}
```

Two Apollo GraphQL queries/mutations may be executed concurrently, not like Express. This has advantage and disadvantage. If you need to worry about the possible race condition, you can consider this `d4c-queue` library, or `Database transaction` or [async-mutex](https://www.npmjs.com/package/async-mutex). You do not need to apply `d4c-queue` library on top API endpoint always, just apply on the place you worry about.

#### NestJS GraphQL synchronized resolver example with this d4c-queue

The below shows how to make `hello query` become `synchronized`. Keep in mind that `@synchronized` should be below `@Query`.

```typescript
import { Query } from '@nestjs/graphql'
import { synchronized } from 'd4c-queue'

function delay() {
  return new Promise<string>(function (resolve, reject) {
    setTimeout(function () {
      resolve('world')
    }, 10 * 1000)
  })
}

export class TestsResolver {
  @Query((returns) => String)
  /** without @synchronized, two resolver may print 1/2 1/2 2/2 2/2
   *  with @synchronized, it prints: 1/2 2/2 2/2 2/2
   */
  @synchronized
  async hello() {
    console.log('hello graphql resolver part: 1/2')
    const resp = await delay()
    console.log('hello graphql resolver part: 2/2')
    return resp
  }
}
```

### Convenience

To use async functions, sometimes we just `await async_func1()` to wait for its finishing then start to call `async_func2`. But if we also do not want to use `await` to block current event loop? The workaround way is to make another wrapper function manually to detach, like below

```typescript
async wrap_function() {
  await async_func1()
  await async_func2()
}

current_function() {
  // just call
  wrap_function()

  // continue current following code
  // ..
}
```

Use this library can easily achieve, becomes

```typescript
current_function() {
  const d4c = new D4C();
  d4c.apply(async_func1);
  d4c.apply(async_func2);
}
```

## API

The parameters in the below signatures are optional. `inheritPreErr` and `noBlockCurr` are false by default. `tag` can overwrite the default tag and **specify different queue** for this method or function.

You can check the generated [TypeDoc site](https://grimmer.io/d4c-queue/modules/_lib_d4c_.html).

### Decorators:

- @QConcurrency

setup a array of queue settings

```ts
// use with @concurrent
function QConcurrency(
  queuesParam: Array<{
    limit: number
    tag?: string | symbol
    isStatic?: boolean
  }>
) {}

// example:
@QConcurrency([
  { limit: 100, isStatic: true },
  { limit: 50, tag: '2' },
])
class TestController {}
```

- @synchronized & @concurrent

```typescript
function synchronized(option?: {
  inheritPreErr?: boolean
  noBlockCurr?: boolean
  tag?: string | symbol
}) {}

/** default concurrency limit is Infinity, // use with @QConcurrency */
function concurrent(option?: {
  tag?: string | symbol
  inheritPreErr?: boolean
  noBlockCurr?: boolean
}) {}
```

Example:

```typescript
@synchronized
@synchronized()
@synchronized({ tag: "world", inheritPreErr: true })
@synchronized({ inheritPreErr: true, noBlockCurr: true })

@concurrent
@concurrent()
@concurrent({ tag: "world", inheritPreErr: true })
@concurrent({ inheritPreErr: true, noBlockCurr: true })

```

See [decorators-usage](#decorators-usage)

### D4C instance usage

Make a instance first, there is a default tag so using `tag` parameter to specify some queue is optional.

- constructor

```ts
constructor(queuesParam?: Array<{ tag?: string | symbol, limit?: number }>) {
```

usage:

```typescript
/** default concurrency is 1*/
const d4c = new D4C()

/** concurrency limit 500 applied on default queues */
const d4c = new D4C([{ concurrency: { limit: 500 }}])

/** setup concurrency for specific queue: "2" */
const d4c = new D4C([{ concurrency: { limit: 100, tag: '2' }}])
```

- setConcurrency

```ts
d4c.setConcurrency([{ limit: 10 }])

d4c.setConcurrency([{ limit: 10, tag: 'queue2' }])
```

- wrap

```typescript
public wrap<T extends IAnyFn>(
  func: T,
  option?: {
    tag?: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }
)
```

If original func is a async function, `wrap` will return `a async function` whose parameters and returned value's type (a.k.a. `Promise`) and value are same as original func.

If original func is a sync function, `wrap` will return `a async function` whose parameters are the same as the original function, and returned value's promise generic type is the same as original func. Which means it becomes a awaitable async function, besides queueing.

- apply

```typescript
public apply<T extends IAnyFn>(
  func: T,
  option?: {
    tag?: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
    args?: Parameters<typeof func>;
  }
)
```

Almost the same as `wrap` but just directly executing the original function call, e.g.

```typescript
const newFunc = d4c.wrap(asyncFun, { tag: "queue1" })
newFunc("asyncFun_arg1", "asyncFun_arg2");)
```

becomes

```typescript
d4c.apply(asyncFun, { args: ['asyncFun_arg1'], tag: 'queue1' })
```

## Changelog

Check [here](https://github.com/grimmer0125/d4c-queue/blob/master/CHANGELOG.md)

## Appendix

I use `babel-node index.js` with the following setting to test.

### babel.config.json

```json
{
  "presets": ["@babel/preset-env"],
  "plugins": [
    [
      "@babel/plugin-proposal-decorators",
      {
        "legacy": true
      }
    ]
  ]
}
```

### CRACO setting

Follow its site, [CRACO](https://github.com/gsoft-inc/craco).

1. `yarn add @craco/craco`
2. Replace `react-scripts` with `craco` in `package.json`
3. `yarn add @babel/preset-env @babel/plugin-proposal-decorators`
4. Touch `craco.config.js` and modify its content as the following
5. Then just `yarn start`.

`craco.config.js` (roughly same as `babel.config.json`):

```javascript
module.exports = {
  babel: {
    presets: [['@babel/preset-env']],
    plugins: [['@babel/plugin-proposal-decorators', { legacy: true }]],
    loaderOptions: {},
    loaderOptions: (babelLoaderOptions, { env, paths }) => {
      return babelLoaderOptions
    },
  },
}
```

### Angular service example

```typescript
import { Injectable } from '@angular/core'
import { QConcurrency, concurrent } from 'd4c-queue'

// can be placed below @Injectable, too
@QConcurrency([{ limit: 1 }])
@Injectable({
  providedIn: 'root',
})
export class HeroService {
  @concurrent
  async task1() {
    await wait(5 * 1000)
  }

  @concurrent
  async task2() {
    await wait(1 * 1000)
  }
}
```

### Use latest GitHub code of this library

1. git clone this repo
2. in cloned project folder, `yarn link`
3. `yarn test` or `yarn build`
4. in your project, `yarn link d4c-queue`. Do above ES6/CommonJS import to start to use.
5. in your project, `yarn unlink d4c-queue` to uninstall.

The development environment of this library is Node.js v15.14.0 & Visual Studio Code. TypeScript 4.2.3 is also used and will be automatically installed in node_modules. [typescript-starter](https://github.com/bitjson/typescript-starter) is used to generate two builds, `main` and `module` via its setting. Some example code is in [tests](https://github.com/grimmer0125/d4c-queue/blob/master/src/lib/D4C.spec.ts).
