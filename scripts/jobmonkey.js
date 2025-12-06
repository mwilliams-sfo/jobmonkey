
const selectors = {
  feed: 'div[data-finite-scroll-hotkey-context=FEED]',
  feedItemHeaderText:
    '.update-components-header .update-components-header__text-view',

  newsModule: '#feed-news-module',
  newsSubheader: '.news-module__subheader',

  jobList:
    '.jobs-search-two-pane__layout .scaffold-layout__list ul:has(> li.scaffold-layout__list-item)',
  activeJob: '.jobs-search-results-list__list-item--active',
  jobClickable: '.job-card-container--clickable',
  jobTitle: '.job-card-list__title--link strong',
  jobCompany: '.artdeco-entity-lockup__subtitle',
  jobLocation: '.artdeco-entity-lockup__caption',

  jobDetails: '.jobs-search__job-details',
  jobDetailsModule: '.job-details-module',
  jobDetailsDescription: '.jobs-description',
  jobDetailsCompany: '*[data-view-name=job-details-about-company-module]',
  fitLevelCard: '.job-details-fit-level-card',
  upsellPremiumContainer: '.upsell-premium-custom-section-card__container',
};

// No offense.
const companyExclusions = [
  /Braintrust/,
  /Capgemini/,
  /Cognizant/,
  /Compunnel/,
  /GlobalLogic/,
  /HCLTech/,
  /Infojini/,
  /Infosys/,
  /Jobs via Dice/,
  /Motion Recruitment/,
  /Net2Source/,
  /NTT DATA/,
  /Robert Half/,
  /The Mom Project/,
  /Verticalmove/,
  /Wipro/,

  /Amazon/,
  /Anthropic/,
  /Apple/,
  /Block/,
  /ByteDance/,
  /Grindr/,
  /Kohler Ventures/,
  /Lucid Motors/,
  /Meta/,
  /Microsoft/,
  /Nextdoor/,
  /OKX/,
  /OSI Engineering/,
  /Rivian/,
  /Roblox/,
  /SiriusXM/,
  /Tesla/,
  /TikTok/,

  /\w+AI\b/,
  /\bai\b/i,
  /^coin/i,
  /consult/i,
  /\bgroup\b/i,
  /infote/i,
  /^intelli/i,
  / llc$/i,
  /resourc/i,
  /solutions/i,
  /staffing/i,
  /^tek/i,
  /tek\b/i,
];

const setGone = (elt, gone) => { elt.classList.toggle('jm-gone', gone); };

const setHidden = (elt, hidden) => {
  elt.classList.toggle('jm-hidden', hidden);
};

const isHidden = elt => elt.classList.contains('jm-hidden');

const splitTerms = str => {
  const terms = [];
  while (str = str.trimStart()) {
    const re =
      str.startsWith('\'') ? /^'([^']*)'?/ :
      str.startsWith('"') ? /^"([^"]*)"?/ :
      /^(\S*)/;
    const match = re.exec(str);
    terms.push(match[1]);
    str = str.substr(match[0].length);
  }
  return terms;
};

const isSuggestedPost = feedItem =>
  feedItem
    .querySelector(selectors.feedItemHeaderText)
    ?.textContent
    ?.trim() === 'Suggested';

const scrubFeed = feed => {
  for (const child of feed.childNodes) {
    if (child.nodeType == Node.ELEMENT_NODE && child.tagName == 'DIV') {
      setGone(child, isSuggestedPost(child));
    }
  }
};

const scrubNews = news => {
  news.querySelectorAll(selectors.newsSubheader).forEach((subheader, index) => {
    if (index > 0) {
      // Hide the subheader and any content under it.
      setGone(subheader, true);
      for (let node = subheader.nextSibling; node; node = node.nextSibling) {
        if (node.nodeType == Node.ELEMENT_NODE) {
          if (node.classList.contains('news-module__subheader')) break;
          setGone(node, true);
        }
      }
    }
  });
};

const isInterestingTitle = title => {
  if (title.match(/\b(?:manager|principal|lead|test|tester|ai|qa|security|analyst|researcher)\b/i)) {
    return false;
  }

  const keywordsParam = new URL(document.URL).searchParams.get('keywords');
  if (keywordsParam) {
    const keywords = splitTerms(keywordsParam);
    if (
      keywords.some(it => it.toLowerCase() == 'android') &&
      !title.match(/\b(?:android|mobile)\b/i)
    ) {
      return false;
    }
  }

  return true;
};

