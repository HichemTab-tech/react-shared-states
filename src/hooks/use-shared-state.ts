import {useSyncExternalStore} from "react";
import {useSharedStatesContext} from "../context/SharedStatesContext";
import type {Prefix} from "../types";
import {SharedData} from "../SharedData";

class SharedStatesData extends SharedData<{
    value: unknown
}> {
    defaultValue(): { value: unknown } {
        return {value: undefined};
    }

    init(key: string, prefix: Prefix, value: unknown) {
        super.init(key, prefix, {value});
    }

    setValue(key: string, prefix: Prefix, value: unknown) {
        super.setValue(key, prefix, {value});
    }
}

const sharedStatesData = new SharedStatesData();

export const useSharedState = <T>(key: string, value: T, scopeName?: Prefix) => {

    const sharedStatesContext = useSharedStatesContext();
    const prefix: Prefix = scopeName ?? sharedStatesContext?.scopeName ?? "_global";

    sharedStatesData.init(key, prefix, value);

    const dataValue = useSyncExternalStore((listener) => {
        sharedStatesData.init(key, prefix, value);
        sharedStatesData.addListener(key, prefix, listener);

        return () => {
            sharedStatesData.removeListener(key, prefix, listener);
        }
    }, () => sharedStatesData.get(key, prefix)?.value as T);

    const setData = (newValueOrCallbackToNewValue: T|((prev: T) => T)) => {
        const newValue = (typeof newValueOrCallbackToNewValue === "function") ? (newValueOrCallbackToNewValue as (prev: T) => T)(sharedStatesData.get(key, prefix)?.value as T) : newValueOrCallbackToNewValue
        if (newValue !== dataValue) {
            sharedStatesData.setValue(key, prefix, newValue);
            sharedStatesData.callListeners(key, prefix);
        }
    }

    return [
        dataValue,
        setData
    ] as const;
}