
class AbortablePromise extends Promise {
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
      signal?.throwIfAborted(Error('Aborted'));
      const listener = evt => reject(Error('Aborted'));
      signal?.addEventListener('abort', listener);
      try {
        executor(
          value => {
            signal?.removeEventListener('abort', listener);
            resolve(value);
          },
          reason => {
            signal?.removeEventListener('abort', listener);
            reject(reason);
          });
      } catch (e) {
        signal?.removeEventListener('abort', listener);
        throw e;
      }
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

export default AbortablePromise;
