import CSS from '$/v-scroll.js';

const V_SCROLL_TAG = 'v-scroll';

const createTemplate = () => {
  const TEMPLATE = document.createElement('template'),
    STYLE = document.createElement('style'),
    SCROLL = document.createElement('b'),
    TRACK = document.createElement('b'),
    BAR = document.createElement('b');
  STYLE.textContent = CSS;
  SCROLL.setAttribute('part', 'scroll');
  TRACK.setAttribute('part', 'track');
  TRACK.dataset.active = 'false';
  BAR.setAttribute('part', 'bar turned');
  BAR.dataset.active = 'false';
  SCROLL.innerHTML = `
      <b style="display:block"><slot></slot></b>
    `;
  TEMPLATE.content.append(STYLE, SCROLL, TRACK, BAR);
  return TEMPLATE;
};

const getNumericCssVar = (element, name, fallback) => {
  const RAW_VALUE = getComputedStyle(element).getPropertyValue(name).trim(),
    PARSED_VALUE = Number.parseFloat(RAW_VALUE);
  return Number.isFinite(PARSED_VALUE) ? PARSED_VALUE : fallback;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const getInitialState = () => ({
  scroll_height: 0,
  thumb_height: 16,
  edge_gap: 3,
  max_scroll_top: 0,
  raf_id: 0,
  dragging: false,
  drag_pointer_id: -1,
  drag_start_client_y: 0,
  drag_start_thumb_y: 0,
  pending_drag_client_y: 0,
  drag_move_raf_id: 0,
  current_thumb_y: 0,
  wheel_indicator_timer: 0
});

const createContext = (host) => {
  const SHADOW_ROOT = host.shadowRoot, REFS = {
    scroll: SHADOW_ROOT.querySelector('[part="scroll"]'),
    track: SHADOW_ROOT.querySelector('[part~="track"]'),
    bar: SHADOW_ROOT.querySelector('[part~="bar"]'),
    content: null
  };
  const SLOT = SHADOW_ROOT.querySelector('slot'), CTX = {
    host,
    refs: REFS,
    slot: SLOT,
    slotted_elements: [],
    mounted: false,
    state: getInitialState(),
    resize_observer: null,
    handlers: null
  };
  return CTX;
};

const applyThumbPosition = (ctx, raw_thumb_y) => {
  const { bar } = ctx.refs;
  const { edge_gap, scroll_height, thumb_height } = ctx.state;
  const VISUAL_MAX_THUMB_Y = Math.max(edge_gap, scroll_height - edge_gap - thumb_height),
    VISUAL_THUMB_Y = clamp(raw_thumb_y, edge_gap, VISUAL_MAX_THUMB_Y);
  bar.style.insetBlockStart = `${VISUAL_THUMB_Y}px`;
};

const clearWheelIndicator = (ctx) => {
  if (ctx.state.wheel_indicator_timer) {
    clearTimeout(ctx.state.wheel_indicator_timer);
    ctx.state.wheel_indicator_timer = 0;
  }
  ctx.host.removeAttribute('wheeling');
};

const clearDragMoveRaf = (ctx) => {
  if (!ctx.state.drag_move_raf_id) return;
  cancelAnimationFrame(ctx.state.drag_move_raf_id);
  ctx.state.drag_move_raf_id = 0;
};

const removeDragListeners = (ctx) => {
  const { onPointerMove, onPointerUp } = ctx.handlers;
  window.removeEventListener('pointermove', onPointerMove);
  window.removeEventListener('pointerup', onPointerUp);
  window.removeEventListener('pointercancel', onPointerUp);
};

const isEventFromSlottedContent = (ctx, event) => {
  if (!ctx.slotted_elements.length) return false;
  const TARGET = event.target instanceof Element ? event.target : null, PATH = event.composedPath();
  return ctx.slotted_elements.some((element) => {
    if (!(element instanceof Element)) return false;
    if (PATH.includes(element)) return true;
    if (!TARGET) return false;
    return element === TARGET || element.contains(TARGET);
  });
};

const isEventOnBlankSurface = (ctx, event) => {
  const { scroll, content } = ctx.refs;
  const TARGET = event.target instanceof Element ? event.target : null;
  if (!TARGET) return false;
  if (TARGET === scroll) return true;
  if (content && TARGET === content) return true;
  return false;
};

const isWheelInRightGutter = (ctx, event) => {
  const { scroll } = ctx.refs;
  const RECT = scroll.getBoundingClientRect();
  if (!RECT.width) return false;

  const BASE_WIDTH = getNumericCssVar(ctx.host, '--v-scroll-width', 8),
    EDGE_GAP = ctx.state.edge_gap || getNumericCssVar(ctx.host, '--v-scroll-edge-gap', 3),
    GUTTER_WIDTH = Math.max(8, BASE_WIDTH + EDGE_GAP * 2 - 4),
    GUTTER_START_X = RECT.right - GUTTER_WIDTH;
  return event.clientX >= GUTTER_START_X && event.clientX <= RECT.right;
};

const isWheelInInteractiveZone = (ctx, event) => {
  return isWheelInRightGutter(ctx, event) || isEventOnBlankSurface(ctx, event);
};

const resolveWheelDelta = (event, viewport_height) => {
  if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) return event.deltaY * 16;
  if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) return event.deltaY * viewport_height;
  return event.deltaY;
};