const isInterestingCompany = company =>
  !companyExclusions.some(it => company.match(it));

const isUnitedStatesSearch = () =>
  new URL(document.URL).searchParams.get('geoid') === '103644278';

const isInterestingJob = job => {
  const title = job.querySelector(selectors.jobTitle)?.textContent?.trim();
  if (title && !isInterestingTitle(title)) return false;

  const company =
    job.querySelector(selectors.jobCompany)?.textContent?.trim();
  if (company && !isInterestingCompany(company)) return false;

  const location =
    job.querySelector(selectors.jobLocation)?.textContent?.trim();
  if (location === 'United States (Remote)' && !isUnitedStatesSearch()) {
    return false
  }

  return true;
};

const fixSelection = list => {
  const jobs =
    Array.from(list.childNodes)
      .filter(it => it.nodeType == Node.ELEMENT_NODE && it.tagName == 'LI');
  const activeJob = jobs.find(it => it.querySelector(selectors.activeJob));
  if (!activeJob || !isHidden(activeJob)) return;

  // Search forward for another job to select, with wrap-around.
  for (
    let otherJob = activeJob.nextSibling ?? list.firstChild;
    otherJob && otherJob !== activeJob;
    otherJob = otherJob.nextSibling ?? list.firstChild
  ) {
    if (
      otherJob.nodeType == Node.ELEMENT_NODE && otherJob.tagName == 'LI' &&
      !isHidden(otherJob)
    ) {
      otherJob.querySelector(selectors.jobClickable)?.click();
      break;
    }
  }
};

const scrubJobList = list => {
  for (const child of list.childNodes) {
    if (child.nodeType == Node.ELEMENT_NODE && child.tagName == 'LI') {
      setHidden(child, !isInterestingJob(child));
    }
  }
  fixSelection(list);
};

const scrubJobDetails = details => {
  for (const module of details.querySelectorAll(selectors.jobDetailsModule)) {
    if (
      module.id !== 'SALARY' &&
      !module.matches(selectors.jobDetailsDescription) &&
      !module.querySelector(selectors.jobDetailsCompany)
    ) {
      setGone(module, true);
    }
  }
  const upsell = details.querySelector(selectors.upsellPremiumContainer)
  if (upsell) {
    setGone(upsell, true);
  }
};

const frameLoaded = async (frame, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const document = frame.contentDocument;
  if (document) return document;

  const window = frame.contentWindow;
  if (!window) throw Error('Frame has no content window');
  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const loadListener = () => {
    const document = frame.contentDocument;
    if (document) resolve(document);
  };
  try {
    signal?.addEventListener('abort', abortListener);
    window.addEventListener('load', loadListener);
    return await promise;
  } finally {
    window.removeEventListener('load', loadListener);
    signal?.removeEventListener('abort', abortListener);
  }
};

const frameUnloaded = async (frame, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  if (!frame.contentDocument) return;

  const window = frame.contentWindow;
  if (!window) throw Error('Frame has no content window');
  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const unloadListener = () => resolve();
  try {
    signal?.addEventListener('abort', abortListener);
    window.addEventListener('unload', unloadListener);
    return await promise;
  } finally {
    window.removeEventListener('unload', unloadListener);
    signal?.removeEventListener('abort', abortListener);
  }
};

const nodeAddedInIframe = async (document, selector, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const localController = new AbortController();
  const localSignal =
    signal ? AbortSignal.any([signal, localController.signal]) :
    localController.signal;
  try {
    signal?.addEventListener('abort', abortListener);
    (async () => {
      while (true) {
        const document = frameLoaded(frame, {signal: localSignal});
        const docController = new AbortController();
        try {
          const docSignal =
            AbortSignal.any([localSignal, docController.Signal]);
          nodeAdded(
            document, selector, {signal: docSignal, deep: options?.deep})
            .then(resolve, () => {});
          await nodeUnloaded(frame, {signal: localSignal});
        } finally {
          docController.abort(Error('Frame unloaded'));
        }
      }
    })();
    return await promise;
  } finally {
    localController.abort(Error('Task complete'));
    signal?.removeEventListener('abort', abortListener);
  }
};

