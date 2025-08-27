import type {NonEmptyString} from "../types";

export const log = (...args: any[]) => {
    if (process.env.NODE_ENV !== 'development') return;
    console.log(
        '%c[react-shared-states]',
        'color: #007acc; font-weight: bold',
        ...args,
    )
}

export const ensureNonEmptyString = <T extends string>(value: T): NonEmptyString<T> => {
    if (!value) throw new Error("Value is empty");
    return value as NonEmptyString<T>
};