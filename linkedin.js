// ==UserScript==
// @name         LinkedIn search (Android/mobile)
// @namespace    https://github.com/mwilliams-sfo/jobmonkey
// @version      0.1
// @description  Filtering script for LinkedIn job search results
// @author       Myles Williams
// @match        https://www.linkedin.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @require      https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/rxjs/7.8.1/rxjs.umd.min.js
// ==/UserScript==

/*global require */
require(['rxjs'], rx => {
    'use strict';

    const companyExclusions = [
        /\bai\b/i,
        /consult/i,
        /\bgroup\b/i,
        /infote/i,
        /^intelli/i,
	/ llc$/i,
        /resourc/i,
        /solutions/i,
	/staffing/i,
        /^tek/i,
        /tek\b/i
    ];

    const selectors = {
        feedItem: 'div[data-finite-scroll-hotkey-context=FEED] > div',
        feedItemHeaderText: '.update-components-header .update-components-header__text-view',

        searchResultItem: 'li.jobs-search-results__list-item',
        searchResultItemClickable: '.job-card-container--clickable',
        searchResultItemActive: '.jobs-search-results-list__list-item--active',
        jobTitle: '.job-card-list__title',
        jobCompany: '.job-card-container__company-name, .job-card-container__primary-description',
        jobMetadataItem: 'li.job-card-container__metadata-item',
    }

    const splitTerms = s => {
        const terms = [];
        while (s = s.trimStart()) {
            let term;
            if (s.startsWith('"') || s.startsWith('\'')) {
                const end = s.indexOf(s.charAt(0), 1);
                term = s.substring(1, end >= 0 ? end : s.length);
                s = end >= 0 ? s.substring(end + 1) : '';
            } else {
                const match = s.match(/\s|'|"/);
                const end = match ? match.index : s.length;
                term = s.substring(0, end);
                s = s.substring(end);
            }
            terms.push(term);
        }
        return terms;
    };

    const jobPathTerms = path => {
        let terms = [];
        const match = path.match(/^\/jobs\/([^/]+)\//);
        if (match) {
            const searchString = decodeURIComponent(match[1])
            if (searchString && searchString !== 'search') {
                terms = splitTerms(searchString.replaceAll('-', ' '));
            }
        }
        return terms;
    };

    const jobQueryTerms = query => {
        const keywordsParam = new URLSearchParams(query).get('keywords');
        return keywordsParam ? splitTerms(keywordsParam) : [];
    };

    const searchTerms = location => {
        const termSet = new Set();
        return [...jobPathTerms(location.pathname), ...jobQueryTerms(location.search)].filter(s => {
            if (termSet.has(s)) return false;
            termSet.add(s);
            return true;
        });
    };

    const filterTitle = title => {
        title = title.toLowerCase();
        if (title.match(/\b(?:manager|principal|lead|test|qa)\b/)) return false;

        const terms = searchTerms(window.location).map(s => s.trim().toLowerCase());
        if (terms.includes('android')) {
            if (!title.match(/\b(?:android|mobile)\b/i)) return false;
            if (title.match(/\b(?:automotive|ai)\b/i)) return false;
        }

        return true;
    };

    const isUnitedStatesSearch = params =>
        (params.get('location') || '').trim().toLowerCase() === 'united states' ||
            params.get('geoId') === '103644278';

    const isUnwantedResult = element => {
        const title = element.querySelector(selectors.jobTitle)?.textContent?.trim() ?? '';
        if (title && !filterTitle(title)) return true;

        const jobLocation = element.querySelector(selectors.jobMetadataItem)?.textContent?.trim() ?? '';
        if (jobLocation) {
            const searchParams = new URLSearchParams(window.location.search);
            if (jobLocation.match(/^united states\b/i) && !isUnitedStatesSearch(searchParams)) {
                return true;
            }
        }

        const companyName = element.querySelector(selectors.jobCompany)?.textContent?.trim() ?? '';
        if (companyName && companyExclusions.some(re => { re.lastIndex = 0; return re.test(companyName); })) {
            return true;
        }

        return false;
    };

    const isHiddenResult = element =>
        element.classList.contains('jm-hidden');

    const toggleResult = (element, visible) => {
        element.classList.toggle('jm-hidden', !visible);
    };

    const resultObservations = [];
    const rxChangedResults = new rx.Subject();

    const mutationObservable = (target, options) =>
        new rx.Observable(subscriber => {
            const observer = new MutationObserver((mutationList, observer) => {
                subscriber.next(mutationList);
            });
            observer.observe(target, options);
            return () => { observer.disconnect(); };
        });

    const observeResult = element => {
        if (resultObservations.some(it => it.node === element)) return;

        // Publish this element to the changed items subject now and every time it changes.
        rxChangedResults.next(element);
        const rxItemMutations = mutationObservable(element, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true
        });
        const subscription = rxItemMutations.subscribe(mutations => rxChangedResults.next(element));
        resultObservations.push({ node: element, subscription });
    };

    const unobserveResult = element => {
        const i = resultObservations.findIndex(it => it.node === element);
        if (i < 0) return;
        const deleted = resultObservations.splice(i, 1);
        deleted.forEach(it => it.subscription.unsubscribe());
    };

    const isSuggestedPost = feedItem =>
        feedItem.querySelector(selectors.feedItemHeaderText)?.textContent?.trim() === 'Suggested';

    const hideSuggestedPosts = () =>
        Array.from(document.querySelectorAll(selectors.feedItem))
            .filter(isSuggestedPost)
            .forEach(it => it.classList.toggle('jm-gone', true));

    let filterEnabled = true;
    const filterStyle = GM_addStyle(
        '.coach-mark-list__container { display: none; }\n' +
        '.jm-hidden { visibility: hidden; }\n' +
        '.jm-gone { display: none; }\n');

    const fixSelection = () => {
        if (!filterEnabled) return;
        const results = Array.from(document.querySelectorAll(selectors.searchResultItem));
        const activeIndex = results.findIndex(it => it.querySelector(selectors.searchResultItemActive));
        if (activeIndex >= 0 && !isHiddenResult(results[activeIndex])) return;
        let newActive = results.slice(activeIndex + 1).find(it => !isHiddenResult(it));
        if (activeIndex >= 0) {
            newActive ??= results.slice(0, activeIndex).find(it => !isHiddenResult(it));
        }
        newActive?.querySelector(selectors.searchResultItemClickable)?.click();
    };

    const menuCommands = [];
    const registerMenuCommands = () => {
        while (menuCommands.length) {
            GM_unregisterMenuCommand(menuCommands.pop());
        }
        menuCommands.push(
            GM_registerMenuCommand(
                filterEnabled ? 'Disable filter' : 'Enable filter',
                (tab, evt) => {
                    filterEnabled = !filterEnabled;
                    filterStyle.disabled = !filterEnabled;
                    fixSelection();
                    registerMenuCommands();
                }));
    };
    registerMenuCommands();

    const rxBodyMutations = mutationObservable(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });
    rxBodyMutations.subscribe(mutations => {
        if (window.location.pathname === '/feed/') {
            hideSuggestedPosts();
        }

        // Update job item observations.
        resultObservations
            .filter(it => !document.body.contains(it.node))
            .forEach(it => unobserveResult(it.node));
        document.querySelectorAll(selectors.searchResultItem).forEach(observeResult);
    });

    rxChangedResults.subscribe(element => {
        toggleResult(element, !isUnwantedResult(element));
        fixSelection();
    });
});
