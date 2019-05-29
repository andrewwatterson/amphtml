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
import {createCustomEvent, getDetail} from '../../../src/event-helper';
import {dev, user} from '../../../src/log';
import {dict} from '../../../src/utils/object';
import {htmlFor} from '../../../src/static-template';
import {isExperimentOn} from '../../../src/experiments';
import {isLayoutSizeDefined} from '../../../src/layout';
import {iterateCursor, toggleAttribute} from '../../../src/dom';
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
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    /** @private {?Element} */
    this.content_ = null;

    /** @private {?Element} */
    this.scrollContainer_ = null;

    /** @private {?Carousel} */
    this.carousel_ = null;

    /** @private {!Array<!Element>} */
    this.slides_ = [];

    /** @private {?Element} */
    this.nextArrowSlot_ = null;

    /** @private {?Element} */
    this.prevArrowSlot_ = null;

    /** @private {boolean} */
    this.outsetArrows_ = false;

    /** @private {number} */
    this.visibleCount_ = 1;

    /** @private {!ArrowVisibility} */
    this.insetArrowVisibility_ = ArrowVisibility.AUTO;

    /**
     * Whether or not the user has interacted with the carousel using touch in
     * the past at any point.
     * @private {boolean}
     */
    this.hadTouch_ = false;

    /** @private {?../../../src/service/action-impl.ActionService} */
    this.action_ = null;

    /** @private {number} */
    this.minVisibleCount_ = 1;

    /** @private {number} */
    this.maxItemWidth_ = Number.MAX_VALUE;

    /** @private {number} */
    this.peek_ = 0;

    /** @private @const */
    this.responsiveAttributes_ = new ResponsiveAttributes({
      'auto-advance': newValue => {
        this.carousel_.updateAutoAdvance(newValue == 'true');
      },
      'auto-advance-interval': newValue => {
        this.carousel_.updateAutoAdvanceInterval(Number(newValue) || 0);
      },
      'auto-advance-loops': newValue => {
        this.carousel_.updateAutoAdvanceLoops(Number(newValue) || 0);
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
      'inset-arrow-visibility': newValue => {
        this.updateInsetArrowVisibility_(newValue);
      },
      'slide': newValue => {
        this.carousel_.goToSlide(Number(newValue));
      },
      'snap': newValue => {
        this.carousel_.updateSnap(newValue != 'false');
      },
      'snap-align': newValue => {
        this.carousel_.updateAlignment(newValue);
      },
      'min-visible-count': newValue => {
        this.updateMinVisibleCount_(Number(newValue));
      },
      'max-item-width': newValue => {
        this.updateMaxItemWidth_(Number(newValue));
      },
    });
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
   * @param {number} minVisibleCount
   */
  updateMinVisibleCount_(minVisibleCount) {
    this.minVisibleCount_ = minVisibleCount || 1;
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
   * Moves the Carousel to a given index.
   * @param {number} index
   */
  goToSlide(index) {
    this.carousel_.goToSlide(index, {smoothScroll: false});
  }

  /**
   * Goes to the next slide. This should be called from a user interaction.
   */
  interactionNext() {
    this.carousel_.next(ActionSource.GENERIC_HIGH_TRUST);
  }

  /**
   * Goes to the previous slide. This should be called from a user interaction.
   */
  interactionPrev() {
    this.carousel_.prev(ActionSource.GENERIC_HIGH_TRUST);
  }

  /**
   * Updates the number of items visible for the internal carousel.
   */
  updateVisibleCount_() {
    const {maxItemWidth_, minVisibleCount_, peek_} = this;
    const box = this.getLayoutBox();
    const fractionalItems = box.width / maxItemWidth_;
    const partialItem = fractionalItems - Math.floor(fractionalItems);
    const wholeItems = Math.ceil(fractionalItems);
    const items =
      partialItem > peek_ ? wholeItems + peek_ : wholeItems - 1 + peek_;

    const visibleCount = Math.max(items, minVisibleCount_);
    const advanceCount = Math.floor(visibleCount);

    this.carousel_.updateAdvanceCount(advanceCount);
    this.carousel_.updateAutoAdvanceCount(advanceCount);
    this.carousel_.updateSnapBy(advanceCount);
    this.carousel_.updateVisibleCount(visibleCount);
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

    this.scrollContainer_ = dev().assertElement(
      this.element.querySelector('.i-amphtml-carousel-scroll')
    );
    this.content_ = dev().assertElement(
      this.element.querySelector('.i-amphtml-carousel-content')
    );
    this.carousel_ = new Carousel({
      win,
      element,
      scrollContainer: this.scrollContainer_,
      initialIndex: this.getInitialIndex_(),
      runMutate: cb => this.mutateElement(cb),
    });
    this.carousel_.updateSnap(false);

    // Do some manual "slot" distribution
    this.slides_.forEach(slide => {
      slide.classList.add('i-amphtml-carousel-slotted');
      this.scrollContainer_.appendChild(slide);
    });
    this.prevArrowSlot_ = this.element.querySelector(
      '.i-amphtml-stream-gallery-arrow-prev-slot'
    );
    this.nextArrowSlot_ = this.element.querySelector(
      '.i-amphtml-stream-gallery-arrow-next-slot'
    );
    // Slot the arrows, with defaults
    this.prevArrowSlot_.appendChild(prevArrow || this.createPrevArrow_());
    this.nextArrowSlot_.appendChild(nextArrow || this.createNextArrow_());

    // Handle the initial set of attributes
    toArray(this.element.attributes).forEach(attr => {
      this.attributeMutated_(attr.name, attr.value);
    });

    this.setupActions_();
    this.setupListeners_();
    this.updateSlides_();
    this.updateUi_();

    // Signal for runtime to check children for layout.
    return this.mutateElement(() => {});
  }

  /** @override */
  isRelayoutNeeded() {
    return true;
  }

  /** @override */
  layoutCallback() {
    this.updateVisibleCount_();
    this.carousel_.updateUi();
    return Promise.resolve();
  }

  /** @override */
  pauseCallback() {
    this.carousel_.pauseAutoAdvance();
  }

  /** @override */
  resumeCallback() {
    this.carousel_.resumeAutoAdvance();
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
      this.content_,
      'i-amphtml-stream-gallery-hide-buttons',
      this.shouldHideButtons_()
    );
    toggleAttribute(
      this.content_,
      'i-amphtml-stream-gallery-outset-arrows',
      this.outsetArrows_
    );
  }

  /**
   * @private
   */
  updateSlides_() {
    this.carousel_.updateSlides(this.slides_);
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

  /**
   * @param {string} name The name of the attribute.
   * @param {string} newValue The new value of the attribute.
   * @private
   */
  attributeMutated_(name, newValue) {
    this.responsiveAttributes_.updateAttribute(name, newValue);
  }
}

AMP.extension('amp-stream-gallery', '0.1', AMP => {
  AMP.registerElement(
    'amp-stream-gallery',
    AmpStreamGallery,
    CarouselCSS + CSS
  );
});