const showWheelIndicator = (ctx) => {
  ctx.host.setAttribute('wheeling', '');
  if (ctx.state.wheel_indicator_timer) clearTimeout(ctx.state.wheel_indicator_timer);
  
  ctx.state.wheel_indicator_timer = setTimeout(() => {
    ctx.host.removeAttribute('wheeling');
    ctx.state.wheel_indicator_timer = 0;
  }, 220);
};

const refreshLayout = (ctx) => {
  if (!ctx.host.isConnected || !ctx.mounted) {
    destroy(ctx);
    return;
  }
  const { scroll, bar, track } = ctx.refs;
  const { clientHeight: VIEWPORT_HEIGHT, scrollHeight: CONTENT_HEIGHT, scrollTop: CURRENT_SCROLL_TOP } = scroll;
  const EDGE_GAP = getNumericCssVar(ctx.host, '--v-scroll-edge-gap', 3),
    MIN_THUMB = getNumericCssVar(ctx.host, '--v-scroll-min-thumb', 16),
    SCROLL_HEIGHT = scroll.clientHeight,
    USABLE_TRACK_HEIGHT = Math.max(0, SCROLL_HEIGHT - EDGE_GAP * 2),
    MAX_SCROLL_TOP = Math.max(0, CONTENT_HEIGHT - VIEWPORT_HEIGHT);

  ctx.state.edge_gap = EDGE_GAP;
  ctx.state.scroll_height = SCROLL_HEIGHT;
  ctx.state.max_scroll_top = MAX_SCROLL_TOP;

  if (MAX_SCROLL_TOP <= 0 || USABLE_TRACK_HEIGHT <= 0) {
    track.dataset.active = 'false';
    bar.dataset.active = 'false';
    bar.style.blockSize = `${MIN_THUMB}px`;
    applyThumbPosition(ctx, EDGE_GAP);
    ctx.state.thumb_height = MIN_THUMB;
    ctx.state.current_thumb_y = EDGE_GAP;
    return;
  }

  const THUMB_HEIGHT = clamp((VIEWPORT_HEIGHT / CONTENT_HEIGHT) * USABLE_TRACK_HEIGHT, MIN_THUMB, USABLE_TRACK_HEIGHT);
  ctx.state.thumb_height = THUMB_HEIGHT;
  track.dataset.active = 'true';
  bar.dataset.active = 'true';
  bar.style.blockSize = `${THUMB_HEIGHT}px`;

  const RANGE = Math.max(0, USABLE_TRACK_HEIGHT - THUMB_HEIGHT),
    RATIO = MAX_SCROLL_TOP > 0 ? CURRENT_SCROLL_TOP / MAX_SCROLL_TOP : 0,
    THUMB_Y = EDGE_GAP + RATIO * RANGE;
  ctx.state.current_thumb_y = THUMB_Y;
  applyThumbPosition(ctx, THUMB_Y);
};

const queueRefresh = (ctx) => {
  if (!ctx.host.isConnected || !ctx.mounted || ctx.state.raf_id) return;
  ctx.state.raf_id = requestAnimationFrame(() => {
    ctx.state.raf_id = 0;
    if (!ctx.host.isConnected || !ctx.mounted) {
      destroy(ctx);
      return;
    }
    refreshLayout(ctx);
  });
};

const syncThumbByScroll = (ctx) => {
  if (ctx.state.dragging) return;
  const { scroll } = ctx.refs;
  const { edge_gap, scroll_height, thumb_height, max_scroll_top } = ctx.state;
  const USABLE_TRACK_HEIGHT = Math.max(0, scroll_height - edge_gap * 2),
    RANGE = Math.max(0, USABLE_TRACK_HEIGHT - thumb_height),
    RATIO = max_scroll_top > 0 ? scroll.scrollTop / max_scroll_top : 0,
    THUMB_Y = edge_gap + RATIO * RANGE;
  ctx.state.current_thumb_y = THUMB_Y;
  applyThumbPosition(ctx, THUMB_Y);
};

