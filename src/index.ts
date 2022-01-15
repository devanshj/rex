import * as Re from "react"

export type Behavior<T> = [value: T, unsubscribe: Unsubscribe]
export type Unsubscribe = () => void

export type Nothing = typeof nothing
export const nothing = Symbol("Rex.nothing")

type Subscribe = <T>(f: (value: T) => void) => ($: Behavior<T>) => void
export const subscribe: Subscribe = f => ([t, _]) => Re.useEffect(() => f(t), [t])

type SubscribeE = <T>(f: (value: Exclude<T, Nothing>) => void) => ($: Behavior<T>) => void
type SubscribeEImpl = (f: (value: T_) => void) => ($: Behavior<T_ | Nothing>) => void
const subscribeEImpl: SubscribeEImpl = f => ([t, _]) => {
  Re.useEffect(() => {
    if (t !== nothing) f(t)
  }, [t])
}
export const subscribeE = subscribeEImpl as SubscribeE

type Value = <T>($: Behavior<T>) => T
export const value: Value = $ => $[0]

type Unsubscriber = ($: Behavior<unknown>) => Unsubscribe
export const unsubscriber: Unsubscriber = $ => $[1]

// ----------------------------------------
// Subjects

type CreateBehavior = <T>(initialValue: T) =>
  [behavior: Behavior<T>, send: (t: T) => void]

export const createBehavior: CreateBehavior = a => {
  let [x, setX] = Re.useState(() => a)
  let didUnsubscribe = Re.useRef(false)

  let next = Re.useCallback(x => !didUnsubscribe.current && setX(x), [])
  let d = Re.useCallback(() => didUnsubscribe.current = true, [])

  return [[x, d], next]
}

type CreateEvent = <T>() =>
  [behavior: Behavior<T | Nothing>, send: (t: T | Nothing) => void]

export const createEvent =
  (() => createBehavior(nothing)) as CreateEvent

type T_ = { __isT: true }
type U_ = { __isU: true }

// ----------------------------------------
// Functor instance

type Map =
  <T, U>(f: (t: Exclude<T, Nothing>) => U) =>
    (t$: Behavior<T>) => Behavior<U | Extract<T, Nothing>>

type MapImpl = 
  (f: (t: T_) => U_) =>
    (t$: Behavior<T_ | Nothing>) => Behavior<U_ | Nothing>

const mapImpl: MapImpl =
  f => ([t, d]) => [t !== nothing ? f(t) : nothing, d]

export const map = mapImpl as Map


// ----------------------------------------
// Applicative instance

type Of = <A>(a: A) => Behavior<A>
export const of: Of = a => [Re.useState(() => a)[0], Re.useState(() => () => {})[0]]

// ----------------------------------------
// Apply instance (lift1, lift2, lift3, lift4, ..., liftN)

type Combine =
  <T extends Behavior<unknown>[], U>
    ( $s: [...T]
    , f:
      ( vs: 
        { [I in keyof T]:
            T[I] extends Behavior<infer U> ? Exclude<U, Nothing> : never
        }
      ) => U
    ) =>
      Behavior<
        | U
        | Extract<
            { [I in keyof T]:
                T[I] extends Behavior<infer V> ? V : never
            }[number],
            Nothing
          >
      >

type CombineImpl = 
  ( $s: Behavior<T_ | Nothing>[]
  , f: (vs: T_[]) => U_
  ) =>
    Behavior<U_ | Nothing>

const combineImpl: CombineImpl = ($s, f) => {
  let ts = $s.map(value).map(tryLastJust)
  let ds = $s.map(unsubscriber)

  return [
    aEvery(ts, isNotNothing) ? f(ts) : nothing,
    Re.useCallback(() => ds.forEach(d => d()), [...ds])
  ]
}

export const combine = combineImpl as Combine

