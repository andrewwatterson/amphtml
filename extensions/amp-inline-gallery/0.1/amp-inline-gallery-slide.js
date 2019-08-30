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

import {CSS} from '../../../build/amp-inline-gallery-slide-0.1.css';
import {Layout} from '../../../src/layout';
import {Services} from '../../../src/services';

export class AmpInlineGallerySlide extends AMP.BaseElement {
  /**
   * @return {!ShadowRoot}
   * @private
   */
  createShadowRoot_() {
    const sr = this.element.attachShadow({mode: 'open'});
    sr.innerHTML = `
      <style>${CSS}</style>
      <figure class="container">
        <div class="content">
          <slot></slot>
        </div>
        <figcaption class="caption">
          <amp-truncate-text layout="fill">
            <slot name="caption"></slot>
            <button class="see-more" slot="collapsed">See more</button>
            <div class="credit" slot="persistent">
              <slot name="credit"></slot>
            </div>
          </amp-truncate-text>
        </figcaption>
      </figure>
    `;
    const expand = sr.querySelector('[slot="collapsed"]');
    expand.addEventListener('click', e => {
      this.openLightbox();
      e.stopPropagation();
    });

    return sr;
  }

  /** @param {!AmpElement} element */
  constructor(element) {
    super(element);

    this.sr_ = null;

    element['getCaptionContent'] = () => this.getCaptionContent();
  }

  /**
   *
   */
  openLightbox() {
    Services.extensionsFor(this.win)
      .installExtensionForDoc(this.getAmpDoc(), 'amp-lightbox-gallery')
      .then(() => {
        const el = document.querySelector('amp-lightbox-gallery');
        return el.getImpl();
      })
      .then(impl => {
        const img = this.element.querySelector('amp-img');
        impl.open(img, true);
      });
  }

  /**
   *
   */
  getCaptionContent() {
    const truncateText = this.sr_.querySelector('amp-truncate-text');
    return truncateText['getTextContent']();
  }

  /** @override */
  isLayoutSupported() {
    return Layout.FLEX_ITEM;
  }

  /** @override */
  buildCallback() {
    this.sr_ = this.createShadowRoot_();

    // Signal for runtime to check children for layout.
    return this.mutateElement(() => {});
  }
}
