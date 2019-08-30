/**
 * Copyright 2019 The AMP HTML Authors. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS-IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  Alignment,
  Axis,
  scrollContainerToElement,
} from '../../amp-base-carousel/0.1/dimensions';
import {CSS} from '../../../build/amp-inline-gallery-thumbnails-0.1.css';
import {Carousel} from '../../amp-base-carousel/0.1/carousel';
import {CSS as CarouselCSS} from '../../../build/carousel-0.1.css';
import {
  createCustomEvent,
  getDetail,
  listenOnce,
} from '../../../src/event-helper';
import {dev} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {getStyle, setStyle} from '../../../src/style';
import {htmlFor} from '../../../src/static-template';
import {scopedQuerySelector} from '../../../src/dom';

/**
 * @param {!Element} el The Element to check.
 * @return {boolean} Whether or not the Element is a sizer Element.
 */
function isSizer(el) {
  return el.tagName == 'I-AMPHTML-SIZER';
}

/**
 * Runs a callback while disabling smooth scrolling by temporarily setting
 * the `scrollBehavior` to `auto`.
 * @param {!Element} el
 * @param {Function} cb
 */
function runEnablingSmoothScroll(el, cb) {
  const scrollBehavior = getStyle(el, 'scrollBehavior');

  setStyle(el, 'scrollBehavior', 'smooth');
  cb();
  setStyle(el, 'scrollBehavior', scrollBehavior);
}

export class AmpInlineGalleryThumbnails extends AMP.BaseElement {
  /**
   * @return {!ShadowRoot}
   * @private
   */
  createShadowRoot_() {
    const sr = this.element.attachShadow({mode: 'open'});
    sr.innerHTML = `
      <style>${CarouselCSS + CSS}</style>
      <slot name="sizer"></slot>
      <div class="i-amphtml-carousel-content" aria-hidden="true">
        <div class="i-amphtml-carousel-scroll">
        </div>
      </div>
    `;
    return sr;
  }

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    this.slides_ = null;

    this.thumbnails_ = null;

    this.thumbnailsContainer_ = null;

    this.carousel_ = null;

    this.requestedIndex_ = 0;

    this.ignoreScrollUntilSettled_ = false;

