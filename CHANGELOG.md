# [2.1.0](https://github.com/ahmed-musallam/hono-openwhisk-adapter/compare/v2.0.1...v2.1.0) (2026-05-06)

### Features

- ship CommonJS alongside ESM ([d2f8d74](https://github.com/ahmed-musallam/hono-openwhisk-adapter/commit/d2f8d74382c6742c814dbec50d5b3dafd76280cc))

## [2.0.1](https://github.com/ahmed-musallam/hono-openwhisk-adapter/compare/v2.0.0...v2.0.1) (2026-03-06)

### Bug Fixes

- headers should always be outside error in error response ([b46dc7b](https://github.com/ahmed-musallam/hono-openwhisk-adapter/commit/b46dc7bc3da9c4ad87cbbde049f72fa31b588062))

# [2.0.0](https://github.com/ahmed-musallam/hono-openwhisk-adapter/compare/v1.0.0...v2.0.0) (2026-03-06)

- refactor!: generic param validation, error handling, and binary support ([deae72b](https://github.com/ahmed-musallam/hono-openwhisk-adapter/commit/deae72bb0d08612fa44f0cb2cbc27c43bf94e7d7))

### BREAKING CHANGES

- The `ToOpenWhiskAction` signature now accepts an optional `validateOwParams` function and no longer takes a logger.
- `OwActionResponse` for non-2xx statuses now uses an `error` field.

# 1.0.0 (2026-03-05)

### Features

- hono adapter initial imple ([48b4cb5](https://github.com/ahmed-musallam/hono-openwhisk-adapter/commit/48b4cb530ca9fd75a533fc172a3aec2a9ed5ee57))
