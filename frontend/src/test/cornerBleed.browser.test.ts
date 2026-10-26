import { afterEach, expect, it } from 'vitest';

import { collectCornerBleeds, finishAnimations } from './cornerBleed';

const mountedElements: Element[] = [];

afterEach(() => {
  for (const element of mountedElements) element.remove();
  mountedElements.length = 0;
});

function mountSurface(containerCss: string, childCss: string): HTMLElement {
  const container = document.createElement('div');
  container.style.cssText = `position: relative; width: 200px; height: 100px; border-radius: 20px; background: white; ${containerCss}`;

  const child = document.createElement('div');
  child.textContent = 'Footer';
  child.style.cssText = `position: absolute; inset-inline: 0; bottom: 0; height: 30px; background: red; ${childCss}`;
  container.append(child);

  document.body.append(container);
  mountedElements.push(container);
  return container;
}

it('test_footer_given_painted_to_rounded_edge_expect_bleed', () => {
  const container = mountSurface('', '');

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_container_clips_content_expect_no_bleed', () => {
  const container = mountSurface('overflow: hidden;', '');

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_rectangular_clip_path_expect_bleed', () => {
  const container = mountSurface('clip-path: inset(0);', '');

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_rounded_clip_path_expect_no_bleed', () => {
  const container = mountSurface('clip-path: inset(0 round 20px);', '');

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_rectangular_polygon_clip_expect_bleed', () => {
  const container = mountSurface(
    'clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);',
    '',
  );

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_rectangular_polygon_and_no_pointer_events_expect_bleed', () => {
  const container = mountSurface(
    'clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%);',
    'pointer-events: none;',
  );

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_corner_excluding_polygon_clip_expect_no_bleed', () => {
  const container = mountSurface(
    'clip-path: polygon(0 0, 100% 0, 100% 80%, 80% 100%, 20% 100%, 0 80%);',
    '',
  );

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_child_matches_corner_radius_expect_no_bleed', () => {
  const container = mountSurface('', 'border-radius: 0 0 20px 20px;');

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_child_inset_from_corner_expect_no_bleed', () => {
  const container = mountSurface('', 'inset-inline: 20px; bottom: 20px;');

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_divider_given_border_reaches_rounded_corner_expect_bleed', () => {
  const container = mountSurface(
    '',
    'background: transparent; border-bottom: 4px solid red;',
  );

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_divider_given_border_misses_corner_probe_expect_no_bleed', () => {
  const container = mountSurface(
    '',
    'background: transparent; border-bottom: 2px solid red;',
  );

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_only_top_border_expect_no_bottom_bleed', () => {
  const container = mountSurface(
    '',
    'background: transparent; border-top: 4px solid red;',
  );

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_zero_opacity_expect_no_bleed', () => {
  const container = mountSurface('', 'opacity: 0;');

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_zero_opacity_ancestor_expect_no_bleed', () => {
  const container = mountSurface('', '');
  const child = container.firstElementChild;
  if (!child) throw new Error('Fixture child is missing');

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'opacity: 0;';
  container.append(wrapper);
  wrapper.append(child);

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_zero_opacity_container_expect_no_bleed', () => {
  const container = mountSurface('opacity: 0;', '');

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_fade_in_inside_open_shadow_root_expect_bleed_after_settling', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent =
    '@keyframes corner-bleed-fade-in { from { opacity: 0; } to { opacity: 1; } }';
  shadowRoot.append(style);

  const container = mountSurface(
    '',
    'animation: corner-bleed-fade-in 10s linear both;',
  );
  shadowRoot.append(container);
  document.body.append(host);
  mountedElements.push(host);

  const footer = container.firstElementChild;
  if (!footer) throw new Error('Fixture footer is missing');
  const [animation] = footer.getAnimations();
  if (!animation) throw new Error('Fixture animation is missing');
  animation.pause();
  animation.currentTime = 0;

  expect(collectCornerBleeds(host)).toEqual([]);

  finishAnimations(host);

  expect(collectCornerBleeds(host).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_intermediate_matching_clip_expect_no_bleed', () => {
  const container = mountSurface('', '');
  const child = container.firstElementChild;
  if (!child) throw new Error('Fixture child is missing');

  const clippingWrapper = document.createElement('div');
  clippingWrapper.style.cssText =
    'position: absolute; inset-inline: 0; bottom: 0; height: 30px; overflow: hidden; border-radius: 0 0 20px 20px;';
  container.append(clippingWrapper);
  clippingWrapper.append(child);

  expect(collectCornerBleeds(container)).toEqual([]);
});

it('test_footer_given_background_image_expect_bleed', () => {
  const container = mountSurface(
    '',
    'background: transparent; background-image: linear-gradient(red, red);',
  );

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_elliptical_container_radius_expect_smaller_radius_used', () => {
  const container = mountSurface('border-radius: 30px / 20px;', '');

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_rounded_surface_in_open_shadow_root_expect_bleed', () => {
  const host = document.createElement('div');
  const shadowRoot = host.attachShadow({ mode: 'open' });
  const container = mountSurface('', '');
  shadowRoot.append(container);
  document.body.append(host);
  mountedElements.push(host);

  expect(collectCornerBleeds(host).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});

it('test_footer_given_small_radius_and_visible_border_expect_bleed', () => {
  const container = mountSurface(
    'border: 1px solid black; border-radius: 6px;',
    '',
  );

  expect(collectCornerBleeds(container).map(({ corner }) => corner)).toEqual([
    'bottom-right',
    'bottom-left',
  ]);
});
