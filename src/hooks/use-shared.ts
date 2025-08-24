import type {Prefix} from "../types";
import {useSharedStatesContext} from "../context/SharedStatesContext";

const useShared = (scopeName?: Prefix) => {
    const sharedStatesContext = useSharedStatesContext();
    const prefix: Prefix = scopeName ?? sharedStatesContext?.scopeName ?? "_global";

    return {
        prefix
    } as const;
}

export default useShared;