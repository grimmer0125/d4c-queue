import { Queue } from "./Queue"

type Task = {
  unlock: (value?: unknown) => void;
  preError?: Error;
  inheritPreErr?: boolean;
};

type TaskQueue = {
  queue: Queue<Task>;
  //** isRunning will be removed since runningTask can cover its effect */
  isRunning: boolean;
  concurrency: number;
  runningTask: number;
};

type Unwrap<T> = T extends Promise<infer U>
  ? U
  : T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : T;

type QueueTag = string | symbol;
type TaskQueuesType = Map<string | symbol, TaskQueue>;
type IAnyFn = (...args: any[]) => Promise<any> | any;
type MethodDecoratorParameter = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;

export const errMsg = {
  instanceInvalidTag: 'instanceInvalidTag: it should be string/symbol/undefined',
  invalidDecoratorOption: "not valid option when using decorators",
  missingThisDueBindIssue: "missingThisDueBindIssue",
  invalidSetQueueConcurrency: "invalidSetQueueConcurrency",
  invalidSetQueueTag: "invalidSetQueueTag",
  invalidClassParameter: "invalidClassParameter",
};

const queueSymbol = Symbol("d4cQueues");
const classDecoratorKey = Symbol('D4C');

const DEFAULT_CONCURRENCY = 1;

export class PreviousError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PreviousError';
  }
}

export function synchronized(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor): void;
export function synchronized(
  option?: {
    tag?: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }): MethodDecoratorParameter;
export function synchronized(
  targetOrOption?: any,
  propertyKey?: string,
  descriptor?: PropertyDescriptor
): void | MethodDecoratorParameter {

  function injectQueue(constructorOrPrototype) {

    if (constructorOrPrototype.prototype) {
      // constructor, means static method
      if (!constructorOrPrototype[queueSymbol]) {
        constructorOrPrototype[queueSymbol] = new Map<string | symbol, TaskQueue>();
      }
    } else {
      // prototype, means instance method
      if (constructorOrPrototype[queueSymbol] !== null) {
        constructorOrPrototype[queueSymbol] = null;
      }
    }
  }

  /**
   * since target in instance method & option both are object
   * so the below check is complicated
   */

  /** if class has a static member call inheritPreErr, even no using parentheses,
   * targetOrOption will have targetOrOption property but its type is function */
  function checkIfOptionObject(obj: any): boolean {
    /** still count valid argument, e.g. @synchronized(null) */
    if (obj === undefined || obj === null) {
      return true;
    }

    /**
     * hasOwnProperty should be false since it is a literal object
     */
    //eslint-disable-next-line
    if (typeof obj === "object" && !obj.hasOwnProperty("constructor") && (
      (typeof obj.inheritPreErr === "boolean" || obj.inheritPreErr === undefined) &&
      (typeof obj.noBlockCurr === "boolean" || obj.noBlockCurr === undefined) &&
      typeof obj.tag === "string" || typeof obj.tag === "symbol" || obj.tag === undefined)) {
      return true;
    }
    return false;
  }

  if (checkIfOptionObject(targetOrOption)) {
    /** parentheses case */
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {

      injectQueue(target);

      const originalMethod = descriptor.value;
      const newFunc = _q(
        null,
        originalMethod,
        targetOrOption,
      );
      descriptor.value = newFunc;
    };
  } else {
    /** no parentheses case */
    const type = typeof targetOrOption;

    /**
     * static method decorator case: target type is constructor function. use target.prototype
     * method decorator case: target is a prototype object, not literally object. use target
     */
    if ((type === "function" || targetOrOption.hasOwnProperty("constructor")) && // eslint-disable-line
      typeof propertyKey === "string" &&
      typeof descriptor === "object" && typeof descriptor.value === "function") {

      injectQueue(targetOrOption);

      const originalMethod = descriptor.value;
      const newFunc = _q(
        null,
        originalMethod,
        {},
      );
      descriptor.value = newFunc;
    } else {
      throw new Error(errMsg.invalidDecoratorOption);
    }
  }
}

