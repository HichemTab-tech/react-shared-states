import {createContext, type PropsWithChildren, useContext, useMemo} from 'react';
import type {Prefix} from "../types";
import {random} from "../lib/utils";

export interface SharedStatesType {
    scopeName: string
}

export const SharedStatesContext = createContext<SharedStatesType | undefined>(undefined);

interface SharedStatesProviderProps extends PropsWithChildren {
    scopeName?: Prefix;
}

export const SharedStatesProvider = ({ children, scopeName }: SharedStatesProviderProps) => {
    if (scopeName && scopeName.includes("//")) throw new Error("scopeName cannot contain '//'");

    if (!scopeName) scopeName = useMemo(() => random() as NonNullable<SharedStatesProviderProps['scopeName']>, []);

    return (
        <SharedStatesContext.Provider value={{scopeName}}>
            {children}
        </SharedStatesContext.Provider>
    );
};

export const useSharedStatesContext = (): SharedStatesType|undefined => {
    return useContext(SharedStatesContext);
};