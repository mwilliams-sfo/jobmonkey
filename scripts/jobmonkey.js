
const selectors = {
  feed: 'div[data-finite-scroll-hotkey-context=FEED]',
  feedItemHeaderText:
    '.update-components-header .update-components-header__text-view',
  feedNewsModule: '#feed-news-module',
  newsSubheader: '.news-module__subheader',

  jobList: '.jobs-search-two-pane__layout .scaffold-layout__list > div > ul',
  jobTitle: '.job-card-list__title--link strong',
  jobCompany: '.artdeco-entity-lockup__subtitle',
  jobLocation: '.artdeco-entity-lockup__caption',

  jobDetails: '.jobs-search__job-details',
  jobDetailsModule: '.job-details-module',
  fitLevelCard: '.job-details-fit-level-card',

  upsellPremiumContainer: '.upsell-premium-custom-section-card__container',
};

// No offense.
const companyExclusions = [
  /Capgemini/,
  /Cognizant/,
  /Compunnel/,
  /GlobalLogic/,
  /Infojini/,
  /Infosys/,
  /Jobs via Dice/,
  /Motion Recruitment/,
  /NTT DATA/,
  /Robert Half/,
  /The Mom Project/,
  /Wipro/,

  /Amazon/,
  /Anthropic/,
  /Apple/,
  /Braintrust/,
  /ByteDance/,
  /Kohler Ventures/,
  /Lucid Motors/,
  /Meta/,
  /OpenAI/,
  /OSI Engineering/,
  /Rivian/,
  /Tesla/,
  /TikTok/,
  /xAI/,

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

const isSuggestedPost = feedItem =>
  feedItem
    .querySelector(selectors.feedItemHeaderText)
    ?.textContent
    ?.trim() === 'Suggested';

const hideSuggestedPosts = feed => {
  for (const child of feed.childNodes) {
    if (child.nodeType != Node.ELEMENT_NODE) continue;
    if (child.tagName == 'DIV' && isSuggestedPost(child)) {
      setGone(child, true);
    }
  }
};

const isInterestingTitle = title => {
  title = title.toLowerCase();
  if (title.match(/\b(?:ai|manager|principal|lead|test|qa)\b/)) return false;

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

const scrubJobList = list => {
  for (const child of list.childNodes) {
    if (child.nodeType != Node.ELEMENT_NODE) continue;
    if (child.tagName == 'LI') {
      setHidden(child, !isInterestingJob(child));
    }
  }
};

const scrubJobDetails = details => {
  for (const module of details.querySelectorAll(selectors.jobDetailsModule)) {
    if (module.querySelector(selectors.fitLevelCard)) {
      setGone(module, true);
    }
  }
  const upsell = details.querySelector(selectors.upsellPremiumContainer)
  if (upsell) {
    setGone(upsell, true);
  }
};

const nodeRemoved = node =>
  new Promise(resolve => {
    const document = node.ownerDocument;
    if (!document) {
      resolve();
      return;
    }
    const observer = new MutationObserver(mutationList => {
      if (!document.contains(node)) {
        observer.disconnect();
        resolve();
      }
    });
    observer.observe(document, { childList: true, subtree: true });
  });

const addStyleSheet = text => {
  const element = document.createElement('style');
  element.appendChild(document.createTextNode(text));
  document.head.appendChild(element);
  return element.sheet;
};

const observeNode = async (node, options, callback) => {
  if (!node.ownerDocument) return;
  const nodeObserver = new MutationObserver(callback);
  nodeObserver.observe(node, options);
  await nodeRemoved(node);
  nodeObserver.disconnect();
  return;
};

let feedObserved = false;
const observeFeed = () => {
  if (feedObserved) return;
  const feed = document.querySelector(selectors.feed);
  if (!feed) return;
  observeNode(
    feed,
    { attributes: true, childList: true, subtree: true },
    () => { hideSuggestedPosts(feed); }
  ).then(() => {
    feedObserved = false;
  });
  feedObserved = true;
};

const hideGames = () => {
  const news = document.querySelector(selectors.feedNewsModule);
  if (!news) return;
  let subheaders = news.querySelectorAll(selectors.newsSubheader);
  for (let node = subheaders.item(1); node; node = node.nextSibling) {
    if (node.nodeType != Node.ELEMENT_NODE) continue;
    setGone(node, true);
  }
};

let jobListObserved = null;
const observeJobList = () => {
  if (jobListObserved) return;
  const jobList = document.querySelector(selectors.jobList);
  if (!jobList) return;
  observeNode(
    jobList,
    { attributes: true, childList: true, subtree: true },
    () => { scrubJobList(jobList); }
  ).then(() => {
    jobListObserved = false;
  });
  jobListObserved = true;
};

let jobDetailsObserved = null;
const observeJobDetails = () => {
  if (jobDetailsObserved) return;
  const details = document.querySelector(selectors.jobDetails);
  if (!details) return;
  observeNode(
    details,
    { attributes: true, childList: true, subtree: true },
    () => { scrubJobDetails(details); }
  ).then(() => {
    jobDetailsObserved = false;
  });
  jobDetailsObserved = true;
};

const styleSheet = addStyleSheet(
  '.jm-gone { display: none !important; }\n' +
  '.jm-hidden { visibility: hidden !important; }\n');

observeNode(
  document.body,
  { attributes: true, childList: true, subtree: true },
  () => {
    observeFeed();
    hideGames();

    observeJobList();
    observeJobDetails();
  });
