import Denque from 'denque';
import 'reflect-metadata';

type TaskQueue = {
  queue: Denque;
  isRunning: boolean;
};

type Task = {
  unlock: (value?: unknown) => void;
  preError?: Error;
  inheritPreErr?: boolean;
};

// https://www.jpwilliams.dev/how-to-unpack-the-return-type-of-a-promise-in-typescript
type Unwrap<T> = T extends Promise<infer U>
  ? U
  : T extends (...args: any) => Promise<infer U>
  ? U
  : T extends (...args: any) => infer U
  ? U
  : T;

// Parameters: https://stackoverflow.com/questions/55386842/typescript-copying-only-function-arguments-and-not-return-type

type QueueTag = string | symbol;
type isInheritPreErr = boolean;

// interface TaskOption {
//   tag?: QueueTag,
//   inheritPreErr?: isInheritPreErr,
// }

type TaskQueuesType = Map<string | symbol, TaskQueue>;

type IAnyFn = (...args: any[]) => Promise<any> | any;

export const errMsg = {
  ClassDecorator:
    'You should specify non-null or non-empty string queueTag in option when using share queues',
  WrapNotag: 'You should specify queueTag in option when using share queues',
  iWraWrongTag: 'queueTag can not be null or empty string',
};

class PreviousError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PreviousError';
  }
}

const classDecoratorKey = Symbol('D4C');
export class D4C {
  static queues: TaskQueuesType = new Map<string | symbol, TaskQueue>();

  queues: TaskQueuesType;

  constructor() {
    this.queues = new Map<string | symbol, TaskQueue>();
  }

  public static register(tag: string | symbol): ClassDecorator {
    if (!tag) {
      throw new Error(errMsg.ClassDecorator);
    }

    return (target) => {
      Reflect.defineMetadata(classDecoratorKey, tag, target.prototype);
    };
  }

  public static staticSynchronized(
    inheritPreErr?: isInheritPreErr,
    nonBlockCurr?: boolean
  ) {
    // target = constructor
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const newFunc = D4C._q(
        null,
        originalMethod,
        { inheritPreErr, nonBlockCurr },
        target.prototype
      );
      descriptor.value = newFunc;
    };
  }

  public static synchronized(
    inheritPreErr?: isInheritPreErr,
    nonBlockCurr?: boolean
  ) {
    // target = prototype
    return function (
      target: any,
      propertyKey: string,
      descriptor: PropertyDescriptor
    ) {
      const originalMethod = descriptor.value;
      const newFunc = D4C._q(
        null,
        originalMethod,
        { inheritPreErr, nonBlockCurr },
        target
      );
      descriptor.value = newFunc;
    };
  }

  public static apply<T extends IAnyFn>(
    func: T,
    option: {
      tag?: string | symbol;
      inheritPreErr?: isInheritPreErr;
      nonBlockCurr?: boolean;
      args?: Parameters<typeof func>;
    }
  ): Promise<Unwrap<typeof func>> {
    const res = D4C.wrap(func, option).apply(null, option.args);
    return res;
  }

  public static wrap<T extends IAnyFn>(
    func: T,
    option: {
      tag?: string | symbol;
      inheritPreErr?: isInheritPreErr;
      nonBlockCurr?: boolean;
    }
  ): (
      ...args: Parameters<typeof func>
    ) => Promise<Unwrap<typeof func>> {
    if (!option?.tag) {
      throw new Error(errMsg.WrapNotag);
    }
    return D4C._q(null, func, option);
  }

  public iapply<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: isInheritPreErr;
      nonBlockCurr?: boolean;
      args?: Parameters<typeof func>;
    }
  ): Promise<Unwrap<typeof func>> {
    const resp = this.iwrap(func, option).apply(null, option.args);
    return resp;
  }

  public iwrap<T extends IAnyFn>(
    func: T,
    option?: {
      tag?: string | symbol;
      inheritPreErr?: isInheritPreErr;
      nonBlockCurr?: boolean;
    }
  ): (
      ...args: Parameters<typeof func>
    ) => Promise<Unwrap<typeof func>> {
    if (option && (option.tag === null || option.tag === '')) {
      throw new Error(errMsg.iWraWrongTag);
    }
    return D4C._q(this.queues, func, option);
  }

  static _q<T extends IAnyFn>(
    queues: TaskQueuesType,
    func: T,
    option?: {
      tag?: QueueTag;
      inheritPreErr?: isInheritPreErr;
      nonBlockCurr?: boolean;
    },
    prototype?: any
  ): (
      ...args: Parameters<typeof func>
    ) => Promise<Unwrap<typeof func>> {
    return async function (...args: any[]): Promise<any> {
      /** Assign queues */
      let taskQueue: TaskQueue;
      let currTaskQueues: TaskQueuesType;
      if (!queues) {
        // console.log("static case (global/decorator)")
        currTaskQueues = D4C.queues;
      } else {
        // console.log("instance case")
        currTaskQueues = queues;
      }

      /** Detect tag */
      let tag: QueueTag;
      if (option?.tag) {
        // console.log("static-global or instance")
        tag = option.tag;
      } else {
        //** either static+decorator case OR instance case with no tag. Try to get tag from Reflect.getMetadata*/
        let queueTag: QueueTag;
        if (prototype) {
          queueTag = Reflect.getMetadata(classDecoratorKey, prototype);
        }
        if (queueTag) {
          // console.log("decorator case !!!!")
          tag = queueTag;
        } else {
          // console.log("instance case: use default tag")
          tag = classDecoratorKey;
        }
      }

      /** Get sub-queue  */
      taskQueue = currTaskQueues.get(tag);
      if (!taskQueue) {
        taskQueue = {
          queue: new Denque(),
          isRunning: false,
        };
        currTaskQueues.set(tag, taskQueue);
      }

      /** Detect if the queue is running or not, use promise to wait it if it is running */
      let result;
      let err: Error;
      let task: Task;
      if (taskQueue.isRunning) {
        const promise = new Promise(function (resolve) {
          task = {
            unlock: resolve,
            preError: null,
            inheritPreErr: option?.inheritPreErr,
          };
        });
        taskQueue.queue.push(task);
        await promise;
      } else {
        taskQueue.isRunning = true;
        if (option?.nonBlockCurr) {
          await Promise.resolve();
        }
      }

      /** Run the task */
      if (task?.preError) {
        err = new PreviousError(task.preError.message ?? task.preError);
      } else {
        try {
          const value = func.apply(this, args);

          /** Detect if it is a async/promise function or not */
          // ref: https://lsm.ai/posts/7-ways-to-detect-javascript-async-function/
          if (value && typeof value.then === 'function') {
            result = await value;
          } else {
            result = value;
          }
        } catch (error) {
          err = error;
        }
      }

      /** After the task is executed, check the following tasks */
      if (taskQueue.queue.length > 0) {
        const nextTask: Task = taskQueue.queue.shift();
        /** Pass error to next task */
        if (err && nextTask.inheritPreErr) {
          nextTask.preError = err;
        }
        nextTask.unlock();
      } else {
        taskQueue.isRunning = false;
      }

      if (err) {
        throw err;
      }

      return result;
    } as (
        ...args: Parameters<typeof func>
      ) => Promise<Unwrap<typeof func>>;
  }
}
