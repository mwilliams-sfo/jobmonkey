
import AbortablePromise from './abortable-promise.js';

export const elementAdded = async (parent, selector, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const element = parent.querySelector(selector);
  if (element) return element;

  const {promise, resolve, reject} = AbortablePromise.withResolvers(signal);
  const observer = new MutationObserver(mutationList => {
    const element = parent.querySelector(selector);
    if (element) resolve(element);
  });
  try {
    observer.observe(
      parent, {attributes: true, childList: true, subtree: true});
    return await promise;
  } finally {
    observer.disconnect();
  }
};

export const elementRemoved = async (parent, element, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  if (!document.contains(parent) || !parent.contains(element)) return;

  const {promise, resolve, reject} = AbortablePromise.withResolvers(signal);
  const observer = new MutationObserver(mutationList => {
    if (!document.contains(parent) || !parent.contains(element)) resolve();
  });
  try {
    observer.observe(document, {childList: true, subtree: true});
    return await promise;
  } finally {
    observer?.disconnect();
  }
};

export const observeElement = async (parent, element, callback, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  if (!document.contains(parent) || !parent.contains(element)) return;

  callback(element);
  const observer = new MutationObserver(mutationList => {
    if (document.contains(parent) && parent.contains(element)) {
      callback(element);
    }
  });
  try {
    observer.observe(
      element, {attributes: true, childList: true, subtree: true});
    await elementRemoved(parent, element, {signal});
  } finally {
    observer.disconnect();
  }
};
