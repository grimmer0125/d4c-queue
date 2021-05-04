class Node<T> {
  public next: Node<T> | null = null;
  public prev: Node<T> | null = null;
  constructor(public data: T) {
  }
}

export class Queue<T> {
  private head: Node<T> | null = null;
  private tail: Node<T> | null = null;
  public length = 0;

  public push(data: T) {
    const node = new Node(data);
    if (this.tail) {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    } else {
      this.head = node;
      this.tail = node;
    }
    this.length += 1;
    return
  }

  public shift() {
    if (this.length > 0) {
      this.length -= 1;
      const node = this.head;
      if (node.next) {
        this.head = node.next;
        this.head.prev = null;
      } else {
        this.head = null;
        this.tail = null;
      }
      return node.data;
    }
    return undefined;
  }
}