type UseLastJust = <T>(t: T) => T | Extract<T, Nothing>
type UseLastJustImpl = (t: T_ | Nothing) => T_ | Nothing
const useLastJustImpl: UseLastJustImpl = t => {
  let lastJust = Re.useRef(t)
  Re.useEffect(() => {
    if (t !== nothing) lastJust.current === t
  }, [t])

  return t === nothing ? lastJust.current : nothing
}
const tryLastJust = useLastJustImpl as UseLastJust

type AEvery = <T extends unknown[], U>(t: T, p: (t: T[number]) => t is U) => t is T & U[]
const aEvery = ((t: any[], p: any) => t.every(p)) as any as AEvery

const isNotNothing =
  <T>(t: T): t is Exclude<T, Nothing> => (t as {}) !== nothing

// ----------------------------------------
// Bind instance



type SwitchMap = <T, U>(f: (t: T) => Behavior<U>) => (t$: Behavior<T>) => Behavior<U>
export const switchMap: SwitchMap = f => ([t, dt]) => {
  let [u, du] = createChildBehavior(f, t)

  let previousDu = Re.useRef(undefined as Unsubscribe | undefined)
  Re.useEffect(() => {
    previousDu.current && previousDu.current()
    previousDu.current = du
  }, [du])
  
  return [u, Re.useCallback(() => (du(), dt()), [du, dt])];
}

type SwitchMapContext = 
  | { isActive: false }
  | { isActive: true, value: unknown }

type SwitchMapContextImpl = 
  | { isActive: boolean, value: unknown }

const switchMapContextImpl: SwitchMapContextImpl =
  { isActive: false, value: undefined }

export const switchMapContext =
  switchMapContextImpl as SwitchMapContext

const createChildBehavior = <T, U>(f: (t: T) => Behavior<U>, t: T) => {
  let $: Behavior<U>
  let old = { ...switchMapContextImpl }
  switchMapContextImpl.isActive = true
  switchMapContextImpl.value = t
  $ = f(t)
  switchMapContextImpl.isActive = old.isActive
  switchMapContextImpl.value = old.value
  return $
}


// ----------------------------------------
// Fold instance

type Fold =
  <T, U>(f: (u: U, t: Exclude<T, Nothing>) => U, u: U) =>
    (t$: Behavior<T>) => Behavior<U | Extract<T, Nothing>>

type FoldImpl = 
  (f: (u: U_, t: T_) => U_, u: U_) =>
    (t$: Behavior<T_ | Nothing>) => Behavior<U_ | Nothing>

const foldImpl: FoldImpl = (f, u) => ([t, d]) => {
  let [x, setX] = Re.useState(() => u)

  if (switchMapContext.isActive) {
    let w = switchMapContext.value
    Re.useEffect(() => {
      if (w !== nothing) setX(u)
    }, [w])
  }

  Re.useEffect(() => {
    if (t !== nothing) setX(f(x, t))
  }, [t])

  return [x, d]
}

export const fold = foldImpl as Fold


// ----------------------------------------
// Monoid instance

export type Never = Behavior<Nothing>
export const never: Never = [nothing, () => {}]


type Merge =
  <T extends Behavior<unknown>[]>
    ($s: [...T]) =>
      Behavior<
        { [I in keyof T]:
            T[I] extends Behavior<infer V> ? V : never
        }[number]
      >

type MergeImpl = 
  ($s: Behavior<T_ | Nothing>[]) => Behavior<T_ | Nothing>

const mergeImpl: MergeImpl = $s => {
  let ts = $s.map(value)
  let ds = $s.map(unsubscriber)

  const selectFirst = () => {
    for (let t of ts) if (t !== nothing) return t
    return nothing
  }
  let [u, setU] = Re.useState(selectFirst)

  if (switchMapContext.isActive) {
    let w = switchMapContext.value
    Re.useEffect(() => {
      if (w !== nothing) setU(selectFirst)
    }, [w])
  }

  for (let t of ts) {
    Re.useEffect(() => {
      setU(t)
    }, [t])
  }

  return [u, Re.useCallback(() => ds.forEach(d => d()), [...ds])];
}
export const merge = mergeImpl as Merge


