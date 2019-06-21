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

import {ActionSource} from '../../amp-base-carousel/0.1/action-source';
import {ActionTrust} from '../../../src/action-constants';
import {CSS} from '../../../build/amp-stream-gallery-0.1.css';
import {Carousel} from '../../amp-base-carousel/0.1/carousel.js';
import {CSS as CarouselCSS} from '../../../build/carousel-0.1.css';
import {
  ResponsiveAttributes,
  getResponsiveAttributeValue,
} from '../../amp-base-carousel/0.1/responsive-attributes';
import {Services} from '../../../src/services';
import {clamp} from '../../../src/utils/math';
import {createCustomEvent, getDetail} from '../../../src/event-helper';
import {dev, user} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {htmlFor} from '../../../src/static-template';
import {isExperimentOn} from '../../../src/experiments';
import {isLayoutSizeDefined} from '../../../src/layout';
import {iterateCursor, toggleAttribute} from '../../../src/dom';
import {setStyle} from '../../../src/style';
import {toArray} from '../../../src/types';

/** @enum {number} */
const ArrowVisibility = {
  NEVER: 0,
  AUTO: 1,
  ALWAYS: 2,
};

/**
 * @param {!Element} el The Element to check.
 * @return {boolean} Whether or not the Element is a sizer Element.
 */
function isSizer(el) {
  return el.tagName == 'I-AMPHTML-SIZER';
}

class AmpStreamGallery extends AMP.BaseElement {
  /**
   * The configuration for handling attributes on this element.
   * @return {!Object<string, function(string)>}
   * @private
   */
  getAttributeConfig_() {
    return {
      'inset-arrow-visibility': newValue => {
        this.updateInsetArrowVisibility_(newValue);
      },
      'loop': newValue => {
        this.carousel_.updateLoop(newValue == 'true');
      },
      'outset-arrows': newValue => {
        this.updateOutsetArrows_(newValue == 'true');
      },
      'peek': newValue => {
        this.updatePeek_(Number(newValue));
      },
      'slide': newValue => {
        this.carousel_.goToSlide(Number(newValue));
      },
      'slide-align': newValue => {
        this.carousel_.updateAlignment(newValue);
      },
      'snap': newValue => {
        this.carousel_.updateSnap(newValue != 'false');
      },
      'max-item-width': newValue => {
        this.updateMaxItemWidth_(Number(newValue));
      },
      'max-visible-count': newValue => {
        this.updateMaxVisibleCount_(Number(newValue));
      },
      'min-item-width': newValue => {
        this.updateMinItemWidth_(Number(newValue));
      },
      'min-visible-count': newValue => {
        this.updateMinVisibleCount_(Number(newValue));
      },
    };
  }

  /**
   * Sets up the actions supported by this element.
   * @private
   */
  setupActions_() {
    this.registerAction(
      'prev',
      ({trust}) => {
        this.carousel_.prev(this.getActionSource_(trust));
      },
      ActionTrust.LOW
    );
    this.registerAction(
      'next',
      ({trust}) => {
        this.carousel_.next(this.getActionSource_(trust));
      },
      ActionTrust.LOW
    );
    this.registerAction(
      'goToSlide',
      ({args, trust}) => {
        this.carousel_.goToSlide(args['index'] || -1, {
          actionSource: this.getActionSource_(trust),
        });
      },
      ActionTrust.LOW
    );
  }

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private @const */
    this.responsiveAttributes_ = new ResponsiveAttributes(
      this.getAttributeConfig_()
    );

    /** @private {?../../../src/service/action-impl.ActionService} */
    this.action_ = null;

    /** @private {?Carousel} */
    this.carousel_ = null;

    /** @private {?Element} */
    this.content_ = null;

    /** @private {?Element} */
    this.nextArrowSlot_ = null;

    /** @private {?Element} */
    this.prevArrowSlot_ = null;

    /** @private {?Element} */
    this.scrollContainer_ = null;

    /** @private {?Element} */
    this.slidesContainer_ = null;

    /** @private {!ArrowVisibility} */
    this.insetArrowVisibility_ = ArrowVisibility.AUTO;

    /** @private {number} */
    this.maxItemWidth_ = Number.MAX_VALUE;

    /** @private {number} */
    this.maxVisibleCount_ = Number.MAX_VALUE;

    /** @private {number} */
    this.minItemWidth_ = 0;

    /** @private {number} */
    this.minVisibleCount_ = 1;

    /** @private {boolean} */
    this.outsetArrows_ = false;

    /** @private {number} */
    this.peek_ = 0;

    /** @private {number} */
    this.visibleCount_ = 1;

    /** @private {!Array<!Element>} */
    this.slides_ = [];

