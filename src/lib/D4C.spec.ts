import autobind from 'autobind-decorator'
import test from 'ava'

import { concurrent, D4C, ErrMsg, QConcurrency, synchronized } from './D4C'

const fixture = ['hello']
const fixture2 = 'world'
const queueTag = 'queue1'

const funcAsync = async (
  input?: string[],
  input2?: string
): Promise<string> => {
  return input[0] + input2
}

const funcSync = (input: string[], input2: string): string => {
  return input[0] + input2
}

const funcPromise = (input: string[], input2: string): Promise<string> => {
  return Promise.resolve(input[0] + input2)
}

const timeout = (seconds: number, target?: { str: string }) => {
  return new Promise<void>((resolve, _) =>
    setTimeout(() => {
      if (target?.str != undefined && target?.str != null) {
        target.str += seconds
      }
      resolve()
    }, seconds * 100)
  )
}

const timeoutError = (seconds: number, result: string) => {
  return new Promise((_, reject) =>
    setTimeout(() => {
      reject(result)
    }, seconds * 100)
  )
}

const immediateFun = (seconds: number, target: { str: string }) => {
  target.str += seconds
}

const immediateFunPromise = (seconds: number, target: { str: string }) => {
  target.str += seconds
  return Promise.resolve()
}

test('Class usage: test concurrency', async (t) => {
  @QConcurrency([
    { limit: 100, isStatic: true },
    { limit: 100, isStatic: false },
    { limit: 1, isStatic: true, tag: '2' },
    { limit: 1, tag: '2' },
  ])
  class TestController {
    @concurrent
    static async staticTimeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @concurrent
    async instanceTimeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @concurrent({ tag: '2' })
    static async staticTimeout2(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @concurrent({ tag: '2' })
    async instanceTimeout2(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @synchronized({ tag: '3' })
    async random(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }
  }
  // test: concurrency on static method, and use default tag
  let test = { str: '' }
  await Promise.all([
    TestController.staticTimeout(0.5, test),
    TestController.staticTimeout(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  // test: concurrency on static method,
  test = { str: '' }
  await Promise.all([
    TestController.staticTimeout2(0.5, test),
    TestController.staticTimeout2(0.1, test),
  ])
  t.is(test.str, '0.50.1')

  // test: concurrency on instance method, and use default tag
  const testController = new TestController()
  test = { str: '' }
  await Promise.all([
    testController.instanceTimeout(0.5, test),
    testController.instanceTimeout(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  // test: concurrency on instance method
  test = { str: '' }
  await Promise.all([
    testController.instanceTimeout2(0.5, test),
    testController.instanceTimeout2(0.1, test),
  ])
  t.is(test.str, '0.50.1')

  // test: no use class decorator so @concurrent will use default @concurrency Infinity
  class TestController2 {
    @concurrent
    static async staticTimeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }
  }
  test = { str: '' }
  await Promise.all([
    TestController2.staticTimeout(0.5, test),
    TestController2.staticTimeout(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  @QConcurrency([
    { limit: 1, isStatic: true },
    { limit: 1, isStatic: false },
    { limit: 1, isStatic: true, tag: '2' },
    { limit: 1, isStatic: false, tag: '2' },
  ])
  class TestController3 {
    static async staticTimeoutNoDecorator(
      seconds: number,
      obj: { str: string }
    ) {
      await timeout(seconds, obj)
    }

    @concurrent
    static async staticTimeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @concurrent
    async instanceTimeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @concurrent({ tag: '2' })
    static async staticTimeout2(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @concurrent({ tag: '2' })
    async instanceTimeout2(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }
  }

  // Test: applying @classConcurrency but testing method not decorated will not be affected
  test = { str: '' }
  await Promise.all([
    TestController3.staticTimeoutNoDecorator(0.5, test),
    TestController3.staticTimeoutNoDecorator(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  // Test: different queues are isolated with each other
  const testController3 = new TestController3()
  test = { str: '' }
  await Promise.all([
    TestController.staticTimeout(0.5, test),
    testController.instanceTimeout(0.4, test),
    TestController.staticTimeout2(0.3, test),
    testController.instanceTimeout2(0.2, test),
  ])
  t.is(test.str, '0.20.30.40.5')

  /** @classConcurrency tries to setup default queue's concurrency but is conflicted with synchronized (implicitly concurrency =1) */
  let error = null
  try {
    @QConcurrency([{ limit: 1, isStatic: true }])
    class TestController4 {
      static async staticTimeoutNoDecorator(
        seconds: number,
        obj: { str: string }
      ) {
        await timeout(seconds, obj)
      }

      @synchronized
      static async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.ClassAndMethodDecoratorsIncompatible)

  /** for test coverage */
  error = null
  try {
    @QConcurrency([{ limit: 1, isStatic: true, tag: '2' }])
    class TestController5 {
      static async staticTimeoutNoDecorator(
        seconds: number,
        obj: { str: string }
      ) {
        await timeout(seconds, obj)
      }

      @synchronized
      static async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error, null)

  /** for test coverage */
  error = null
  try {
    @QConcurrency([{ limit: 1, isStatic: true, tag: '2' }])
    class TestController6 {
      @concurrent
      static async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error, null)

  /** for test coverage */
  error = null
  try {
    @QConcurrency([{ limit: 1, tag: '2' }])
    class TestController7 {
      @synchronized
      async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error, null)

  /** for test coverage */
  error = null
  try {
    @QConcurrency([
      { limit: 1, tag: '2' },
      { limit: 1, tag: '3', isStatic: true },
    ])
    class TestController8 {
      async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error, null)

  /** for the same tag queue,  @concurrent & @synchronized can not be applied both */
  error = null
  try {
    @QConcurrency([{ limit: 1, isStatic: true }])
    class TestController9 {
      static async staticTimeoutNoDecorator(
        seconds: number,
        obj: { str: string }
      ) {
        await timeout(seconds, obj)
      }

      @synchronized
      static async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }

      @concurrent
      static async staticTimeout2(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.TwoDecoratorsIncompatible)

  /** @classConcurrency' parameters should be an array  */
  error = null
  try {
    @QConcurrency({ limit: 1, tag: '2' } as any)
    class TestController10 {
      async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidClassDecoratorParameter)

  /** limit should be a number */
  error = null
  try {
    @QConcurrency([null, { limit: '3' }] as any)
    class TestController11 {
      async staticTimeout(seconds: number, obj: { str: string }) {
        await timeout(seconds, obj)
      }
    }
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidClassDecoratorParameter)
})

test('Instance usage: test concurrency', async (t) => {
  /** Fixme: dummy cases for code coverage */
  let d4c = new D4C([null] as any)
  d4c = new D4C([{}] as any)
  d4c.setConcurrency(null)

  /** default queue: concurrency 100 test */
  let test = { str: '' }
  d4c = new D4C([{ concurrency: { limit: 100 } }])
  let fn1 = d4c.wrap(timeout)
  let fn2 = d4c.wrap(immediateFun)
  let fn3 = d4c.wrap(immediateFunPromise)
  await Promise.all([
    fn1(2, test),
    fn2(1, test),
    fn1(0.5, test),
    fn3(0.2, test),
    fn1(0.05, test),
  ])
  t.is(test.str, '10.20.050.52')

  /** tag queue: concurrency 100 test */
  test = { str: '' }
  d4c = new D4C([{ concurrency: { limit: 100, tag: '2' } }])
  fn1 = d4c.wrap(timeout, { tag: '2' })
  fn2 = d4c.wrap(immediateFun, { tag: '2' })
  fn3 = d4c.wrap(immediateFunPromise, { tag: '2' })
  await Promise.all([
    fn1(2, test),
    fn2(1, test),
    fn1(0.5, test),
    fn3(0.2, test),
    fn1(0.05, test),
  ])
  t.is(test.str, '10.20.050.52')

  /** default queue: use setConcurrency to change concurrency on default to 100 */
  test = { str: '' }
  d4c = new D4C()
  d4c.setConcurrency([{ limit: 100 }])
  fn1 = d4c.wrap(timeout)
  fn2 = d4c.wrap(immediateFun)
  fn3 = d4c.wrap(immediateFunPromise)
  await Promise.all([
    fn1(2, test),
    fn2(1, test),
    fn1(0.5, test),
    fn3(0.2, test),
    fn1(0.05, test),
  ])
  t.is(test.str, '10.20.050.52')

  /** new tag with setConcurrency to set concurrency 1 */
  test = { str: '' }
  d4c.setConcurrency([{ limit: 1, tag: '2' }])
  fn1 = d4c.wrap(timeout, { tag: '2' })
  fn2 = d4c.wrap(immediateFun, { tag: '2' })
  fn3 = d4c.wrap(immediateFunPromise, { tag: '2' })
  await Promise.all([
    fn1(2, test),
    fn2(1, test),
    fn1(0.5, test),
    fn3(0.2, test),
    fn1(0.05, test),
  ])
  t.is(test.str, '210.50.20.05')

  /** default queue: use setConcurrency to set it back to 1 */
  test = { str: '' }
  d4c.setConcurrency([{ limit: 1 }])
  fn1 = d4c.wrap(timeout)
  fn2 = d4c.wrap(immediateFun)
  fn3 = d4c.wrap(immediateFunPromise)
  await Promise.all([
    fn1(2, test),
    fn2(1, test),
    fn1(0.5, test),
    fn3(0.2, test),
    fn1(0.05, test),
  ])
  t.is(test.str, '210.50.20.05')

  let error = null
  try {
    d4c.setConcurrency([undefined] as any)
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidQueueConcurrency)

  error = null
  try {
    d4c.setConcurrency([{ limit: -100 }])
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidQueueConcurrency)

  error = null
  try {
    d4c.setConcurrency([{ tag: true, limit: 100 }] as any)
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidQueueTag)

  error = null
  try {
    d4c.setConcurrency([{ tag: true }] as any)
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidQueueConcurrency)

  error = null
  try {
    d4c.setConcurrency([{ tag: true, limit: '100' }] as any)
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidQueueConcurrency)

  error = null
  try {
    d4c = new D4C([{ concurrency: { limit: '11' } }] as any)
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidQueueConcurrency)
})

test('Instance usage: pass a class arrow function property', async (t) => {
  class TestController {
    greeting: string
    constructor(message: string) {
      this.greeting = message
    }

    greet = async (text: string) => {
      const str = 'Hello, ' + text + this.greeting
      return str
    }
  }
  const d4c = new D4C()
  const test = new TestController('!!')
  const newFunc = d4c.wrap(test.greet, { tag: queueTag })
  const job = newFunc(fixture2)
  const resp = await job
  t.is(resp, 'Hello, world!!')

  /** wrap_exec part */
  const resp2 = await d4c.apply(test.greet, {
    tag: queueTag,
    args: [fixture2],
  })
  t.is(resp2, 'Hello, world!!')
})

test('Decorator usage', async (t) => {
  class TestController {
    greeting: string
    constructor(message: string) {
      this.greeting = message
      this.testManualBind = this.testManualBind.bind(this)
    }

    @synchronized
    greet(text: string) {
      const str = 'Hello, ' + text + this.greeting
      return str
    }

    @synchronized()
    async testManualBind(text: string) {
      const str = 'Hello, ' + text + this.greeting
      return str
    }

    @autobind
    @synchronized()
    async testAutoBind(text: string) {
      const str = 'Hello, ' + text + this.greeting
      return str
    }

    @synchronized({})
    static async staticMethod(text: string) {
      return text
    }

    @synchronized
    static async timeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @synchronized({ tag: '2' })
    static async timeoutAnotherQueue(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @synchronized({ inheritPreErr: true })
    async instanceTimeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }

    @synchronized({})
    async instanceTimeoutError(seconds: number, obj) {
      await timeoutError(seconds, obj)
    }

    @synchronized({ noBlockCurr: true })
    testNoBlockCurr(seconds: number, obj: { str: string }) {
      obj.str += seconds
    }

    @autobind
    autobindMethodNoQueue(text: string) {
      const str = 'Hello, ' + text + this.greeting
      return str
    }
  }

  // /** instance method  */
  const testController = new TestController('!!')
  t.is(await testController.greet(fixture2), 'Hello, world!!')

  /** test if this lib working with manual bind */
  const testManualBind = testController.testManualBind
  t.is(await testManualBind(fixture2), 'Hello, world!!')

  /** test if this lib working with auto bind */
  const testAutoBind = testController.testAutoBind
  t.is(await testAutoBind(fixture2), 'Hello, world!!')

  /** static method part */
  t.is(await TestController.staticMethod(fixture2), 'world')

  /** Test if they are really executed one by one */
  let test = { str: '' }
  await Promise.all([
    TestController.timeout(0.5, test),
    TestController.timeout(0.1, test),
  ])
  t.is(test.str, '0.50.1')

  /** Test if these are really use different queues */
  test = { str: '' }
  await Promise.all([
    TestController.timeout(0.5, test),
    TestController.timeoutAnotherQueue(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  //** Static and Instance method should have different queues */
  test = { str: '' }
  await Promise.all([
    TestController.timeout(0.5, test),
    testController.instanceTimeout(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  //** Two instances should have different queues */
  const testController2 = new TestController('!!')
  test = { str: '' }
  await Promise.all([
    testController2.instanceTimeout(0.5, test),
    testController.instanceTimeout(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  /** Class instance and D4C instance should have different queues */
  test = { str: '' }
  const fn = new D4C().wrap(timeout)
  await Promise.all([fn(0.5, test), testController.instanceTimeout(0.1, test)])
  t.is(test.str, '0.10.5')

  /** composite case: D4C instance on no autobind decorated method */
  let error = null
  try {
    const d4c = new D4C()
    const newFunc = d4c.wrap(testController.greet)
    const resp = await newFunc('')
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.MissingThisDueBindIssue)

  /** composite case: D4C instance on autobind decorated method */
  const d4c = new D4C()
  const result = await d4c.apply(testController.testAutoBind, {
    args: ['world'],
  })
  t.is(result, 'Hello, world!!')

  /** composite case: D4C instance on autobind non-decorated method */
  t.is(
    await d4c.apply(testController.autobindMethodNoQueue),
    'Hello, undefined!!'
  )

  /** Two class should not affect each other  */
  class TestController2 {
    greeting: string
    constructor(message: string) {
      this.greeting = message
    }

    @synchronized({})
    static async timeout(seconds: number, obj: { str: string }) {
      await timeout(seconds, obj)
    }
  }
  test = { str: '' }
  await Promise.all([
    TestController.timeout(0.5, test),
    TestController2.timeout(0.1, test),
  ])
  t.is(test.str, '0.10.5')

  /** test invalid decorator */
  error = null
  try {
    class TestController4 {
      @synchronized({ tag: true } as any)
      static async greet(text: string) {
        return text
      }
    }
    await TestController4.greet(fixture2), 'world'
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InvalidDecoratorOption)

  /** test if option inheritPreErr works on decorator */
  ;(async () => {
    try {
      await testController.instanceTimeoutError(1, 'some_error')
    } catch (err) {
      // console.log(" err by purpose")
    }
  })()

  error = null
  try {
    await testController.instanceTimeout(0.1, { str: '' })
  } catch (err) {
    error = err
  }
  t.is(error.message, 'some_error')

  /** test if option noBlockCurr works on decorator */
  test = { str: '' }
  const job = testController.testNoBlockCurr(2, test)
  test.str = test.str + '1'
  await job
  t.is(test.str, '12')
})

test('Instance usage: funcAsync, symbol tag', async (t) => {
  const d4c = new D4C()
  const job = d4c.wrap(funcAsync, { tag: Symbol('123') })(fixture, fixture2)
  t.is(await job, 'helloworld')
})

test('Instance usage: funcAsync, a invalid null tag case', async (t) => {
  const d4c = new D4C()
  let error
  try {
    await d4c.wrap(funcAsync, { tag: null })
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.InstanceInvalidTag)
})

test('Instance usage: async function', async (t) => {
  const d4c = new D4C()
  const newFunc = d4c.wrap(funcAsync, { tag: queueTag })
  const job = newFunc(fixture, fixture2)
  const resp = await job
  t.is(resp, 'helloworld')
})

test('Instance usage: non-async function', async (t) => {
  const d4c = new D4C()
  const newFunc = d4c.wrap(funcSync, { tag: queueTag })
  const job = newFunc(fixture, fixture2)
  const resp = await job
  t.is(resp, 'helloworld')
})

test('Instance usage: promise-returning function', async (t) => {
  const d4c = new D4C()
  const job = d4c.wrap(funcPromise, { tag: queueTag })(fixture, fixture2)
  const resp = await job
  t.is(resp, 'helloworld')
})

test('Instance usage: apply a funcAsync', async (t) => {
  const d4c = new D4C()

  /** apply */
  const resp = await d4c.apply(funcAsync, {
    tag: queueTag,
    args: [['33', '44'], '5'],
  })
  t.is(resp, '335')
})

test('Instance usage: test if queue really work, execute one by one', async (t) => {
  let test = { str: '' }
  await Promise.all([
    timeout(2, test),
    immediateFun(1, test),
    timeout(0.5, test),
    immediateFunPromise(0.2, test),
    timeout(0.05, test),
  ])
  t.is(test.str, '10.20.050.52') // 1, 0.2, 0.05, 0.5, 2

  test = { str: '' }
  const d4c = new D4C()
  const fn1 = d4c.wrap(timeout)
  const fn2 = d4c.wrap(immediateFun)
  const fn3 = d4c.wrap(immediateFunPromise)
  await Promise.all([
    fn1(2, test),
    fn2(1, test),
    fn1(0.5, test),
    fn3(0.2, test),
    fn1(0.05, test),
  ])
  t.is(test.str, '210.50.20.05')

  test = { str: '' }
  const d4c2 = new D4C()
  const fn11 = d4c2.wrap(timeout, { tag: '1' })
  const fn21 = d4c2.wrap(immediateFun, { tag: '2' })
  const fn31 = d4c2.wrap(immediateFunPromise, { tag: '3' })
  await Promise.all([
    fn11(2, test),
    fn21(1, test),
    fn11(0.5, test),
    fn31(0.2, test),
    fn11(0.05, test),
  ])
  t.is(test.str, '10.220.50.05') // 1, 0.2, 2, 0.5, 0.05

  test = { str: '' }
  const fn12 = new D4C().wrap(timeout)
  const fn22 = new D4C().wrap(immediateFun)
  const fn32 = new D4C().wrap(immediateFunPromise)
  await Promise.all([
    fn12(2, test),
    fn22(1, test),
    fn12(0.5, test),
    fn32(0.2, test),
    fn12(0.05, test),
  ])
  t.is(test.str, '10.220.50.05')
})

test('Instance usage: option noBlockCurr enable, with two non-async function ', async (t) => {
  const d4c = new D4C()
  let testStr = ''
  testStr += '1'
  const newFunc = d4c.wrap(
    () => {
      testStr += 'inFuncSyn'
    },
    { tag: queueTag, noBlockCurr: true }
  )
  testStr += '2'
  const job = newFunc()
  testStr += '3'

  const newFunc2 = d4c.wrap(
    () => {
      testStr += 'inFuncSyn2'
    },
    { tag: queueTag }
  )
  await Promise.all([job, newFunc2()])
  testStr += '4'
  t.is(testStr, '123inFuncSyninFuncSyn24')
})

test("Instance usage: option inheritPreErr enable: task2 inherit task1's error in object queue", async (t) => {
  const d4c = new D4C()

  const fun2 = async () => {
    console.log('dummy fun2')
  }

  const fun1ErrorProducer = async () => {
    try {
      await d4c.wrap(timeoutError)(1, 'some_error')
    } catch (_) {
      // console.log(" err by purpose")
    }
  }

  fun1ErrorProducer()

  let error
  try {
    await d4c.wrap(fun2, { inheritPreErr: true })()
  } catch (err) {
    error = err
  }

  t.is(error.message, 'some_error')
})

test('Instance usage: test option skipIfFull', async (t) => {
  const d4c = new D4C([{ concurrency: { limit: 2 } }])
  const fn1 = d4c.wrap(timeout, { skipIfFull: true })

  let error = null
  try {
    await fn1(3)
    await Promise.all([fn1(3), fn1(3), fn1(3)])
  } catch (err) {
    error = err
  }
  t.is(error.message, ErrMsg.QueueIsFull)
})
