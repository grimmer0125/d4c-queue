# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.3.11](https://github.com/grimmer0125/d4c-queue/compare/v1.3.10...v1.3.101 (2021-05-04)

Fix internal queue bug

### [1.3.10](https://github.com/grimmer0125/d4c-queue/compare/v1.3.6...v1.3.10) (2021-05-04)

Implement a FIFO queue instead of using third party library, denque

### [1.3.6](https://github.com/grimmer0125/d4c-queue/compare/v1.3.4...v1.3.6) (2021-05-03)

Improve tests to 100% coverage

### [1.3.4](https://github.com/grimmer0125/d4c-queue/compare/v1.3.4...v1.3.0) (2021-05-02)

Improve documentation and tests, and fix a bug about empty arguments in d4c.apply

### [1.3.0](https://github.com/grimmer0125/d4c-queue/compare/v1.2.6...v1.3.0) (2021-05-02)

#### ⚠ BREAKING CHANGES

Improve queue system & API breaking change & back to es6 for main build

Improve the queue system, no more global usage and static queues

Each instance/class is isolated with the others. API is breaking change.

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

```
D4C.apply -> dApply
D4C.wrap -> dWrap
D4C.synchronized -> synchronized
D4C.register -> defaultTag
```

Change instance method naming:

```
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
- instance usage
- decorator usage.