    /**
     * Whether or not the user has interacted with the carousel using touch in
     * the past at any point.
     * @private {boolean}
     */
    this.hadTouch_ = false;

    /**
     * Whether or not the element has been laid out yet.
     * @private {boolean}
     */
    this.laidOut_ = false;

    /**
     * @private {boolean}
     */
    this.updateVisibleCountRequested_ = false;
  }

  /**
   * Moves the Carousel to a given index.
   * @param {number} index
   */
  goToSlide(index) {
    this.carousel_.goToSlide(index, {smoothScroll: false});
  }

  /** @override */
  isLayoutSupported(layout) {
    return isLayoutSizeDefined(layout);
  }

  /** @override */
  buildCallback() {
    user().assert(
      isExperimentOn(AMP.win, 'amp-stream-gallery'),
      'The amp-stream-gallery experiment must be enabled to use the ' +
        'component'
    );

    this.action_ = Services.actionServiceForDoc(this.element);

    const {element, win} = this;
    const children = toArray(element.children);
    let prevArrow;
    let nextArrow;
    // Figure out which slot the children go into.
    children.forEach(c => {
      const slot = c.getAttribute('slot');
      if (slot == 'prev-arrow') {
        prevArrow = c;
      } else if (slot == 'next-arrow') {
        nextArrow = c;
      } else if (!isSizer(c)) {
        this.slides_.push(c);
      }
    });
    // Create the carousel's inner DOM.
    element.appendChild(this.renderContainerDom_());

    this.scrollContainer_ = element.querySelector('.i-amphtml-carousel-scroll');
    this.slidesContainer_ = element.querySelector(
      '.i-amphtml-stream-gallery-slides'
    );
    this.content_ = element.querySelector('.i-amphtml-carousel-content');
    this.prevArrowSlot_ = element.querySelector(
      '.i-amphtml-stream-gallery-arrow-prev-slot'
    );
    this.nextArrowSlot_ = element.querySelector(
      '.i-amphtml-stream-gallery-arrow-next-slot'
    );

    // Do some manual "slot" distribution
    this.slides_.forEach(slide => {
      slide.classList.add('i-amphtml-carousel-slotted');
      this.scrollContainer_.appendChild(slide);
    });
    this.prevArrowSlot_.appendChild(prevArrow || this.createPrevArrow_());
    this.nextArrowSlot_.appendChild(nextArrow || this.createNextArrow_());

    this.carousel_ = new Carousel({
      win,
      element,
      scrollContainer: dev().assertElement(this.scrollContainer_),
      initialIndex: this.getInitialIndex_(),
      runMutate: cb => this.mutateElement(cb),
    });
    this.carousel_.pauseLayout();
    this.carousel_.updateSnap(false);
    this.carousel_.updateSlides(this.slides_);

    // Handle the initial set of attributes
    toArray(this.element.attributes).forEach(attr => {
      this.attributeMutated_(attr.name, attr.value);
    });

    this.setupActions_();
    this.setupListeners_();

    // Signal for runtime to check children for layout.
    return this.mutateElement(() => {});
  }

  /** @override */
  isRelayoutNeeded() {
    return true;
  }

  /** @override */
  pauseCallback() {
    this.carousel_.pauseLayout();
  }

  /** @override */
  resumeCallback() {
    this.carousel_.resumeLayout();
  }

  /**
   * Does the first layout for the carousel implementation.
   * @private
   */
  firstLayout_() {
    this.carousel_.resumeLayout();
    // Unhides the content once things are stable. This uses mutate element to
    // synchronize with the rest of the carousel layout, even though
    // `layoutCallback` is in a mutate context.
    this.mutateElement(() => {
      this.element.setAttribute('i-amphtml-gallery-laid-out', '');
    });
  }

  /** @override */
  layoutCallback() {
    this.updateVisibleCount_();

    if (!this.laidOut_) {
      this.laidOut_ = true;
      this.firstLayout_();
    } else {
      this.carousel_.updateUi();
    }

    return Promise.resolve();
  }

  /** @override */
  mutatedAttributesCallback(mutations) {
    for (const key in mutations) {
      // Stringify since the attribute logic deals with strings and amp-bind
      // may not (e.g. value could be a Number).
      this.attributeMutated_(key, String(mutations[key]));
    }
  }

  /**
   * @param {string} name The name of the attribute.
   * @param {string} newValue The new value of the attribute.
   * @private
   */
  attributeMutated_(name, newValue) {
    this.responsiveAttributes_.updateAttribute(name, newValue);
  }

  /**
   * @return {!Element}
   * @private
   */
  renderContainerDom_() {
    const html = htmlFor(this.element);
    return html`
      <div class="i-amphtml-carousel-content">
        <div class="i-amphtml-stream-gallery-slides">
          <div class="i-amphtml-carousel-scroll"></div>
        </div>
        <div class="i-amphtml-stream-gallery-arrow-prev-slot"></div>
        <div class="i-amphtml-stream-gallery-arrow-next-slot"></div>
      </div>
    `;
  }

  /**
   * @return {!Element}
   * @private
   */
  createNextArrow_() {
    const html = htmlFor(this.element);
    return html`
      <button class="i-amphtml-stream-gallery-next" aria-hidden="true"></button>
    `;
  }

  /**
   * @return {!Element}
   * @private
   */
  createPrevArrow_() {
    const html = htmlFor(this.element);
    return html`
      <button class="i-amphtml-stream-gallery-prev" aria-hidden="true"></button>
    `;
  }

  /**
   * Gets the ActionSource to use for a given ActionTrust.
   * @param {!ActionTrust} trust
   * @return {!ActionSource}
   * @private
   */
  getActionSource_(trust) {
    return trust == ActionTrust.HIGH
      ? ActionSource.GENERIC_HIGH_TRUST
      : ActionSource.GENERIC_LOW_TRUST;
  }

  /**
   * @return {number} The initial index for the carousel.
   * @private
   */
  getInitialIndex_() {
    const attr = this.element.getAttribute('slide') || '0';
    return Number(getResponsiveAttributeValue(attr));
  }

  /**
   * Determines how many whole items in addition to the current peek value can
   * fit for a given item width. This can be rounded up or down to satisfy a
   * max/min size constraint.
   * @param {number} containerWidth The width of the container element.
   * @param {number} itemWidth The width of each item.
   * @param {boolean} roundUp Whether the fractional number of items should
   *    be rounded up or down.
   * @return {number} The number of items to display.
   */
  getItemsForWidth_(containerWidth, itemWidth, roundUp) {
    const availableWidth = containerWidth - this.peek_ * itemWidth;
    const fractionalItems = availableWidth / itemWidth;
    const wholeItems = roundUp
      ? Math.ceil(fractionalItems)
      : Math.floor(fractionalItems);
    // Always show at least 1 whole item.
    return Math.max(1, wholeItems) + this.peek_;
  }

  /**
   * @param {!ActionSource|undefined} actionSource
   * @return {boolean} Whether or not the action is a high trust action.
   * @private
   */
  isHighTrustActionSource_(actionSource) {
    return (
      actionSource == ActionSource.WHEEL ||
      actionSource == ActionSource.TOUCH ||
      actionSource == ActionSource.GENERIC_HIGH_TRUST
    );
  }

  /**
   * @return {boolean}
   * @private
   */
  shouldHideButtons_() {
    if (this.insetArrowVisibility_ == ArrowVisibility.ALWAYS) {
      return false;
    }

    if (this.insetArrowVisibility_ == ArrowVisibility.NEVER) {
      return true;
    }

    const peeking = Math.round(this.visibleCount_) != this.visibleCount_;
    return this.hadTouch_ || peeking;
  }

  /**
   *
   * @param {number} peek
   */
  updatePeek_(peek) {
    this.peek_ = Math.max(0, peek || 0);
    this.updateVisibleCount_();
  }

  /**
   *
   * @param {number} maxItemWidth
   */
  updateMaxItemWidth_(maxItemWidth) {
    this.maxItemWidth_ = maxItemWidth || Number.MAX_VALUE;
    this.updateVisibleCount_();
  }

  /**
   *
   * @param {number} maxVisibleCount
   */
  updateMaxVisibleCount_(maxVisibleCount) {
    this.maxVisibleCount_ = maxVisibleCount || Number.MAX_VALUE;
    this.updateVisibleCount_();
  }

  /**
   *
   * @param {number} minItemWidth
   */
  updateMinItemWidth_(minItemWidth) {
    this.minItemWidth_ = minItemWidth || 0;
    this.updateVisibleCount_();
  }

  /**
   *
   * @param {number} minVisibleCount
   */
  updateMinVisibleCount_(minVisibleCount) {
    this.minVisibleCount_ = minVisibleCount || 1;
    this.updateVisibleCount_();
  }

  /**
   * Updates the number of items visible for the internal carousel.
   */
  updateVisibleCount_() {
    if (this.updateVisibleCountRequested_) {
      return;
    }

    this.updateVisibleCountRequested_ = true;
    Promise.resolve().then(() => {
      this.updateVisibleCountRequested_ = false;

      const {
        maxItemWidth_,
        minItemWidth_,
        maxVisibleCount_,
        minVisibleCount_,
        slides_,
      } = this;
      // For outset arrows, we need to check the slides container to get the
      // available width. Ideally, we wouldn't do a read here. We cannot do a
      // measure, since the internal carousel implementation would update its
      // calculations on the next frame when we update things below.
      const width = this.outsetArrows_
        ? this.slidesContainer_./*OK*/ getBoundingClientRect().width
        : this.getLayoutBox().width;
      const maxItems = this.getItemsForWidth_(width, maxItemWidth_, true);
      const minItems = this.getItemsForWidth_(width, minItemWidth_, false);
      const items = Math.min(minItems, maxItems);

      const maxVisibleSlides = Math.min(slides_.length, maxVisibleCount_);
      const visibleCount = clamp(items, minVisibleCount_, maxVisibleSlides);
      const advanceCount = Math.floor(visibleCount);
      /*
       * When we are going to show more slides than we have, cap the width so
       * that we do not go over the max requested slide width. Otherwise, when
       * the number of min items is less than the number of maxItems, then we
       * need to cap the width, so that the extra space goes to the sides.
       */
      const maxContainerWidth =
        items > maxVisibleSlides
          ? `${maxVisibleSlides * maxItemWidth_}px`
          : minItems <= maxItems
          ? `${minItems * maxItemWidth_}px`
          : '';

      this.mutateElement(() => {
        setStyle(this.scrollContainer_, 'max-width', maxContainerWidth);
      });
      this.carousel_.updateSlides(this.slides_);
      this.carousel_.updateAdvanceCount(advanceCount);
      this.carousel_.updateAutoAdvanceCount(advanceCount);
      this.carousel_.updateSnapBy(advanceCount);
      this.carousel_.updateVisibleCount(visibleCount);
    });
  }

  /**
   * @param {boolean} outsetArrows
   * @private
   */
  updateOutsetArrows_(outsetArrows) {
    this.outsetArrows_ = outsetArrows;
    this.updateUi_();
  }

  /**
   * @param {string} insetArrowVisibility
   * @private
   */
  updateInsetArrowVisibility_(insetArrowVisibility) {
    this.insetArrowVisibility_ =
      insetArrowVisibility == 'always'
        ? ArrowVisibility.ALWAYS
        : insetArrowVisibility == 'never'
        ? ArrowVisibility.NEVER
        : ArrowVisibility.AUTO;
    this.updateUi_();
  }

  /**
   * Updates the UI of the <amp-base-carousel> itself, but not the internal
   * implementation.
   * @private
   */
  updateUi_() {
    // TODO(sparhami) for Shadow DOM, we will need to get the assigned nodes
    // instead.
    iterateCursor(this.prevArrowSlot_.children, child => {
      toggleAttribute(child, 'disabled', this.carousel_.isAtStart());
    });
    iterateCursor(this.nextArrowSlot_.children, child => {
      toggleAttribute(child, 'disabled', this.carousel_.isAtEnd());
    });
    toggleAttribute(
      dev().assertElement(this.content_),
      'i-amphtml-stream-gallery-hide-buttons',
      this.shouldHideButtons_()
    );
    toggleAttribute(
      dev().assertElement(this.content_),
      'i-amphtml-stream-gallery-outset-arrows',
      this.outsetArrows_
    );
  }

  /**
   * @private
   */
  setupListeners_() {
    this.element.addEventListener('indexchange', event => {
      this.onIndexChanged_(event);
    });
    this.element.addEventListener('scrollpositionchange', () => {
      this.updateUi_();
    });
    this.prevArrowSlot_.addEventListener('click', event => {
      if (event.target != event.currentTarget) {
        this.carousel_.prev(ActionSource.GENERIC_HIGH_TRUST);
      }
    });
    this.nextArrowSlot_.addEventListener('click', event => {
      if (event.target != event.currentTarget) {
        this.carousel_.next(ActionSource.GENERIC_HIGH_TRUST);
      }
    });
  }

  /**
   * @param {!Event} event
   * @private
   */
  onIndexChanged_(event) {
    const detail = getDetail(event);
    const index = detail['index'];
    const actionSource = detail['actionSource'];
    const data = dict({'index': index});
    const name = 'slideChange';
    const isHighTrust = this.isHighTrustActionSource_(actionSource);
    const trust = isHighTrust ? ActionTrust.HIGH : ActionTrust.LOW;

    const action = createCustomEvent(this.win, `streamGallery.${name}`, data);
    this.action_.trigger(this.element, name, action, trust);
    this.element.dispatchCustomEvent(name, data);
    this.hadTouch_ = this.hadTouch_ || actionSource == ActionSource.TOUCH;
    this.updateUi_();
  }
}

AMP.extension('amp-stream-gallery', '0.1', AMP => {
  AMP.registerElement(
    'amp-stream-gallery',
    AmpStreamGallery,
    CarouselCSS + CSS
  );
});
