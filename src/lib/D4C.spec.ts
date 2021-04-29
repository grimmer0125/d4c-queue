import test from 'ava';

import { D4C, dApply, defaultTag, dWrap, errMsg, synchronized } from './D4C';

const fixture = ['1'];
const fixture2 = '2';
const queueTag = 'abc';

const funcAsync = async (
  input?: string[],
  input2?: string
): Promise<string> => {
  return input[0] + input2;
};

const funcSync = (input: string[], input2: string): string => {
  return input[0] + input2;
};

const funcPromise = (input: string[], input2: string): Promise<string> => {
  return Promise.resolve(input[0] + input2);
};

// Todo:
// - add tests for method decorator with valid option (also getMetadata really work)
//   - no parentheses
//   - parentheses    
//     1. ()
//     2. {}
//     3. {noBlockCurr: true} 
//     4. {inheritPreErr: true}
//     5. {x:3} <- invalid error case 
//     6. {} with no class register case [below is tested]
// - add test for normal non async member/static method 

test("insert a class's method via decorator to make a task in global queue - no tag error", async (t) => {
  let error;
  try {
    class TestController {
      greeting: string;
      constructor(message: string) {
        this.greeting = message;
      }

      @synchronized
      async greet(text: string) {
        const str = 'Hello, ' + text + this.greeting;
        return str;
      }
    }

    /** instance method  */
    const test = new TestController('kitty');
    const job = test.greet(fixture2);
    const resp = await job;
    t.is(resp, 'Hello, 2kitty');
  } catch (err) {
    error = err
  }
  t.is(error.message, errMsg.noSynchronizedAvailableOK);
});

test("insert a class's method via decorator to make a task in global queue - no parentheses", async (t) => {
  @defaultTag("jojo")
  class TestController {
    greeting: string;
    constructor(message: string) {
      this.greeting = message;
    }

    @synchronized({ tag: "world", inheritPreErr: true, noBlockCurr: true })
    async greet(text: string) {
      const str = 'Hello, ' + text + this.greeting;
      return str;
    }

    @synchronized
    static async staticMethod(text: string) {
      return queueTag + text;
    }
  }

  /** instance method  */
  const test = new TestController('kitty');
  const job = test.greet(fixture2);
  const resp = await job;
  t.is(resp, 'Hello, 2kitty');

  /** static method part */
  const job3 = TestController.staticMethod(fixture2);
  const resp3 = await job3;
  t.is(resp3, 'abc2');
});

test('insert a non-async function task in global queue to test noBlockCurr', async (t) => {
  let testStr = '';
  testStr += '1';
  const newFunc = dWrap((input: string[], input2: string) => {
    testStr += 'inFuncSyn';
  }, { tag: queueTag, noBlockCurr: true });
  testStr += '2';
  const job = newFunc(fixture, fixture2);
  testStr += '3';
  await job;
  testStr += '4';
  t.is(testStr, '123inFuncSyn4');
});

test('insert a function returning a promise as a task in global queue', async (t) => {
  const job = dWrap(funcPromise, { tag: queueTag })(fixture, fixture2);
  const resp = await job;
  t.is(resp, '12');
});

test('insert a non-async function task in global queue', async (t) => {
  const newFunc = dWrap(funcSync, { tag: queueTag });
  const job = newFunc(fixture, fixture2);
  const resp = await job;
  t.is(resp, '12');
});

test('insert a task in global queue', async (t) => {
  const newFunc = dWrap(funcAsync, { tag: queueTag });
  const job = newFunc(fixture, fixture2);
  const resp = await job;
  t.is(resp, '12');
});

test('insert a task in global queue and directly apply', async (t) => {
  /** apply */
  const resp2 = await dApply(funcAsync, {
    args: [['33', '44'], '5'],
    tag: queueTag,
  });
  t.is(resp2, '335');
});

test('insert a task in global queue, tag is symbol', async (t) => {
  const newFunc = dWrap(funcAsync, {
    tag: Symbol(queueTag),
  });
  const job = newFunc(fixture, fixture2);
  const resp = await job;
  t.is(resp, '12');
});

test('insert a task in global queue with invalid empty tag', async (t) => {
  let error;
  try {
    await dWrap(funcAsync, {});
  } catch (err) {
    error = err;
  }
  t.is(error.message, errMsg.WrapNotag);
});

test('insert a task in object queue', async (t) => {
  const d4c = new D4C();
  t.is(await d4c.wrap(funcAsync)(fixture, fixture2), '12');
});

