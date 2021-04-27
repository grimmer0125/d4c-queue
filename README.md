# D4C Queue

Pass a `aync` function, a function returning a promise, or a normal non-async function into task queues, with their arguments. Do them sequentially, and get their values by `await` if need. Besides using a function as a parameter, it also supports to use [Decorators](https://www.typescriptlang.org/docs/handbook/decorators.html) on your instance method or static methods.

## Features:

1. Three usages
   1. Instance
   2. Global
   3. class and method decorator (also for static methods)
2. Use third party library [Denque](https://www.npmjs.com/package/denque) to implement a FIFO queue for O(1) speed. Using built-in JavaScript array will have O(n) issue.
3. Optional parameter, `inheritPreErr` to inherit previous error and the task will not be executed and throw a custom error `new PreviousError(task.preError.message ?? task.preError), if it gets previous error. If omit this parameter or set it as false, the following will continue whatever previous tasks happen errors.
4. Optional parameter, `nonBlockCurr` to forcely execute the first task in the queue in the next tick of the event loop. This is useful if you pass a normal non-async function as the first task but do not want it to block the current event loop.
5. Able to pass arguments and get return value for each task function
6. Support Browser and Node.js
7. Written in TypeSript and its `.d.ts` typing is out of box.
8. Support `async function`, a function to return `promise`, and a normal function.

## Installation

Support: ES6 (ES2015) and above.

Either `npm install d4c-queue` or `yarn add d4c-queue`. Then import this package.

ES6:

```
import { D4C } from "d4c-queue";
```

CommonJS :

```
const D4C = require("d4c-queue").D4C;
```

### use latest GitHub code of this library 

1. git clone this repo
2. in cloned project folder, `yarn link` or `npm link`
3. `yarn test`/`npm run test` or `yarn build`/`npm run build`
4. in your project, `yarn link d4c-queue` or `npm link d4c-queue`, start to use. 
5. in your project, `yarn unlink d4c-queue` or `npm unlink d4c-queue` to uninstall. 


### Extra optional steps if you want to use decorators from this library

Keep in mind that `decorators` and `Metadata` are JavaScript proposals and may vary in the future.

For TypeScript users, modify your tsconfig.json to include the following settings

```
{
  "experimentalDecorators": true,
  "emitDecoratorMetadata": true
}
```

And install [reflect-metadata](https://www.npmjs.com/package/reflect-metadata) to ensure the consistent implementation behavior of `Metadata`. https://github.com/microsoft/tsyringe mention the the list of `polyfill for the Reflect API`, besides reflect-metadata. Then put `import "reflect-metadata` only once in your code.

For JavaScript users, you can use Babel to support decorators, install `@babel/plugin-proposal-decorators`, `babel-plugin-transform-typescript-metadata`. And if want to apply this library on arrow function property, `"@babel/plugin-proposal-class-properties"` is needed, too. This is my testing babel.config.json

```
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
        [
            "babel-plugin-transform-typescript-metadata"
        ]
    ]
}
```

## Usage example:

1. Global usage:

```
// in place 1
D4C.wrap(asyncFun, { tag: "queue1" })("asyncFun_arg1", "asyncFun_arg2");

// in place 2, even another event in event loop
const asyncResult = D4C.wrap(syncFun, { tag: "queue1"})("syncFun_arg1");
// you can choose to await this asyncResult (promise) or not
```

You can use `D4C.apply(someFun, { args:["someFun_arg1"], tag: "queue1"}) instead`.

2. Instance usage:

```
   const d4c = new D4C();
   // then use d4c.iwrap or d4c.iapply like global usage
```

The only difference is `tag` is a optional parameter, rather than the other usages.

3. Decorator usage (using global share queues under the hood):

```
   @D4C.register(Symbol("jojo"))
   class ServiceAdapter {
     @D4C.synchronized()
     client_send_message() {
       // ...
     }

     @D4C.staticSynchronized()
     static async staticMethod(text: string) {
       return text;
     }

     arrowFunc_property = D4C.wrap(
       async (text: string) => {
         const str = 'Hello, ' + text + this.greeting;
         return str;
       },
       { tag: Symbol('') }
     );
   }
```

The way on arrow function property is a workaround way since some issue happen when decorator apply on arrow function property. If you need the effect of arrow function, you can try to bind by yourself or you can consider https://www.npmjs.com/package/autobind-decorator

```
@autobind
@D4C.synchronized()
client_send_message() {
  // ...
}
```

### Its queue system is

```
D4C global share queues:
  tag1: queue1
  tag2: queue2
D4C instance queues:
  tag1: queue1
  tag2: queue2
```

## Motivation and more detailed user scenario

### 1 Causality

Sometimes a task function is better to be executed right after the other function is finished. For example, if you are writing a adapter to use a network client library to connect to a service, either happening in a React frontend or a Node.js program, and sometimes you will do not block current event loop (e.g. using a UI indicator to wait) and just call `client_connect`, later `client_send_message` in another event to be executed. In your adapter code, usually we can use a flag and do something like

```
if (connectingStatus === "Connected") {
  // send message
} else if (connectingStatus === "Disconnected") {
  // try to re-connected, but how ?
} else if (connectingStatus === "Connecting") {
  // Um...how to wait for connecting successfully?
}
```

`Connecting` status is more ambiguous then `Disconnected` status. Now you can use a task queue to solve them. E.g.,

```
/** assume they are class instance method which are decorated yet*/

@D4C.register(Symbol("jojo")) // using Symbol or string
class ServiceAdapter {

  @D4C.synchronized()
  client_connect(){
    ...
  }

  @D4C.synchronized()
  client_send_message() {
    ...
  }
}
```

### 2 Concurrency

Concurrency may make race condition. And we usually use a synchronization mechanism (e.g. mutex) to solve it. A task queue can achieve this.

It is similar to causality. Sometimes two function which access same data within and will result race condition if they are executed concurrently. Although JavaScript is single thread (except Node.js Worker threads, Web Workers and JS runtime), the intrinsic property of event loop may result in some unexpected race condition, e.g.

```
const func1 = async () => {
  // console.log("func1 start, event1 in event loop")
  await func3();
  console.log("func1 end, should not be same event1")
};

const func2 = async () => {
  console.log("func2")
};

async function testRaceCondition() {
  func1() // if add await will result in no race condition
  func2()
}
testRaceCondition()
```

func2 will be executed when fun1 is not finished.

In backend, the real example is to compare `Async/await` in [`Express`](https://expressjs.com/) server and [`Apollo`](https://www.apollographql.com/docs/apollo-server/)/[NestJS](https://nestjs.com/) server.

No race condition on two API call in Express:

```
app.post('/testing', async (req, res) => {
  // Do something here
})
```

Possible race condition on two API call in Apollo (even NestJS):

```
const resolvers = {
  Mutation: {
    orderBook: async (_, { email, book }, { dataSources }) => {
    },
  },
  Query: {
    books: async () => books,
  },
};
```

Two Apollo GraphQL queries/mutations may be executed cocurrently, not like Express. This has advantage and disadvantage. If you need to worry about the possible race condition, you can consider this `d4c-queue` library, or `Database transaction` or [async-mutex](https://www.npmjs.com/package/async-mutex).

This library does not allow multiple tasks executed in one time, if you want to have fined control on limited concurrency tasks, you can consider [p-queue](https://www.npmjs.com/package/p-queue).

### 3 Convenience

To use async functions, sometime we just `await async_fun1()` to wait for its finishing then start to call `async_func2`. But if we also do not want to use `await` to block current event loop? The workaround way is to make another wrapper function manually to detach, like below

```
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

## Function list

May improve this later.

Decorators:

- public static register(tag: string | symbol)
- public static staticSynchronized( inheritPreErr?: boolean, nonBlockCurr?: boolean)
- public static synchronized( inheritPreErr?: isInheritPreErr, nonBlockCurr?: boolean)

D4C.wrap:

```
public static wrap<T extends IAnyFn>(
  func: T,
  option: {
    tag?: boolean;
    inheritPreErr?: isInheritPreErr;
    nonBlockCurr?: boolean;
  })
```

If original func is a async function, `D4C.wrap` will return `a async function` whose parameters and returned value's type (a.k.a. `Promise`) and value are same as original func.

If original func is a normal non async function, `D4C.wrap` will return `a async function` whose parameters are the same as the original function, and returned value's promise type is the same as original func. Which means it becomes a awaitable async function, besides queueing.

D4C.apply:

```
public static apply<T extends IAnyFn>(
  func: T,
    option: {
    tag?: string | symbol;
    inheritPreErr?: isInheritPreErr;
    nonBlockCurr?: boolean;
    args?: Parameters<typeof async_func>;
  })
```

Almost the same as D4C.wrap but just directly executing the original function call.

```
const newFunc = D4C.wrap(asyncFun, { tag: "queue1" })
newFunc("asyncFun_arg1", "asyncFun_arg2");)
```

becomes

```
D4C.apply(asyncFun, { args:["asyncFun_arg1"], tag: "queue1"})
```

instance method: iwrap

```
 public iwrap<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: isInheritPreErr;
      nonBlockCurr?: boolean;
    }
  )
```

Same as static method D4C.wrap except `const d4c = new D4C()` first and use `d4c.iwrap`.

instance method: iwrap

```
  public iapply<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      nonBlockCurr?: boolean;
      args?: Parameters<typeof func>;
    }
  )
```

Same as static method D4C.wrap except `const d4c = new D4C()` first and use `d4c.iapply`.
