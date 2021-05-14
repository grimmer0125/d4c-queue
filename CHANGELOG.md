# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

Those versions which only include documentation change might not be included here.

### [1.6.0](https://github.com/grimmer0125/d4c-queue/compare/v1.5.10...v1.6.0) (2021-05-07)

⭐ Decorator concurrency mode ⭐ is added.

```ts
@QConcurrency([
  { limit: 100, isStatic: true },
  { limit: 50, tag: '2' },
])
class TestController {
  @concurrent
  static async fetchData(url: string) {}
```

#### ⚠ BREAKING CHANGES

```ts
// orig: only setup one queue, omitting tag will apply default queue and new tag queue
d4c = new D4C({ concurrency: { limit: 100 } });
d4c.setConcurrency({ limit: 10 });

// new. to setup multiple queue, omitting tag will only for deafult queue and not apply on new tag queue
d4c = new D4C([{ concurrency: { limit: 100 } }]);
d4c.setConcurrency([{ limit: 10 }]);
```

### [1.5.10](https://github.com/grimmer0125/d4c-queue/compare/v1.5.9...v1.5.10) (2021-05-07)

#### ⚠ BREAKING CHANGES

```ts
/** orig */
d4c.setQueue({ concurrency: 10 });

/** new, rename parameter */
d4c.setConcurrency({ limit: 10 });
```

- Allow D4C constructor can setup tag queue concurrency limit. `const d4c = new D4C({ limit: 100, tag: '2' });`
- Improve README.

### [1.5.9](https://github.com/grimmer0125/d4c-queue/compare/v1.5.4...v1.5.9) (2021-05-07)

Add TypeDoc site and refactor code and improve some test.

### [1.5.4](https://github.com/grimmer0125/d4c-queue/compare/v1.5.0...v1.5.4) (2021-05-07)

#### ⚠ BREAKING CHANGES

```ts
const d4c = new D4C(100);
```

To

```ts
const d4c = new D4C({ concurrency: 100 });
```

### [1.5.0](https://github.com/grimmer0125/d4c-queue/compare/v1.4.5...v1.5.0) (2021-05-07)

⭐ New API ⭐ and minor bug fixes

Add concurrency mode support for D4C instance usage. Previous it only supports synchronization mode (concurrency = 1).

```ts
const d4c = new D4C(100);
d4c.setQueue({ concurrency: 10 }); // change default concurrency from 1 to 10
d4c.setQueue({ concurrency: 10, tag: 'queue2' }); // concurrency for queue2
```

### [1.4.2](https://github.com/grimmer0125/d4c-queue/compare/v1.4.1...v1.4.2) (2021-05-06)

Remove reflect-metadata

### [1.4.1](https://github.com/grimmer0125/d4c-queue/compare/v1.4.0...v1.4.1) (2021-05-05)

Fix security vulnerabilities

### [1.4.0](https://github.com/grimmer0125/d4c-queue/compare/v1.3.12...v1.4.0) (2021-05-05)

#### ⚠ BREAKING CHANGES

Remove `@injectQ` decorator. Dynamically inject queues only when applying `@synchronized`.

### [1.3.12](https://github.com/grimmer0125/d4c-queue/compare/v1.3.11...v1.3.12) (2021-05-04)

Add changelog link in README

### [1.3.11](https://github.com/grimmer0125/d4c-queue/compare/v1.3.10...v1.3.11) (2021-05-04)

Fix internal queue bug

### [1.3.10](https://github.com/grimmer0125/d4c-queue/compare/v1.3.6...v1.3.10) (2021-05-04)

Implement a FIFO queue instead of using third party library, denque

### [1.3.6](https://github.com/grimmer0125/d4c-queue/compare/v1.3.4...v1.3.6) (2021-05-03)

Improve tests to 100% coverage

### [1.3.4](https://github.com/grimmer0125/d4c-queue/compare/v1.3.0...v1.3.4) (2021-05-02)

Improve documentation and tests, and fix a bug about empty arguments in d4c.apply

### [1.3.0](https://github.com/grimmer0125/d4c-queue/compare/v1.2.6...v1.3.0) (2021-05-02)

#### ⚠ BREAKING CHANGES

- Improve queue system. Each instance/class is isolated with the others.
- API breaking change. No more global usage. no more ~~dApply, dWrap~~, and add needed `@injectQ`.
- back to es6 for main build.

original:

```ts
import { D4C, dApply, dWrap, synchronized } from 'd4c-queue';

/** global usage*/
const asyncFunResult = await dWrap(asyncFun, { tag: 'queue1' })(
  'asyncFun_arg1',
  'asyncFun_arg2'
);

/** instance usage */
const d4c = new D4C();
d4c.apply(async);

/** decorator usage */
class ServiceAdapter {
  @synchronized
  async connect() {}
}
```

becomes

```ts
import { D4C, injectQ, synchronized } from 'd4c-queue';

/** instance usage */
d4c.apply(syncFun, { args: ['syncFun_arg1'] });

/** decorator usage */
@injectQ
class ServiceAdapter {
  @synchronized
  async connect() {}
}
```

### [1.2.6](https://github.com/grimmer0125/d4c-queue/compare/v1.2.3...v1.2.6) (2021-05-01)

- Inject default tag, and fix decorator defaultTag not take effect bug

- Also fix a bug that class decorator defaultTag will be overwritten by
  some default tag.

### [1.2.3](https://github.com/grimmer0125/d4c-queue/compare/v1.2.2...v1.2.3) (2021-04-29)

Try to build es5 package for main build

### [1.2.2](https://github.com/grimmer0125/d4c-queue/compare/v1.2.0...v1.2.2) (2021-04-29)

Fix exporting module

### [1.2.0](https://github.com/grimmer0125/d4c-queue/compare/v1.1.5...v1.2.0) (2021-04-29)

#### ⚠ BREAKING CHANGES

Refactor API and instance method renaming

Change static method to public function:

```ts
D4C.apply -> dApply
D4C.wrap -> dWrap
D4C.synchronized -> synchronized
D4C.register -> defaultTag
```

Change instance method naming:

```ts
iapply -> apply
iwrap -> wrap
```

### [1.1.5](https://github.com/grimmer0125/d4c-queue/compare/v1.1.4...v1.1.5) (2021-04-28)

Fix the bug about optional tag in @D4C.synchronized

### [1.1.4](https://github.com/grimmer0125/d4c-queue/compare/v1.1.0...v1.1.4) (2021-04-28)

Add optional tag in @D4C.synchronized and fix 1.1.0 API change bug

### [1.1.0](https://github.com/grimmer0125/d4c-queue/compare/v1.0.0...v1.1.0) (2021-04-28)

#### ⚠ BREAKING CHANGES

Change API to let method decorator receive an option object, like global/instance usage.
Also rename parameter, `nonBlockCurr` to `noBlockCurr`.

### 1.0.0 (2021-04-28)

First release to https://www.npmjs.com/package/d4c-queue/v/1.0.0

Features

- global usage

```ts
D4C.wrap(asyncFun, { tag: 'queue1' })('asyncFun_arg1', 'asyncFun_arg2');
```

- instance usage

```ts
const d4c = new D4C();
d4c.iwrap(asyncFun, { tag: 'queue1' })('asyncFun_arg1', 'asyncFun_arg2');
```

- decorator usage.

```ts
@D4C.register(Symbol('jojo'))
class ServiceAdapter {
  @D4C.synchronized
  client_send_message() {}
}
```