    this.keepScrollInSync_ = false;
  }

  /** @override */
  isRelayoutNeeded() {
    return true;
  }

  /** @override */
  isLayoutSupported() {
    return true;
  }

  /** @override */
  buildCallback() {
    Array.from(this.element.children).forEach(c => {
      if (isSizer(c)) {
        c.setAttribute('slot', 'sizer');
      }
    });

    const sr = this.createShadowRoot_();
    this.thumbnailsContainer_ = dev().assertElement(
      sr.querySelector('.i-amphtml-carousel-scroll')
    );

    this.carousel_ = new Carousel({
      win: this.win,
      element: this.element,
      scrollContainer: this.thumbnailsContainer_,
      initialIndex: 0,
      runMutate: cb => this.mutateElement(cb),
    });
    this.carousel_.updateAlignment(Alignment.CENTER);
    this.carousel_.updateLoop(true);
    this.carousel_.updateMixedLength(true);
    this.carousel_.updateSnap(false);

    this.thumbWidth =
      this.element.getAttribute('thumbnail-aspect-ratio-width') || 1;
    this.thumbHeight =
      this.element.getAttribute('thumbnail-aspect-ratio-height') || 1;
    this.keepScrollInSync_ = this.element.hasAttribute('sync-scroll');

    this.addListeners_();
  }

  /** @override */
  layoutCallback() {
    this.carousel_.updateUi();
    return Promise.resolve();
  }

  /**
   *
   * @param {*} element
   * @param {*} index
   */
  createThumbnailForElement_(element, index) {
    const html = htmlFor(this.element);
    const content = html`
      <div class="thumbnail-container">
        <div class="thumbnail">
          <svg class="resizer"></svg>
        </div>
      </div>
    `;

    content
      .querySelector('.resizer')
      .setAttribute('viewBox', `0 0 ${this.thumbWidth} ${this.thumbHeight}`);
    content.querySelector('.thumbnail').appendChild(element);
    content.onclick = () => {
      const event = createCustomEvent(
        this.win,
        'goToSlide',
        dict({
          'index': index,
        }),
        {
          bubbles: true,
        }
      );
      this.element.dispatchEvent(event);
      this.requestedIndex_ = index;
      this.ignoreScrollUntilSettled_ = true;
      this.scrollToElement(index, 0, true);
    };
    return content;
  }

  /**
   *
   */
  addListeners_() {
    this.element.addEventListener('offsetchange-update', event => {
      this.handleOffsetChangeUpdate_(event);
    });
    this.element.addEventListener('offsetchange', event => {
      event.stopPropagation();
    });
    this.element.addEventListener('indexchange-update', event => {
      this.handleIndexChangeUpdate_(event);
    });
    this.element.addEventListener('indexchange', event => {
      event.stopPropagation();
    });
    this.element.addEventListener(
      'touchstart',
      () => {
        this.handleTouchstart_();
      },
      {
        passive: true,
      }
    );
  }

  /**
   *
   */
  createDefaultThumbnail_() {
    const html = htmlFor(this.element);
    return html`
      <div class="default-thumbnail-content"></div>
    `;
  }

  /**
   *
   * @param {*} slide
   */
  getThumbnailContent_(slide) {
    const ampImg =
      slide.tagName == 'AMP-IMG'
        ? slide
        : scopedQuerySelector(slide, '> amp-img');

    if (!ampImg) {
      return this.createDefaultThumbnail_();
    }

    const img = new Image();
    img.className = 'thumbnail-img';
    img.src = ampImg.getAttribute('src');
    img.srcset = ampImg.getAttribute('srcset') || '';
    img.sizes = ampImg.getAttribute('sizes') || '';

    return img;
  }

  /**
   *
   * @param {*} index
   * @param {*} offset
   * @param {*} smooth
   */
  scrollToElement(index, offset = 0, smooth) {
    const thumbnail = this.thumbnails_[index];
    const {thumbnailsContainer_} = this;

    /**
     *
     */
    function runner() {
      scrollContainerToElement(
        Axis.X,
        Alignment.CENTER,
        thumbnailsContainer_,
        thumbnail,
        offset
      );
    }

    if (smooth) {
      runEnablingSmoothScroll(thumbnailsContainer_, runner);
    } else {
      runner();
    }
  }

  /**
   *
   * @param {*} slide
   * @param {*} index
   */
  createThumbnail_(slide, index) {
    return this.createThumbnailForElement_(
      this.getThumbnailContent_(slide),
      index
    );
  }

  /**
   *
   * @param {*} index
   * @param {*} offset
   */
  isScrollSettled_(index, offset) {
    if (!this.ignoreScrollUntilSettled_) {
      return true;
    }

    return this.requestedIndex_ == index && Math.abs(offset) <= 0.01;
  }

  /**
   *
   * @param {*} slides
   */
  updateSlides_(slides) {
    if (slides == this.slides_) {
      return;
    }

    this.slides_ = slides;
    this.thumbnails_ = this.slides_.map((s, i) => this.createThumbnail_(s, i));
    this.mutateElement(() => {
      this.thumbnailsContainer_.innerHTML = '';
      this.thumbnails_.forEach(t => this.thumbnailsContainer_.appendChild(t));
      this.carousel_.updateSlides(this.thumbnails_);
    });
  }

  /**
   *
   * @param {*} index
   * @param {*} offset
   * @param {*} smooth
   */
  updateOffset_(index, offset, smooth) {
    if (this.touching_ || this.userScrolling_) {
      return;
    }

    if (this.ignoreScrollUntilSettled_) {
      return;
    }

    this.scrollToElement(index, offset, smooth);
  }

  /**
   *
   */
  handleTouchstart_() {
    this.touching_ = true;

    // Check for a scroll initiated from a touch event. If the touchend occurs
    // prior to any scroll, stop listening as it was caused by something else.
    const unlistenScroll = listenOnce(this.element, 'scroll', () => {
      this.handleManualScroll_();
    });

    listenOnce(
      this.element,
      'touchend',
      () => {
        this.touching_ = false;
        unlistenScroll();
      },
      {
        passive: true,
      }
    );
  }

  /**
   *
   */
  handleManualScroll_() {
    this.userScrolling_ = true;

    listenOnce(this.element, 'reset-reference-point', () => {
      this.userScrolling_ = false;
    });
  }

  /**
   *
   * @param {*} event
   */
  handleOffsetChangeUpdate_(event) {
    const detail = getDetail(event);
    const index = detail['index'];
    const slides = detail['slides'];
    const offset = detail['offset'];

    this.updateSlides_(slides);
    this.ignoreScrollUntilSettled_ = !this.isScrollSettled_(index, offset);

    if (this.keepScrollInSync_) {
      this.updateOffset_(index, offset, false);
    }
  }

  /**
   *
   * @param {*} event
   */
  handleIndexChangeUpdate_(event) {
    const detail = getDetail(event);
    const index = detail['index'];
    const slides = detail['slides'];
    const offset = 0;

    this.updateSlides_(slides);
    this.ignoreScrollUntilSettled_ = !this.isScrollSettled_(index, offset);

    if (!this.keepScrollInSync_) {
      this.updateOffset_(index, offset, true);
    }
  }
}
