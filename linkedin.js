// ==UserScript==
// @name         LinkedIn search (Android/mobile)
// @namespace    https://github.com/mwilliams-sfo/jobmonkey
// @version      0.1
// @description  Filtering script for LinkedIn job search results
// @author       Myles Williams
// @match        https://www.linkedin.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.6/require.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/jquery/3.7.1/jquery.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/rxjs/7.8.1/rxjs.umd.min.js
// ==/UserScript==

/*global require */
require(['jquery', 'rxjs'], ($, rx) => {
    'use strict';

    const companyExclusions = [
        /consult/i,
        /infote/i,
        /^intelli/i,
        /resourc/i,
        /solutions/i,
        /^tek/i,
        /tek\b/i
    ];

    const selectors = {
        searchResultItem: 'li.jobs-search-results__list-item',
        jobTitle: '.job-card-list__title',
        jobCompany: '.job-card-container__company-name, .job-card-container__primary-description',
        jobMetadataItem: 'li.job-card-container__metadata-item'
    }

    const jobPathTerms = path => {
        let terms = [];
        const match = (/^\/jobs\/([^/]+)\//).exec(path);
        if (match) {
            const searchString = decodeURIComponent(match[1]);
            if (searchString && searchString !== 'search') {
                terms = terms.concat(searchString.split(/-+/));
            }
        }
        return terms;
    };

    const jobQueryTerms = query => {
        let terms = [];
        const keywordsParam = new URLSearchParams(location.search).get('keywords');
        if (keywordsParam) {
            terms = terms.concat(keywordsParam.split(/\s+/));
        }
        return terms;
    };

    const searchTerms = location => {
        const terms = [], termSet = {};
        jobPathTerms(location.pathname)
            .concat(jobQueryTerms(location.search))
            .forEach(s => {
                if (s in termSet) return;
                terms.push(s);
                termSet[s] = true;
            });
        return terms;
    };

    const filterTitle = title => {
        title = title.toLowerCase();
        if ((/manager|lead|test/).test(title)) return false;

        const terms = searchTerms(window.location).map(s => {
            s = s.trim();
            let match;
            if ((match = (/^"([^"]*)"$/).exec(s)) || (match = (/^'([^']*)'$/).exec(s))) {
                s = match[1].trim();
            }
            return s.toLowerCase();
        });
        if (terms.includes('android')) {
            if (!(/\b(android|mobile)\b/i).test(title)) return false;
            if ((/automotive/i).test(title)) return false;
        }

        return true;
    };

    const isUnwantedResult = element => {
        const $element = $(element);

        const title = $element.find(selectors.jobTitle).text().trim();
        if (title && !filterTitle(title)) {
            return true;
        }

        const jobLocation = $element.find(selectors.jobMetadataItem).eq(0).text().trim();
        if (jobLocation) {
            const searchLocation = (new URLSearchParams(window.location.search).get('location') || '').trim();
            if (searchLocation.toLowerCase() !== 'united states' && jobLocation.match(/^united states\b/i)) {
                return true;
            }
        }

        const companyName = $element.find(selectors.jobCompany).text().trim();
        if (companyName && companyExclusions.some(re => { re.lastIndex = 0; return re.test(companyName); })) {
            return true;
        }

        return false;
    }

    const toggleItem = (element, visible) => {
        $(element).css('visibility', visible ? 'visible' : 'hidden');
    };

    const itemObservations = [];
    const rxChangedItems = new rx.Subject();

    const mutationObservable = (target, options) =>
        new rx.Observable(subscriber => {
            const observer = new MutationObserver((mutationList, observer) => {
                subscriber.next(mutationList);
            });
            observer.observe(target, options);
            subscriber.add(() => {
                const finalRecords = observer.takeRecords();
                observer.disconnect();
                if (finalRecords.length) {
                    subscriber.next(finalRecords);
                }
            });
        });

    const observeItem = element => {
        if (itemObservations.some(it => it.node === element)) return;

        // Publish this element to the changed items subject now and every time it changes.
        rxChangedItems.next(element);
        const rxItemMutations = mutationObservable(element, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true
        });
        const subscription = rxItemMutations.subscribe(mutations => rxChangedItems.next(element));
        itemObservations.push({ node: element, subscription });
    };

    const unobserveItem = element => {
        const i = itemObservations.findIndex(it => it.node === element);
        if (i < 0) return;
        itemObservations[i].subscription.unsubscribe();
        itemObservations.splice(i, 1);
    };

    const rxBodyMutations = mutationObservable(document.body, {
        childList: true,
        attributes: true,
        subtree: true
    });
    rxBodyMutations.subscribe(mutations => {
        // Update item observations.
        itemObservations
            .filter(it => !document.body.contains(it.node))
            .forEach(it => unobserveItem(it.node));
        $(selectors.searchResultItem).toArray().forEach(observeItem);
    });

    rxChangedItems.subscribe(element => {
        toggleItem(element, !isUnwantedResult(element));
    });
});
