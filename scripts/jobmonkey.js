
const selectors = {
  feed: 'div[data-finite-scroll-hotkey-context=FEED]',
  feedItemHeaderText: '.update-components-header .update-components-header__text-view',

  jobList: '.jobs-search-two-pane__layout .scaffold-layout__list > div > ul',
  jobTitle: '.job-card-list__title--link strong',

  jobDetails: '.jobs-search__job-details',
  jobDetailsModule: '.job-details-module',
  fitLevelCard: '.job-details-fit-level-card',

  upsellPremiumContainer: '.upsell-premium-custom-section-card__container',
};

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
  if (title.match(/\b(?:manager|principal|lead|test|qa)\b/)) return false;

  return true;
};

const isInterestingJob = job => {
  const title = job.querySelector(selectors.jobTitle)?.textContent?.trim();
  if (title && !isInterestingTitle(title)) return false;

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

let feedObserver = null, jobListObserver = null, jobDetailsObserver = null;

const bodyObserver = new MutationObserver((mutationList, observer) => {
  const feed = document.querySelector(selectors.feed);
  if (feed && !feedObserver) {
    feedObserver = new MutationObserver((mutationList, observer) => {
      hideSuggestedPosts(feed);
    });
    feedObserver.observe(feed, {
      childList: true,
      attributes: true,
      subtree: true,
    });
  } else if (!feed && feedObserver) {
    feedObserver.disconnect();
    feedObserver = null;
  }

  const jobList = document.querySelector(selectors.jobList);
  if (jobList && !jobListObserver) {
    jobListObserver = new MutationObserver((mutationList, observer) => {
      scrubJobList(jobList);
    });
    jobListObserver.observe(jobList, {
      childList: true,
      attributes: true,
      subtree: true,
    });
  } else if (!jobList && jobListObserver) {
    jobListObserver.disconnect();
    jobListObserver = null;
  }

  const details = document.querySelector(selectors.jobDetails);
  if (details && !jobDetailsObserver) {
    jobDetailsObserver = new MutationObserver((mutationList, observer) => {
      scrubJobDetails(details);
    });
    jobDetailsObserver.observe(details, {
      childList: true,
      attributes: true,
      subtree: true,
    });
  } else if (!details && jobDetailsObserver) {
    jobDetailsObserver.disconnect();
    jobDetailsObserver = null;
  }
});
bodyObserver.observe(document.body, {
  childList: true,
  attributes: true,
  subtree: true,
});
