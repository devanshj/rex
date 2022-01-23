import * as Re from "react"

export type Behavior<T> =
  [ valueKeyed: [value: T, key: Key]
  , unsubscribe: Unsubscribe
  , setParent: ($: Behavior<unknown>) => void
  ]
type Key = string & { __isKey: true }
export type Unsubscribe = () => void

export type Nothing = typeof nothing
export const nothing = Symbol("Rex.nothing")

type Value = <T>($: Behavior<T>) => T
export const value: Value = $ => $[0][0]

type Unsubscriber = ($: Behavior<unknown>) => Unsubscribe
export const unsubscriber: Unsubscriber = $ => $[1]

const key = ($: Behavior<unknown>) => $[0][1]
const firstKey = "0" as Key
const nextKey = (key: Key) => (Number(key) + 1).toString() as Key
const next = <T>(t: T) => ([_, k]: [unknown, Key]): Behavior<T>[0] => [t, nextKey(k)]

type ParentSetter = <T>($: Behavior<T>) => (r$: Behavior<unknown>) => void
const parentSetter: ParentSetter = $ => $[2]

type SubscribeB = <T>(f: (value: T) => void) => ($: Behavior<T>) => void
export const subscribeB: SubscribeB = f => $ => {
  Re.useEffect(() => {
    f(value($))
  }, [key($)])
}

type Subscribe = <T>(f: (value: Exclude<T, Nothing>) => void) => ($: Behavior<T>) => void
type SubscribeImpl = (f: (value: T_) => void) => ($: Behavior<T_ | Nothing>) => void
const subscribeImpl: SubscribeImpl = f => $ =>
  l($, subscribeB(t => {
    if (t !== nothing) f(t)
  }))

export const subscribe = subscribeImpl as Subscribe


// ----------------------------------------
// Subjects

type CreateBehavior = <T>(initialValue: T) =>
  [behavior: Behavior<T>, send: (t: T) => void]

export const createBehavior: CreateBehavior = a => {
  let [[x, k], setX] = Re.useState([a, firstKey])
  let didUnsubscribe = Re.useRef(false)

  let next = Re.useCallback((x: typeof a) => {
    if (!didUnsubscribe.current) setX(([_, k]) => [x, nextKey(k)])
  }, [])
  let d = Re.useCallback(() => didUnsubscribe.current = true, [])

  return [[[x, k], d, () => {}], next]
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
  f => ([[t, k], d, r]) => [[t !== nothing ? f(t) : nothing, k], d, r]

export const map = mapImpl as Map


// ----------------------------------------
// Applicative instance

type Of = <A>(a: A) => Behavior<A>
export const of: Of = a =>
  [Re.useState([a, firstKey] as [typeof a, Key])[0], Re.useState(() => () => {})[0], () => {}]

// ----------------------------------------
// Apply instance (lift1, lift2, ...)

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
  let ts = $s.map(tryLastJust)
  let vs = ts.map(x => x[0])
  let ds = $s.map(unsubscriber)
  let k = $s.map(key).join("") as Key

  return [
    [aEvery(vs, isNotNothing) ? f(vs) : nothing, k],
    Re.useCallback(() => ds.forEach(d => d()), [...ds]),
    r$ => {
      for (let $ of $s) parentSetter($)(r$)
    }
  ]
}

export const combine = combineImpl as Combine

type UseLastJust = <T>(t: Behavior<T>) => Behavior<T | Extract<T, Nothing>>[0]
type UseLastJustImpl = (t: Behavior<T_ | Nothing>) => Behavior<T_ | Nothing>[0]
const useLastJustImpl: UseLastJustImpl = ([[x, k], _]) => {
  let lastJust = Re.useRef([x, k] as [typeof x, typeof k])
  Re.useEffect(() => {
    lastJust.current = [x, k]
  }, [k])

  return x === nothing ? lastJust.current : [x, k]
}
const tryLastJust = useLastJustImpl as UseLastJust

type AEvery = <T extends unknown[], U>(t: T, p: (t: T[number]) => t is U) => t is T & U[]
const aEvery = ((t: any[], p: any) => t.every(p)) as any as AEvery

const isNotNothing =
  <T>(t: T): t is Exclude<T, Nothing> => (t as {}) !== nothing


// ----------------------------------------
// Bind instance

type SwitchMap = <T, U>(f: (t: T) => Behavior<U>) => (t$: Behavior<T>) => Behavior<U>
export const switchMap: SwitchMap = f => $ => {
  let [u, du] = createChildBehavior(f, $)
  let dt = unsubscriber($)

  let previousDu = Re.useRef(undefined as Unsubscribe | undefined)
  Re.useEffect(() => {
    previousDu.current && previousDu.current()
    previousDu.current = du
  }, [du])
  
  return [
    u, Re.useCallback(() => (du(), dt()), [du, dt]),
    () => console.error("[@devanshj/rex]: Nested `switchMap` isn't implemented yet")
  ]
}

type ParentContext = 
  | { isPresent: false }
  | { isPresent: true, value: Behavior<unknown> }

type ParentContextImpl = 
  | { isPresent: boolean, value: Behavior<unknown> | undefined  }
 
const parentContextImpl: ParentContextImpl =
  { isPresent: false, value: undefined }

export const parentContext =
  parentContextImpl as ParentContext

const createChildBehavior = <T, U>(f: (t: T) => Behavior<U>, t$: Behavior<T>) => {
  let old = { ...parentContextImpl }
  parentContextImpl.isPresent = true
  parentContextImpl.value = t$
  let u$ = f(value(t$))
  parentSetter(u$)(t$)
  parentContextImpl.isPresent = old.isPresent
  parentContextImpl.value = old.value
  return u$
}


