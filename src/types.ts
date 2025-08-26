export type PotentialPromise<T> = T | Promise<T>;

export type AFunction<R = unknown, Args extends unknown[] = unknown[]> = (...args: Args) => PotentialPromise<R>;

export type Prefix = "_global" | ({} & string);

export interface DataMapValue {
    listeners: AFunction[]
}

export type NonEmptyString<T extends string> = '' extends T ? never : T;