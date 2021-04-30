# D4C Queue

Pass a `async` function, a promise-returning function or a normal non-async function into task queues, with their arguments. Do them sequentially, and get their values by `await` if need. You can use global function or instance of D4C (e.g, `const d4c = new D4C(); d4c.apply(async_fun1);`). It also supports [Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html) (`@synchronized`) on your instance method or static methods.

## Features

1. Three usages
   1. Global
   2. Instance
   3. Class and method decorator (also for static methods)
2. Use third party library [Denque](https://www.npmjs.com/package/denque) to implement a FIFO queue for O(1) speed. Using built-in JavaScript array will have O(n) issue.
3. Optional parameter, `inheritPreErr` to inherit previous error and the task will not be executed and throw a custom error `new PreviousError(task.preError.message ?? task.preError), if it gets previous error. If omit this parameter or set it as false, the following will continue whatever previous tasks happen errors.
4. Optional parameter, `noBlockCurr` to forcibly execute the first task in the queue in the next tick of the event loop. This is useful if you pass a normal non-async function as the first task but do not want it to block the current event loop.
5. Able to pass arguments and get return value for each task function.
6. Support Browser and Node.js.
7. Support TypeScript and JavaScript. Written in TypeScript and its `.d.ts` typing is out of box.
8. Support `async function`, a `promise-returning` function, and a `normal non-async` function.

## Installation

This package includes two builds.

- ES5 build with CommonJS module for `main` build in package.json.
- ES6 build (ES2015) with ES6 module for `module` build. Some tools will follow the `module` field in `package.json`, like Rollup, Webpack, or Parcel. It is good to let build tools can tree-shake your module build to import only the code they need.

Either `npm install d4c-queue` or `yarn add d4c-queue`. Then import this package.

**ES6 import**

```typescript
import { D4C, dApply, dWrap, synchronized } from 'd4c-queue';
```

**CommonJS**

```typescript
const { D4C, dApply, dWrap, synchronized } = require('d4c-queue');
```

It is possible to use the `module` build with CommonJS require syntax in TypeScript or other build tools.

### Extra optional steps if you want to use decorators from this library

Keep in mind that `decorators` and `Metadata` are JavaScript proposals and may vary in the future.

#### Install reflect-metadata

[reflect-metadata](https://www.npmjs.com/package/reflect-metadata) is used to ensure the consistent implementation behavior of `Metadata`. https://github.com/microsoft/tsyringe mentions the the list of `polyfill for the Reflect API`, besides reflect-metadata. After `yarn add reflect-metadata`/`npm install reflect-metadata`, put `import 'reflect-metadata'` only once in your code.

#### TypeScript users

Modify your tsconfig.json to include the following settings

```json
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

#### JavaScript users

You can use Babel to support decorators, install `@babel/plugin-proposal-decorators`, `babel-plugin-transform-typescript-metadata`. And if want to apply this library on arrow function property, `"@babel/plugin-proposal-class-properties"` is needed, too. The below is my testing `babel.config.json` and I use `babel-node index.js` to test

For the users using **Create React App** JavaScript version, you can either use `eject` or [craco](https://github.com/gsoft-inc/craco) to customize your babel setting. Using create React App TypeScript Version just needs to modify `tsconfig.json.`

See [babel.config.json](#babelconfigjson) in [Appendix](#Appendix)

To use **craco**, see [CRACO Setting](#craco-setting) in [Appendix](#Appendix)

#### Testing notes

While testing this `d4c-queue` library, `babel-plugin-transform-typescript-metadata`, `emitDecoratorMetadata` are not needed. Also, explicitly `import 'reflect-metadata'` is needed when developing this library but using this library seems not (just need installation). The reason might be that `D4C` already import it once and reflect-metadata is a singleton. Anyway, please setup them in case some issues happen.

## Usage example

Keep in mind that a function will not be enqueued into a task queue even it becomes a new function after wrapping. A task will be enqueued only when it is executed.

### Designed queue system is

```
D4C global share queues (global/decorator) :
  tag1: queue1
  tag2: queue2
D4C instance queues (1 D4C object):
  tag1: queue1
  tag2: queue2
```

For decorator case, it is using global share queue since we need to support static method.

### Global usage

You need to explicitly specify the tag field, not like the other usages.

```typescript
/**
 * in place 1
 * you can choose to await the result or not.
 */
const asyncFunResult = await dWrap(asyncFun, { tag: 'queue1' })(
  'asyncFun_arg1',
  'asyncFun_arg2'
);
/**
 * in place 2, another event in event loop. Either async or normal
 * sync function is ok. E.g., pass a normal non-async function,
 * it will wait for asyncFun's finishing, then use await to get
 * the new wrapped async function's result.
 */
const syncFunFunResult = await dWrap(syncFun, { tag: 'queue1' })(
  'syncFun_arg1'
);
```

You can use `dApply(someFun, { args:["someFun_arg1"], tag: "queue1"}) instead`.

### Instance usage

The API is almost the same as global usage, except its tag is optional and their queue system.

```typescript
const d4c = new D4C();
d4c.apply(func);
d4c.wrap(func2)();
```

### Class and method decorators usage

A class will use a unique tag queue of global share queues under the hood. Its default tag is hidden and will be automatically specified by the library.

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
    return text;
  }
}
```

To use arrow function property, you must use `@defaultTag(someUniqueKey)` and use the same key in `arrowFunc_property = dWrap(func, {tag: someUniqueKey})` like below,

```typescript
const uniqueKey = Symbol('jojo');
/**
 * only use @defaultTag when you need arrow function property,
 * otherwise it is deprecated.
 */
@defaultTag(uniqueKey)
class ServiceAdapter {
  arrowFunc_property = dWrap(
    async (text: string) => {
      const str = 'Hello, ' + text;
      return str;
    },
    /** need to apply same tag if you want to use same queue. */
    { tag: uniqueKey }
  );
}
```

Using decorators on `arrow function property` does not work so the current way is a workaround. If you need the effect of arrow function, alternatively you can try to bind by yourself or consider [autobind-decorator](https://www.npmjs.com/package/autobind-decorator)

```typescript
@autobind
@synchronized
client_send_message_wait_connect(msg: string) {
  // ...
}
```

## Motivation and more detailed user scenario

### Causality

Sometimes a task function is better to be executed after the previous task function is finished. For example, assume you are writing a adapter to use a network client library to connect to a service, either in a React frontend or a Node.js backend program, and you do not want to block current event loop (e.g. using a UI indicator to wait) for this case, so `connect` is called first, later `send_message` is executed in another event. In the adapter code, usually a flag can be used and do something like

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
/** using Symbol or string as parameter */
class ServiceAdapter {
  async send_message(msg: string) {
    if (this.connectingStatus === 'Connected') {
      /** send message */
      await client_send_message_without_wait_connect(msg);
    } else if (this.connectingStatus === 'Connecting') {
      /** send message */
      await client_send_message_wait_connect(msg);
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

### Concurrency

Concurrency may make race condition. And we usually use a synchronization mechanism (e.g. mutex) to solve it. A task queue can achieve this.

It is similar to causality. Sometimes two function which access same data within and will result race condition if they are executed concurrently. Although JavaScript is single thread (except Node.js Worker threads, Web Workers and JS runtime), the intrinsic property of event loop may result in some unexpected race condition, e.g.

```typescript
const func1 = async () => {
  // console.log("func1 start, event1 in event loop")
  await func3();
  console.log('func1 end, should not be same event1');
};

const func2 = async () => {
  console.log('func2');
};

async function testRaceCondition() {
  func1(); // if add await will result in no race condition
  func2();
}
testRaceCondition();
```

`func2` will be executed when `fun1` is not finished.

In backend, the practical example is to compare `Async/await` in [Express](https://expressjs.com/) framework and [Apollo](https://www.apollographql.com/docs/apollo-server/)/[NestJS](https://nestjs.com/) frameworks. [NestJS' GraphQL part](https://docs.nestjs.com/graphql/quick-start) is using Apollo and they have a different implementation than ExpressJS. [NestJS' Restful part](https://docs.nestjs.com/controllers) is the same as ExpressJS.

No race condition on two API call in `Express`, any API will be executed one by one. After async handler callback function is finished, another starts to be executed.

```typescript
/** Express case */
app.post('/testing', async (req, res) => {
  // Do something here
});
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
};
```

Two Apollo GraphQL queries/mutations may be executed concurrently, not like Express. This has advantage and disadvantage. If you need to worry about the possible race condition, you can consider this `d4c-queue` library, or `Database transaction` or [async-mutex](https://www.npmjs.com/package/async-mutex). **Of course you do not need to apply this library on top API endpoint always, just apply on the place you worry about.**

#### NestJS GraphQL synchronized resolver example with this d4c-queue

The below shows how to make `hello query` become `synchronized`. Keep in mind that `@synchronized` should be below `@Query`.

```typescript
import { Query } from '@nestjs/graphql';
import { synchronized } from 'd4c-queue';

function delay() {
  return new Promise<string>(function (resolve, reject) {
    setTimeout(function () {
      resolve('world');
    }, 10 * 1000);
  });
}

export class TestsResolver {
  @Query((returns) => String)
  /** without @synchronized, two resolver may print 1/2 1/2 2/2 2/2
   *  with @synchronized, it prints: 1/2 2/2 2/2 2/2
   */
  @synchronized
  async hello() {
    console.log('hello graphql resolver part: 1/2');
    const resp = await delay();
    console.log('hello graphql resolver part: 2/2');
    return resp;
  }
}
```

#### Need multiple concurrency tasks?

This library does not implement the mechanism about multiple tasks executed concurrently, if you want to have fine control on limited concurrency tasks, you can consider [p-queue](https://www.npmjs.com/package/p-queue).

### Convenience

To use async functions, sometime we just `await async_fun1()` to wait for its finishing then start to call `async_func2`. But if we also do not want to use `await` to block current event loop? The workaround way is to make another wrapper function manually to detach, like below

```typescript
async wrap_function(){
  await async_fun1()
  await async_func2()
}

current_function()
{
  // just call
  wrap_function()

  // continue current following code
  // ..
}
```

Use this library can easily achieve, becomes

```typescript
current_function();
{
  const d4c = new D4C();
  d4c.apply(async_fun1);
  d4c.apply(async_fun1);
}
```

## API

Keep in mind that using `string` for a `tag` has a little possibility that others use the same key string and will use the same queue.

### Decorators:

- defaultTag

**It is deprecated**. Only use @defaultTag when you need arrow function property. A class does not need to explicitly specify a defaultTag anymore.

```typescript
function defaultTag(tag: string | symbol);
```

Example:

```typescript
@defaultTag(Symbol("jojo"))
@defaultTag("jojo")
```

This decorator is to supply defaultTag setting manually.

- synchronized

```typescript
function synchronized(option?: {
  inheritPreErr?: boolean;
  noBlockCurr?: boolean;
  tag?: string | symbol;
});
```

The tag here can overwrite the default tag from class and **specify different queue** for this method.

Example:

```typescript
@synchronized
@synchronized()
@synchronized({ tag: "world", inheritPreErr: true })
@synchronized({ inheritPreErr: true, noBlockCurr: true })

```

See [class-and-method-decorators-usage](#class-and-method-decorators-usage)

### Global usage

- dWrap

```typescript
function dWrap<T extends IAnyFn>(
  func: T,
  option: {
    tag: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }
);
```

If original func is a async function, `dWrap` will return `a async function` whose parameters and returned value's type (a.k.a. `Promise`) and value are same as original func.

If original func is a normal non async function, `dWrap` will return `a async function` whose parameters are the same as the original function, and returned value's promise generic type is the same as original func. Which means it becomes a awaitable async function, besides queueing.

- dApply

```typescript
function dApply<T extends IAnyFn>(
  func: T,
  option: {
    tag: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
    args?: Parameters<typeof func>;
  }
);
```

Almost the same as `dWrap` but just directly executing the original function call, e.g.

```typescript
const newFunc = dWrap(asyncFun, { tag: "queue1" })
newFunc("asyncFun_arg1", "asyncFun_arg2");)
```

becomes

```typescript
dApply(asyncFun, { args: ['asyncFun_arg1'], tag: 'queue1' });
```

### Instance usage

Make a instance first, there is a default tag so that setting a unique tag for a unique queue is optional.

```typescript
const d4c = new D4C();
/** then d4.wrap or d4.apply*/
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