// ----------------------------------------
// Fold instance

type Fold =
  <T, U>(f: (u: U, t: Exclude<T, Nothing>) => U, u: U) =>
    (t$: Behavior<T>) => Behavior<U | Extract<T, Nothing>>

type FoldImpl = 
  (f: (u: U_, t: T_) => U_, u: U_) =>
    (t$: Behavior<T_ | Nothing>) => Behavior<U_ | Nothing>

const foldImpl: FoldImpl = (f, u) => ([tk, d, r]) => {
  let [[x, k], setX] = Re.useState([u, firstKey])

  if (parentContext.isPresent) {
    l(parentContext.value, subscribe(() => setX(next(u))))
  }
  l([tk, d, r], subscribe(t => setX(next(f(x, t)))))

  return [[x, k], d, r]
}

export const fold = foldImpl as Fold


// ----------------------------------------
// Monoid instance

export type Never = Behavior<Nothing>
export const never: Never = [[nothing, firstKey], () => {}, () => {}]


type Merge =
  <T extends Behavior<unknown>[]>
    ($s: [...T]) =>
      Behavior<
        Exclude<
          { [I in keyof T]:
              T[I] extends Behavior<infer V> ? V : never
          }[number],
          { [I in keyof T]:
              T[I] extends Behavior<Nothing> ? never : Nothing
          }[number]
        >
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
  let [u, setU] = Re.useState([selectFirst(), firstKey] as [T_ | Nothing, Key])
 
  for (let $ of $s) {
    l($, subscribe(u => setU(next(u))))
  }

  return [
    u, Re.useCallback(() => ds.forEach(d => d()), [...ds]),
    r$ => {
      for (let $ of $s) parentSetter($)(r$)
    }
  ]
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

const filterImpl: FilterImpl = p => ([[t, k], d, r]) =>
  [[t === nothing ? nothing : p(t) ? t : nothing, k], d, r]

export const filter = filterImpl as Filter


type Take = <T>(n: number) => ($: Behavior<T>) => Behavior<T | Nothing>
type TakeImpl = (n: number) => ($: Behavior<T_ | Nothing>) => Behavior<T_ | Nothing>
const takeImpl: TakeImpl = n => $ => {
  if (n === 0) console.error("[@devanshj/rex] `Rex.take` expected a number >= 0")
  let c = Re.useRef(0)

  if (parentContext.isPresent) {
    l(parentContext.value, subscribe(() => c.current = 0))
  }

  l($, subscribe(() => {
    if (c.current === n) unsubscriber($)()
    c.current++
  }))

  return $
}
export const take = takeImpl as Take


type TakeUntil = <T>(a$: Behavior<unknown>) => ($: Behavior<T>) => Behavior<T | Nothing>
export const takeUntil: TakeUntil = a$ => ([t, dt, r]) => {
  l(a$, subscribe(dt))
  return [t, dt, r]
}


// ----------------------------------------
// Temporals

type MapWithPrevious =
  <T, U>(f: (c: Exclude<T, Nothing>, p: Exclude<T, Nothing> | undefined) => U) =>
    ($: Behavior<T>) => Behavior<U | Extract<T, Nothing>>

type MapWithPreviousImpl =
  (f: (c: T_, p: T_ | undefined) => U_) =>
    ($: Behavior<T_ | Nothing>) => Behavior<U_ | Nothing>

const mapWithPreviousImpl: MapWithPreviousImpl = f => $ => {
  let previousT = Re.useRef(undefined as T_ | undefined)
  let previousParent = Re.useRef(undefined as unknown | undefined)
  let previousPreviousParent = Re.useRef(undefined as unknown | undefined)
  let shouldPreviousTBeUndefined = Re.useRef(false);

  Re.useEffect(() => {
    let p = value($)
    if (p === nothing) return
    previousT.current = p

    if (shouldPreviousTBeUndefined.current) {
      shouldPreviousTBeUndefined.current = false
    }
  }, [key($)])

  if (parentContext.isPresent) {
    l(parentContext.value, subscribeB(v => {
      previousPreviousParent.current = previousParent.current
      previousParent.current = v
      shouldPreviousTBeUndefined.current = previousPreviousParent.current === nothing;
    }))
  }
   
  let t = value($)
  let u =
    t === nothing ? nothing : f(t,
      shouldPreviousTBeUndefined.current
        ? undefined 
        : previousT.current
    )

  return [[u, key($)], $[1], $[2]]
}
export const mapWithPrevious = mapWithPreviousImpl as MapWithPrevious


// ----------------------------------------
// Canonical interop

type From =
  <T>($: (next: (t: T) => void) => () => void) => Behavior<T | Nothing>

export const from: From = $ => {
  let [x, setX] = Re.useState([nothing, firstKey] as [Parameters<Parameters<typeof $>[0]>[0] | Nothing, Key])
  let [d, setD] = Re.useState(() => () => {})
  let parent = Re.useRef<Behavior<unknown> | undefined>()

  Re.useEffect(() => {
    if (parent.current && value(parent.current) === nothing) return;
    let d = $(v => setX(next(v)))
    setD(() => d)

    return d
  }, [$, parent.current ? key(parent.current) : undefined])

  return [x, d, $ => parent.current = $]
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

// ----------------------------------------
// extras

const l = <A, R>(a: A, f: (a: A) => R) => f(a)