const nodeAddedShallow = async (document, selector, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const element = document.querySelector(selector);
  if (element) return element;

  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);

  const observer = new MutationObserver(mutationList => {
    const element = document.querySelector(selector);
    if (element) resolve(element);
  });
  try {
    signal?.addEventListener('abort', abortListener);
    observer.observe(
      document, { attributes: true, childList: true, subtree: true });
    return await promise;
  } finally {
    observer.disconnect();
    signal?.removeEventListener('abort', abortListener);
  }
};

const nodeAddedInIframes = async (document, selector, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const localController = new AbortController();
  const localSignal =
    signal ? AbortSignal.any([signal, localController.signal]) :
    localController.signal;

  const frameObservations = [];
  const observeFrame = frame => {
    const frameController = new AbortController();
    const frameSignal =
      AbortSignal.any([localSignal, frameController.signal]);
    nodeAddedInIframe(
      frame, selector, {signal: frameSignal, deep: options?.deep})
      .then(resolve, () => {});
    frameObservations.push({frame, controller: frameController});
  };
  const framesObserver = new MutationObserver(mutationList => {
    const frames = Array.from(document.querySelectorAll('iframe'));
    for (let i = frameObservations.length - 1; i >= 0; i--) {
      const obs = frameObservations[i];
      if (!frames.some(it => it === obs.frame)) {
        obs.controller.abort(Error('Frame removed'));
        frameObservations.splice(i, 1);
      }
    }
    for (const frame of frames) {
      if (!frameObservations.some(it => it.frame === frame)) {
        observeFrame(frame);
      }
    }
  });

  try {
    signal?.addEventListener('abort', abortListener);
    for (const frame in document.querySelectorAll('iframe').values()) {
      observeFrame(frame);
    }
    framesObserver.observe(document, {childList: true, subtree: true});
    return await promise;
  } finally {
    framesObserver.disconnect();
    localController.abort(Error('Task complete'));
    signal?.removeEventListener('abort', abortListener);
  }
};

const nodeAdded = async(document, selector, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const localController = new AbortController();
  const localSignal =
    signal ? AbortSignal.any([signal, localController.signal]) :
    localController.signal;

  try {
    signal?.addEventListener('abort', abortListener);
    nodeAddedShallow(document, selector, {signal: localSignal})
      .then(resolve, () => {});
    const deep = options?.deep;
    if (deep) {
      nodeAddedInIframes(document, selector, {signal: localSignal, deep})
        .then(resolve, () => {});
    }
    return await promise;
  } finally {
    localController.abort(Error('Task complete'));
    signal?.removeEventListener('abort', abortListener);
  }
};

const nodeRemoved = async (node, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const document = node.ownerDocument;
  if (!document) return;

  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const observer = new MutationObserver(mutationList => {
    if (!document.contains(node)) resolve();
  });
  try {
    signal?.addEventListener('abort', abortListener);
    observer.observe(document, { childList: true, subtree: true });
    return await promise;
  } finally {
    observer.disconnect();
    signal?.removeEventListener('abort', abortListener);
  }
};

const addStyleSheet = text => {
  const element = document.createElement('style');
  element.appendChild(document.createTextNode(text));
  document.head.appendChild(element);
  return element.sheet;
};

const observeNode = async (document, selector, options, callback) => {
  const signal = options?.signal;
  signal?.throwIfAborted();
  while (true) {
    const node =
      await nodeAdded(document, selector, {signal, deep: options?.deep});
    callback(node);

    const observer = new MutationObserver(mutationList => { callback(node); });
    try {
      observer.observe(
        node, { attributes: true, childList: true, subtree: true });
      await nodeRemoved(node, {signal});
    } finally {
      observer.disconnect();
    }
  }
};

const observeFeed = (options) => {
  const signal = options?.signal;
  observeNode(document, selectors.feed, {signal, deep: true}, scrubFeed);
};

const observeNews = (options) => {
  const signal = options?.signal;
  observeNode(document, selectors.newsModule, {signal, deep: true}, scrubNews);
};

const observeJobList = (options) => {
  const signal = options?.signal;
  observeNode(document, selectors.jobList, {signal, deep: true}, scrubJobList);
};

const observeJobDetails = (options) => {
  const signal = options?.signal;
  observeNode(
    document, selectors.jobDetails, {signal, deep: true}, scrubJobDetails);
};

const styleSheet = addStyleSheet(
  '.jm-gone { display: none !important; }\n' +
  '.jm-hidden { visibility: hidden !important; }\n');

observeFeed();
observeNews();
observeJobList();
observeJobDetails();
