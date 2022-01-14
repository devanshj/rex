import * as Re from "react"

export type Behavior<T> = [value: T, unsubscribe: Unsubscribe]
export type Unsubscribe = () => void

export type Event<T> = Behavior<T | Nothing>
export type Nothing = typeof nothing
export const nothing = Symbol("Rex.nothing")

// ----------------------------------------
// Functor instances

type Map = <T, U>(f: (t: T) => U) => (t$: Behavior<T>) => Behavior<U>
export const map: Map = f => ([t, d]) => [f(t), d]

type MapE = <T, U>(f: (t: T) => U) => (t$: Event<T>) => Event<U>
export const mapE: MapE = f => ([t, d]) => [t === nothing ? nothing : f(t), d]


// ----------------------------------------
// Applicative instance

type Of = <A>(a: A) => Behavior<A>
export const of: Of = a => [Re.useState(() => a)[0], Re.useState(() => () => {})[0]]

// ----------------------------------------
// Apply instance (lift1, lift2, lift3, lift4, ..., liftN)

type Combine =
  <T extends Behavior<unknown>[]>($s: [...T]) =>
    { [I in keyof T]: T[I] extends Behavior<infer U> ? U : never }

type CombineImpl = 
  ($s: Behavior<unknown>[]) => Behavior<unknown[]>

const combineImpl: CombineImpl = $s =>
  [$s.map($ => $[0]), md($s.map($ => $[1]))]

export const combine = combineImpl as Combine


// ----------------------------------------
// Bind instance

type SwitchMap = <T, U>(f: (t: T) => Behavior<U>) => (t$: Behavior<T>) => Behavior<U>
export const switchMap: SwitchMap = f => ([t, dt]) => {
  let [u, du] = f(t)
  let previousDu = usePrevious(du);
  Re.useEffect(() => previousDu && previousDu(), [du])
  
  return [u, md([dt, du])];
}


// ----------------------------------------
// Fold instance

type Fold = <T, A>(f: (a: A, t: T) => A, a: A) => (t$: Behavior<T>) => Behavior<A>
export const fold: Fold = (f, iA) => ([t, d]) => {
  let [a, next] = Re.useReducer(f, iA)
  Re.useEffect(() => next(t), [t])
  return [a, d]
}

type FoldE = <T, A>(f: (a: A, t: T) => A, a: A) => (t$: Event<T>) => Behavior<A>
export const foldE: FoldE = (f, iA) => ([t, d]) => {
  let [a, next] = Re.useReducer(f, iA)
  Re.useEffect(() => void (t !== nothing && next(t)), [t])
  return [a, d]
}

// ----------------------------------------
// Monoid instance

export type Never = Event<never>
export const never: () => Never = () => {
  let [x] = Re.useState(() => [nothing, () => {}] as [Nothing, Unsubscribe])
  return [Re.useMemo(() => x[0], [x]), Re.useMemo(() => x[1], [x])]
}


type Merge =
  <T extends Behavior<unknown>[]>($s: [...T]) =>
    Behavior<{ [I in keyof T]: T[I] extends Behavior<infer U> ? U : never }[number]>

type MergeImpl = 
  ($s: Behavior<unknown>[]) => Behavior<unknown>

const mergeImpl: MergeImpl = $s => {
  let ts = $s.map($ => $[0])
  let d = md($s.map($ => $[1]))
  
  let [u, setU] = Re.useState(() => ts[0])
  for (let t of ts) Re.useEffect(() => void setU(t), [t])

  return [u, d];
}
export const merge = mergeImpl as Merge


type MergeE =
  <T extends Event<unknown>[]>($s: [...T]) =>
    Event<{ [I in keyof T]: T[I] extends Event<infer U> ? U : never }[number]>

type MergeEImpl = 
  ($s: Event<unknown>[]) => Event<unknown>

const mergeEImpl: MergeEImpl = $s => {
  let ts = $s.map($ => $[0])
  let d = md($s.map($ => $[1]))
  
  let [u, setU] = Re.useState(() => ts.find(x => x !== nothing) ?? nothing)
  for (let t of ts) Re.useEffect(() => void (t !== nothing && setU(t)), [t])

  return [u, d];
}
export const mergeE = mergeEImpl as MergeE


// ----------------------------------------
// Filterable instance

