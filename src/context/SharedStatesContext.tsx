import {createContext, type PropsWithChildren, useContext, useMemo} from 'react';

export interface SharedStatesType {
    uniqueName: string
}

const SharedStatesContext = createContext<SharedStatesType | undefined>(undefined);

interface SharedStatesProviderProps extends PropsWithChildren {}

export const SharedStatesProvider = ({ children }: SharedStatesProviderProps) => {

    const uniqueName = useMemo(() => Math.random().toString(36).substring(2, 15), []);

    return (
        <SharedStatesContext.Provider value={{uniqueName}}>
            {children}
        </SharedStatesContext.Provider>
    );
};

export const useSharedStatesContext = (): SharedStatesType|undefined => {
    return useContext(SharedStatesContext);
};