function _q<T extends IAnyFn>(
  d4c: D4C,
  func: T,
  option?: {
    tag?: QueueTag;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }
): (
    ...args: Parameters<typeof func>
  ) => Promise<Unwrap<typeof func>> {

  return async function (...args: any[]): Promise<any> {

    /** Assign queues */
    let taskQueue: TaskQueue;
    let currTaskQueues: TaskQueuesType;
    if (d4c) {
      /** D4C instance case */
      currTaskQueues = d4c.queues;
    } else if (this && (this[queueSymbol] || this[queueSymbol] === null)) {

      /** Decorator case, using injected queues in user defined objects*/
      if (this[queueSymbol] === null) {
        this[queueSymbol] = new Map<string | symbol, TaskQueue>();
      }

      currTaskQueues = this[queueSymbol];
    } else {
      throw new Error(errMsg.missingThisDueBindIssue);
    }

    /** Detect tag */
    let tag: QueueTag;
    if (option?.tag !== undefined) {
      tag = option.tag;
    } else {
      tag = classDecoratorKey;
    }

    /** Get sub-queue */
    taskQueue = currTaskQueues.get(tag);
    if (!taskQueue) {
      taskQueue = {
        queue: new Queue<Task>(),
        isRunning: false,
        runningTask: 0,
        concurrency: d4c?.defaultConcurrency ?? DEFAULT_CONCURRENCY
      };
      currTaskQueues.set(tag, taskQueue);
    }

    /** Detect if the queue is running or not, use promise to wait it if it is running */
    let result;
    let err: Error;
    let task: Task;
    if (taskQueue.runningTask === taskQueue.concurrency) {
      const promise = new Promise(function (resolve) {
        task = {
          unlock: resolve,
          preError: null,
          inheritPreErr: option?.inheritPreErr,
        };
      });
      taskQueue.queue.push(task);
      await promise;
      taskQueue.runningTask += 1;
    } else if (option?.noBlockCurr) {
      taskQueue.runningTask += 1;
      await Promise.resolve();
    } else {
      taskQueue.runningTask += 1;
    }

    /** Run the task */
    if (task?.preError) {
      err = new PreviousError(task.preError.message ?? task.preError);
    } else {
      try {
        /** this will be constructor function for static method case */
        const value = func.apply(this, args);

        /** Detect if it is a async/promise function or not */
        if (value && typeof value.then === 'function') {
          result = await value;
        } else {
          result = value;
        }
      } catch (error) {
        err = error;
      }
    }
    taskQueue.runningTask -= 1;

    /** After the task is executed, check the following tasks */
    if (taskQueue.queue.length > 0) {
      const nextTask: Task = taskQueue.queue.shift();
      /** Pass error to next task */
      if (err && nextTask.inheritPreErr) {
        nextTask.preError = err;
      }
      nextTask.unlock();
    }

    if (err) {
      throw err;
    }

    return result;
  } as (
      ...args: Parameters<typeof func>
    ) => Promise<Unwrap<typeof func>>;
}

export class D4C {
  queues: TaskQueuesType;
  defaultConcurrency = DEFAULT_CONCURRENCY;

  constructor(option?: { concurrency?: number }) {
    if (option) {
      const { concurrency } = option;
      if (typeof concurrency == "number" && concurrency > 0) {
        this.defaultConcurrency = concurrency;
      } else if (concurrency !== undefined) {
        throw new Error(errMsg.invalidClassParameter)
      }
    }

    this.queues = new Map<string | symbol, TaskQueue>();
  }

  setQueue(option: {
    tag?: string | symbol;
    concurrency: number,
  }) {
    const { tag, concurrency } = option;
    if (typeof concurrency !== "number" || concurrency < 1) {
      throw new Error(errMsg.invalidSetQueueConcurrency)
    }
    if (tag !== undefined && typeof tag !== "symbol" && typeof tag !== "string") {
      throw new Error(errMsg.invalidSetQueueTag);
    }

    // TODO: refactor this, _q has similar code */
    let usedTag: string | symbol;
    if (tag !== undefined) {
      usedTag = tag;
    } else {
      usedTag = classDecoratorKey;
      this.defaultConcurrency = concurrency;
    }

    let taskQueue = this.queues.get(usedTag);
    if (!taskQueue) {
      taskQueue = {
        queue: new Queue<Task>(),
        isRunning: false,
        runningTask: 0,
        concurrency: concurrency
      };
    } else {
      taskQueue.concurrency = concurrency;
    }

    this.queues.set(usedTag, taskQueue);
  }

  apply<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
      args?: Parameters<typeof func>;
    }
  ): Promise<Unwrap<typeof func>> {
    const resp = this.wrap(func, option).apply(null, option?.args);
    return resp;
  }

  wrap<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
    }
  ): (
      ...args: Parameters<typeof func>
    ) => Promise<Unwrap<typeof func>> {
    if (!option || (option.tag === undefined || typeof option.tag === "string"
      || typeof option.tag === "symbol")) {
      return _q(this, func, option);
    }
    throw new Error(errMsg.instanceInvalidTag);
  }
}
