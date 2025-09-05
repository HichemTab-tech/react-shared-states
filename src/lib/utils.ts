import {isDevMode} from "../config";

export const log = (...args: any[]) => {
    if ((typeof __REACT_SHARED_STATES_DEV__ === "undefined" || !__REACT_SHARED_STATES_DEV__) && !isDevMode) return;
    console.log(
        '%c[react-shared-states]',
        'color: #007acc; font-weight: bold',
        ...args,
    )
}

export const ensureNonEmptyString = <X extends string>(value: X): X => {
    if (!value) throw new Error("Value is empty");
    return value
};

export const random = () => {
    return Math.random().toString(36).substring(2, 15);
}