import {createContext, type PropsWithChildren, useContext, useMemo} from 'react';

export interface SharedStatesType {
    scopeName: string
}

const SharedStatesContext = createContext<SharedStatesType | undefined>(undefined);

interface SharedStatesProviderProps extends PropsWithChildren {
    scopeName?: string
}

export const SharedStatesProvider = ({ children, scopeName }: SharedStatesProviderProps) => {

    if (!scopeName) scopeName = useMemo(() => Math.random().toString(36).substring(2, 15), []);

    return (
        <SharedStatesContext.Provider value={{scopeName}}>
            {children}
        </SharedStatesContext.Provider>
    );
};

export const useSharedStatesContext = (): SharedStatesType|undefined => {
    return useContext(SharedStatesContext);
};