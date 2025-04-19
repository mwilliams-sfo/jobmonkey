
const selectors = {
  feedItem: 'div[data-finite-scroll-hotkey-context=FEED] > div',
  feedItemHeaderText: '.update-components-header .update-components-header__text-view',

  jobDetails: '.jobs-search__job-details',
  jobDetailsModule: '.job-details-module',
};

const isSuggestedPost = feedItem =>
  feedItem.querySelector(selectors.feedItemHeaderText)?.textContent?.trim() === 'Suggested';

const hideSuggestedPosts = () => {
  for (const item of document.querySelectorAll(selectors.feedItem)) {
    if (isSuggestedPost(item)) {
      item.classList.toggle('jm-gone', true);
    }
  }
};

const observer = new MutationObserver((mutationList, observer) => {
  if (window.location.pathname === '/feed/') {
    hideSuggestedPosts();
  }
});
observer.observe(document.body, {
  childList: true,
  attributes: true,
  subtree: true,
});
