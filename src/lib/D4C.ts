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

type UnwrapPromise<T> = T extends Promise<infer U>
  ? U
  : T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : T;

type QueueTag = string | symbol;
type TaskQueuesType = Map<string | symbol, TaskQueue>;
type IAnyFn = (...args: any[]) => Promise<any> | any;
type MethodDecoratorType = (target: any, propertyKey: string, descriptor: PropertyDescriptor) => void;

export enum ErrMsg {
  InstanceInvalidTag = 'instanceInvalidTag: it should be string/symbol/undefined',
  InvalidDecoratorOption = "not valid option when using decorators",
  InvalidQueueConcurrency = "invalidQueueConcurrency",
  InvalidQueueTag = "invalidQueueTag",
  InvalidClassDecoratorParameter = "invalidClassDecoratorParameter",
  TwoDecoratorsIncompatible = "TwoDecoratorsInCompatible",
  ClassAndMethodDecoratorsIncompatible = "ClassAndMethodDecoratorsIncompatible",
  MissingThisDueBindIssue = "missingThisDueBindIssue",
};

const queueSymbol = Symbol("d4cQueues"); // subQueue system
const concurrentSymbol = Symbol("concurrent"); // record the concurrency of each instance method decorator's tag
const isConcurrentSymbol = Symbol("isConcurrent"); // record isConcurrent of each instance method decortor's tag

const defaultTag = Symbol('D4C');

const DEFAULT_CONCURRENCY = 1;

export class PreviousTaskError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PreviousError';
  }
}

function checkIfClassConcurrencyApplyOnSynchronizedMethod(target, usedTag: string | symbol) {
  // true means isConcurrent, false means sync, undefined means no static method decorator on this tag
  if (target[isConcurrentSymbol][usedTag] === undefined) {
    return;
  } else if (target[isConcurrentSymbol][usedTag] === false) {
    throw new Error(ErrMsg.ClassAndMethodDecoratorsIncompatible)
  }
}

/**
 * Class decorator to setup concurrency for queues
 * @param queuesParam a array of each queue parameter
 */
export function QConcurrency(queuesParam: Array<{ limit: number, tag?: string | symbol, isStatic?: boolean }>): ClassDecorator {
  if (!Array.isArray(queuesParam)) {
    throw new Error(ErrMsg.InvalidClassDecoratorParameter);
  }

  /** target is constructor */
  return (target) => {
    queuesParam.forEach((queueParam) => {
      if (!queueParam) {
        return;
      }
      const { tag, limit, isStatic } = queueParam;
      if (!checkTag(tag) || typeof limit !== "number" || (isStatic !== undefined && typeof isStatic !== "boolean")) {
        throw new Error(ErrMsg.InvalidClassDecoratorParameter);
      }

      const usedTag = tag ?? defaultTag;

      /** TODO: refactor below as they are use similar code */
      if (isStatic) {
        // check if at least one static method is using @synchronized/@concurrent
        if (!target[queueSymbol]) {
          return;
        }

        checkIfClassConcurrencyApplyOnSynchronizedMethod(target, usedTag);

        /** inject concurrency info for each tag in instance method case */
        if (target[concurrentSymbol]?.[usedTag]) {
          target[concurrentSymbol][usedTag] = limit;
        }

      } else {
        // check if at least one instance method is using @synchronized/@concurrent
        if (target.prototype[queueSymbol] !== null) {
          return
        }

        checkIfClassConcurrencyApplyOnSynchronizedMethod(target.prototype, usedTag);

        /** inject concurrency info for each tag in instance method case */
        if (target.prototype[concurrentSymbol]?.[usedTag]) {
          target.prototype[concurrentSymbol][usedTag] = limit;
        }
      }
    })
  };
}

function checkTag(tag) {
  if (tag === undefined || typeof tag === "string"
    || typeof tag === "symbol") {
    return true;
  }

  return false;
}