Same as public function `dWrap` except making a instance first.

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

Same as public function `dApply` except making a instance first.

## Appendix

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
    ],
    [
      "@babel/plugin-proposal-class-properties",
      {
        "loose": true
      }
    ],
    ["babel-plugin-transform-typescript-metadata"]
  ]
}
```

### CRACO setting

Follow its site, [craco](https://github.com/gsoft-inc/craco).

1. `yarn add @craco/craco`
2. Replace `react-scripts` with `craco` in `package.json`
3. `yarn add @babel/preset-env @babel/plugin-proposal-decorators @babel/plugin-proposal-class-properties babel-plugin-transform-typescript-metadata -D`
4. Touch `craco.config.js` and modify its content as the following
5. Then just `yarn start`.

`craco.config.js` (roughly same as `babel.config.json`):

```javascript
module.exports = {
  babel: {
    presets: [['@babel/preset-env']],
    plugins: [
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-proposal-class-properties', { loose: true }],
      ['babel-plugin-transform-typescript-metadata'],
    ],
    loaderOptions: {},
    loaderOptions: (babelLoaderOptions, { env, paths }) => {
      return babelLoaderOptions;
    },
  },
};
```

### Use latest GitHub code of this library

1. git clone this repo
2. in cloned project folder, `yarn link`
3. `yarn test` or `yarn build`
4. in your project, `yarn link d4c-queue`. Do above ES6/CommonJS import to start to use.
5. in your project, `yarn unlink d4c-queue` to uninstall.

The development environment of this library is Node.js v15.14.0 & Visual Studio Code. TypeScript 4.2.3 is also used and will be automatically installed in node_modules. [typescript-starter](https://github.com/bitjson/typescript-starter) is used to generate two builds, `main` and `module` via its setting.
