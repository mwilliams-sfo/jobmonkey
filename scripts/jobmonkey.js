
const selectors = {
  feed: 'div[data-finite-scroll-hotkey-context=FEED]',
  feedItemHeaderText:
    '.update-components-header .update-components-header__text-view',

  newsModule: '#feed-news-module',
  newsSubheader: '.news-module__subheader',

  jobSearch: '.jobs-search-two-pane__layout',
  jobList: '.scaffold-layout__list ul:has(> li.scaffold-layout__list-item)',
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

const elementAdded = async (parent, selector, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const element = parent.querySelector(selector);
  if (element) return element;

  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const observer = new MutationObserver(mutationList => {
    if (signal?.aborted) return;
    const element = parent.querySelector(selector);
    if (element) resolve(element);
  });
  try {
    signal?.addEventListener('abort', abortListener);
    observer.observe(
      parent, {attributes: true, childList: true, subtree: true});
    return await promise;
  } finally {
    observer.disconnect();
    signal?.removeEventListener('abort', abortListener);
  }
};

const elementRemoved = async (element, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const document = element.ownerDocument;
  if (!document) return;

  const {promise, resolve, reject} = Promise.withResolvers();
  const abortListener = () => reject(signal.reason);
  const observer = new MutationObserver(mutationList => {
    if (signal?.aborted) return;
    if (element.ownerDocument !== document) resolve();
  });
  try {
    signal?.addEventListener('abort', abortListener);
    observer.observe(document, {childList: true, subtree: true});
    return await promise;
  } finally {
    observer?.disconnect();
    signal?.removeEventListener('abort', abortListener);
  }
};

const addStyleSheet = document => {
  let style = document.querySelector('#jobmonkey-style');
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('id', 'jobmonkey-style');
    style.appendChild(
      document.createTextNode(
        '.jm-gone { display: none !important; }\n' +
        '.jm-hidden { visibility: hidden !important; }\n'));
    document.head.appendChild(style);
  }
  return style.sheet;
};

const observeElement = async (element, callback, options) => {
  const signal = options?.signal;
  signal?.throwIfAborted();

  const document = element.ownerDocument;
  if (!document) return;
  callback(element);

  const observer = new MutationObserver(mutationList => {
    if (signal?.aborted || element.ownerDocument !== document) return;
    callback(element));
  });
  try {
    observer.observe(
      element, {attributes: true, childList: true, subtree: true});
    await elementRemoved(element, {signal});
  } finally {
    observer.disconnect();
  }
};

const observeFeed = async (options) => {
  const signal = options?.signal;
  while (true) {
    const element = await elementAdded(document, selectors.feed, {signal});
    await observeElement(element, scrubFeed, {signal});
  }
};

const observeNews = async (options) => {
  const signal = options?.signal;
  while (true) {
    const element =
      await elementAdded(document, selectors.newsModule, {signal});
    await observeElement(element, scrubNews, {signal});
  }
};

const observeJobList = async (options) => {
  const signal = options?.signal;
  while (true) {
    const element = await elementAdded(
      document, `${selectors.jobSearch} ${selectors.jobList}`, {signal});
    await observeElement(element, scrubJobList, {signal});
  }
};

const observeJobDetails = async (options) => {
  const signal = options?.signal;
  while (true) {
    const element = await elementAdded(
      document, `${selectors.jobSearch} ${selectors.jobDetails}`, {signal});
    await observeElement(element, scrubJobDetails, {signal});
  }
};

const styleSheet = addStyleSheet(document);

observeFeed();
observeNews();
observeJobList();
observeJobDetails();
