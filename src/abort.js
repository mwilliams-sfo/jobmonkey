
export const throwWhenAborted = async (signal) => {
  signal.throwIfAborted();
  const {promise, reject} = Promise.withResolvers();
  const listener = evt => reject(signal.reason);
  await promise;
};

export class AbortablePromise extends Promise {
  constructor(executor, signal) {
    if (!signal) {
      super(executor);
      return;
    }
    if (typeof executor != 'function') {
      throw TypeError('executor is not callable');
    }
    if (!(signal instanceof AbortSignal)) {
      throw TypeError('signal is not an AbortSignal');
    }
    super((resolve, reject) => {
      Promise.race([throwWhenAborted(signal), new Promise(executor)])
        .then(resolve, reject);
    });
  }

  static withResolvers(signal) {
    let resolve, reject;
    const promise = new AbortablePromise(
      (res, rej) => {
        resolve = res;
        reject = rej;
      },
      signal);
    return {promise, resolve, reject};
  }
}
