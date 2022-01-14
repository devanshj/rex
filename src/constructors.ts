import { Behavior, nothing, Nothing, Unsubscribe, Event } from "."
import * as Re from "react"

// ----------------------------------------
// setTimeout interop

type Timeout =
  <L extends boolean = false>(duration: number, options?: { leading?: L }) =>
    Behavior<{} | (L extends false ? never : Nothing)>

type TimeoutImpl =
  (duration: number, options?: { leading?: boolean }) =>
    Event<{}>

const timeoutImpl: TimeoutImpl = (duration, { leading = false } = {}) => {
  let [x, setX] = Re.useState(leading ? {} : nothing)
  let [d, setD] = Re.useState(() => (() => {}) as Unsubscribe)

  Re.useEffect(() => {
    let i = window.setTimeout(() => setX({}))
    setD(() => window.clearTimeout(i))

    return () => window.clearTimeout(i)
  }, [duration])

  return [x, d]
}
export const timeout = timeoutImpl as Timeout

type TimeoutE =
  <W extends Nothing, L extends boolean = false>
    (duration: number, when: W, options?: { leading?: L }) =>
      Behavior<{} | (L extends false ? never : Nothing)>

type TimeoutEImpl =
  (duration: number, when: unknown, options?: { leading?: boolean }) =>
    Event<{}>

const timeoutEImpl: TimeoutEImpl = (duration, when, { leading = false } = {}) => {
  let [x, setX] = Re.useState(leading ? {} : nothing)
  let [d, setD] = Re.useState(() => (() => {}) as Unsubscribe)

  Re.useEffect(() => {
    if (when === nothing) return
    let i = window.setTimeout(() => setX({}))
    setD(() => window.clearTimeout(i))

    return () => window.clearTimeout(i)
  }, [when, duration])

  return [x, d]
}
export const timeoutE = timeoutEImpl as TimeoutE


// ----------------------------------------
// setInterval interop

type Interval =
  <L extends boolean = false>(duration: number, options?: { leading?: L }) =>
    Behavior<{} | (L extends false ? never : Nothing)>

type IntervalImpl =
  (duration: number, options?: { leading?: boolean }) =>
    Event<{}>

const intervalImpl: IntervalImpl = (duration, { leading = false } = {}) => {
  let [x, setX] = Re.useState(leading ? {} : nothing)
  let [d, setD] = Re.useState(() => (() => {}) as Unsubscribe)

  Re.useEffect(() => {
    let i = window.setInterval(() => setX({}))
    setD(() => window.clearInterval(i))

    return () => window.clearTimeout(i)
  }, [duration])

  return [x, d]
}
export const interval = intervalImpl as Interval

type IntervalE =
  <W extends Nothing, L extends boolean = false>
    (duration: number, when: W, options?: { leading?: L }) =>
      Behavior<{} | (L extends false ? never : Nothing)>

type IntervalEImpl =
  (duration: number, when: unknown, options?: { leading?: boolean }) =>
    Event<{}>

const intervalEImpl: IntervalEImpl = (duration, when, { leading = false } = {}) => {
  let [x, setX] = Re.useState(leading ? {} : nothing)
  let [d, setD] = Re.useState(() => (() => {}) as Unsubscribe)

  Re.useEffect(() => {
    if (when === nothing) return
    let i = window.setInterval(() => setX({}))
    setD(() => window.clearInterval(i))
    
    return () => window.clearTimeout(i)
  }, [when, duration])

  return [x, d]
}
export const intervalE = intervalEImpl as IntervalE


// ----------------------------------------
// EventTarget interop

type FromEventTarget =
  (target: EventTarget, type: string) => Event<unknown>

export const fromEventTarget: FromEventTarget = (target, type) => {
  let [e, setE] = Re.useState(nothing as unknown)
  let [d, setD] = Re.useState(() => () => {})

  Re.useEffect(() => {
    target.addEventListener(type, setE)
    setD(() => target.removeEventListener(type, setE))
  }, [])

  return [e, d]
}

type FromEventTargetE =
  (target: EventTarget, type: string, when: unknown) => Event<unknown>

export const fromEventTargetE: FromEventTargetE = (target, type, when) => {
  let [e, setE] = Re.useState(nothing as unknown)
  let [d, setD] = Re.useState(() => () => {})

  Re.useEffect(() => {
    if (when === nothing) return
    target.addEventListener(type, setE)
    setD(() => target.removeEventListener(type, setE))
  }, [when])

  return [e, d]
}



// ----------------------------------------
// Canonical interop

type From =
  <T>($: (next: (t: T) => void) => () => void) => Event<T>

export const fromCanonical: From = $ => {
  let [e, setE] = Re.useState(nothing as Parameters<Parameters<typeof $>[0]>[0] | Nothing)
  let [d, setD] = Re.useState(() => () => {})

  Re.useEffect(() => {
    let d = $(setE)
    setD(d)
    return d
  }, [$])

  return [e, d]
}

type FromE =
  <T, W extends Nothing>($: (next: (t: T) => void) => () => void, when: W) => Event<T>

export const fromCanonicalE: FromE = ($, when) => {
  let [e, setE] = Re.useState(nothing as Parameters<Parameters<typeof $>[0]>[0] | Nothing)
  let [d, setD] = Re.useState(() => () => {})

  Re.useEffect(() => {
    if (when === nothing) return
    let d = $(setE)
    setD(d)
    return d
  }, [$])

  return [e, d]
}