function checkIfTwoDecoratorsHaveSameConcurrentValue(target, tag: string | symbol, isConcurrent: boolean) {
  // init
  if (!target[isConcurrentSymbol]) {
    target[isConcurrentSymbol] = {};
  }

  // check if two decorators for same queue have same isConcurrency value
  if (target[isConcurrentSymbol][tag] === undefined) {
    target[isConcurrentSymbol][tag] = isConcurrent;
  } else if (target[isConcurrentSymbol][tag] !== isConcurrent) {
    throw new Error(ErrMsg.TwoDecoratorsIncompatible);
  }

  /** set default concurrency is infinity for @concurrent on instance/static methods*/
  if (isConcurrent) {
    if (!target[concurrentSymbol]) {
      target[concurrentSymbol] = {};
    }
    target[concurrentSymbol][tag] = Infinity;
  }
}

function injectQueue(constructorOrPrototype, tag: string | symbol, isConcurrent: boolean) {

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

  checkIfTwoDecoratorsHaveSameConcurrentValue(constructorOrPrototype, tag, isConcurrent);
}

/** if class has a static member call inheritPreErr, even no using parentheses,
 * targetOrOption will have targetOrOption property but its type is function */
function checkIfDecoratorOptionObject(obj: any): boolean {
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
    checkTag(obj.tag))) {
    return true;
  }
  return false;
}

/**
 * Static and instance method decorator. Default concurrency = Infinity.
 * usage example:
 * ```typescript
 * @concurrent
 * async fetchData() {}
 * // or
 * @concurrent({ tag: 'world', inheritPreErr: true, noBlockCurr: true })
 * static async fetchData(url: string) {}
 * ```
 * */
export function concurrent(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor): void;
export function concurrent(
  option?: {
    tag?: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }): MethodDecoratorType;
export function concurrent(
  targetOrOption?: any,
  propertyKey?: string,
  descriptor?: PropertyDescriptor
): void | MethodDecoratorType {
  return _methodDecorator(targetOrOption, propertyKey, descriptor, true);
}

/**
 * Static and instance method decorator. Default concurrency = 1 for lock.
 * usage example:
 * ```typescript
 * @synchronize
 * async connect() {}
 * // or
 * @synchronized({ tag: 'world', inheritPreErr: true, noBlockCurr: true })
 * static async staticMethod(text: string) {}
 * ```
 * */
export function synchronized(
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor): void;
export function synchronized(
  option?: {
    tag?: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }): MethodDecoratorType;
export function synchronized(
  targetOrOption?: any,
  propertyKey?: string,
  descriptor?: PropertyDescriptor
): void | MethodDecoratorType {
  return _methodDecorator(targetOrOption, propertyKey, descriptor, false);
}

function _methodDecorator(
  targetOrOption: any,
  propertyKey: string,
  descriptor: PropertyDescriptor,
  isConcurrent: boolean
): void | MethodDecoratorType {

  if (checkIfDecoratorOptionObject(targetOrOption)) {
    /** parentheses case containing option (=targetOrOption) */
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {

      injectQueue(target, targetOrOption?.tag ?? defaultTag, isConcurrent);

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

      injectQueue(targetOrOption, defaultTag, isConcurrent);

      const originalMethod = descriptor.value;
      const newFunc = _q(
        null,
        originalMethod,
        {},
      );
      descriptor.value = newFunc;
    } else {
      throw new Error(ErrMsg.InvalidDecoratorOption);
    }
  }
}