const applyDragMove = (ctx, client_y) => {
  const { scroll } = ctx.refs;
  const { edge_gap, scroll_height, thumb_height, drag_start_client_y, drag_start_thumb_y, max_scroll_top } = ctx.state;
  const USABLE_TRACK_HEIGHT = Math.max(0, scroll_height - edge_gap * 2),
    THUMB_RANGE = Math.max(0, USABLE_TRACK_HEIGHT - thumb_height),
    DELTA_Y = client_y - drag_start_client_y,
    NEXT_THUMB_Y = clamp(drag_start_thumb_y + DELTA_Y, edge_gap, edge_gap + THUMB_RANGE),
    RATIO = THUMB_RANGE > 0 ? (NEXT_THUMB_Y - edge_gap) / THUMB_RANGE : 0,
    NEXT_SCROLL_TOP = RATIO * max_scroll_top;
  ctx.state.current_thumb_y = NEXT_THUMB_Y;
  scroll.scrollTop = NEXT_SCROLL_TOP;
  applyThumbPosition(ctx, NEXT_THUMB_Y);
};

const addDragListeners = (ctx) => {
  const { onPointerMove, onPointerUp } = ctx.handlers;
  window.addEventListener('pointermove', onPointerMove, { passive: false });
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
};

const handlePointerDown = (ctx, event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  const { bar } = ctx.refs;
  ctx.state.dragging = true;
  ctx.state.drag_pointer_id = event.pointerId;
  ctx.state.drag_start_client_y = event.clientY;
  ctx.state.drag_start_thumb_y = ctx.state.current_thumb_y;
  ctx.host.setAttribute('dragging', '');
  bar.setPointerCapture(event.pointerId);
  addDragListeners(ctx);
};

const handlePointerMove = (ctx, event) => {
  if (!ctx.state.dragging || event.pointerId !== ctx.state.drag_pointer_id) return;
  event.preventDefault();
  ctx.state.pending_drag_client_y = event.clientY;
  if (ctx.state.drag_move_raf_id) return;
  ctx.state.drag_move_raf_id = requestAnimationFrame(() => {
    ctx.state.drag_move_raf_id = 0;
    if (!ctx.state.dragging) return;
    applyDragMove(ctx, ctx.state.pending_drag_client_y);
  });
};

const handlePointerUp = (ctx, event) => {
  if (event.pointerId !== ctx.state.drag_pointer_id) return;
  const { bar } = ctx.refs;
  clearDragMoveRaf(ctx);
  applyDragMove(ctx, event.clientY);
  ctx.state.dragging = false;
  ctx.state.drag_pointer_id = -1;
  ctx.host.removeAttribute('dragging');
  if (bar.hasPointerCapture(event.pointerId)) bar.releasePointerCapture(event.pointerId);
  removeDragListeners(ctx);
  syncThumbByScroll(ctx);
};

const handleViewportWheel = (ctx, event) => {
  const IS_FROM_BAR = event.composedPath().includes(ctx.refs.bar);
  if (IS_FROM_BAR) {
    event.preventDefault();
    return;
  }
  const IS_FROM_SLOTTED_CONTENT = isEventFromSlottedContent(ctx, event),
    IS_ON_BLANK_SURFACE = isEventOnBlankSurface(ctx, event);
  if (IS_FROM_SLOTTED_CONTENT && !IS_ON_BLANK_SURFACE) {
    event.preventDefault();
    return;
  }
  if (!isWheelInInteractiveZone(ctx, event)) return;
  event.preventDefault();
  const { scroll } = ctx.refs;
  const DELTA = resolveWheelDelta(event, scroll.clientHeight), NEXT_SCROLL_TOP = clamp(
    scroll.scrollTop + DELTA,
    0,
    Math.max(0, scroll.scrollHeight - scroll.clientHeight)
  );
  scroll.scrollTop = NEXT_SCROLL_TOP;
  showWheelIndicator(ctx);
};

const handleViewportPointerMove = (ctx, event) => {
  const IN_GUTTER = isWheelInInteractiveZone(ctx, event), IN_RIGHT_GUTTER = isWheelInRightGutter(ctx, event);
  if (IN_GUTTER) ctx.host.setAttribute('in-gutter', '');
  else ctx.host.removeAttribute('in-gutter');
  if (IN_RIGHT_GUTTER) ctx.host.setAttribute('over-scrollbar', '');
  else ctx.host.removeAttribute('over-scrollbar');
};

const handleViewportPointerLeave = (ctx) => {
  ctx.host.removeAttribute('in-gutter');
  ctx.host.removeAttribute('over-scrollbar');
};

