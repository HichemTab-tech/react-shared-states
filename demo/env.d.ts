import {FakeSharedEmitter} from "./FakeSharedEmitter";

declare global {
    interface Window {
        FakeSharedEmitter: typeof FakeSharedEmitter
    }
}