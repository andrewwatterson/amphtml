---
$category@: layout
formats:
  - websites
teaser:
  text: Wraps its children in a unique full-screen scrolling container allowing you to display a full-screen ad without taking up the entire viewport.
---
<!---
Copyright 2016 The AMP HTML Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

      http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS-IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
-->

# amp-fx-flying-carpet

A flying carpet wraps its children in a unique full-screen scrolling container. In particular, this allows you to display a full-screen ad without taking up the entire viewport, making for a better user experience.

<table>
  <tr>
    <td class="col-fourty"><strong>Required Script</strong></td>
    <td><code>&lt;script async custom-element="amp-fx-flying-carpet" src="https://cdn.ampproject.org/v0/amp-fx-flying-carpet-0.1.js">&lt;/script></code></td>
  </tr>
  <tr>
    <td class="col-fourty"><strong>Examples</strong></td>
    <td><a href="https://amp.dev/documentation/examples/components/amp-fx-flying-carpet/">Annotated code example for amp-fx-flying-carpet</a></td>
  </tr>
</table>

[tip type="note"]
Check if your ad network permits use of flying carpets when implementing the `amp-fx-flying-carpet` to display adds. 
[/tip]
[TOC]

## Behavior

`amp-fx-flying-carpet` displays its children inside a container of fixed height. As the user scrolls the page, the flying carpet reveals more of it contents, sliding across its children as if peering through a window in the page.

Example:

```html
<amp-fx-flying-carpet height="300px">
  <amp-img src="fullscreen.png" width="300" height="500" layout="responsive"></amp-img>
</amp-fx-flying-carpet>
```

The following requirements are imposed on `amp-fx-flying-carpet` positioning:
 - It should be positioned so that it doesn't obscure the first viewport (outside of top 75%).
 - It should be positioned so that its top can reach or be above the top of the last viewport when scrolled.

## Attributes
<table>
  <tr>
    <td width="40%"><strong>height</strong></td>
    <td>The height of the flying carpet's "window".</td>
  </tr>
  <tr>
    <td width="40%"><strong>common attributes</strong></td>
    <td>This element includes <a href="https://amp.dev/documentation/guides-and-tutorials/learn/common_attributes">common attributes</a> extended to AMP components.</td>
  </tr>
</table>


## Styling

- You may use the `amp-fx-flying-carpet` element selector to style it freely.
- `amp-fx-flying-carpet` elements are always `position: relative`.

## Validation

See [amp-fx-flying-carpet rules](https://github.com/ampproject/amphtml/blob/master/extensions/amp-fx-flying-carpet/validator-amp-fx-flying-carpet.protoascii) in the AMP validator specification.