const handleSlotChange = (ctx) => {
  if (ctx.refs.content) ctx.resize_observer.unobserve(ctx.refs.content);
  const ASSIGNED = ctx.slot.assignedElements({ flatten: true });
  ctx.slotted_elements = ASSIGNED;
  const CONTENT = ASSIGNED.find((element) => element.classList?.contains('content')) ?? ASSIGNED[0] ?? null;
  ctx.refs.content = CONTENT;
  if (CONTENT) ctx.resize_observer.observe(CONTENT);
  queueRefresh(ctx);
};

const destroy = (ctx) => {
  if (!ctx.mounted) return;
  ctx.mounted = false;
  const { scroll, bar } = ctx.refs;
  const { onScroll, onViewportWheel, onViewportPointerMove, onViewportPointerLeave, onPointerDown, onSlotChange } = ctx.handlers;
  scroll.removeEventListener('scroll', onScroll);
  scroll.removeEventListener('wheel', onViewportWheel);
  scroll.removeEventListener('pointermove', onViewportPointerMove);
  scroll.removeEventListener('pointerleave', onViewportPointerLeave);
  bar.removeEventListener('pointerdown', onPointerDown);
  ctx.slot?.removeEventListener('slotchange', onSlotChange);
  if (ctx.refs.content) ctx.resize_observer.unobserve(ctx.refs.content);
  removeDragListeners(ctx);
  ctx.host.removeAttribute('dragging');
  ctx.resize_observer.disconnect();
  if (ctx.state.raf_id) cancelAnimationFrame(ctx.state.raf_id);
  ctx.state.raf_id = 0;
  clearDragMoveRaf(ctx);
  ctx.state.dragging = false;
  ctx.state.drag_pointer_id = -1;
  clearWheelIndicator(ctx);
  ctx.host.removeAttribute('in-gutter');
  ctx.host.removeAttribute('over-scrollbar');
};

const onConnected = (host) => {
  if (host.__v_scroll_ctx?.mounted) return;
  const CTX = host.__v_scroll_ctx;
  const { scroll, bar, track } = CTX.refs;
  if (!scroll || !bar || !track || !CTX.slot) return;
  CTX.mounted = true;
  scroll.addEventListener('scroll', CTX.handlers.onScroll, { passive: true });
  scroll.addEventListener('wheel', CTX.handlers.onViewportWheel, { passive: false });
  scroll.addEventListener('pointermove', CTX.handlers.onViewportPointerMove, { passive: true });
  scroll.addEventListener('pointerleave', CTX.handlers.onViewportPointerLeave, { passive: true });
  bar.addEventListener('pointerdown', CTX.handlers.onPointerDown);
  CTX.slot.addEventListener('slotchange', CTX.handlers.onSlotChange);
  CTX.resize_observer.observe(scroll);
  handleSlotChange(CTX);
  queueRefresh(CTX);
};

const onDisconnected = (host) => {
  const CTX = host.__v_scroll_ctx;
  if (CTX) destroy(CTX);
};

const createVScrollElement = () => {
  const V_SCROLL_ELEMENT = function VScrollElement() {
    const SELF = Reflect.construct(HTMLElement, [], V_SCROLL_ELEMENT);
    SELF.attachShadow({ mode: 'open' });
    SELF.shadowRoot.append(createTemplate().content.cloneNode(true));
    const CTX = createContext(SELF);
    CTX.handlers = {
      onScroll: () => syncThumbByScroll(CTX),
      onPointerDown: (event) => handlePointerDown(CTX, event),
      onPointerMove: (event) => handlePointerMove(CTX, event),
      onPointerUp: (event) => handlePointerUp(CTX, event),
      onViewportWheel: (event) => handleViewportWheel(CTX, event),
      onViewportPointerMove: (event) => handleViewportPointerMove(CTX, event),
      onViewportPointerLeave: () => handleViewportPointerLeave(CTX),
      onSlotChange: () => handleSlotChange(CTX)
    };
    CTX.resize_observer = new ResizeObserver(() => queueRefresh(CTX));
    SELF.__v_scroll_ctx = CTX;
    return SELF;
  };
  V_SCROLL_ELEMENT.prototype = Object.create(HTMLElement.prototype);
  V_SCROLL_ELEMENT.prototype.constructor = V_SCROLL_ELEMENT;
  /**@description: connectedCallback / disconnectedCallback 属于 Custom Element 的生命周期方法，浏览器调用时会把 this 绑定到当前元素实例 所以需要不能使用箭头函数  */
  V_SCROLL_ELEMENT.prototype.connectedCallback = function connectedCallback() {
    onConnected(this);
  };
  V_SCROLL_ELEMENT.prototype.disconnectedCallback = function disconnectedCallback() {
    onDisconnected(this);
  };
  return V_SCROLL_ELEMENT;
};

if (!customElements.get(V_SCROLL_TAG)) customElements.define(V_SCROLL_TAG, createVScrollElement());
