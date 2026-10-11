
export const Visibility = Object.freeze({
  GONE: 0,
  HIDDEN: 1,
  VISIBLE: 2,
});

export class Styler {
  #style;

  constructor(document) {
    if (!(document instanceof HTMLDocument)) {
      throw TypeError('document is not an HTMLDocument');
    }
    let style = document.getElementById('#jobmonkey-style');
    if (style) {
      throw Error('document already has a styler');
    }
    style = document.createElement('style');
    style.setAttribute('id', 'jobmonkey-style');
    style.textContent =
      '.jm-gone { display: none !important; }\n' +
      '.jm-hidden { visibility: hidden !important; }\n';
    document.head.appendChild(style);
    this.#style = style;
  }

  get enabled() {
    return !this.#style.sheet.disabled;
  }

  set enabled(value) {
    this.#style.sheet.disabled = !value;
  }

  getVisibility(elt, visibility) {
    if (elt.classList.contains('jm-gone')) return Visibility.GONE;
    if (elt.classList.contains('jm-hidden')) return Visibility.HIDDEN;
    return Visibility.VISIBLE;
  }

  setVisibility(elt, visibility) {
    elt.classList.toggle('jm-gone', visibility === Visibility.GONE);
    elt.classList.toggle('jm-hidden', visibility === Visibility.HIDDEN);
  }
}
