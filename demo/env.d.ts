// noinspection JSUnusedGlobalSymbols

import {FakeSharedEmitter} from "./FakeSharedEmitter";
import {sharedStatesApi, sharedSubscriptionsApi, sharedFunctionsApi} from "react-shared-states";

declare global {
    interface Window {
        FakeSharedEmitter: typeof FakeSharedEmitter
        sharedSubscriptionsApi: typeof sharedSubscriptionsApi
        sharedStatesApi: typeof sharedStatesApi
        sharedFunctionsApi: typeof sharedFunctionsApi
        hide: () => void
    }
}