import test from 'ava';

import { Queue } from "./Queue"
test("Test FIFO queue", (t) => {
  const queue = new Queue<number>();
  queue.push(1);
  queue.push(2);
  t.is(queue.shift(), 1);
  t.is(queue.shift(), 2);
  t.is(queue.shift(), undefined);
  t.is(queue.length, 0)
  queue.push(3);
  t.is(queue.shift(), 3);

  const strQueue = new Queue<string>();
  strQueue.push("1");
  strQueue.push("2");
  t.is(strQueue.shift(), "1");
  t.is(strQueue.shift(), "2");
  t.is(strQueue.shift(), undefined);
});
