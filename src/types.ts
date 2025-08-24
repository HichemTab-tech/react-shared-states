export type AFunction<R = unknown, Args extends unknown[] = unknown[]> = (...args: Args) => Promise<R> | R;

export type Prefix = "_global" | ({} & string);

export interface DataMapValue {
    listeners: AFunction[]
}