function _q<T extends IAnyFn>(
  d4cObj: { queues: TaskQueuesType, defaultConcurrency: number },
  func: T,
  option?: {
    tag?: QueueTag;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }
): (
    ...args: Parameters<typeof func>
  ) => Promise<UnwrapPromise<typeof func>> {

  return async function (...args: any[]): Promise<any> {

    /** Detect tag */
    let tag: QueueTag;
    if (option?.tag !== undefined) {
      tag = option.tag;
    } else {
      tag = defaultTag;
    }

    let decoratorConcurrencyLimit: number;

    /** Assign queues */
    let taskQueue: TaskQueue;
    let currTaskQueues: TaskQueuesType;
    if (d4cObj) {
      /** D4C instance case */
      currTaskQueues = d4cObj.queues;
    } else if (this && (this[queueSymbol] || this[queueSymbol] === null)) {

      if (this[queueSymbol] === null) {
        /** Decorator instance method first time case, using injected queues in user defined objects*/
        this[queueSymbol] = new Map<string | symbol, TaskQueue>();
      }

      currTaskQueues = this[queueSymbol];
      decoratorConcurrencyLimit = this[concurrentSymbol]?.[tag];
      // console.log("decoratorConcurrencyLimit:", decoratorConcurrencyLimit)
    } else {
      throw new Error(ErrMsg.MissingThisDueBindIssue);
    }

    /** Get sub-queue */
    taskQueue = currTaskQueues.get(tag);
    if (!taskQueue) {
      taskQueue = {
        queue: new Queue<Task>(),
        isRunning: false,
        runningTask: 0,
        /** D4C instance usage ?? (Decorator usage - specified limit ?? decorator - nonspecified case) */
        concurrency: d4cObj?.defaultConcurrency ?? (decoratorConcurrencyLimit ?? DEFAULT_CONCURRENCY)
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
      err = new PreviousTaskError(task.preError.message ?? task.preError);
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
    ) => Promise<UnwrapPromise<typeof func>>;
}

export class D4C {
  private queues: TaskQueuesType;

  private defaultConcurrency = DEFAULT_CONCURRENCY;

  /**
   * Default concurrency is 1. Omitting tag means it is for default queue.
   * If you specify concurrency limit for some tag queue,
   * this instance will not use that tag queue by default.
   */
  constructor(queuesParam?: Array<{ concurrency: { tag?: string | symbol, limit?: number } }>) {
    this.queues = new Map<string | symbol, TaskQueue>();
    if (Array.isArray(queuesParam)) {
      queuesParam.forEach((option) => {
        if (option?.concurrency?.limit > 0) {
          this._setConcurrency(option.concurrency);
        }
      });
    }
  }

  /**
   * @param option tag is optional for specific queue. omitting is for default queue
   * @param option.limit is limit of concurrency and should be >= 1
   */
  setConcurrency(queuesParam: Array<{
    tag?: string | symbol;
    limit: number,
  }>) {
    if (Array.isArray(queuesParam)) {
      queuesParam.forEach((option) => {
        this._setConcurrency(option);
      });
    }
  }

  private _setConcurrency(concurrency?: {
    tag?: string | symbol;
    limit?: number,
  }) {
    if (concurrency?.limit === undefined || typeof (concurrency.limit) !== "number") {
      throw new Error(ErrMsg.InvalidQueueConcurrency)
    }

    const { tag, limit } = concurrency;
    if (limit < 1) {
      throw new Error(ErrMsg.InvalidQueueConcurrency)
    }
    if (!checkTag(tag)) {
      throw new Error(ErrMsg.InvalidQueueTag);
    }

    // TODO: refactor this, _q has similar code */
    let usedTag: string | symbol;
    if (tag !== undefined) {
      usedTag = tag;
    } else {
      usedTag = defaultTag;
    }

    // TODO: refactor, other places have similar code
    let taskQueue = this.queues.get(usedTag);
    if (!taskQueue) {
      taskQueue = {
        queue: new Queue<Task>(),
        isRunning: false,
        runningTask: 0,
        concurrency: limit
      };
    } else {
      taskQueue.concurrency = limit;
    }

    this.queues.set(usedTag, taskQueue);
  }

  /** It wraps original function for queue ready and executes it*/
  apply<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
      args?: Parameters<typeof func>;
    }
  ): Promise<UnwrapPromise<typeof func>> {
    const resp = this.wrap(func, option).apply(null, option?.args);
    return resp;
  }

  /** It wraps original function for queue ready */
  wrap<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
    }
  ): (
      ...args: Parameters<typeof func>
    ) => Promise<UnwrapPromise<typeof func>> {
    if (!option || checkTag(option.tag)) {
      return _q({ queues: this.queues, defaultConcurrency: this.defaultConcurrency }, func, option);
    }
    throw new Error(ErrMsg.InstanceInvalidTag);
  }
}
