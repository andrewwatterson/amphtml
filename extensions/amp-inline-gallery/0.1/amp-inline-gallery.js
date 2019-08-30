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

import {AmpInlineGalleryCaptions} from './amp-inline-gallery-captions';
import {AmpInlineGalleryPagination} from './amp-inline-gallery-pagination';
import {AmpInlineGallerySlide} from './amp-inline-gallery-slide';
import {AmpInlineGallerySlides} from './amp-inline-gallery-slides';
import {AmpInlineGalleryThumbnails} from './amp-inline-gallery-thumbnails';
import {CSS} from '../../../build/amp-inline-gallery-0.1.css';
import {Layout} from '../../../src/layout';
import {createCustomEvent, getDetail} from '../../../src/event-helper';
import {isExperimentOn} from '../../../src/experiments';
import {toArray} from '../../../src/types';

class AmpInlineGallery extends AMP.BaseElement {
  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);
  }

  /** @override */
  buildCallback() {
    this.element.addEventListener('offsetchange', event => {
      this.onOffsetChange_(event);
    });
    this.element.addEventListener('indexchange', event => {
      this.onIndexChange_(event);
    });
    this.element.addEventListener('goToSlide', event => {
      this.onGoToSlide_(event);
    });
  }

  /** @override */
  isLayoutSupported(layout) {
    return layout == Layout.CONTAINER;
  }

  /**
   *
   * @param {string} name
   * @param {!JsonObject} detail
   * @private
   */
  dispatchOnChildren_(name, detail) {
    toArray(this.element.children).forEach(child => {
      child.dispatchEvent(createCustomEvent(this.win, name, detail));
    });
  }
  /**
   * @param {!Event} event
   * @private
   */
  onIndexChange_(event) {
    const detail = getDetail(event);
    this.dispatchOnChildren_('indexchange-update', detail);
  }

  /**
   * @param {!Event} event
   * @private
   */
  onOffsetChange_(event) {
    const detail = getDetail(event);
    this.dispatchOnChildren_('offsetchange-update', detail);
  }

  /**
   * @param {!Event} event
   * @private
   */
  onGoToSlide_(event) {
    const detail = getDetail(event);
    this.dispatchOnChildren_('goToSlide', detail);
  }
}

AMP.extension('amp-inline-gallery', '0.1', AMP => {
  if (!isExperimentOn(AMP.win, 'amp-inline-gallery')) {
    return;
  }

  AMP.registerElement('amp-inline-gallery-captions', AmpInlineGalleryCaptions);
  AMP.registerElement(
    'amp-inline-gallery-pagination',
    AmpInlineGalleryPagination
  );
  AMP.registerElement('amp-inline-gallery-slides', AmpInlineGallerySlides);
  AMP.registerElement('amp-inline-gallery-slide', AmpInlineGallerySlide);
  AMP.registerElement(
    'amp-inline-gallery-thumbnails',
    AmpInlineGalleryThumbnails
  );
  AMP.registerElement('amp-inline-gallery', AmpInlineGallery, CSS);
});
