export type PotentialPromise<T> = T | Promise<T>;

export type AFunction<R = unknown, Args extends unknown[] = unknown[]> = (...args: Args) => PotentialPromise<R>;

export type Prefix = "_global" | ({} & string);

export interface SharedValue<T> {
    value: T;
    listeners: AFunction[],
    isStatic?: true,
}

export interface SharedCreated {
    key: string,
    prefix: string,
}