test('insert a task in object queue and directly apply', async (t) => {
  const d4c = new D4C();

  /** apply */
  const resp2 = await d4c.apply(funcAsync, {
    tag: queueTag,
    args: [['33', '44'], '5'],
  });
  t.is(resp2, '335');
});

test('insert a task in object queue, use symbol case', async (t) => {
  const d4c = new D4C();
  const job = d4c.wrap(funcAsync, { tag: Symbol('123') })(fixture, fixture2);
  t.is(await job, '12');
});

test('insert a task in object queue, use a invalid null/empty tag case', async (t) => {
  const d4c = new D4C();
  let error;
  try {
    await d4c.wrap(funcAsync, { tag: null });
  } catch (err) {
    error = err;
  }
  t.is(error.message, errMsg.iWraWrongTag);
});

test("insert a class's method via decorator to make a task in global queue", async (t) => {
  @defaultTag("jojo")
  class TestController {
    greeting: string;
    constructor(message: string) {
      this.greeting = message;
    }

    @synchronized
    async greet(text: string) {
      const str = 'Hello, ' + text + this.greeting;
      return str;
    }

    @synchronized
    static async staticMethod(text: string) {
      return queueTag + text;
    }

    /** workaround working way for a arrow function */
    greet2 = dWrap(
      async (text: string) => {
        const str = 'Hello, ' + text + this.greeting;
        return str;
      },
      { tag: Symbol('') }
    );
  }

  /** instance method  */
  const test = new TestController('kitty');
  const job = test.greet(fixture2);
  const resp = await job;
  t.is(resp, 'Hello, 2kitty');

  /** static method part */
  const job3 = TestController.staticMethod(fixture2);
  const resp3 = await job3;
  t.is(resp3, 'abc2');

  /**
   * arrow function property part
   */
  const test2 = new TestController('doraemon');
  const func2 = test2.greet2;
  const resp2 = await func2(fixture2);
  t.is(resp2, 'Hello, 2doraemon');
});

test("insert a class's method via decorator with a invalid empty tag", async (t) => {
  let error;
  try {
    @defaultTag('')
    class TestController2 {
      greeting: string;
      constructor(message: string) {
        this.greeting = message;
      }
    }
  } catch (err) {
    error = err;
  }
  t.is(error.message, errMsg.ClassDecorator);
});

test("insert a class's method as a task by manually using global queue", async (t) => {
  class TestController {
    greeting: string;
    constructor(message: string) {
      this.greeting = message;
    }

    greet = async (text: string) => {
      const str = 'Hello, ' + text + this.greeting;
      return str;
    };
  }
  const test = new TestController('kitty');
  const newFunc = dWrap(test.greet, { tag: queueTag });
  const job = newFunc(fixture2);
  const resp = await job;
  t.is(resp, 'Hello, 2kitty');

  /** wrap_exec part */
  const resp2 = await dApply(test.greet, {
    tag: queueTag,
    args: [fixture2],
  });
  t.is(resp2, 'Hello, 2kitty');
});

test('test if queue really work', async (t) => {
  let testStr = '';
  const timeout = (seconds: number) => {
    return new Promise((resolve, _) =>
      setTimeout(() => {
        testStr += seconds;
        resolve('');
      }, seconds * 1000)
    );
  };

  const immediateFun = (seconds: number) => {
    testStr += seconds;
  };

  const immediateFunPromise = (seconds: number) => {
    Promise.resolve((testStr += seconds));
  };

  const d4c = new D4C();
  const fn = d4c.wrap(timeout);
  const fn2 = d4c.wrap(immediateFun);
  const fn3 = d4c.wrap(immediateFunPromise);

  await Promise.all([fn(2), fn2(1), fn(0.5), fn3(0.2), fn(0.05)]);
  t.is(testStr, '210.50.20.05');
});

test("test task2 inherit task1's error in object queue", async (t) => {
  const d4c = new D4C();

  const fun2 = async () => {
    console.log('dummy fun2');
  };

  const timeout = (seconds, result) => {
    return new Promise((_, reject) =>
      setTimeout(() => {
        reject(result);
      }, seconds * 1000)
    );
  };

  const fun1ErrorProducer = async () => {
    try {
      await d4c.wrap(timeout)(1, new Error('bad'));
    } catch (_) {
      // console.log(" err by purpose")
    }
  };

  fun1ErrorProducer();

  let error;
  try {
    await d4c.wrap(fun2, { inheritPreErr: true })();
  } catch (err) {
    error = err;
  }

  t.is(error.message, 'bad');
});
