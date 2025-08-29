import {createContext, type PropsWithChildren, useContext, useMemo} from 'react';
import type {NonEmptyString} from "../types";

export interface SharedStatesType {
    scopeName: string
}

const SharedStatesContext = createContext<SharedStatesType | undefined>(undefined);

interface SharedStatesProviderProps<T extends string = string> extends PropsWithChildren {
    scopeName?: '__global' extends NonEmptyString<T> ? never : NonEmptyString<T>;
}

export const SharedStatesProvider = <T extends string = string>({ children, scopeName }: SharedStatesProviderProps<T>) => {
    if (scopeName && scopeName.includes("//")) throw new Error("scopeName cannot contain '//'");

    if (!scopeName) scopeName = useMemo(() => Math.random().toString(36).substring(2, 15) as NonNullable<SharedStatesProviderProps<T>['scopeName']>, []);

    return (
        <SharedStatesContext.Provider value={{scopeName}}>
            {children}
        </SharedStatesContext.Provider>
    );
};

export const useSharedStatesContext = (): SharedStatesType|undefined => {
    return useContext(SharedStatesContext);
};