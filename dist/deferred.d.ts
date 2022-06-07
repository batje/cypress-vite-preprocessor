export declare function createDeferred<T>(): {
    resolve: (thenableOrResult?: T | PromiseLike<T> | undefined) => void;
    reject: any;
    promise: any;
};
