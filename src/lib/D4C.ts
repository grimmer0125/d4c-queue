
/* eslint-disable */
/** Using Denque is to get O(1) queue speed, using built-in array as FIFO queue will result in O(n) */
import Denque from "Denque";
import 'reflect-metadata'


interface TaskQueue {
  queue: Denque,
  isRunning: Boolean
}

interface Task {
  unlock: (value?: unknown) => void,
  preError?: Error
  inheritPreErr?: boolean
}

type QueueTag = string | symbol;
type isInheritPreErr = boolean;

// interface TaskOption {
//   tag?: QueueTag,
//   inheritPreErr?: isInheritPreErr,
// }

type TaskQueuesType = Map<string | symbol, TaskQueue>;

type IAsyncFn = (...args: any[]) => Promise<any>;

class PreviousError extends Error {
  constructor(message) {
    super(message);
    this.name = "PreviousError";
  }
}

const classDecoratorKey = Symbol("D4C");
export default class D4C {
  static queues: TaskQueuesType = new Map<string | symbol, TaskQueue>();

  queues: TaskQueuesType;

  constructor() {
    this.queues = new Map<string | symbol, TaskQueue>();
  }

  public static classRegister(tag: QueueTag): ClassDecorator {
    if (!tag) {
      throw new Error('You should specify non-null or non-empty string queueTag in option when using share queues');
    }

    return (target) => {
      Reflect.defineMetadata(classDecoratorKey, tag, target.prototype);
    };
  }

  public static staticMethodDecorator(inheritPreErr?: isInheritPreErr) {
    // target = constructor 
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const newFunc = D4C._q(null, originalMethod, { inheritPreErr }, target.prototype);
      descriptor.value = newFunc;
    };
  }

  public static methodDecorator(inheritPreErr?: isInheritPreErr) {
    // target = prototype
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;
      const newFunc = D4C._q(null, originalMethod, { inheritPreErr }, target);
      descriptor.value = newFunc;
    };
  }

  public static apply<T extends IAsyncFn>(async_func: T, option: {
    tag?: QueueTag,
    inheritPreErr?: isInheritPreErr,
    args?: Parameters<typeof async_func>
  }): ReturnType<typeof async_func> {
    const res = D4C.wrap(async_func, option).apply(null, option.args);
    return res;
  }

  public static wrap<T extends IAsyncFn>(async_func: T, option: {
    tag?: QueueTag,
    inheritPreErr?: isInheritPreErr,
  }): T {
    if (!option?.tag) {
      throw new Error('You should specify queueTag in option when using share queues');
    }
    return D4C._q(null, async_func, option);
  }

  public iapply<T extends IAsyncFn>(async_func: T, option?: {
    tag?: QueueTag,
    inheritPreErr?: isInheritPreErr,
    args?: Parameters<typeof async_func>
  }): ReturnType<typeof async_func> {
    const resp = this.iwrap(async_func, option).apply(null, option.args);
    return resp;
  }

  public iwrap<T extends IAsyncFn>(async_func: T, option?: {
    tag?: QueueTag,
    inheritPreErr?: isInheritPreErr,
  }): T {
    if (option && (option.tag === null || option.tag === "")) {
      throw new Error('queueTag can not be null or empty string');
    }
    return D4C._q(this.queues, async_func, option);
  }

  static _q<T extends IAsyncFn>(queues: TaskQueuesType, async_func: T, option?: {
    tag?: QueueTag,
    inheritPreErr?: isInheritPreErr,
  }, prototype?: any): T {
    return (async function (...args: any[]): Promise<any> {

      /** Assign queues */
      let taskQueue: TaskQueue;
      let currTaskQueues: TaskQueuesType
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
        let queueTag: QueueTag
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
          isRunning: false
        }
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
            inheritPreErr: option?.inheritPreErr
          }
        });
        taskQueue.queue.push(task);
        await promise;
      } else {
        taskQueue.isRunning = true;
      }

      /** Run the task */
      if (task?.preError) {
        err = new PreviousError(task.preError.message ?? task.preError)
      } else {
        try {
          result = await async_func.apply(this, arguments);
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
    }) as T;
  }
}

