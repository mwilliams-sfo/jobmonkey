// ==UserScript==
// @name         LinkedIn search (Android/mobile)
// @namespace    https://github.com/mwilliams-sfo/jobmonkey
// @version      0.1
// @description  Filtering script for LinkedIn job search results
// @author       Myles Williams
// @match        https://www.linkedin.com/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
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
        /\bgroup\b/i,
        /^intelli/i,
        /resourc/i,
        /solutions/i,
        /^tek/i,
        /tek\b/i
    ];

    const selectors = {
        searchResultItem: 'li.jobs-search-results__list-item',
        hiddenItem: '.jm-hidden',
        searchResultItemClickable: '.job-card-container--clickable',
        searchResultItemActive: '.jobs-search-results-list__list-item--active',
        jobTitle: '.job-card-list__title',
        jobCompany: '.job-card-container__company-name, .job-card-container__primary-description',
        jobMetadataItem: 'li.job-card-container__metadata-item'
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
                const end = match ? match[0].index : s.length;
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
        const termSet = {};
        return [...jobPathTerms(location.pathname), ...jobQueryTerms(location.search)].filter(s => {
            if (s in termSet) return false;
            termSet[s] = true;
            return true;
        });
    };

    const filterTitle = title => {
        title = title.toLowerCase();
        if ((/manager|lead|test/).test(title)) return false;

        const terms = searchTerms(window.location).map(s => s.trim().toLowerCase());
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
            const searchParams = new URLSearchParams(window.location.search);
            const searchLocation = (searchParams.get('location') || '').trim();
            const geoId = searchParams.get('geoId');
            if ((searchLocation.toLowerCase() !== 'united states' && geoId !== '103644278') && jobLocation.match(/^united states\b/i)) {
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
        $(element).toggleClass('jm-hidden', !visible);
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

    let filterEnabled = true;
    const filterStyle = document.createElement('style');
    filterStyle.setAttribute('type', 'text/css');
    filterStyle.textContent = '.jm-hidden { visibility: hidden; }';
    document.head.appendChild(filterStyle);

    const fixSelection = () => {
        if (!filterEnabled) return;
        const $activeItem = $(selectors.searchResultItem).has(selectors.searchResultItemActive);
        if (!$activeItem.is(selectors.hiddenItem)) return;
        const $newActive = $activeItem.nextAll(selectors.searchResultItem).not(selectors.hiddenItem).first();
        if (!$newActive.length) {
            $newActive.pushStack($(selectors.searchResultItem).not(selectors.hiddenItem).first());
        }
        $newActive.find(selectors.searchResultItemClickable).trigger('click');
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
        // Update item observations.
        itemObservations
            .filter(it => !document.body.contains(it.node))
            .forEach(it => unobserveItem(it.node));
        $(selectors.searchResultItem).toArray().forEach(observeItem);
    });

    rxChangedItems.subscribe(element => {
        toggleItem(element, !isUnwantedResult(element));
        fixSelection();
    });
});
