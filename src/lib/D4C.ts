import Denque from 'denque';
import 'reflect-metadata';

type Task = {
  unlock: (value?: unknown) => void;
  preError?: Error;
  inheritPreErr?: boolean;
};

type TaskQueue = {
  queue: Denque<Task>;
  isRunning: boolean;
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
  ClassDecorator:
    'Only non-null or non-empty string queueTag is valid in option when using share queues',
  WrapNotag: 'queueTag needs to be passed in option when using share queues',
  iWraWrongTag: 'queueTag can not be null or empty string',
  wrongDecoratorOption: "not valid option when using decorators",
  noSynchronizedAvailableOK: "noClassDefaultTagORdecoratorTagAvailable"
};

class PreviousError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PreviousError';
  }
}

export function defaultTag(tag: string | symbol): ClassDecorator {
  return D4C.register(tag);
}
export function synchronized(
  target: any,
  propertyKey: string, // usually it is the name of the method
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
  return D4C.synchronized(targetOrOption, propertyKey, descriptor);
}

export function dWrap<T extends IAnyFn>(
  func: T,
  option: {
    tag?: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
  }
): (
    ...args: Parameters<typeof func>
  ) => Promise<Unwrap<typeof func>> {
  return D4C.wrap(func, option);
}

export function dApply<T extends IAnyFn>(
  func: T,
  option: {
    tag?: string | symbol;
    inheritPreErr?: boolean;
    noBlockCurr?: boolean;
    args?: Parameters<typeof func>;
  }
): Promise<Unwrap<typeof func>> {
  return D4C.apply(func, option);
}

const classDecoratorKey = Symbol('D4C');
export class D4C {
  static queues: TaskQueuesType = new Map<string | symbol, TaskQueue>();

  queues: TaskQueuesType;

  constructor() {
    this.queues = new Map<string | symbol, TaskQueue>();
  }

  static register(defaultTag: string | symbol): ClassDecorator {
    if (!defaultTag) {
      throw new Error(errMsg.ClassDecorator);
    }

    return (target) => {
      Reflect.defineMetadata(classDecoratorKey, defaultTag, target.prototype);
    };
  }

  static synchronized(
    target: any,
    propertyKey: string, // usually it is the name of the method
    descriptor: PropertyDescriptor): void;
  static synchronized(
    option?: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
    }): MethodDecoratorParameter;
  static synchronized(
    targetOrOption?: any,
    propertyKey?: string,
    descriptor?: PropertyDescriptor
  ): void | MethodDecoratorParameter {

    /**
     * problem is target in instance method & option both are object 
     * so the below check is complicated
     */

    /** if class has a static member call inheritPreErr, even no using parentheses, 
     * targetOrOption will have targetOrOption property but its type is function */
    function checkIfOptionObject(obj: any): boolean {
      if (obj === undefined || obj === null) {
        return true;
      }

      /**
       * hasOwnProperty should be false since it is a literal object 
       */
      //eslint-disable-next-line
      if (typeof obj === "object" && !obj.hasOwnProperty("constructor") && (Object.keys(obj).length === 0 ||
        typeof obj.inheritPreErr === "boolean" ||
        typeof obj.noBlockCurr === "boolean" ||
        typeof obj.tag === "string" || typeof obj.tag === "symbol")) {
        return true
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
        const originalMethod = descriptor.value;
        const newFunc = D4C._q(
          null,
          originalMethod,
          targetOrOption,
          target.prototype ?? target
        );
        descriptor.value = newFunc;
      };
    } else {
      /** no parentheses case */
      const type = typeof targetOrOption;

      /** static method decorator case: target type is constructor function. use target.prototype
       * method decorator case: target is a prototype object, not literally object. use target 
       * descriptor.value.name === propertyKey is really needed & always correct? */
      if ((type === "function" || targetOrOption.hasOwnProperty("constructor")) && // eslint-disable-line
        typeof propertyKey === "string" &&
        typeof descriptor === "object" && typeof descriptor.value === "function" &&
        descriptor.value.name === propertyKey) {
        const originalMethod = descriptor.value;
        const newFunc = D4C._q(
          null,
          originalMethod,
          {},
          targetOrOption.prototype ?? targetOrOption
        );
        descriptor.value = newFunc
      } else {
        throw new Error(errMsg.wrongDecoratorOption);
      }
    }
  }

  static apply<T extends IAnyFn>(
    func: T,
    option: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
      args?: Parameters<typeof func>;
    }
  ): Promise<Unwrap<typeof func>> {
    const res = D4C.wrap(func, option).apply(null, option.args);
    return res;
  }

  static wrap<T extends IAnyFn>(
    func: T,
    option: {
      tag?: string | symbol;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
    }
  ): (
      ...args: Parameters<typeof func>
    ) => Promise<Unwrap<typeof func>> {
    if (!option?.tag) {
      throw new Error(errMsg.WrapNotag);
    }
    return D4C._q(null, func, option);
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
    const resp = this.wrap(func, option).apply(null, option.args);
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
    if (option && (option.tag === null || option.tag === '')) {
      throw new Error(errMsg.iWraWrongTag);
    }
    return D4C._q(this.queues, func, option);
  }

  private static _q<T extends IAnyFn>(
    queues: TaskQueuesType,
    func: T,
    option?: {
      tag?: QueueTag;
      inheritPreErr?: boolean;
      noBlockCurr?: boolean;
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
        /** static case (global/decorator) */
        currTaskQueues = D4C.queues;
      } else {
        /** instance case */
        currTaskQueues = queues;
      }

      /** Detect tag */
      let tag: QueueTag;
      if (option?.tag) {
        /** static-global or instance or static-decorator-custom-tag*/
        tag = option.tag;
      } else {
        /**
         *  either static+decorator case OR instance case with no tag
         */
        let classDefaultTag: QueueTag;
        if (prototype) {
          /** decorator case */
          classDefaultTag = Reflect.getMetadata(classDecoratorKey, prototype);
          if (classDefaultTag) {
            tag = classDefaultTag;
          } else {
            throw new Error(errMsg.noSynchronizedAvailableOK)
          }
        }

        /** instance case: use default tag */
        tag = classDecoratorKey;
      }


      /** Get sub-queue */
      taskQueue = currTaskQueues.get(tag);
      if (!taskQueue) {
        taskQueue = {
          queue: new Denque<Task>(),
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
        if (option?.noBlockCurr) {
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