// ----------------------------------------
// Filterable instance

type Filter =
  <T, U extends Exclude<T, Nothing> = Exclude<T, Nothing>>
    ( f:
      | ((t: Exclude<T, Nothing>) => t is U)
      | ((t: Exclude<T, Nothing>) => boolean)
    ) =>
      (t$: Behavior<T>) => Behavior<U | Nothing>

type FilterImpl =
  ( f:
    | ((t: T_ | U_) => t is U_)
    | ((t: T_ | U_) => boolean)
  ) =>
    (t$: Behavior<T_ | U_ | Nothing>) => Behavior<U_ | Nothing>

const filterImpl: FilterImpl = p => ([t, d]) =>
  [t === nothing ? nothing : p(t) ? t : nothing, d]

export const filter = filterImpl as Filter


type Take = <T>(n: number) => ($: Behavior<T>) => Behavior<T | Nothing>
type TakeImpl = (n: number) => ($: Behavior<T_ | Nothing>) => Behavior<T_ | Nothing>
const takeImpl: TakeImpl = n => ([t, d]) => {
  if (n === 0) console.error("[@devanshj/rex] `Rex.take` expected a number >= 0")
  let c = Re.useRef(0)

  if (switchMapContext.isActive) {
    let w = switchMapContext.value
    Re.useEffect(() => {
      if (w !== nothing) c.current = 0
    }, [w])
  }

  Re.useEffect(() => {
    if (t === nothing) return
    if (c.current === n) d()
    c.current++
  }, [t])

  return [t, d]
}
export const take = takeImpl as Take


type TakeUntil = <T>(a$: Behavior<unknown>) => ($: Behavior<T>) => Behavior<T | Nothing>
export const takeUntil: TakeUntil = ([a, _]) => ([t, dt]) => {
  Re.useEffect(() => {
    if (a === nothing) return
    dt()
  }, [a])

  return [t, dt]
}


// ----------------------------------------
// Canonical interop

type From =
  <T>($: (next: (t: T) => void) => () => void) => Behavior<T | Nothing>

export const from: From = $ => {
  let [x, setX] = Re.useState(nothing as Parameters<Parameters<typeof $>[0]>[0] | Nothing)
  let [d, setD] = Re.useState(() => () => {})

  Re.useEffect(() => {
    if (switchMapContext.isActive && switchMapContext.value === nothing) return
    let d = $(setX)
    setD(d)

    return d
  }, [$, ...(switchMapContext.isActive ? [switchMapContext.value] : [])])

  return [x, d]
}


// ----------------------------------------
// EventTarget interop 

export const fromEventTarget = <T extends Event>(target: EventTarget, type: string) =>
  from(Re.useCallback($ => {
    target.addEventListener(type, $ as (e: Event) => void)
    return () => target.removeEventListener(type, $ as (e: Event) => void)
  }, [target, type])) as Behavior<T>


// ----------------------------------------
// setTimeout interop

type Timeout =
  (duration: number) =>
    Behavior<{} | Nothing>

export const timeout: Timeout = (duration) =>
  from<{}>(Re.useCallback($ => {
    let i = window.setTimeout(() => $({}), duration)
    return () => window.clearTimeout(i)
  }, [duration]))


// ----------------------------------------
// setInterval interop

type Interval =
  <L extends boolean = false>
    (duration: number, options?: { leading?: L }) =>
      Behavior<{} | (L extends false ? never : Nothing)>

type IntervalImpl =
  (duration: number, options?: { leading?: boolean }) =>
    Behavior<{} | Nothing>

const intervalImpl: IntervalImpl = (duration, { leading = false } = {}) =>
  merge([
    ...(leading ? [of({})] : []),
    from<{}>(Re.useCallback($ => {
      let i = window.setTimeout(() => $({}), duration)
      return () => window.clearTimeout(i)
    }, [duration]))
  ])

export const interval = intervalImpl as Interval