type Filter =
  <T, U extends T = T>(f: ((t: T) => t is U) | ((t: T) => boolean)) =>
    (t$: Behavior<T>) => Event<U>

export const filter: Filter = p => ([t, d]) => [p(t) ? t : nothing, d]

type FilterE =
  <T, U extends T = T>(f: ((t: T) => t is U) | ((t: T) => boolean)) =>
    (t$: Event<T>) => Event<U>
export const filterE: FilterE = p => ([t, d]) => [t === nothing ? nothing : p(t) ? t : nothing, d]



type Take = <T>(n: number) => ($: Behavior<T>) => Behavior<T>
export const take: Take = n => ([t, d]) => {
  if (n === 0) console.error("[@devanshj/rex]: `Rex.take` expects a number >= 0")
  let c = Re.useRef(0)

  Re.useEffect(() => {
    if (c.current === n) d()
    c.current++
  }, [t])

  return [t, d]
}

type TakeE = <T>(n: number) => ($: Event<T>) => Event<T>
export const takeE: TakeE = n => ([t, d]) => {
  let c = Re.useRef(0)

  Re.useEffect(() => {
    if (t === nothing) return
    if (c.current === n) d()
    c.current++
  }, [t])

  return [n === 0 ? nothing : t, d]
}

type TakeUntilE = <T>(a$: Event<unknown>) => ($: Behavior<T>) => Behavior<T>
export const takeUntilE: TakeUntilE = ([a, _]) => ([t, dt]) => {
  Re.useEffect(() => {
    if (a === nothing) return
    dt()
  }, [a])

  return [t, dt]
}



type Drop = <T>(n: number) => ($: Behavior<T>) => Event<T>
export const drop: Drop = n => ([t, d]) => {
  let [v, setV] = Re.useState(nothing as typeof t | Nothing)
  let c = Re.useRef(0)

  Re.useEffect(() => {
    if (c.current >= n) setV(t)
    c.current++
  }, [t])

  return [n === 0 ? t : v, d]
}

type DropE = <T>(n: number) => ($: Event<T>) => Event<T>
export const dropE: DropE = n => ([t, d]) => {
  let [v, setV] = Re.useState(nothing as typeof t | Nothing)
  let c = Re.useRef(0)

  Re.useEffect(() => {
    if (t === nothing) return
    if (c.current >= n) setV(t)
    c.current++
  }, [t])

  return [n === 0 ? t : v, d]
}

type DropTillE = <T>(a$: Event<unknown>) => ($: Event<T>) => Event<T>
export const dropTillE: DropTillE = ([a, da]) => ([t, dt]) => {
  let [v, setV] = Re.useState(nothing as typeof t | Nothing)
  let didReceive = Re.useRef(false)

  Re.useEffect(() => {
    if (a === nothing) return
    didReceive.current = true
  }, [a])

  Re.useEffect(() => {
    if (didReceive.current) setV(t)
  }, [t])

  return [v, md([dt, da])]
}


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

type CreateEvent = <T = Nothing>(initialValue?: T | Nothing) =>
  [event: Event<T>, send: (t: T) => void]

export const createEvent: CreateEvent = (a = nothing) =>
  createBehavior(a)


// ----------------------------------------
// Others

type Subscribe = <T>(f: (value: T) => void) => ($: Behavior<T>) => void
export const subscribe: Subscribe = f => ([t, _]) => Re.useEffect(() => f(t), [t])

type SubscribeE = <T>(f: (value: T) => void) => ($: Event<T>) => void
export const subscribeE: SubscribeE = f => ([t, _]) =>
  Re.useEffect(() => void (t !== nothing && f(t)), [t])

type Value = <T>($: Behavior<T>) => T
export const value: Value = $ => $[0]

type Unsubscriber = ($: Behavior<unknown>) => Unsubscribe
export const unsubscriber: Unsubscriber = $ => $[1]


// ----------------------------------------
// Helpers

type MergeDisposes = (ds: Unsubscribe[]) => Unsubscribe
const md: MergeDisposes = ds => Re.useMemo(() => () => ds.forEach(d => d()), [...ds])

const usePrevious = <T>(t: T) => {
  let ref = Re.useRef(undefined as T | undefined)
  Re.useEffect(() => void (ref.current = t), [t])
  return ref.current
}