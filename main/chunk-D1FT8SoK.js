import{An as g,Ar as v,Cn as ee,Ct as Q$1,Dr as ue$1,Er as tg,Et as RE,Gr as yo,Gt as V,Hr as yC,Ht as Ug,J as Hi,L as Fj,Mr as vi,Nn as go,Nr as vs,Nt as Ss,On as et$1,Ot as Rt$1,Qn as mn$1,R as Fu,Rn as io,Sn as ea$1,St as PE,Vn as jh,Wr as yi,Wt as Uu,X as Hw,Xt as W,Yn as mC,Zn as mg,Zt as We$1,_ as C,at as K,b as Ce,en as Ww,er as ne,gn as bv,i as $l,it as Jo,jn as gI,kt as Ry,lr as oo,lt as LI,nr as nt$1,nt as JE,o as $u,or as oe$1,pr as py,pt as Lu,rr as nu,rt as Jh,sr as of,st as Ku,t as $D,tn as XE,tt as Ir,ur as pp,vr as re$1,xr as sg,yn as cb}from"./chunk-BbtgccHu.js";import{A as un$1,C as Pn$1,D as mn$2,M as xn$1,S as Ln$1,_ as An$1,x as Hn$1,y as En$1}from"./main-5VQIB3EQ.js";var ct;function je(){if(ct==null&&typeof window<`u`)try{window.addEventListener(`test`,null,Object.defineProperty({},"passive",{get:()=>ct=!0}))}finally{ct=ct||!1}return ct}function Q(n){return je()?n:!!n.capture}var Ue=new C(`cdk-input-modality-detector-options`);var ze={ignoreKeys:[18,17,224,91,16]};var Ge=650;var ae={passive:!0,capture:!0};var He=(()=>{class n{_platform=g(un$1);_listenerCleanups;modalityDetected;modalityChanged;get mostRecentModality(){return this._modality.value}_mostRecentTarget=null;_modality=new Ir(null);_options;_lastTouchMs=0;_onKeydown=t=>{this._options?.ignoreKeys?.some(a=>a===t.keyCode)||(this._modality.next(`keyboard`),this._mostRecentTarget=Hn$1(t))};_onMousedown=t=>{Date.now()-this._lastTouchMs<Ge||(this._modality.next(Pn$1(t)?`keyboard`:`mouse`),this._mostRecentTarget=Hn$1(t))};_onTouchstart=t=>{if(Ln$1(t)){this._modality.next(`keyboard`);return}this._lastTouchMs=Date.now(),this._modality.next(`touch`),this._mostRecentTarget=Hn$1(t)};constructor(){let t=g(Ce),a=g(Q$1),r=g(Ue,{optional:!0});if(this._options=V(V({},ze),r),this.modalityDetected=this._modality.pipe(Ry(1)),this.modalityChanged=this.modalityDetected.pipe(Jo()),this._platform.isBrowser){let o=g(oo).createRenderer(null,null);this._listenerCleanups=t.runOutsideAngular(()=>[o.listen(a,`keydown`,this._onKeydown,ae),o.listen(a,`mousedown`,this._onMousedown,ae),o.listen(a,`touchstart`,this._onTouchstart,ae)])}}ngOnDestroy(){this._modality.complete(),this._listenerCleanups?.forEach(t=>t())}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var ut=(function(n){return n[n.IMMEDIATE=0]=`IMMEDIATE`,n[n.EVENTUAL=1]=`EVENTUAL`,n})(ut||{});var $e=new C(`cdk-focus-monitor-default-options`);var At=Q({passive:!0,capture:!0});var re=(()=>{class n{_ngZone=g(Ce);_platform=g(un$1);_inputModalityDetector=g(He);_origin=null;_lastFocusOrigin=null;_windowFocused=!1;_windowFocusTimeoutId;_originTimeoutId;_originFromTouchInteraction=!1;_elementInfo=/* @__PURE__ */ new Map;_monitoredElementCount=0;_rootNodeFocusListenerCount=/* @__PURE__ */ new Map;_detectionMode;_windowFocusListener=()=>{this._windowFocused=!0,this._windowFocusTimeoutId=setTimeout(()=>this._windowFocused=!1)};_document=g(Q$1);_stopInputModalityDetector=new ne;constructor(){let t=g($e,{optional:!0});this._detectionMode=t?.detectionMode||ut.IMMEDIATE}_rootNodeFocusAndBlurListener=t=>{let a=Hn$1(t);for(let r=a;r;r=r.parentElement)t.type===`focus`?this._onFocus(t,r):this._onBlur(t,r)};monitor(t,a=!1){let r=mn$2(t);if(!this._platform.isBrowser||r.nodeType!==1)return ea$1();let o=xn$1(r)||this._document,i=this._elementInfo.get(r);if(i)return a&&(i.checkChildren=!0),i.subject;let d={checkChildren:a,subject:new ne,rootNode:o};return this._elementInfo.set(r,d),this._registerGlobalListeners(d),d.subject}stopMonitoring(t){let a=mn$2(t),r=this._elementInfo.get(a);r&&(r.subject.complete(),this._setClasses(a),this._elementInfo.delete(a),this._removeGlobalListeners(r))}focusVia(t,a,r){let o=mn$2(t);o===this._document.activeElement?this._getClosestElementsInfo(o).forEach(([d,f])=>this._originChanged(d,a,f)):(this._setOrigin(a),typeof o.focus==`function`&&o.focus(r))}ngOnDestroy(){this._elementInfo.forEach((t,a)=>this.stopMonitoring(a))}_getWindow(){return this._document.defaultView||window}_getFocusOrigin(t){return this._origin?this._originFromTouchInteraction?this._shouldBeAttributedToTouch(t)?`touch`:`program`:this._origin:this._windowFocused&&this._lastFocusOrigin?this._lastFocusOrigin:t&&this._isLastInteractionFromInputLabel(t)?`mouse`:`program`}_shouldBeAttributedToTouch(t){return this._detectionMode===ut.EVENTUAL||!!t?.contains(this._inputModalityDetector._mostRecentTarget)}_setClasses(t,a){t.classList.toggle(`cdk-focused`,!!a),t.classList.toggle(`cdk-touch-focused`,a===`touch`),t.classList.toggle(`cdk-keyboard-focused`,a===`keyboard`),t.classList.toggle(`cdk-mouse-focused`,a===`mouse`),t.classList.toggle(`cdk-program-focused`,a===`program`)}_setOrigin(t,a=!1){this._ngZone.runOutsideAngular(()=>{if(this._origin=t,this._originFromTouchInteraction=t===`touch`&&a,this._detectionMode===ut.IMMEDIATE){clearTimeout(this._originTimeoutId);let r=this._originFromTouchInteraction?Ge:1;this._originTimeoutId=setTimeout(()=>this._origin=null,r)}})}_onFocus(t,a){let r=this._elementInfo.get(a),o=Hn$1(t);!r||!r.checkChildren&&a!==o||this._originChanged(a,this._getFocusOrigin(o),r)}_onBlur(t,a){let r=this._elementInfo.get(a);!r||r.checkChildren&&t.relatedTarget instanceof Node&&a.contains(t.relatedTarget)||(this._setClasses(a),this._emitOrigin(r,null))}_emitOrigin(t,a){t.subject.observers.length&&this._ngZone.run(()=>t.subject.next(a))}_registerGlobalListeners(t){if(!this._platform.isBrowser)return;let a=t.rootNode,r=this._rootNodeFocusListenerCount.get(a)||0;r||this._ngZone.runOutsideAngular(()=>{a.addEventListener(`focus`,this._rootNodeFocusAndBlurListener,At),a.addEventListener(`blur`,this._rootNodeFocusAndBlurListener,At)}),this._rootNodeFocusListenerCount.set(a,r+1),++this._monitoredElementCount===1&&(this._ngZone.runOutsideAngular(()=>{this._getWindow().addEventListener(`focus`,this._windowFocusListener)}),this._inputModalityDetector.modalityDetected.pipe($l(this._stopInputModalityDetector)).subscribe(o=>{this._setOrigin(o,!0)}))}_removeGlobalListeners(t){let a=t.rootNode;if(this._rootNodeFocusListenerCount.has(a)){let r=this._rootNodeFocusListenerCount.get(a);r>1?this._rootNodeFocusListenerCount.set(a,r-1):(a.removeEventListener(`focus`,this._rootNodeFocusAndBlurListener,At),a.removeEventListener(`blur`,this._rootNodeFocusAndBlurListener,At),this._rootNodeFocusListenerCount.delete(a))}--this._monitoredElementCount||(this._getWindow().removeEventListener(`focus`,this._windowFocusListener),this._stopInputModalityDetector.next(),clearTimeout(this._windowFocusTimeoutId),clearTimeout(this._originTimeoutId))}_originChanged(t,a,r){this._setClasses(t,a),this._emitOrigin(r,a),this._lastFocusOrigin=a}_getClosestElementsInfo(t){let a=[];return this._elementInfo.forEach((r,o)=>{(o===t||r.checkChildren&&o.contains(t))&&a.push([o,r])}),a}_isLastInteractionFromInputLabel(t){let{_mostRecentTarget:a,mostRecentModality:r}=this._inputModalityDetector;if(r!==`mouse`||!a||a===t||t.nodeName!==`INPUT`&&t.nodeName!==`TEXTAREA`||t.disabled)return!1;let o=t.labels;if(o){for(let i=0;i<o.length;i++)if(o[i].contains(a))return!0}return!1}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var We=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=Hw({type:n,selectors:[[`ng-component`]],exportAs:[`cdkVisuallyHidden`],decls:0,vars:0,template:function(a,r){},styles:[`.cdk-visually-hidden {
  border: 0;
  clip: rect(0 0 0 0);
  height: 1px;
  margin: -1px;
  overflow: hidden;
  padding: 0;
  position: absolute;
  width: 1px;
  white-space: nowrap;
  outline: 0;
  -webkit-appearance: none;
  -moz-appearance: none;
  left: 0;
}
[dir=rtl] .cdk-visually-hidden {
  left: auto;
  right: 0;
}
`],encapsulation:2})}return n})();var Ke=/* @__PURE__ */ new Set;var Z;var oe=(()=>{class n{_platform=g(un$1);_nonce=g(of,{optional:!0});_matchMedia;constructor(){this._matchMedia=this._platform.isBrowser&&window.matchMedia?window.matchMedia.bind(window):Qn}matchMedia(t){return(this._platform.WEBKIT||this._platform.BLINK)&&Xn(t,this._nonce),this._matchMedia(t)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function Xn(n,e){if(!Ke.has(n))try{Z||(Z=document.createElement(`style`),e&&Z.setAttribute(`nonce`,e),Z.setAttribute(`type`,`text/css`),document.head.appendChild(Z)),Z.sheet&&(Z.sheet.insertRule(`@media ${n.replace(/[{}]/g,``)} {body{ }}`,0),Ke.add(n))}catch(t){console.error(t)}}function Qn(n){return{matches:n===`all`||n===``,media:n,addListener:()=>{},removeListener:()=>{}}}var Jn=(()=>{class n{create(t){return typeof MutationObserver>`u`?null:new MutationObserver(t)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var Ur=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({providers:[Jn]})}return n})();var ta=(()=>{class n{_platform=g(un$1);isDisabled(t){return t.hasAttribute(`disabled`)}isVisible(t){return na(t)&&getComputedStyle(t).visibility===`visible`}isTabbable(t){if(!this._platform.isBrowser)return!1;let a=ea(ca(t));if(a&&(qe(a)===-1||!this.isVisible(a)))return!1;let r=t.nodeName.toLowerCase(),o=qe(t);return t.hasAttribute(`contenteditable`)?o!==-1:r===`iframe`||r===`object`||this._platform.WEBKIT&&this._platform.IOS&&!da(t)?!1:r===`audio`?t.hasAttribute(`controls`)?o!==-1:!1:r===`video`?o===-1?!1:o!==null?!0:this._platform.FIREFOX||t.hasAttribute(`controls`):t.tabIndex>=0}isFocusable(t,a){return la(t)&&!this.isDisabled(t)&&(a?.ignoreInert||!t.closest?.(`[inert]`))&&(a?.ignoreVisibility||this.isVisible(t))}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function ea(n){try{return n.frameElement}catch{return null}}function na(n){return!!(n.offsetWidth||n.offsetHeight||typeof n.getClientRects==`function`&&n.getClientRects().length)}function aa(n){let e=n.nodeName.toLowerCase();return e===`input`||e===`select`||e===`button`||e===`textarea`}function ra(n){return ia(n)&&n.type==`hidden`}function oa(n){return sa(n)&&n.hasAttribute(`href`)}function ia(n){return n.nodeName.toLowerCase()==`input`}function sa(n){return n.nodeName.toLowerCase()==`a`}function Ze(n){if(!n.hasAttribute(`tabindex`)||n.tabIndex===void 0)return!1;let e=n.getAttribute(`tabindex`);return!!(e&&!isNaN(parseInt(e,10)))}function qe(n){if(!Ze(n))return null;let e=parseInt(n.getAttribute(`tabindex`)||``,10);return isNaN(e)?-1:e}function da(n){let e=n.nodeName.toLowerCase(),t=e===`input`&&n.type;return t===`text`||t===`password`||e===`select`||e===`textarea`}function la(n){return ra(n)?!1:aa(n)||oa(n)||n.hasAttribute(`contenteditable`)||Ze(n)}function ca(n){return n.ownerDocument&&n.ownerDocument.defaultView||window}var ie=class{_element;_checker;_ngZone;_document;_injector;_startAnchor=null;_endAnchor=null;_hasAttached=!1;startAnchorListener=()=>{!this.focusLastTabbableElement()&&this._checker.isFocusable(this._element)&&this._element.focus()};endAnchorListener=()=>{!this.focusFirstTabbableElement()&&this._checker.isFocusable(this._element)&&this._element.focus()};get enabled(){return this._enabled}set enabled(e){this._enabled=e,this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(e,this._startAnchor),this._toggleAnchorTabIndex(e,this._endAnchor))}_enabled=!0;constructor(e,t,a,r,o=!1,i){this._element=e,this._checker=t,this._ngZone=a,this._document=r,this._injector=i,o||this.attachAnchors()}destroy(){let e=this._startAnchor,t=this._endAnchor;e&&(e.removeEventListener(`focus`,this.startAnchorListener),e.remove()),t&&(t.removeEventListener(`focus`,this.endAnchorListener),t.remove()),this._startAnchor=this._endAnchor=null,this._hasAttached=!1}attachAnchors(){return this._hasAttached?!0:(this._ngZone.runOutsideAngular(()=>{this._startAnchor||(this._startAnchor=this._createAnchor(),this._startAnchor.addEventListener(`focus`,this.startAnchorListener)),this._endAnchor||(this._endAnchor=this._createAnchor(),this._endAnchor.addEventListener(`focus`,this.endAnchorListener))}),this._element.parentNode&&(this._element.parentNode.insertBefore(this._startAnchor,this._element),this._element.parentNode.insertBefore(this._endAnchor,this._element.nextSibling),this._hasAttached=!0),this._hasAttached)}focusInitialElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusInitialElement(e)))})}focusFirstTabbableElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusFirstTabbableElement(e)))})}focusLastTabbableElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusLastTabbableElement(e)))})}_getRegionBoundary(e){let t=this._element.querySelectorAll(`[cdk-focus-region-${e}], [cdkFocusRegion${e}], [cdk-focus-${e}]`);return e==`start`?t.length?t[0]:this._getFirstTabbableElement(this._element):t.length?t[t.length-1]:this._getLastTabbableElement(this._element)}focusInitialElement(e){let t=this._element.querySelector(`[cdk-focus-initial], [cdkFocusInitial]`);if(t){if(!this._checker.isFocusable(t)){let a=this._getFirstTabbableElement(t);return a?.focus(e),!!a}return t.focus(e),!0}return this.focusFirstTabbableElement(e)}focusFirstTabbableElement(e){let t=this._getRegionBoundary(`start`);return t&&t.focus(e),!!t}focusLastTabbableElement(e){let t=this._getRegionBoundary(`end`);return t&&t.focus(e),!!t}hasAttached(){return this._hasAttached}_getFirstTabbableElement(e){if(this._checker.isFocusable(e)&&this._checker.isTabbable(e))return e;let t=e.children;for(let a=0;a<t.length;a++){let r=t[a].nodeType===this._document.ELEMENT_NODE?this._getFirstTabbableElement(t[a]):null;if(r)return r}return null}_getLastTabbableElement(e){if(this._checker.isFocusable(e)&&this._checker.isTabbable(e))return e;let t=e.children;for(let a=t.length-1;a>=0;a--){let r=t[a].nodeType===this._document.ELEMENT_NODE?this._getLastTabbableElement(t[a]):null;if(r)return r}return null}_createAnchor(){let e=this._document.createElement(`div`);return this._toggleAnchorTabIndex(this._enabled,e),e.classList.add(`cdk-visually-hidden`),e.classList.add(`cdk-focus-trap-anchor`),e.setAttribute(`aria-hidden`,`true`),e}_toggleAnchorTabIndex(e,t){e?t.setAttribute(`tabindex`,`0`):t.removeAttribute(`tabindex`)}toggleAnchors(e){this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(e,this._startAnchor),this._toggleAnchorTabIndex(e,this._endAnchor))}_executeOnStable(e){$D(e,{injector:this._injector})}};var Qr=(()=>{class n{_checker=g(ta);_ngZone=g(Ce);_document=g(Q$1);_injector=g(oe$1);constructor(){g(En$1).load(We)}create(t,a=!1){return new ie(t,this._checker,this._ngZone,this._document,a,this._injector)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function to(n,...e){return e.length?e.some(t=>n[t]):n.altKey||n.shiftKey||n.ctrlKey||n.metaKey}function lo(){return typeof __karma__<`u`&&!!__karma__||typeof jasmine<`u`&&!!jasmine||typeof jest<`u`&&!!jest||typeof Mocha<`u`&&!!Mocha}var J;var Ye=[`color`,`button`,`checkbox`,`date`,`datetime-local`,`email`,`file`,`hidden`,`image`,`month`,`number`,`password`,`radio`,`range`,`reset`,`search`,`submit`,`tel`,`text`,`time`,`url`,`week`];function po(){if(J)return J;if(typeof document!=`object`||!document)return J=new Set(Ye),J;let n=document.createElement(`input`);return J=new Set(Ye.filter(e=>(n.setAttribute(`type`,e),n.type===e))),J}var ua=new C(`MATERIAL_ANIMATIONS`);var Xe=null;function ma(){return g(ua,{optional:!0})?.animationsDisabled||g(bv,{optional:!0})===`NoopAnimations`?`di-disabled`:(Xe??=g(oe).matchMedia(`(prefers-reduced-motion)`).matches,Xe?`reduced-motion`:`enabled`)}function tt(){return ma()!==`enabled`}function Eo(n){return n==null?``:typeof n==`string`?n:`${n}px`}function Ao(n){return n!=null&&`${n}`!=`false`}var S=(function(n){return n[n.FADING_IN=0]=`FADING_IN`,n[n.VISIBLE=1]=`VISIBLE`,n[n.FADING_OUT=2]=`FADING_OUT`,n[n.HIDDEN=3]=`HIDDEN`,n})(S||{});var se=class{_renderer;element;config;_animationForciblyDisabledThroughCss;state=S.HIDDEN;constructor(e,t,a,r=!1){this._renderer=e,this.element=t,this.config=a,this._animationForciblyDisabledThroughCss=r}fadeOut(){this._renderer.fadeOutRipple(this)}};var Qe=Q({passive:!0,capture:!0});var de=class{_events=/* @__PURE__ */ new Map;addHandler(e,t,a,r){let o=this._events.get(t);if(o){let i=o.get(a);i?i.add(r):o.set(a,/* @__PURE__ */ new Set([r]))}else this._events.set(t,/* @__PURE__ */ new Map([[a,/* @__PURE__ */ new Set([r])]])),e.runOutsideAngular(()=>{document.addEventListener(t,this._delegateEventHandler,Qe)})}removeHandler(e,t,a){let r=this._events.get(e);if(!r)return;let o=r.get(t);o&&(o.delete(a),o.size===0&&r.delete(t),r.size===0&&(this._events.delete(e),document.removeEventListener(e,this._delegateEventHandler,Qe)))}_delegateEventHandler=e=>{let t=Hn$1(e);t&&this._events.get(e.type)?.forEach((a,r)=>{(r===t||r.contains(t))&&a.forEach(o=>o.handleEvent(e))})}};var mt={enterDuration:225,exitDuration:150};var pa=800;var Je=Q({passive:!0,capture:!0});var tn=[`mousedown`,`touchstart`];var en=[`mouseup`,`mouseleave`,`touchend`,`touchcancel`];var fa=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=Hw({type:n,selectors:[[`ng-component`]],hostAttrs:[`mat-ripple-style-loader`,``],decls:0,vars:0,template:function(a,r){},styles:[`.mat-ripple {
  overflow: hidden;
  position: relative;
}
.mat-ripple:not(:empty) {
  transform: translateZ(0);
}

.mat-ripple.mat-ripple-unbounded {
  overflow: visible;
}

.mat-ripple-element {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  transition: opacity, transform 0ms cubic-bezier(0, 0, 0.2, 1);
  transform: scale3d(0, 0, 0);
  background-color: var(--%NS%mat-ripple-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 10%, transparent));
}
@media (forced-colors: active) {
  .mat-ripple-element {
    display: none;
  }
}
.cdk-drag-preview .mat-ripple-element, .cdk-drag-placeholder .mat-ripple-element {
  display: none;
}
`],encapsulation:2})}return n})();var pt=class n{_target;_ngZone;_platform;_containerElement;_triggerElement=null;_isPointerDown=!1;_activeRipples=/* @__PURE__ */ new Map;_mostRecentTransientRipple=null;_lastTouchStartEvent;_pointerUpEventsRegistered=!1;_containerRect=null;static _eventManager=new de;constructor(e,t,a,r,o){this._target=e,this._ngZone=t,this._platform=r,r.isBrowser&&(this._containerElement=mn$2(a)),o&&o.get(En$1).load(fa)}fadeInRipple(e,t,a={}){let r=this._containerRect=this._containerRect||this._containerElement.getBoundingClientRect(),o=V(V({},mt),a.animation);a.centered&&(e=r.left+r.width/2,t=r.top+r.height/2);let i=a.radius||ba(e,t,r),d=e-r.left,f=t-r.top,b=o.enterDuration,h=document.createElement(`div`);h.classList.add(`mat-ripple-element`),h.style.left=`${d-i}px`,h.style.top=`${f-i}px`,h.style.height=`${i*2}px`,h.style.width=`${i*2}px`,a.color!=null&&(h.style.backgroundColor=a.color),h.style.transitionDuration=`${b}ms`,this._containerElement.appendChild(h);let Ce=window.getComputedStyle(h),Yn=Ce.transitionProperty,xe=Ce.transitionDuration,$t=Yn===`none`||xe===`0s`||xe===`0s, 0s`||r.width===0&&r.height===0,z=new se(this,h,a,$t);h.style.transform=`scale3d(1, 1, 1)`,z.state=S.FADING_IN,a.persistent||(this._mostRecentTransientRipple=z);let _t=null;return!$t&&(b||o.exitDuration)&&this._ngZone.runOutsideAngular(()=>{let Ee=()=>{_t&&(_t.fallbackTimer=null),clearTimeout(Se),this._finishRippleTransition(z)},Wt=()=>this._destroyRipple(z),Se=setTimeout(Wt,b+100);h.addEventListener(`transitionend`,Ee),h.addEventListener(`transitioncancel`,Wt),_t={onTransitionEnd:Ee,onTransitionCancel:Wt,fallbackTimer:Se}}),this._activeRipples.set(z,_t),($t||!b)&&this._finishRippleTransition(z),z}fadeOutRipple(e){if(e.state===S.FADING_OUT||e.state===S.HIDDEN)return;let t=e.element,a=V(V({},mt),e.config.animation);t.style.transitionDuration=`${a.exitDuration}ms`,t.style.opacity=`0`,e.state=S.FADING_OUT,(e._animationForciblyDisabledThroughCss||!a.exitDuration)&&this._finishRippleTransition(e)}fadeOutAll(){this._getActiveRipples().forEach(e=>e.fadeOut())}fadeOutAllNonPersistent(){this._getActiveRipples().forEach(e=>{e.config.persistent||e.fadeOut()})}setupTriggerEvents(e){let t=mn$2(e);!this._platform.isBrowser||!t||t===this._triggerElement||(this._removeTriggerEvents(),this._triggerElement=t,tn.forEach(a=>{n._eventManager.addHandler(this._ngZone,a,t,this)}))}handleEvent(e){e.type===`mousedown`?this._onMousedown(e):e.type===`touchstart`?this._onTouchStart(e):this._onPointerUp(),this._pointerUpEventsRegistered||(this._ngZone.runOutsideAngular(()=>{en.forEach(t=>{this._triggerElement.addEventListener(t,this,Je)})}),this._pointerUpEventsRegistered=!0)}_finishRippleTransition(e){e.state===S.FADING_IN?this._startFadeOutTransition(e):e.state===S.FADING_OUT&&this._destroyRipple(e)}_startFadeOutTransition(e){let t=e===this._mostRecentTransientRipple,{persistent:a}=e.config;e.state=S.VISIBLE,!a&&(!t||!this._isPointerDown)&&e.fadeOut()}_destroyRipple(e){let t=this._activeRipples.get(e)??null;this._activeRipples.delete(e),this._activeRipples.size||(this._containerRect=null),e===this._mostRecentTransientRipple&&(this._mostRecentTransientRipple=null),e.state=S.HIDDEN,t!==null&&(e.element.removeEventListener(`transitionend`,t.onTransitionEnd),e.element.removeEventListener(`transitioncancel`,t.onTransitionCancel),t.fallbackTimer!==null&&clearTimeout(t.fallbackTimer)),e.element.remove()}_onMousedown(e){let t=Pn$1(e),a=this._lastTouchStartEvent&&Date.now()<this._lastTouchStartEvent+pa;!this._target.rippleDisabled&&!t&&!a&&(this._isPointerDown=!0,this.fadeInRipple(e.clientX,e.clientY,this._target.rippleConfig))}_onTouchStart(e){if(!this._target.rippleDisabled&&!Ln$1(e)){this._lastTouchStartEvent=Date.now(),this._isPointerDown=!0;let t=e.changedTouches;if(t)for(let a=0;a<t.length;a++)this.fadeInRipple(t[a].clientX,t[a].clientY,this._target.rippleConfig)}}_onPointerUp(){this._isPointerDown&&(this._isPointerDown=!1,this._getActiveRipples().forEach(e=>{let t=e.state===S.VISIBLE||e.config.terminateOnPointerUp&&e.state===S.FADING_IN;!e.config.persistent&&t&&e.fadeOut()}))}_getActiveRipples(){return Array.from(this._activeRipples.keys())}_removeTriggerEvents(){let e=this._triggerElement;e&&(tn.forEach(t=>n._eventManager.removeHandler(t,e,this)),this._pointerUpEventsRegistered&&(en.forEach(t=>e.removeEventListener(t,this,Je)),this._pointerUpEventsRegistered=!1))}};function ba(n,e,t){let a=Math.max(Math.abs(n-t.left),Math.abs(n-t.right)),r=Math.max(Math.abs(e-t.top),Math.abs(e-t.bottom));return Math.sqrt(a*a+r*r)}var le=new C(`mat-ripple-global-options`);var Uo=(()=>{class n{_elementRef=g(mn$1);_animationsDisabled=tt();color;unbounded=!1;centered=!1;radius=0;animation;get disabled(){return this._disabled}set disabled(t){t&&this.fadeOutAllNonPersistent(),this._disabled=t,this._setupTriggerEventsIfEnabled()}_disabled=!1;get trigger(){return this._trigger||this._elementRef.nativeElement}set trigger(t){this._trigger=t,this._setupTriggerEventsIfEnabled()}_trigger;_rippleRenderer;_globalOptions;_isInitialized=!1;constructor(){let t=g(Ce),a=g(un$1),r=g(le,{optional:!0}),o=g(oe$1);this._globalOptions=r||{},this._rippleRenderer=new pt(this,t,this._elementRef,a,o)}ngOnInit(){this._isInitialized=!0,this._setupTriggerEventsIfEnabled()}ngOnDestroy(){this._rippleRenderer._removeTriggerEvents()}fadeOutAll(){this._rippleRenderer.fadeOutAll()}fadeOutAllNonPersistent(){this._rippleRenderer.fadeOutAllNonPersistent()}get rippleConfig(){return{centered:this.centered,radius:this.radius,color:this.color,animation:V(V(V({},this._globalOptions.animation),this._animationsDisabled?{enterDuration:0,exitDuration:0}:{}),this.animation),terminateOnPointerUp:this._globalOptions.terminateOnPointerUp}}get rippleDisabled(){return this.disabled||!!this._globalOptions.disabled}_setupTriggerEventsIfEnabled(){!this.disabled&&this._isInitialized&&this._rippleRenderer.setupTriggerEvents(this.trigger)}launch(t,a=0,r){return typeof t==`number`?this._rippleRenderer.fadeInRipple(t,a,V(V({},this.rippleConfig),r)):this._rippleRenderer.fadeInRipple(0,0,V(V({},this.rippleConfig),t))}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,selectors:[[``,`mat-ripple`,``],[``,`matRipple`,``]],hostAttrs:[1,`mat-ripple`],hostVars:2,hostBindings:function(a,r){a&2&&mg(`mat-ripple-unbounded`,r.unbounded)},inputs:{color:[0,`matRippleColor`,`color`],unbounded:[0,`matRippleUnbounded`,`unbounded`],centered:[0,`matRippleCentered`,`centered`],radius:[0,`matRippleRadius`,`radius`],animation:[0,`matRippleAnimation`,`animation`],disabled:[0,`matRippleDisabled`,`disabled`],trigger:[0,`matRippleTrigger`,`trigger`]},exportAs:[`matRipple`]})}return n})();var ha={capture:!0};var ga=[`focus`,`mousedown`,`mouseenter`,`touchstart`];var ce=`mat-ripple-loader-uninitialized`;var ue=`mat-ripple-loader-class-name`;var nn=`mat-ripple-loader-centered`;var Dt=`mat-ripple-loader-disabled`;var an=(()=>{class n{_document=g(Q$1);_animationsDisabled=tt();_globalRippleOptions=g(le,{optional:!0});_platform=g(un$1);_ngZone=g(Ce);_injector=g(oe$1);_eventCleanups;_hosts=/* @__PURE__ */ new Map;constructor(){let t=g(oo).createRenderer(null,null);this._eventCleanups=this._ngZone.runOutsideAngular(()=>ga.map(a=>t.listen(this._document,a,this._onInteraction,ha)))}ngOnDestroy(){let t=this._hosts.keys();for(let a of t)this.destroyRipple(a);this._eventCleanups.forEach(a=>a())}configureRipple(t,a){t.setAttribute(ce,this._globalRippleOptions?.namespace??``),(a.className||!t.hasAttribute(ue))&&t.setAttribute(ue,a.className||``),a.centered&&t.setAttribute(nn,``),a.disabled&&t.setAttribute(Dt,``)}setDisabled(t,a){let r=this._hosts.get(t);r?(r.target.rippleDisabled=a,!a&&!r.hasSetUpEvents&&(r.hasSetUpEvents=!0,r.renderer.setupTriggerEvents(t))):a?t.setAttribute(Dt,``):t.removeAttribute(Dt)}_onInteraction=t=>{let a=Hn$1(t);if(a instanceof HTMLElement){let r=a.closest(`[${ce}="${this._globalRippleOptions?.namespace??``}"]`);r&&this._createRipple(r)}};_createRipple(t){if(!this._document||this._hosts.has(t))return;t.querySelector(`.mat-ripple`)?.remove();let a=this._document.createElement(`span`);a.classList.add(`mat-ripple`,t.getAttribute(ue)),t.append(a);let r=this._globalRippleOptions,o=this._animationsDisabled?0:r?.animation?.enterDuration??mt.enterDuration,i=this._animationsDisabled?0:r?.animation?.exitDuration??mt.exitDuration,d={rippleDisabled:this._animationsDisabled||r?.disabled||t.hasAttribute(Dt),rippleConfig:{centered:t.hasAttribute(nn),terminateOnPointerUp:r?.terminateOnPointerUp,animation:{enterDuration:o,exitDuration:i}}},f=new pt(d,this._ngZone,a,this._platform,this._injector),b=!d.rippleDisabled;b&&f.setupTriggerEvents(t),this._hosts.set(t,{target:d,renderer:f,hasSetUpEvents:b}),t.removeAttribute(ce)}destroyRipple(t){let a=this._hosts.get(t);a&&(a.renderer._removeTriggerEvents(),this._hosts.delete(t))}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var rn=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=Hw({type:n,selectors:[[`structural-styles`]],decls:0,vars:0,template:function(a,r){},styles:[`.mat-focus-indicator {
  position: relative;
}
.mat-focus-indicator::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  box-sizing: border-box;
  pointer-events: none;
  display: var(--%NS%mat-focus-indicator-display, none);
  border-width: var(--%NS%mat-focus-indicator-border-width, 3px);
  border-style: var(--%NS%mat-focus-indicator-border-style, solid);
  border-color: var(--%NS%mat-focus-indicator-border-color, transparent);
  border-radius: var(--%NS%mat-focus-indicator-border-radius, 4px);
}
.mat-focus-indicator:focus-visible::before {
  content: "";
}

@media (forced-colors: active) {
  html {
    --%NS%mat-focus-indicator-display: block;
    --%NS%mat-focus-indicator-fallback-border-style: none;
  }
}
`],encapsulation:2})}return n})();var va=new C(`MAT_BUTTON_CONFIG`);function on(n){return n==null?void 0:yC(n)}var sn=(()=>{class n{_elementRef=g(mn$1);_ngZone=g(Ce);_animationsDisabled=tt();_config=g(va,{optional:!0});_focusMonitor=g(re);_cleanupClick;_renderer=g(io);_rippleLoader=g(an);_isAnchor;_isFab=!1;color;get disableRipple(){return this._disableRipple}set disableRipple(t){this._disableRipple=t,this._updateRippleDisabled()}_disableRipple=!1;get disabled(){return this._disabled}set disabled(t){this._disabled=t,this._updateRippleDisabled()}_disabled=!1;ariaDisabled;disabledInteractive;tabIndex;set _tabindex(t){this.tabIndex=t}showProgress=Fj(!1,{transform:mC});constructor(){g(En$1).load(rn);let t=this._elementRef.nativeElement;this._isAnchor=t.tagName===`A`,this.disabledInteractive=this._config?.disabledInteractive??!1,this.color=this._config?.color??null,this._rippleLoader?.configureRipple(t,{className:`mat-mdc-button-ripple`})}ngAfterViewInit(){this._focusMonitor.monitor(this._elementRef,!0),this._isAnchor&&this._setupAsAnchor()}ngOnDestroy(){this._cleanupClick?.(),this._focusMonitor.stopMonitoring(this._elementRef),this._rippleLoader?.destroyRipple(this._elementRef.nativeElement)}focus(t=`program`,a){t?this._focusMonitor.focusVia(this._elementRef.nativeElement,t,a):this._elementRef.nativeElement.focus(a)}_getAriaDisabled(){return this.ariaDisabled!=null?this.ariaDisabled:this._isAnchor?this.disabled||null:this.disabled&&this.disabledInteractive?!0:null}_getDisabledAttribute(){return this.disabledInteractive||!this.disabled?null:!0}_updateRippleDisabled(){this._rippleLoader?.setDisabled(this._elementRef.nativeElement,this.disableRipple||this.disabled)}_getTabIndex(){return this._isAnchor?this.disabled&&!this.disabledInteractive?-1:this.tabIndex:this.tabIndex}_setupAsAnchor(){this._cleanupClick=this._ngZone.runOutsideAngular(()=>this._renderer.listen(this._elementRef.nativeElement,`click`,t=>{this.disabled&&(t.preventDefault(),t.stopImmediatePropagation())}))}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,hostAttrs:[1,`mat-mdc-button-base`],hostVars:15,hostBindings:function(a,r){a&2&&(Jh(`disabled`,r._getDisabledAttribute())(`aria-disabled`,r._getAriaDisabled())(`tabindex`,r._getTabIndex()),gI(r.color?`mat-`+r.color:``),mg(`mat-mdc-button-progress-indicator-shown`,r.showProgress())(`mat-mdc-button-disabled`,r.disabled)(`mat-mdc-button-disabled-interactive`,r.disabledInteractive)(`mat-unthemed`,!r.color)(`_mat-animation-noopable`,r._animationsDisabled))},inputs:{color:`color`,disableRipple:[2,`disableRipple`,`disableRipple`,mC],disabled:[2,`disabled`,`disabled`,mC],ariaDisabled:[2,`aria-disabled`,`ariaDisabled`,mC],disabledInteractive:[2,`disabledInteractive`,`disabledInteractive`,mC],tabIndex:[2,`tabIndex`,`tabIndex`,on],_tabindex:[2,`tabindex`,`_tabindex`,on],showProgress:[1,`showProgress`]}})}return n})();var dn=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[An$1]})}return n})();var ln=/* @__PURE__ */ new Map([[`text`,[`mat-mdc-button`]],[`filled`,[`mdc-button--unelevated`,`mat-mdc-unelevated-button`]],[`elevated`,[`mdc-button--raised`,`mat-mdc-raised-button`]],[`outlined`,[`mdc-button--outlined`,`mat-mdc-outlined-button`]],[`tonal`,[`mat-tonal-button`]]]);var bi=(()=>{class n extends sn{get appearance(){return this._appearance}set appearance(t){this.setAppearance(t||this._config?.defaultAppearance||`text`)}_appearance=null;constructor(){super();let t=ya(this._elementRef.nativeElement);t&&this.setAppearance(t)}setAppearance(t){if(t===this._appearance)return;let a=this._elementRef.nativeElement.classList,r=this._appearance?ln.get(this._appearance):null,o=ln.get(t);r&&a.remove(...r),a.add(...o),this._appearance=t}static ɵfac=function(a){return new(a||n)};static ɵcmp=(function(){let t=[[[``,8,`material-icons`,3,`iconPositionEnd`,``],[`mat-icon`,3,`iconPositionEnd`,``],[``,`matButtonIcon`,``,3,`iconPositionEnd`,``],[``,8,`material-symbols-outlined`,3,`iconPositionEnd`,``],[``,8,`material-symbols-rounded`,3,`iconPositionEnd`,``],[``,8,`material-symbols-sharp`,3,`iconPositionEnd`,``]],`*`,[[``,`iconPositionEnd`,``,8,`material-icons`],[`mat-icon`,`iconPositionEnd`,``],[``,`matButtonIcon`,``,`iconPositionEnd`,``],[``,`iconPositionEnd`,``,8,`material-symbols-outlined`],[``,`iconPositionEnd`,``,8,`material-symbols-rounded`],[``,`iconPositionEnd`,``,8,`material-symbols-sharp`]],[[``,`progressIndicator`,``]]],a=[`.material-icons:not([iconPositionEnd]), mat-icon:not([iconPositionEnd]), [matButtonIcon]:not([iconPositionEnd]), .material-symbols-outlined:not([iconPositionEnd]), .material-symbols-rounded:not([iconPositionEnd]), .material-symbols-sharp:not([iconPositionEnd])`,`*`,`.material-icons[iconPositionEnd], mat-icon[iconPositionEnd], [matButtonIcon][iconPositionEnd], .material-symbols-outlined[iconPositionEnd], .material-symbols-rounded[iconPositionEnd], .material-symbols-sharp[iconPositionEnd]`,`[progressIndicator]`];function r(o,i){o&1&&(Uu(0,`div`,2),XE(1,3),$u())}return Hw({type:n,selectors:[[`button`,`matButton`,``],[`a`,`matButton`,``],[`button`,`mat-button`,``],[`button`,`mat-raised-button`,``],[`button`,`mat-flat-button`,``],[`button`,`mat-stroked-button`,``],[`a`,`mat-button`,``],[`a`,`mat-raised-button`,``],[`a`,`mat-flat-button`,``],[`a`,`mat-stroked-button`,``]],hostAttrs:[1,`mdc-button`],inputs:{appearance:[0,`matButton`,`appearance`]},exportAs:[`matButton`,`matAnchor`],features:[jh],ngContentSelectors:a,decls:8,vars:5,consts:[[1,`mat-mdc-button-persistent-ripple`],[1,`mdc-button__label`],[1,`mat-mdc-button-progress-indicator-container`],[1,`mat-focus-indicator`],[1,`mat-mdc-button-touch-target`]],template:function(i,d){i&1&&(JE(t),tg(0,`span`,0),XE(1),Uu(2,`span`,1),XE(3,1),$u(),XE(4,2),RE(5,r,2,0,`div`,2),tg(6,`span`,3)(7,`span`,4)),i&2&&(mg(`mdc-button__ripple`,!d._isFab)(`mdc-fab__ripple`,d._isFab),cb(5),PE(d.showProgress()?5:-1))},styles:[`.mat-mdc-button-base {
  text-decoration: none;
}
.mat-mdc-button-base .mat-icon {
  min-height: fit-content;
  flex-shrink: 0;
}
@media (hover: none) {
  .mat-mdc-button-base:hover > span.mat-mdc-button-persistent-ripple::before {
    opacity: 0;
  }
}

.mdc-button {
  -webkit-user-select: none;
  user-select: none;
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  min-width: 64px;
  border: none;
  outline: none;
  line-height: inherit;
  -webkit-appearance: none;
  overflow: visible;
  vertical-align: middle;
  background: transparent;
  padding: 0 8px;
}
.mdc-button::-moz-focus-inner {
  padding: 0;
  border: 0;
}
.mdc-button:active {
  outline: none;
}
.mdc-button:hover {
  cursor: pointer;
}
.mdc-button:disabled {
  cursor: default;
  pointer-events: none;
}
.mdc-button[hidden] {
  display: none;
}
.mdc-button .mdc-button__label {
  position: relative;
}

.mat-mdc-button {
  padding: 0 var(--%NS%mat-button-text-horizontal-padding, 12px);
  height: var(--%NS%mat-button-text-container-height, 40px);
  font-family: var(--%NS%mat-button-text-label-text-font, var(--%NS%mat-sys-label-large-font));
  font-size: var(--%NS%mat-button-text-label-text-size, var(--%NS%mat-sys-label-large-size));
  letter-spacing: var(--%NS%mat-button-text-label-text-tracking, var(--%NS%mat-sys-label-large-tracking));
  text-transform: var(--%NS%mat-button-text-label-text-transform);
  font-weight: var(--%NS%mat-button-text-label-text-weight, var(--%NS%mat-sys-label-large-weight));
}
.mat-mdc-button, .mat-mdc-button .mdc-button__ripple {
  border-radius: var(--%NS%mat-button-text-container-shape, var(--%NS%mat-sys-corner-full));
}
.mat-mdc-button:not(:disabled) {
  color: var(--%NS%mat-button-text-label-text-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-button[disabled], .mat-mdc-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--%NS%mat-button-text-disabled-label-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mat-mdc-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-mdc-button:has(.material-icons, .material-symbols-outlined, .material-symbols-rounded,
.material-symbols-sharp, mat-icon, [matButtonIcon]) {
  padding: 0 var(--%NS%mat-button-text-with-icon-horizontal-padding, 16px);
}
.mat-mdc-button > .mat-icon {
  margin-right: var(--%NS%mat-button-text-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-text-icon-offset, -4px);
}
[dir=rtl] .mat-mdc-button > .mat-icon {
  margin-right: var(--%NS%mat-button-text-icon-offset, -4px);
  margin-left: var(--%NS%mat-button-text-icon-spacing, 8px);
}
.mat-mdc-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-text-icon-offset, -4px);
  margin-left: var(--%NS%mat-button-text-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-text-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-text-icon-offset, -4px);
}
.mat-mdc-button .mat-ripple-element {
  background-color: var(--%NS%mat-button-text-ripple-color, color-mix(in srgb, var(--%NS%mat-sys-primary) calc(var(--%NS%mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-text-state-layer-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-text-disabled-state-layer-color, var(--%NS%mat-sys-on-surface-variant));
}
.mat-mdc-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-text-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
}
.mat-mdc-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-text-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));
}
.mat-mdc-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-text-pressed-state-layer-opacity, var(--%NS%mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--%NS%mat-button-text-touch-target-size, 48px);
  display: var(--%NS%mat-button-text-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}

.mat-mdc-unelevated-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--%NS%mat-button-filled-container-height, 40px);
  font-family: var(--%NS%mat-button-filled-label-text-font, var(--%NS%mat-sys-label-large-font));
  font-size: var(--%NS%mat-button-filled-label-text-size, var(--%NS%mat-sys-label-large-size));
  letter-spacing: var(--%NS%mat-button-filled-label-text-tracking, var(--%NS%mat-sys-label-large-tracking));
  text-transform: var(--%NS%mat-button-filled-label-text-transform);
  font-weight: var(--%NS%mat-button-filled-label-text-weight, var(--%NS%mat-sys-label-large-weight));
  padding: 0 var(--%NS%mat-button-filled-horizontal-padding, 24px);
}
.mat-mdc-unelevated-button > .mat-icon {
  margin-right: var(--%NS%mat-button-filled-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-filled-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-unelevated-button > .mat-icon {
  margin-right: var(--%NS%mat-button-filled-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-filled-icon-spacing, 8px);
}
.mat-mdc-unelevated-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-filled-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-filled-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-unelevated-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-filled-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-filled-icon-offset, -8px);
}
.mat-mdc-unelevated-button .mat-ripple-element {
  background-color: var(--%NS%mat-button-filled-ripple-color, color-mix(in srgb, var(--%NS%mat-sys-on-primary) calc(var(--%NS%mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-filled-state-layer-color, var(--%NS%mat-sys-on-primary));
}
.mat-mdc-unelevated-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-filled-disabled-state-layer-color, var(--%NS%mat-sys-on-surface-variant));
}
.mat-mdc-unelevated-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-filled-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
}
.mat-mdc-unelevated-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-unelevated-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-unelevated-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-filled-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));
}
.mat-mdc-unelevated-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-filled-pressed-state-layer-opacity, var(--%NS%mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-unelevated-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--%NS%mat-button-filled-touch-target-size, 48px);
  display: var(--%NS%mat-button-filled-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-unelevated-button:not(:disabled) {
  color: var(--%NS%mat-button-filled-label-text-color, var(--%NS%mat-sys-on-primary));
  background-color: var(--%NS%mat-button-filled-container-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-unelevated-button, .mat-mdc-unelevated-button .mdc-button__ripple {
  border-radius: var(--%NS%mat-button-filled-container-shape, var(--%NS%mat-sys-corner-full));
}
.mat-mdc-unelevated-button .mat-mdc-button-progress-indicator-container {
  --%NS%mat-progress-spinner-active-indicator-color: var(--%NS%mat-button-filled-progress-active-indicator-color, var(--%NS%mat-sys-on-primary));
}
.mat-mdc-unelevated-button[disabled], .mat-mdc-unelevated-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--%NS%mat-button-filled-disabled-label-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
  background-color: var(--%NS%mat-button-filled-disabled-container-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-unelevated-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-raised-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: var(--%NS%mat-button-protected-container-elevation-shadow, var(--%NS%mat-sys-level1));
  height: var(--%NS%mat-button-protected-container-height, 40px);
  font-family: var(--%NS%mat-button-protected-label-text-font, var(--%NS%mat-sys-label-large-font));
  font-size: var(--%NS%mat-button-protected-label-text-size, var(--%NS%mat-sys-label-large-size));
  letter-spacing: var(--%NS%mat-button-protected-label-text-tracking, var(--%NS%mat-sys-label-large-tracking));
  text-transform: var(--%NS%mat-button-protected-label-text-transform);
  font-weight: var(--%NS%mat-button-protected-label-text-weight, var(--%NS%mat-sys-label-large-weight));
  padding: 0 var(--%NS%mat-button-protected-horizontal-padding, 24px);
}
.mat-mdc-raised-button > .mat-icon {
  margin-right: var(--%NS%mat-button-protected-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-protected-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-raised-button > .mat-icon {
  margin-right: var(--%NS%mat-button-protected-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-protected-icon-spacing, 8px);
}
.mat-mdc-raised-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-protected-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-protected-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-raised-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-protected-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-protected-icon-offset, -8px);
}
.mat-mdc-raised-button .mat-ripple-element {
  background-color: var(--%NS%mat-button-protected-ripple-color, color-mix(in srgb, var(--%NS%mat-sys-primary) calc(var(--%NS%mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-protected-state-layer-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-raised-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-protected-disabled-state-layer-color, var(--%NS%mat-sys-on-surface-variant));
}
.mat-mdc-raised-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-protected-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
}
.mat-mdc-raised-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-raised-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-raised-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-protected-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));
}
.mat-mdc-raised-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-protected-pressed-state-layer-opacity, var(--%NS%mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-raised-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--%NS%mat-button-protected-touch-target-size, 48px);
  display: var(--%NS%mat-button-protected-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-raised-button:not(:disabled) {
  color: var(--%NS%mat-button-protected-label-text-color, var(--%NS%mat-sys-primary));
  background-color: var(--%NS%mat-button-protected-container-color, var(--%NS%mat-sys-surface));
}
.mat-mdc-raised-button, .mat-mdc-raised-button .mdc-button__ripple {
  border-radius: var(--%NS%mat-button-protected-container-shape, var(--%NS%mat-sys-corner-full));
}
@media (hover: hover) {
  .mat-mdc-raised-button:hover {
    box-shadow: var(--%NS%mat-button-protected-hover-container-elevation-shadow, var(--%NS%mat-sys-level2));
  }
}
.mat-mdc-raised-button:focus {
  box-shadow: var(--%NS%mat-button-protected-focus-container-elevation-shadow, var(--%NS%mat-sys-level1));
}
.mat-mdc-raised-button:active, .mat-mdc-raised-button:focus:active {
  box-shadow: var(--%NS%mat-button-protected-pressed-container-elevation-shadow, var(--%NS%mat-sys-level1));
}
.mat-mdc-raised-button[disabled], .mat-mdc-raised-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--%NS%mat-button-protected-disabled-label-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
  background-color: var(--%NS%mat-button-protected-disabled-container-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-raised-button[disabled].mat-mdc-button-disabled, .mat-mdc-raised-button.mat-mdc-button-disabled.mat-mdc-button-disabled {
  box-shadow: var(--%NS%mat-button-protected-disabled-container-elevation-shadow, var(--%NS%mat-sys-level0));
}
.mat-mdc-raised-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-mdc-outlined-button {
  border-style: solid;
  transition: border 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--%NS%mat-button-outlined-container-height, 40px);
  font-family: var(--%NS%mat-button-outlined-label-text-font, var(--%NS%mat-sys-label-large-font));
  font-size: var(--%NS%mat-button-outlined-label-text-size, var(--%NS%mat-sys-label-large-size));
  letter-spacing: var(--%NS%mat-button-outlined-label-text-tracking, var(--%NS%mat-sys-label-large-tracking));
  text-transform: var(--%NS%mat-button-outlined-label-text-transform);
  font-weight: var(--%NS%mat-button-outlined-label-text-weight, var(--%NS%mat-sys-label-large-weight));
  border-radius: var(--%NS%mat-button-outlined-container-shape, var(--%NS%mat-sys-corner-full));
  border-width: var(--%NS%mat-button-outlined-outline-width, 1px);
  padding: 0 var(--%NS%mat-button-outlined-horizontal-padding, 24px);
}
.mat-mdc-outlined-button > .mat-icon {
  margin-right: var(--%NS%mat-button-outlined-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-outlined-icon-offset, -8px);
}
[dir=rtl] .mat-mdc-outlined-button > .mat-icon {
  margin-right: var(--%NS%mat-button-outlined-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-outlined-icon-spacing, 8px);
}
.mat-mdc-outlined-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-outlined-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-outlined-icon-spacing, 8px);
}
[dir=rtl] .mat-mdc-outlined-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-outlined-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-outlined-icon-offset, -8px);
}
.mat-mdc-outlined-button .mat-ripple-element {
  background-color: var(--%NS%mat-button-outlined-ripple-color, color-mix(in srgb, var(--%NS%mat-sys-primary) calc(var(--%NS%mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-outlined-state-layer-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-outlined-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-outlined-disabled-state-layer-color, var(--%NS%mat-sys-on-surface-variant));
}
.mat-mdc-outlined-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-outlined-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
}
.mat-mdc-outlined-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-outlined-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-mdc-outlined-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-outlined-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));
}
.mat-mdc-outlined-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-outlined-pressed-state-layer-opacity, var(--%NS%mat-sys-pressed-state-layer-opacity));
}
.mat-mdc-outlined-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--%NS%mat-button-outlined-touch-target-size, 48px);
  display: var(--%NS%mat-button-outlined-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}
.mat-mdc-outlined-button:not(:disabled) {
  color: var(--%NS%mat-button-outlined-label-text-color, var(--%NS%mat-sys-primary));
  border-color: var(--%NS%mat-button-outlined-outline-color, var(--%NS%mat-sys-outline));
}
.mat-mdc-outlined-button[disabled], .mat-mdc-outlined-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--%NS%mat-button-outlined-disabled-label-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
  border-color: var(--%NS%mat-button-outlined-disabled-outline-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 12%, transparent));
}
.mat-mdc-outlined-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}

.mat-tonal-button {
  transition: box-shadow 280ms cubic-bezier(0.4, 0, 0.2, 1);
  height: var(--%NS%mat-button-tonal-container-height, 40px);
  font-family: var(--%NS%mat-button-tonal-label-text-font, var(--%NS%mat-sys-label-large-font));
  font-size: var(--%NS%mat-button-tonal-label-text-size, var(--%NS%mat-sys-label-large-size));
  letter-spacing: var(--%NS%mat-button-tonal-label-text-tracking, var(--%NS%mat-sys-label-large-tracking));
  text-transform: var(--%NS%mat-button-tonal-label-text-transform);
  font-weight: var(--%NS%mat-button-tonal-label-text-weight, var(--%NS%mat-sys-label-large-weight));
  padding: 0 var(--%NS%mat-button-tonal-horizontal-padding, 24px);
}
.mat-tonal-button:not(:disabled) {
  color: var(--%NS%mat-button-tonal-label-text-color, var(--%NS%mat-sys-on-secondary-container));
  background-color: var(--%NS%mat-button-tonal-container-color, var(--%NS%mat-sys-secondary-container));
}
.mat-tonal-button, .mat-tonal-button .mdc-button__ripple {
  border-radius: var(--%NS%mat-button-tonal-container-shape, var(--%NS%mat-sys-corner-full));
}
.mat-tonal-button[disabled], .mat-tonal-button.mat-mdc-button-disabled {
  cursor: default;
  pointer-events: none;
  color: var(--%NS%mat-button-tonal-disabled-label-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
  background-color: var(--%NS%mat-button-tonal-disabled-container-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 12%, transparent));
}
.mat-tonal-button.mat-mdc-button-disabled-interactive {
  pointer-events: auto;
}
.mat-tonal-button > .mat-icon {
  margin-right: var(--%NS%mat-button-tonal-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-tonal-icon-offset, -8px);
}
[dir=rtl] .mat-tonal-button > .mat-icon {
  margin-right: var(--%NS%mat-button-tonal-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-tonal-icon-spacing, 8px);
}
.mat-tonal-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-tonal-icon-offset, -8px);
  margin-left: var(--%NS%mat-button-tonal-icon-spacing, 8px);
}
[dir=rtl] .mat-tonal-button .mdc-button__label + .mat-icon {
  margin-right: var(--%NS%mat-button-tonal-icon-spacing, 8px);
  margin-left: var(--%NS%mat-button-tonal-icon-offset, -8px);
}
.mat-tonal-button .mat-ripple-element {
  background-color: var(--%NS%mat-button-tonal-ripple-color, color-mix(in srgb, var(--%NS%mat-sys-on-secondary-container) calc(var(--%NS%mat-sys-pressed-state-layer-opacity) * 100%), transparent));
}
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-tonal-state-layer-color, var(--%NS%mat-sys-on-secondary-container));
}
.mat-tonal-button.mat-mdc-button-disabled .mat-mdc-button-persistent-ripple::before {
  background-color: var(--%NS%mat-button-tonal-disabled-state-layer-color, var(--%NS%mat-sys-on-surface-variant));
}
.mat-tonal-button:hover > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-tonal-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
}
.mat-tonal-button.cdk-program-focused > .mat-mdc-button-persistent-ripple::before, .mat-tonal-button.cdk-keyboard-focused > .mat-mdc-button-persistent-ripple::before, .mat-tonal-button.mat-mdc-button-disabled-interactive:focus > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-tonal-focus-state-layer-opacity, var(--%NS%mat-sys-focus-state-layer-opacity));
}
.mat-tonal-button:active > .mat-mdc-button-persistent-ripple::before {
  opacity: var(--%NS%mat-button-tonal-pressed-state-layer-opacity, var(--%NS%mat-sys-pressed-state-layer-opacity));
}
.mat-tonal-button .mat-mdc-button-touch-target {
  position: absolute;
  top: 50%;
  height: var(--%NS%mat-button-tonal-touch-target-size, 48px);
  display: var(--%NS%mat-button-tonal-touch-target-display, block);
  left: 0;
  right: 0;
  transform: translateY(-50%);
}

.mat-mdc-button,
.mat-mdc-unelevated-button,
.mat-mdc-raised-button,
.mat-mdc-outlined-button,
.mat-tonal-button {
  -webkit-tap-highlight-color: transparent;
}
.mat-mdc-button .mat-mdc-button-ripple,
.mat-mdc-button .mat-mdc-button-persistent-ripple,
.mat-mdc-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-unelevated-button .mat-mdc-button-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-raised-button .mat-mdc-button-ripple,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before,
.mat-tonal-button .mat-mdc-button-ripple,
.mat-tonal-button .mat-mdc-button-persistent-ripple,
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  pointer-events: none;
  border-radius: inherit;
}
.mat-mdc-button .mat-mdc-button-ripple,
.mat-mdc-unelevated-button .mat-mdc-button-ripple,
.mat-mdc-raised-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-tonal-button .mat-mdc-button-ripple {
  overflow: hidden;
}
.mat-mdc-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-unelevated-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-raised-button .mat-mdc-button-persistent-ripple::before,
.mat-mdc-outlined-button .mat-mdc-button-persistent-ripple::before,
.mat-tonal-button .mat-mdc-button-persistent-ripple::before {
  content: "";
  opacity: 0;
}
.mat-mdc-button .mdc-button__label,
.mat-mdc-button .mat-icon,
.mat-mdc-unelevated-button .mdc-button__label,
.mat-mdc-unelevated-button .mat-icon,
.mat-mdc-raised-button .mdc-button__label,
.mat-mdc-raised-button .mat-icon,
.mat-mdc-outlined-button .mdc-button__label,
.mat-mdc-outlined-button .mat-icon,
.mat-tonal-button .mdc-button__label,
.mat-tonal-button .mat-icon {
  z-index: 1;
  position: relative;
}
.mat-mdc-button .mat-focus-indicator,
.mat-mdc-unelevated-button .mat-focus-indicator,
.mat-mdc-raised-button .mat-focus-indicator,
.mat-mdc-outlined-button .mat-focus-indicator,
.mat-tonal-button .mat-focus-indicator {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  border-radius: inherit;
}
.mat-mdc-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-unelevated-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-raised-button:focus-visible > .mat-focus-indicator::before,
.mat-mdc-outlined-button:focus-visible > .mat-focus-indicator::before,
.mat-tonal-button:focus-visible > .mat-focus-indicator::before {
  content: "";
  border-radius: inherit;
}
.mat-mdc-button._mat-animation-noopable,
.mat-mdc-unelevated-button._mat-animation-noopable,
.mat-mdc-raised-button._mat-animation-noopable,
.mat-mdc-outlined-button._mat-animation-noopable,
.mat-tonal-button._mat-animation-noopable {
  transition: none !important;
  animation: none !important;
}
.mat-mdc-button > .mat-icon,
.mat-mdc-unelevated-button > .mat-icon,
.mat-mdc-raised-button > .mat-icon,
.mat-mdc-outlined-button > .mat-icon,
.mat-tonal-button > .mat-icon {
  display: inline-block;
  position: relative;
  vertical-align: top;
  font-size: 1.125rem;
  height: 1.125rem;
  width: 1.125rem;
}

.mat-mdc-outlined-button .mat-mdc-button-ripple,
.mat-mdc-outlined-button .mdc-button__ripple {
  top: -1px;
  left: -1px;
  bottom: -1px;
  right: -1px;
}

.mat-mdc-unelevated-button .mat-focus-indicator::before,
.mat-tonal-button .mat-focus-indicator::before,
.mat-mdc-raised-button .mat-focus-indicator::before {
  margin: calc(calc(var(--%NS%mat-focus-indicator-border-width, 3px) + 2px) * -1);
}

.mat-mdc-outlined-button .mat-focus-indicator::before {
  margin: calc(calc(var(--%NS%mat-focus-indicator-border-width, 3px) + 3px) * -1);
}

.mat-mdc-button-progress-indicator-container {
  position: absolute;
  inset-inline-start: 0;
  inset-block-start: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.mat-mdc-button-progress-indicator-shown mat-icon,
.mat-mdc-button-progress-indicator-shown [matButtonIcon],
.mat-mdc-button-progress-indicator-shown .mdc-button__label {
  visibility: hidden;
}
`,`@media (forced-colors: active) {
  .mat-mdc-button:not(.mdc-button--outlined),
  .mat-mdc-unelevated-button:not(.mdc-button--outlined),
  .mat-mdc-raised-button:not(.mdc-button--outlined),
  .mat-mdc-outlined-button:not(.mdc-button--outlined),
  .mat-mdc-button-base.mat-tonal-button,
  .mat-mdc-icon-button.mat-mdc-icon-button,
  .mat-mdc-outlined-button .mdc-button__ripple {
    outline: solid 1px;
  }
}
`],encapsulation:2})})()}return n})();function ya(n){return n.hasAttribute(`mat-raised-button`)?`elevated`:n.hasAttribute(`mat-stroked-button`)?`outlined`:n.hasAttribute(`mat-flat-button`)?`filled`:n.hasAttribute(`mat-button`)?`text`:null}var hi=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[dn,An$1]})}return n})();var _n=(()=>{class n{_renderer;_elementRef;onChange=t=>{};onTouched=()=>{};constructor(t,a){this._renderer=t,this._elementRef=a}setProperty(t,a){this._renderer.setProperty(this._elementRef.nativeElement,t,a)}registerOnTouched(t){this.onTouched=t}registerOnChange(t){this.onChange=t}setDisabledState(t){this.setProperty(`disabled`,t)}static ɵfac=function(a){return new(a||n)(We$1(io),We$1(mn$1))};static ɵdir=Fu({type:n})}return n})();var Ut=(()=>{class n extends _n{static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,features:[jh]})}return n})();var yt=new C(``);var _a={provide:yt,useExisting:yi(()=>Nn),multi:!0};function Na(){let n=Ss()?Ss().getUserAgent():``;return/android (\d+)/.test(n.toLowerCase())}var Ca=new C(``);var Nn=(()=>{class n extends _n{_compositionMode;_composing=!1;constructor(t,a,r){super(t,a),this._compositionMode=r,this._compositionMode??=!Na()}writeValue(t){let a=t??``;this.setProperty(`value`,a)}_handleInput(t){(!this._compositionMode||this._compositionMode&&!this._composing)&&this.onChange(t)}_compositionStart(){this._composing=!0}_compositionEnd(t){this._composing=!1,this._compositionMode&&this.onChange(t)}static ɵfac=function(a){return new(a||n)(We$1(io),We$1(mn$1),We$1(Ca,8))};static ɵdir=Fu({type:n,selectors:[[`input`,`formControlName`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`formControlName`,``,3,`ngNoCva`,``],[`input`,`formControl`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`formControl`,``,3,`ngNoCva`,``],[`input`,`ngModel`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`ngModel`,``,3,`ngNoCva`,``],[``,`ngDefaultControl`,``]],hostBindings:function(a,r){a&1&&sg(`input`,function(i){return r._handleInput(i.target.value)})(`blur`,function(){return r.onTouched()})(`compositionstart`,function(){return r._compositionStart()})(`compositionend`,function(i){return r._compositionEnd(i.target.value)})},standalone:!1,features:[LI([_a]),jh]})}return n})();function be(n){return n==null||he(n)===0}function he(n){return n==null?null:Array.isArray(n)||typeof n==`string`?n.length:n instanceof Set?n.size:null}var Y=new C(``);var ge=new C(``);var xa=/^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;var me=class{static min(e){return Cn(e)}static max(e){return xn(e)}static required(e){return En(e)}static requiredTrue(e){return Ea(e)}static email(e){return Sa(e)}static minLength(e){return Ma(e)}static maxLength(e){return Sn(e)}static pattern(e){return wa(e)}static nullValidator(e){return Tt()}static compose(e){return Tn(e)}static composeAsync(e){return Fn(e)}};function Cn(n){return e=>{if(e.value==null||n==null)return null;let t=parseFloat(e.value);return!isNaN(t)&&t<n?{min:{min:n,actual:e.value}}:null}}function xn(n){return e=>{if(e.value==null||n==null)return null;let t=parseFloat(e.value);return!isNaN(t)&&t>n?{max:{max:n,actual:e.value}}:null}}function En(n){return be(n.value)?{required:!0}:null}function Ea(n){return n.value===!0?null:{required:!0}}function Sa(n){return be(n.value)||xa.test(n.value)?null:{email:!0}}function Ma(n){return e=>{let t=e.value?.length??he(e.value);return t===null||t===0?null:t<n?{minlength:{requiredLength:n,actualLength:t}}:null}}function Sn(n){return e=>{let t=e.value?.length??he(e.value);return t!==null&&t>n?{maxlength:{requiredLength:n,actualLength:t}}:null}}function wa(n){if(!n)return Tt;let e,t;return typeof n==`string`?(t=``,n.charAt(0)!==`^`&&(t+=`^`),t+=n,n.charAt(n.length-1)!==`$`&&(t+=`$`),e=new RegExp(t)):(t=n.toString(),e=n),a=>{if(be(a.value))return null;let r=a.value;return e.test(r)?null:{pattern:{requiredPattern:t,actualValue:r}}}}function Tt(n){return null}function Mn(n){return n!=null}function wn(n){return vs(n)?et$1(n):n}function An(n){let e={};return n.forEach(t=>{e=t!=null?V(V({},e),t):e}),Object.keys(e).length===0?null:e}function Dn(n,e){return e.map(t=>t(n))}function Aa(n){return!n.validate}function In(n){return n.map(e=>Aa(e)?e:t=>e.validate(t))}function Tn(n){if(!n)return null;let e=n.filter(Mn);return e.length==0?null:function(t){return An(Dn(t,e))}}function ve(n){return n!=null?Tn(In(n)):null}function Fn(n){if(!n)return null;let e=n.filter(Mn);return e.length==0?null:function(t){let a=Dn(t,e).map(wn);return py(a).pipe(W(An))}}function ye(n){return n!=null?Fn(In(n)):null}function cn(n,e){return n===null?[e]:Array.isArray(n)?[...n,e]:[n,e]}function kn(n){return n._rawValidators}function On(n){return n._rawAsyncValidators}function pe(n){return n?Array.isArray(n)?n:[n]:[]}function Ft(n,e){return Array.isArray(n)?n.includes(e):n===e}function un(n,e){let t=pe(e);return pe(n).forEach(r=>{Ft(t,r)||t.push(r)}),t}function mn(n,e){return pe(e).filter(t=>!Ft(n,t))}var kt=class{get value(){return this.control?this.control.value:null}get valid(){return this.control?this.control.valid:null}get invalid(){return this.control?this.control.invalid:null}get pending(){return this.control?this.control.pending:null}get disabled(){return this.control?this.control.disabled:null}get enabled(){return this.control?this.control.enabled:null}get errors(){return this.control?this.control.errors:null}get pristine(){return this.control?this.control.pristine:null}get dirty(){return this.control?this.control.dirty:null}get touched(){return this.control?this.control.touched:null}get status(){return this.control?this.control.status:null}get untouched(){return this.control?this.control.untouched:null}get statusChanges(){return this.control?this.control.statusChanges:null}get valueChanges(){return this.control?this.control.valueChanges:null}get path(){return null}_composedValidatorFn;_composedAsyncValidatorFn;_rawValidators=[];_rawAsyncValidators=[];_setValidators(e){this._rawValidators=e||[],this._composedValidatorFn=ve(this._rawValidators)}_setAsyncValidators(e){this._rawAsyncValidators=e||[],this._composedAsyncValidatorFn=ye(this._rawAsyncValidators)}get validator(){return this._composedValidatorFn||null}get asyncValidator(){return this._composedAsyncValidatorFn||null}_onDestroyCallbacks=[];_registerOnDestroy(e){this._onDestroyCallbacks.push(e)}_invokeOnDestroyCallbacks(){this._onDestroyCallbacks.forEach(e=>e()),this._onDestroyCallbacks=[]}reset(e=void 0){this.control?.reset(e)}hasError(e,t){return this.control?this.control.hasError(e,t):!1}getError(e,t){return this.control?this.control.getError(e,t):null}};var j=class extends kt{name;get formDirective(){return null}get path(){return null}};var ft=`VALID`;var It=`INVALID`;var et=`PENDING`;var bt=`DISABLED`;var U=class{};var Ot=class extends U{value;source;constructor(e,t){super(),this.value=e,this.source=t}};var gt=class extends U{pristine;source;constructor(e,t){super(),this.pristine=e,this.source=t}};var vt=class extends U{touched;source;constructor(e,t){super(),this.touched=e,this.source=t}};var nt=class extends U{status;source;constructor(e,t){super(),this.status=e,this.source=t}};var Rt=class extends U{source;constructor(e){super(),this.source=e}};var at=class extends U{source;constructor(e){super(),this.source=e}};function Rn(n){return(zt(n)?n.validators:n)||null}function Da(n){return Array.isArray(n)?ve(n):n||null}function Vn(n,e){return(zt(e)?e.asyncValidators:n)||null}function Ia(n){return Array.isArray(n)?ye(n):n||null}function zt(n){return n!=null&&!Array.isArray(n)&&typeof n==`object`}function Ta(n,e,t){let a=n.controls;if(!(e?Object.keys(a):a).length)throw new v(1e3,``);if(!Pn(a,t))throw new v(1001,``)}function Fa(n,e,t){n._forEachChild((a,r)=>{if(t[r]===void 0)throw new v(-1002,``)})}var Vt=class{_pendingDirty=!1;_hasOwnPendingAsyncValidator=null;_pendingTouched=!1;_onCollectionChange=()=>{};_updateOn;_hasRequired=ue$1(!1);_parent=null;_asyncValidationSubscription;_composedValidatorFn;_composedAsyncValidatorFn;_rawValidators;_rawAsyncValidators;value;constructor(e,t){this._assignValidators(e),this._assignAsyncValidators(t)}get validator(){return this._composedValidatorFn}set validator(e){this._rawValidators=this._composedValidatorFn=e,this._updateHasRequiredValidator()}get asyncValidator(){return this._composedAsyncValidatorFn}set asyncValidator(e){this._rawAsyncValidators=this._composedAsyncValidatorFn=e}get parent(){return this._parent}get status(){return yo(this.statusReactive)}set status(e){yo(()=>this.statusReactive.set(e))}_status=Ku(()=>this.statusReactive());statusReactive=ue$1(void 0);get valid(){return this.status===ft}get invalid(){return this.status===It}get pending(){return this.status===et}get disabled(){return this.status===bt}get enabled(){return this.status!==bt}errors;get pristine(){return yo(this.pristineReactive)}set pristine(e){yo(()=>this.pristineReactive.set(e))}_pristine=Ku(()=>this.pristineReactive());pristineReactive=ue$1(!0);get dirty(){return!this.pristine}get touched(){return yo(this.touchedReactive)}set touched(e){yo(()=>this.touchedReactive.set(e))}_touched=Ku(()=>this.touchedReactive());touchedReactive=ue$1(!1);get untouched(){return!this.touched}_events=new ne;events=this._events.asObservable();valueChanges;statusChanges;get updateOn(){return this._updateOn?this._updateOn:this.parent?this.parent.updateOn:`change`}setValidators(e){this._assignValidators(e)}setAsyncValidators(e){this._assignAsyncValidators(e)}addValidators(e){this.setValidators(un(e,this._rawValidators))}addAsyncValidators(e){this.setAsyncValidators(un(e,this._rawAsyncValidators))}removeValidators(e){this.setValidators(mn(e,this._rawValidators))}removeAsyncValidators(e){this.setAsyncValidators(mn(e,this._rawAsyncValidators))}hasValidator(e){return Ft(this._rawValidators,e)}hasAsyncValidator(e){return Ft(this._rawAsyncValidators,e)}clearValidators(){this.validator=null}clearAsyncValidators(){this.asyncValidator=null}markAsTouched(e={}){let t=this.touched===!1;this.touched=!0;let a=e.sourceControl??this;e.onlySelf||this._parent?.markAsTouched(K(V({},e),{sourceControl:a})),t&&e.emitEvent!==!1&&this._events.next(new vt(!0,a))}markAllAsDirty(e={}){this.markAsDirty({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:this}),this._forEachChild(t=>t.markAllAsDirty(e))}markAllAsTouched(e={}){this.markAsTouched({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:this}),this._forEachChild(t=>t.markAllAsTouched(e))}markAsUntouched(e={}){let t=this.touched===!0;this.touched=!1,this._pendingTouched=!1;let a=e.sourceControl??this;this._forEachChild(r=>{r.markAsUntouched({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:a})}),e.onlySelf||this._parent?._updateTouched(e,a),t&&e.emitEvent!==!1&&this._events.next(new vt(!1,a))}markAsDirty(e={}){let t=this.pristine===!0;this.pristine=!1;let a=e.sourceControl??this;e.onlySelf||this._parent?.markAsDirty(K(V({},e),{sourceControl:a})),t&&e.emitEvent!==!1&&this._events.next(new gt(!1,a))}markAsPristine(e={}){let t=this.pristine===!1;this.pristine=!0,this._pendingDirty=!1;let a=e.sourceControl??this;this._forEachChild(r=>{r.markAsPristine({onlySelf:!0,emitEvent:e.emitEvent})}),e.onlySelf||this._parent?._updatePristine(e,a),t&&e.emitEvent!==!1&&this._events.next(new gt(!0,a))}markAsPending(e={}){this.status=et;let t=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new nt(this.status,t)),this.statusChanges.emit(this.status)),e.onlySelf||this._parent?.markAsPending(K(V({},e),{sourceControl:t}))}disable(e={}){let t=this._parentMarkedDirty(e.onlySelf);this.status=bt,this.errors=null,this._forEachChild(r=>{r.disable(K(V({},e),{onlySelf:!0}))}),this._updateValue();let a=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new Ot(this.value,a)),this._events.next(new nt(this.status,a)),this.valueChanges.emit(this.value),this.statusChanges.emit(this.status)),this._updateAncestors(K(V({},e),{skipPristineCheck:t}),this),this._onDisabledChange.forEach(r=>r(!0))}enable(e={}){let t=this._parentMarkedDirty(e.onlySelf);this.status=ft,this._forEachChild(a=>{a.enable(K(V({},e),{onlySelf:!0}))}),this.updateValueAndValidity({onlySelf:!0,emitEvent:e.emitEvent}),this._updateAncestors(K(V({},e),{skipPristineCheck:t}),this),this._onDisabledChange.forEach(a=>a(!1))}_updateAncestors(e,t){e.onlySelf||(this._parent?.updateValueAndValidity(e),e.skipPristineCheck||this._parent?._updatePristine({},t),this._parent?._updateTouched({},t))}setParent(e){this._parent=e}getRawValue(){return this.value}updateValueAndValidity(e={}){if(this._setInitialStatus(),this._updateValue(),this.enabled){let a=this._cancelExistingSubscription();this.errors=this._runValidator(),this.status=this._calculateStatus(),(this.status===ft||this.status===et)&&this._runAsyncValidator(a,e.emitEvent)}let t=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new Ot(this.value,t)),this._events.next(new nt(this.status,t)),this.valueChanges.emit(this.value),this.statusChanges.emit(this.status)),e.onlySelf||this._parent?.updateValueAndValidity(K(V({},e),{sourceControl:t}))}_updateTreeValidity(e={emitEvent:!0}){this._forEachChild(t=>t._updateTreeValidity(e)),this.updateValueAndValidity({onlySelf:!0,emitEvent:e.emitEvent})}_setInitialStatus(){this.status=this._allControlsDisabled()?bt:ft}_runValidator(){return this.validator?this.validator(this):null}_runAsyncValidator(e,t){if(this.asyncValidator){this.status=et,this._hasOwnPendingAsyncValidator={emitEvent:t!==!1,shouldHaveEmitted:e!==!1};let a=wn(this.asyncValidator(this));this._asyncValidationSubscription=a.subscribe(r=>{this._hasOwnPendingAsyncValidator=null,this.setErrors(r,{emitEvent:t,shouldHaveEmitted:e})})}}_cancelExistingSubscription(){if(this._asyncValidationSubscription){this._asyncValidationSubscription.unsubscribe();let e=(this._hasOwnPendingAsyncValidator?.emitEvent||this._hasOwnPendingAsyncValidator?.shouldHaveEmitted)??!1;return this._hasOwnPendingAsyncValidator=null,e}return!1}setErrors(e,t={}){this.errors=e,this._updateControlsErrors(t.emitEvent!==!1,this,t.shouldHaveEmitted)}get(e){let t=e;return t==null||(Array.isArray(t)||(t=t.split(`.`)),t.length===0)?null:t.reduce((a,r)=>a&&a._find(r),this)}getError(e,t){let a=t?this.get(t):this;return a?.errors?a.errors[e]:null}hasError(e,t){return!!this.getError(e,t)}get root(){let e=this;for(;e._parent;)e=e._parent;return e}_updateControlsErrors(e,t,a){this.status=this._calculateStatus(),e&&this.statusChanges.emit(this.status),(e||a)&&this._events.next(new nt(this.status,t)),this._parent&&this._parent._updateControlsErrors(e,t,a)}_initObservables(){this.valueChanges=new nt$1,this.statusChanges=new nt$1}_calculateStatus(){return this._allControlsDisabled()?bt:this.errors?It:this._hasOwnPendingAsyncValidator||this._anyControlsHaveStatus(et)?et:this._anyControlsHaveStatus(It)?It:ft}_anyControlsHaveStatus(e){return this._anyControls(t=>t.status===e)}_anyControlsDirty(){return this._anyControls(e=>e.dirty)}_anyControlsTouched(){return this._anyControls(e=>e.touched)}_updatePristine(e,t){let a=!this._anyControlsDirty(),r=this.pristine!==a;this.pristine=a,e.onlySelf||this._parent?._updatePristine(e,t),r&&this._events.next(new gt(this.pristine,t))}_updateTouched(e={},t){this.touched=this._anyControlsTouched(),this._events.next(new vt(this.touched,t)),e.onlySelf||this._parent?._updateTouched(e,t)}_onDisabledChange=[];_registerOnCollectionChange(e){this._onCollectionChange=e}_setUpdateStrategy(e){zt(e)&&e.updateOn!=null&&(this._updateOn=e.updateOn)}_parentMarkedDirty(e){return!e&&!!this._parent?.dirty&&!this._parent._anyControlsDirty()}_find(e){return null}_assignValidators(e){this._rawValidators=Array.isArray(e)?e.slice():e,this._composedValidatorFn=Da(this._rawValidators),this._updateHasRequiredValidator()}_assignAsyncValidators(e){this._rawAsyncValidators=Array.isArray(e)?e.slice():e,this._composedAsyncValidatorFn=Ia(this._rawAsyncValidators)}_updateHasRequiredValidator(){yo(()=>this._hasRequired.set(this.hasValidator(me.required)))}};function Pn(n,e){return Object.hasOwn(n,e)}function ka(n){return n.tagName===`INPUT`||n.tagName===`SELECT`||n.tagName===`TEXTAREA`}function Oa(n,e,t,a){switch(t){case`name`:n.setAttribute(e,t,a);break;case`disabled`:case`readonly`:case`required`:a?n.setAttribute(e,t,``):n.removeAttribute(e,t);break;case`max`:case`min`:case`minLength`:case`maxLength`:a!==void 0?n.setAttribute(e,t,a.toString()):n.removeAttribute(e,t)}}var fe=class{kind;context;control;message;constructor({kind:e,context:t,control:a}){this.kind=e,this.context=t,this.control=a}};function Ra(n){return typeof n==`number`?n:parseInt(n,10)}function Ln(n){return typeof n==`number`?n:parseFloat(n)}var Gt=(()=>{class n{_validator=Tt;_onChange;_enabled;ngOnChanges(t){if(this.inputName in t){let a=this.normalizeInput(t[this.inputName].currentValue);this._enabled=this.enabled(a),this._validator=this._enabled?this.createValidator(a):Tt,this._onChange?.()}}validate(t){return this._validator(t)}registerOnValidatorChange(t){this._onChange=t}enabled(t){return t!=null}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,features:[nu]})}return n})();var Va={provide:Y,useExisting:yi(()=>Pa),multi:!0};var Pa=(()=>{class n extends Gt{max;inputName=`max`;normalizeInput=t=>Ln(t);createValidator=t=>xn(t);static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[`input`,`type`,`number`,`max`,``,`formControlName`,``],[`input`,`type`,`number`,`max`,``,`formControl`,``],[`input`,`type`,`number`,`max`,``,`ngModel`,``]],hostVars:1,hostBindings:function(a,r){a&2&&Jh(`max`,r._enabled?r.max:null)},inputs:{max:`max`},standalone:!1,features:[LI([Va]),jh]})}return n})();var La={provide:Y,useExisting:yi(()=>Ba),multi:!0};var Ba=(()=>{class n extends Gt{min;inputName=`min`;normalizeInput=t=>Ln(t);createValidator=t=>Cn(t);static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[`input`,`type`,`number`,`min`,``,`formControlName`,``],[`input`,`type`,`number`,`min`,``,`formControl`,``],[`input`,`type`,`number`,`min`,``,`ngModel`,``]],hostVars:1,hostBindings:function(a,r){a&2&&Jh(`min`,r._enabled?r.min:null)},inputs:{min:`min`},standalone:!1,features:[LI([La]),jh]})}return n})();var ja={provide:Y,useExisting:yi(()=>Bn),multi:!0};var Bn=(()=>{class n extends Gt{required;inputName=`required`;normalizeInput=mC;createValidator=t=>En;enabled(t){return t}static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`required`,``,`formControlName`,``,3,`type`,`checkbox`],[``,`required`,``,`formControl`,``,3,`type`,`checkbox`],[``,`required`,``,`ngModel`,``,3,`type`,`checkbox`]],hostVars:1,hostBindings:function(a,r){a&2&&Jh(`required`,r._enabled?``:null)},inputs:{required:`required`},standalone:!1,features:[LI([ja]),jh]})}return n})();var Ua={provide:Y,useExisting:yi(()=>za),multi:!0};var za=(()=>{class n extends Gt{maxlength;inputName=`maxlength`;normalizeInput=t=>Ra(t);createValidator=t=>Sn(t);static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`maxlength`,``,`formControlName`,``],[``,`maxlength`,``,`formControl`,``],[``,`maxlength`,``,`ngModel`,``]],hostVars:1,hostBindings:function(a,r){a&2&&Jh(`maxlength`,r._enabled?r.maxlength:null)},inputs:{maxlength:`maxlength`},standalone:!1,features:[LI([Ua]),jh]})}return n})();var Ga=new C(``);var Ht=new C(``,{factory:()=>_e});var _e=`always`;function Ha(n,e){return[...e.path,n]}function pn(n,e,t=_e){Ne(n,e),e.valueAccessor.writeValue(n.value),(n.disabled||t===`always`)&&e.valueAccessor.setDisabledState?.(n.disabled),Wa(n,e),qa(n,e),Ka(n,e),$a(n,e)}function fn(n,e,t=!0){let a=()=>{};e?.valueAccessor?.registerOnChange(a),e?.valueAccessor?.registerOnTouched(a),Lt(n,e),n&&(e._invokeOnDestroyCallbacks(),n._registerOnCollectionChange(()=>{}))}function Pt(n,e){n.forEach(t=>{t.registerOnValidatorChange&&t.registerOnValidatorChange(e)})}function $a(n,e){if(e.valueAccessor.setDisabledState){let t=a=>{e.valueAccessor.setDisabledState(a)};n.registerOnDisabledChange(t),e._registerOnDestroy(()=>{n._unregisterOnDisabledChange(t)})}}function Ne(n,e){let t=kn(n);e.validator!==null?n.setValidators(cn(t,e.validator)):typeof t==`function`&&n.setValidators([t]);let a=On(n);e.asyncValidator!==null?n.setAsyncValidators(cn(a,e.asyncValidator)):typeof a==`function`&&n.setAsyncValidators([a]);let r=()=>n.updateValueAndValidity();Pt(e._rawValidators,r),Pt(e._rawAsyncValidators,r)}function Lt(n,e){let t=!1;if(n!==null){if(e.validator!==null){let r=kn(n);if(Array.isArray(r)&&r.length>0){let o=r.filter(i=>i!==e.validator);o.length!==r.length&&(t=!0,n.setValidators(o))}}if(e.asyncValidator!==null){let r=On(n);if(Array.isArray(r)&&r.length>0){let o=r.filter(i=>i!==e.asyncValidator);o.length!==r.length&&(t=!0,n.setAsyncValidators(o))}}}let a=()=>{};return Pt(e._rawValidators,a),Pt(e._rawAsyncValidators,a),t}function Wa(n,e){e.valueAccessor.registerOnChange(t=>{n._pendingValue=t,n._pendingChange=!0,n._pendingDirty=!0,n.updateOn===`change`&&jn(n,e)})}function Ka(n,e){e.valueAccessor.registerOnTouched(()=>{n._pendingTouched=!0,n.updateOn===`blur`&&n._pendingChange&&jn(n,e),n.updateOn!==`submit`&&n.markAsTouched()})}function jn(n,e){n._pendingDirty&&n.markAsDirty(),n.setValue(n._pendingValue,{emitModelToViewChange:!1}),e.viewToModelUpdate(n._pendingValue),n._pendingChange=!1}function qa(n,e){let t=(a,r)=>{e.valueAccessor.writeValue(a),r&&e.viewToModelUpdate(a)};n.registerOnChange(t),e._registerOnDestroy(()=>{n._unregisterOnChange(t)})}function Un(n,e){Ne(n,e)}function Za(n,e){return Lt(n,e)}function Ya(n,e){if(!Object.hasOwn(n,`model`))return!1;let t=n.model;return t.isFirstChange()?!0:!Object.is(e,t.currentValue)}function Xa(n){return Object.getPrototypeOf(n.constructor)===Ut}function zn(n,e){n._syncPendingControls(),e.forEach(t=>{let a=t.control;a.updateOn===`submit`&&a._pendingChange&&(t.viewToModelUpdate(a._pendingValue),a._pendingChange=!1)})}function Qa(n,e){if(!e)return null;let t,a,r;return e.forEach(o=>{o.constructor===Nn?t=o:Xa(o)?a=o:r=o}),r||a||t||null}function Ja(n,e){let t=n.indexOf(e);t>-1&&n.splice(t,1)}var tr={provide:Ga,useFactory:()=>{let n=g(rt,{self:!0});return{setParseErrors:e=>{n.setParseErrorSource(e)},set onReset(e){n.onReset=e}}}};var rt=class extends kt{_parent=null;name=null;valueAccessor=null;isCustomControlBased=!1;userOnReset;resetSubscription;set onReset(e){this.userOnReset=e,this.resetSubscription?.unsubscribe(),this.resetSubscription=void 0,this.control&&(this.resetSubscription=this.control.events.subscribe(t=>{t instanceof at&&this.control&&this.userOnReset?.(this.control.value)}),this.subscription?.add(this.resetSubscription))}isNativeFormElement=!1;rawValueAccessors;_selectedValueAccessor=null;get selectedValueAccessor(){return this._selectedValueAccessor??=Qa(this,this.rawValueAccessors)}parseErrorsValidator=null;renderer;injector;requiredValidatorViaDi;subscription;customControlBindings=null;constructor(e,t,a){super(),this.injector=e,this.renderer=t,this.rawValueAccessors=a,this.injector?.get(re$1)?.onDestroy(()=>{this.removeParseErrorsValidator(this.control),this.subscription?.unsubscribe()})}setupCustomControl(){this.subscription?.unsubscribe();let e=this.injector?.get(Ug);if(!this.control||!e)return;let t=e.markForCheck.bind(e);this.subscription=new ee,this.subscription.add(this.control.valueChanges.subscribe(t)),this.subscription.add(this.control.statusChanges.subscribe(t)),this.resetSubscription?.unsubscribe(),this.resetSubscription=void 0,this.userOnReset&&(this.resetSubscription=this.control.events.subscribe(a=>{a instanceof at&&this.control&&this.userOnReset?.(this.control.value)}),this.subscription.add(this.resetSubscription)),this.parseErrorsValidator&&this.control.addValidators(this.parseErrorsValidator)}ngControlCreate(e){!e.nativeElement.hasAttribute?.(`ngNoCva`)&&(this.rawValueAccessors&&this.rawValueAccessors.length>0||this.valueAccessor!==null)||!e.customControl||(this.isCustomControlBased=!0,e.listenToCustomControlModel(r=>{this.control?.markAsDirty(),this.control?.setValue(r,{emitModelToViewChange:!1}),this.viewToModelUpdate(r)}),e.listenToCustomControlOutput(`touch`,()=>{this.control?.markAsTouched()}),this.customControlBindings={},this.isNativeFormElement=ka(e.nativeElement),this.requiredValidatorViaDi=this._rawValidators.find(r=>r instanceof Bn))}ngControlUpdate(e,t){if(!this.isCustomControlBased)return;let a=this.control,r=this.customControlBindings;Object.is(r.value,a.value)||(r.value=a.value,e.setCustomControlModelInput(a.value)),this.bindControlProperty(e,r,`touched`,a.touched),this.bindControlProperty(e,r,`dirty`,a.dirty),this.bindControlProperty(e,r,`valid`,a.valid),this.bindControlProperty(e,r,`invalid`,a.invalid),this.bindControlProperty(e,r,`pending`,a.pending),this.bindControlProperty(e,r,`disabled`,a.disabled),this.shouldBindRequired&&this.bindControlProperty(e,r,`required`,this.isRequired);let o=a.errors;if(r.errors!==o){r.errors=o;let i=this._convertErrors(o);e.setInputOnDirectives(`errors`,i)}}get isRequired(){return(this.requiredValidatorViaDi?._enabled||this.control?._hasRequired())??!1}get shouldBindRequired(){return!0}bindControlProperty(e,t,a,r){if(t[a]===r)return;t[a]=r;let o=e.setInputOnDirectives(a,r);this.isNativeFormElement&&!o&&(a===`disabled`||a===`required`)&&this.renderer&&Oa(this.renderer,e.nativeElement,a,r)}_convertErrors(e){if(e===null)return[];let t=this.control;return Object.entries(e).map(([a,r])=>new fe({context:r,kind:a,control:t}))}setParseErrorSource(e){if(e===void 0)return;let t=null,a=Ku(()=>{let r=e();return r.length===0?null:r.reduce((o,i)=>(o[i.kind]=i,o),{})});this.parseErrorsValidator=(()=>t).bind(this),Hi(()=>{t=a(),this.control?.updateValueAndValidity({emitEvent:!1})},{injector:this.injector})}removeParseErrorsValidator(e){this.parseErrorsValidator&&(e?.removeValidators(this.parseErrorsValidator),e?.updateValueAndValidity({emitEvent:!1}))}};var Bt=class{_cd;constructor(e){this._cd=e}get isTouched(){return this._cd?.control?._touched?.(),!!this._cd?.control?.touched}get isUntouched(){return!!this._cd?.control?.untouched}get isPristine(){return this._cd?.control?._pristine?.(),!!this._cd?.control?.pristine}get isDirty(){return!!this._cd?.control?.dirty}get isValid(){return this._cd?.control?._status?.(),!!this._cd?.control?.valid}get isInvalid(){return!!this._cd?.control?.invalid}get isPending(){return!!this._cd?.control?.pending}get isSubmitted(){return this._cd?._submitted?.(),!!this._cd?.submitted}};var Ri=(()=>{class n extends Bt{constructor(t){super(t)}static ɵfac=function(a){return new(a||n)(We$1(rt,2))};static ɵdir=Fu({type:n,selectors:[[``,`formControlName`,``],[``,`ngModel`,``],[``,`formControl`,``]],hostVars:14,hostBindings:function(a,r){a&2&&mg(`ng-untouched`,r.isUntouched)(`ng-touched`,r.isTouched)(`ng-pristine`,r.isPristine)(`ng-dirty`,r.isDirty)(`ng-valid`,r.isValid)(`ng-invalid`,r.isInvalid)(`ng-pending`,r.isPending)},standalone:!1,features:[jh]})}return n})();var Vi=(()=>{class n extends Bt{constructor(t){super(t)}static ɵfac=function(a){return new(a||n)(We$1(j,10))};static ɵdir=Fu({type:n,selectors:[[``,`formGroupName`,``],[``,`formArrayName`,``],[``,`ngModelGroup`,``],[``,`formGroup`,``],[``,`formArray`,``],[`form`,3,`ngNoForm`,``],[``,`ngForm`,``]],hostVars:16,hostBindings:function(a,r){a&2&&mg(`ng-untouched`,r.isUntouched)(`ng-touched`,r.isTouched)(`ng-pristine`,r.isPristine)(`ng-dirty`,r.isDirty)(`ng-valid`,r.isValid)(`ng-invalid`,r.isInvalid)(`ng-pending`,r.isPending)(`ng-submitted`,r.isSubmitted)},standalone:!1,features:[jh]})}return n})();var jt=class extends Vt{constructor(e,t,a){super(Rn(t),Vn(a,t)),this.controls=e,this._initObservables(),this._setUpdateStrategy(t),this._setUpControls(),this.updateValueAndValidity({onlySelf:!0,emitEvent:!!this.asyncValidator})}controls;registerControl(e,t){return this._find(e)||(this.controls[e]=t,t.setParent(this),t._registerOnCollectionChange(this._onCollectionChange),t)}addControl(e,t,a={}){this.registerControl(e,t),this.updateValueAndValidity({emitEvent:a.emitEvent}),this._onCollectionChange()}removeControl(e,t={}){let a=this._find(e);a&&a._registerOnCollectionChange(()=>{}),delete this.controls[e],this.updateValueAndValidity({emitEvent:t.emitEvent}),this._onCollectionChange()}setControl(e,t,a={}){let r=this._find(e);r&&r._registerOnCollectionChange(()=>{}),delete this.controls[e],t&&this.registerControl(e,t),this.updateValueAndValidity({emitEvent:a.emitEvent}),this._onCollectionChange()}contains(e){return this._find(e)?.enabled===!0}setValue(e,t={}){yo(()=>{Fa(this,!0,e),Object.keys(e).forEach(a=>{Ta(this,!0,a),this.controls[a].setValue(e[a],{onlySelf:!0,emitEvent:t.emitEvent})}),this.updateValueAndValidity(t)})}patchValue(e,t={}){e!=null&&(Object.keys(e).forEach(a=>{let r=this._find(a);r&&r.patchValue(e[a],{onlySelf:!0,emitEvent:t.emitEvent})}),this.updateValueAndValidity(t))}reset(e={},t={}){this._forEachChild((a,r)=>{a.reset(e?e[r]:null,K(V({},t),{onlySelf:!0}))}),this._updatePristine(t,this),this._updateTouched(t,this),this.updateValueAndValidity(t),t?.emitEvent!==!1&&this._events.next(new at(this))}getRawValue(){return this._reduceChildren({},(e,t,a)=>(e[a]=t.getRawValue(),e))}_syncPendingControls(){let e=this._reduceChildren(!1,(t,a)=>a._syncPendingControls()?!0:t);return e&&this.updateValueAndValidity({onlySelf:!0}),e}_forEachChild(e){Object.keys(this.controls).forEach(t=>{let a=this.controls[t];a&&e(a,t)})}_setUpControls(){this._forEachChild(e=>{e.setParent(this),e._registerOnCollectionChange(this._onCollectionChange)})}_updateValue(){this.value=this._reduceValue()}_anyControls(e){for(let[t,a]of Object.entries(this.controls))if(this.contains(t)&&e(a))return!0;return!1}_reduceValue(){return this._reduceChildren({},(t,a,r)=>((a.enabled||this.disabled)&&(t[r]=a.value),t))}_reduceChildren(e,t){let a=e;return this._forEachChild((r,o)=>{a=t(a,r,o)}),a}_allControlsDisabled(){for(let e of Object.keys(this.controls))if(this.controls[e].enabled)return!1;return Object.keys(this.controls).length>0||this.disabled}_find(e){return Pn(this.controls,e)?this.controls[e]:null}};var er={provide:j,useExisting:yi(()=>nr)};var ht=Promise.resolve();var nr=(()=>{class n extends j{callSetDisabledState;get submitted(){return yo(this.submittedReactive)}_submitted=Ku(()=>this.submittedReactive());submittedReactive=ue$1(!1);_directives=/* @__PURE__ */ new Set;form;ngSubmit=new nt$1;options;constructor(t,a,r){super(),this.callSetDisabledState=r,this.form=new jt({},ve(t),ye(a))}ngAfterViewInit(){this._setUpdateStrategy()}get formDirective(){return this}get control(){return this.form}get path(){return[]}get controls(){return this.form.controls}addControl(t){ht.then(()=>{t.control=this._findContainer(t.path).registerControl(t.name,t.control),t._setupWithForm(this.callSetDisabledState),t.control.updateValueAndValidity({emitEvent:!1}),this._directives.add(t)})}getControl(t){return this.form.get(t.path)}removeControl(t){ht.then(()=>{this._findContainer(t.path)?.removeControl(t.name),this._directives.delete(t)})}addFormGroup(t){ht.then(()=>{let a=this._findContainer(t.path),r=new jt({});Un(r,t),a.registerControl(t.name,r),r.updateValueAndValidity({emitEvent:!1})})}removeFormGroup(t){ht.then(()=>{this._findContainer(t.path)?.removeControl?.(t.name)})}getFormGroup(t){return this.form.get(t.path)}updateModel(t,a){ht.then(()=>{this.form.get(t.path).setValue(a)})}setValue(t){this.control.setValue(t)}onSubmit(t){return this.submittedReactive.set(!0),zn(this.form,this._directives),this.ngSubmit.emit(t),this.form._events.next(new Rt(this.control)),t?.target?.method===`dialog`}onReset(){this.resetForm()}resetForm(t=void 0){this.form.reset(t),this.submittedReactive.set(!1)}_setUpdateStrategy(){this.options&&this.options.updateOn!=null&&(this.form._updateOn=this.options.updateOn)}_findContainer(t){return t.pop(),t.length?this.form.get(t):this.form}static ɵfac=function(a){return new(a||n)(We$1(Y,10),We$1(ge,10),We$1(Ht,8))};static ɵdir=Fu({type:n,selectors:[[`form`,3,`ngNoForm`,``,3,`formGroup`,``,3,`formArray`,``],[`ng-form`],[``,`ngForm`,``]],hostBindings:function(a,r){a&1&&sg(`submit`,function(i){return r.onSubmit(i)})(`reset`,function(){return r.onReset()})},inputs:{options:[0,`ngFormOptions`,`options`]},outputs:{ngSubmit:`ngSubmit`},exportAs:[`ngForm`],standalone:!1,features:[LI([er]),jh]})}return n})();function bn(n,e){let t=n.indexOf(e);t>-1&&n.splice(t,1)}function hn(n){return typeof n==`object`&&n!==null&&Object.keys(n).length===2&&`value`in n&&`disabled`in n}var Gn=class extends Vt{defaultValue=null;_onChange=[];_pendingValue;_pendingChange=!1;constructor(e=null,t,a){super(Rn(t),Vn(a,t)),this._applyFormState(e),this._setUpdateStrategy(t),this._initObservables(),this.updateValueAndValidity({onlySelf:!0,emitEvent:!!this.asyncValidator}),zt(t)&&(t.nonNullable||t.initialValueIsDefault)&&(hn(e)?this.defaultValue=e.value:this.defaultValue=e)}setValue(e,t={}){yo(()=>{this.value=this._pendingValue=e,this._onChange.length&&t.emitModelToViewChange!==!1&&this._onChange.forEach(a=>a(this.value,t.emitViewToModelChange!==!1)),this.updateValueAndValidity(t)})}patchValue(e,t={}){this.setValue(e,t)}reset(e=this.defaultValue,t={}){this._applyFormState(e),this.markAsPristine(t),this.markAsUntouched(t),this.setValue(this.value,t),t.overwriteDefaultValue&&(this.defaultValue=this.value),this._pendingChange=!1,t?.emitEvent!==!1&&this._events.next(new at(this))}_updateValue(){}_anyControls(e){return!1}_allControlsDisabled(){return this.disabled}registerOnChange(e){this._onChange.push(e)}_unregisterOnChange(e){bn(this._onChange,e)}registerOnDisabledChange(e){this._onDisabledChange.push(e)}_unregisterOnDisabledChange(e){bn(this._onDisabledChange,e)}_forEachChild(e){}_syncPendingControls(){return this.updateOn===`submit`&&(this._pendingDirty&&this.markAsDirty(),this._pendingTouched&&this.markAsTouched(),this._pendingChange)?(this.setValue(this._pendingValue,{onlySelf:!0,emitModelToViewChange:!1}),!0):!1}_applyFormState(e){hn(e)?(this.value=this._pendingValue=e.value,e.disabled?this.disable({onlySelf:!0,emitEvent:!1}):this.enable({onlySelf:!0,emitEvent:!1})):this.value=this._pendingValue=e}};var ar=n=>n instanceof Gn;var rr=(()=>{class n extends j{callSetDisabledState;get submitted(){return yo(this._submittedReactive)}set submitted(t){this._submittedReactive.set(t)}_submitted=Ku(()=>this._submittedReactive());_submittedReactive=ue$1(!1);_oldForm;_onCollectionChange=()=>this._updateDomValue();directives=[];constructor(t,a,r){super(),this.callSetDisabledState=r,this._setValidators(t),this._setAsyncValidators(a)}ngOnChanges(t){this.onChanges(t)}ngOnDestroy(){this.onDestroy()}onChanges(t){if(!this.form)throw new v(1052,!1);Object.hasOwn(t,`form`)&&(this._updateValidators(),this._updateDomValue(),this._updateRegistrations(),this._oldForm=this.form)}onDestroy(){this.form&&(Lt(this.form,this),this.form._onCollectionChange===this._onCollectionChange&&this.form._registerOnCollectionChange(()=>{}))}get formDirective(){return this}get path(){return[]}addControl(t){let a=this.form.get(t.path);if(!a)throw new v(-1055,!1);return t._setupWithForm(a,this.callSetDisabledState),a.updateValueAndValidity({emitEvent:!1}),this.directives.push(t),a}getControl(t){return this.form.get(t.path)}removeControl(t){fn(t.control||null,t,!1),Ja(this.directives,t)}addFormGroup(t){this._setUpFormContainer(t)}removeFormGroup(t){this._cleanUpFormContainer(t)}getFormGroup(t){return this.form.get(t.path)}getFormArray(t){return this.form.get(t.path)}addFormArray(t){this._setUpFormContainer(t)}removeFormArray(t){this._cleanUpFormContainer(t)}updateModel(t,a){this.form.get(t.path).setValue(a)}onReset(){this.resetForm()}resetForm(t=void 0,a={}){this.form.reset(t,a),this._submittedReactive.set(!1)}onSubmit(t){return this.submitted=!0,zn(this.form,this.directives),this.ngSubmit.emit(t),this.form._events.next(new Rt(this.control)),t?.target?.method===`dialog`}_updateDomValue(){this.directives.forEach(t=>{let a=t.control,r=this.form.get(t.path);a!==r&&(fn(a||null,t),ar(r)&&t._setupWithForm(r,this.callSetDisabledState))}),this.form._updateTreeValidity({emitEvent:!1})}_setUpFormContainer(t){let a=this.form.get(t.path);Un(a,t),a.updateValueAndValidity({emitEvent:!1})}_cleanUpFormContainer(t){let a=this.form?.get(t.path);a&&Za(a,t)&&a.updateValueAndValidity({emitEvent:!1})}_updateRegistrations(){this.form._registerOnCollectionChange(this._onCollectionChange),this._oldForm?._registerOnCollectionChange(()=>{})}_updateValidators(){Ne(this.form,this),this._oldForm&&Lt(this._oldForm,this)}static ɵfac=function(a){return new(a||n)(We$1(Y,10),We$1(ge,10),We$1(Ht,8))};static ɵdir=Fu({type:n,features:[jh,nu]})}return n})();var or={provide:j,useExisting:yi(()=>ir)};var ir=(()=>{class n extends rr{form=null;ngSubmit=new nt$1;get control(){return this.form}static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`formGroup`,``]],hostBindings:function(a,r){a&1&&sg(`submit`,function(i){return r.onSubmit(i)})(`reset`,function(){return r.onReset()})},inputs:{form:[0,`formGroup`,`form`]},outputs:{ngSubmit:`ngSubmit`},exportAs:[`ngForm`],standalone:!1,features:[LI([or]),jh]})}return n})();var sr={provide:rt,useExisting:yi(()=>dr)};var gn=Promise.resolve();var dr=(()=>{class n extends rt{_changeDetectorRef;callSetDisabledState;control=new Gn;static ngAcceptInputType_isDisabled;_registered=!1;_ngModelInjector;viewModel;name=``;isDisabled;model;options;update=new nt$1;constructor(t,a,r,o,i,d,f,b){super(f,b,o),this._changeDetectorRef=i,this.callSetDisabledState=d,this._parent=t,this._setValidators(a),this._setAsyncValidators(r)}ngOnChanges(t){if(this._registered,this._checkForErrors(),!this._registered||`name`in t){if(this._registered&&(this._checkName(),this.formDirective)){let a=t.name.previousValue;this.formDirective.removeControl({name:a,path:this._getPath(a)})}this._setUpControl()}`isDisabled`in t&&this._updateDisabled(t),Ya(t,this.viewModel)&&(this._updateValue(this.model),this.viewModel=this.model)}ngOnDestroy(){this.formDirective?.removeControl(this)}ɵngControlCreate(t){super.ngControlCreate(t)}ɵngControlUpdate(t){super.ngControlUpdate(t,!1)}get shouldBindRequired(){return!1}get path(){return this._getPath(this.name)}get formDirective(){return this._parent?this._parent.formDirective:null}viewToModelUpdate(t){this.viewModel=t,this.update.emit(t)}_setUpControl(){this._setUpdateStrategy(),this._isStandalone()?this._setUpStandalone():this.formDirective.addControl(this),this._registered=!0}_setUpdateStrategy(){this.options&&this.options.updateOn!=null&&(this.control._updateOn=this.options.updateOn)}_isStandalone(){return!this._parent||!!(this.options&&this.options.standalone)}_setUpStandalone(){this.isCustomControlBased?this.setupCustomControl():(this.valueAccessor??=this.selectedValueAccessor,pn(this.control,this,this.callSetDisabledState)),this.control.updateValueAndValidity({emitEvent:!1})}_setupWithForm(t){this.isCustomControlBased?this.setupCustomControl():(this.valueAccessor??=this.selectedValueAccessor,pn(this.control,this,t))}_checkForErrors(){this._checkName()}_checkName(){this.options&&this.options.name&&(this.name=this.options.name),!this._isStandalone()&&this.name}_updateValue(t){gn.then(()=>{this.control.setValue(t,{emitViewToModelChange:!1}),this._changeDetectorRef?.markForCheck()})}_updateDisabled(t){let a=t.isDisabled.currentValue,r=a!==0&&mC(a);gn.then(()=>{r&&!this.control.disabled?this.control.disable():!r&&this.control.disabled&&this.control.enable(),this._changeDetectorRef?.markForCheck()})}_getPath(t){return this._parent?Ha(t,this._parent):[t]}static ɵfac=function(a){return new(a||n)(We$1(j,9),We$1(Y,10),We$1(ge,10),We$1(yt,10),We$1(Ug,8),We$1(Ht,8),We$1(oe$1,8),We$1(io,8))};static ɵdir=Fu({type:n,selectors:[[``,`ngModel`,``,3,`formControlName`,``,3,`formControl`,``]],inputs:{name:`name`,isDisabled:[0,`disabled`,`isDisabled`],model:[0,`ngModel`,`model`],options:[0,`ngModelOptions`,`options`]},outputs:{update:`ngModelChange`},exportAs:[`ngModel`],standalone:!1,features:[LI([sr,tr]),jh,nu,Ww(null)]})}return n})();var Li=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,selectors:[[`form`,3,`ngNoForm`,``,3,`ngNativeValidate`,``]],hostAttrs:[`novalidate`,``],standalone:!1})}return n})();var lr={provide:yt,useExisting:yi(()=>cr),multi:!0};var cr=(()=>{class n extends Ut{writeValue(t){let a=t??``;this.setProperty(`value`,a)}registerOnChange(t){this.onChange=a=>{t(a==``?null:parseFloat(a))}}static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[`input`,`type`,`number`,`formControlName`,``,3,`ngNoCva`,``],[`input`,`type`,`number`,`formControl`,``,3,`ngNoCva`,``],[`input`,`type`,`number`,`ngModel`,``,3,`ngNoCva`,``]],hostBindings:function(a,r){a&1&&sg(`input`,function(i){return r.onChange(i.target.value)})(`blur`,function(){return r.onTouched()})},standalone:!1,features:[LI([lr]),jh]})}return n})();var ur={provide:yt,useExisting:yi(()=>$n),multi:!0};function Hn(n,e){return n==null?`${e}`:(e&&typeof e==`object`&&(e=`Object`),`${n}: ${e}`.slice(0,50))}function mr(n){return n.split(`:`)[0]}var $n=(()=>{class n extends Ut{value;_optionMap=/* @__PURE__ */ new Map;_idCounter=0;set compareWith(t){this._compareWith=t}_compareWith=Object.is;appRefInjector=g(go).injector;destroyRef=g(re$1);cdr=g(Ug);_queuedWrite=!1;_writeValueAfterRender(){this._queuedWrite||this.appRefInjector.destroyed||(this._queuedWrite=!0,$D({write:()=>{this.destroyRef.destroyed||(this._queuedWrite=!1,this.writeValue(this.value))}},{injector:this.appRefInjector}))}writeValue(t){this.cdr.markForCheck(),this.value=t;let r=Hn(this._getOptionId(t),t);this.setProperty(`value`,r)}registerOnChange(t){this.onChange=a=>{this.value=this._getOptionValue(a),t(this.value)}}_registerOption(){return(this._idCounter++).toString()}_getOptionId(t){for(let a of this._optionMap.keys())if(this._compareWith(this._optionMap.get(a),t))return a;return null}_getOptionValue(t){let a=mr(t);return this._optionMap.has(a)?this._optionMap.get(a):t}static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[`select`,`formControlName`,``,3,`multiple`,``,3,`ngNoCva`,``],[`select`,`formControl`,``,3,`multiple`,``,3,`ngNoCva`,``],[`select`,`ngModel`,``,3,`multiple`,``,3,`ngNoCva`,``]],hostBindings:function(a,r){a&1&&sg(`change`,function(i){return r.onChange(i.target.value)})(`blur`,function(){return r.onTouched()})},inputs:{compareWith:`compareWith`},standalone:!1,features:[LI([ur]),jh]})}return n})();var Bi=(()=>{class n{_element;_renderer;_select;id;constructor(t,a,r){this._element=t,this._renderer=a,this._select=r,this._select&&(this.id=this._select._registerOption())}set ngValue(t){this._select!=null&&(this._select._optionMap.set(this.id,t),this._setElementValue(Hn(this.id,t)),this._select._writeValueAfterRender())}set value(t){this._setElementValue(t),this._select?._writeValueAfterRender()}_setElementValue(t){this._renderer.setProperty(this._element.nativeElement,`value`,t)}ngOnDestroy(){this._select?._optionMap.delete(this.id),this._select?._writeValueAfterRender()}static ɵfac=function(a){return new(a||n)(We$1(mn$1),We$1(io),We$1($n,9))};static ɵdir=Fu({type:n,selectors:[[`option`]],inputs:{ngValue:`ngValue`,value:`value`},standalone:!1})}return n})();var vn=Symbol(`negativeZero`);var pr={provide:yt,useExisting:yi(()=>Wn),multi:!0};function yn(n,e){return n==null?`${e}`:(typeof e==`string`&&(e=`'${e}'`),e&&typeof e==`object`&&(e=`Object`),`${n}: ${e}`.slice(0,50))}function fr(n){return n.split(`:`)[0]}var Wn=(()=>{class n extends Ut{value;_optionMap=/* @__PURE__ */ new Map;_idCounter=0;set compareWith(t){this._compareWith=t}_compareWith=Object.is;writeValue(t){this.value=t;let a;if(Array.isArray(t)){let r=this._getOptionIds(t);a=(o,i)=>{o._setSelected(r.has(i))}}else a=r=>{r._setSelected(!1)};this._optionMap.forEach(a)}registerOnChange(t){this.onChange=a=>{let r=[],o=a.selectedOptions;if(o!==void 0){let i=o;for(let d=0;d<i.length;d++){let f=i[d],b=this._getOptionValue(f.value);r.push(b)}}else{let i=a.options;for(let d=0;d<i.length;d++){let f=i[d];if(f.selected){let b=this._getOptionValue(f.value);r.push(b)}}}this.value=r,t(r)}}_registerOption(t){let a=(this._idCounter++).toString();return this._optionMap.set(a,t),a}_getOptionIds(t){if(this._compareWith!==Object.is||t.length<2)return new Set(t.map(o=>this._getOptionId(o)).filter(o=>o!==null));let a=/* @__PURE__ */ new Set;t.forEach(o=>a.add(o===0&&Object.is(o,-0)?vn:o));let r=/* @__PURE__ */ new Set;for(let[o,i]of this._optionMap){if(a.size===0)break;let d=i._value,f=d===0&&Object.is(d,-0)?vn:d;a.delete(f)&&r.add(o)}return r}_getOptionId(t){for(let a of this._optionMap.keys())if(this._compareWith(this._optionMap.get(a)._value,t))return a;return null}_getOptionValue(t){let a=fr(t);return this._optionMap.has(a)?this._optionMap.get(a)._value:t}static ɵfac=(()=>{let t;return function(r){return(t||(t=pp(n)))(r||n)}})();static ɵdir=Fu({type:n,selectors:[[`select`,`multiple`,``,`formControlName`,``,3,`ngNoCva`,``],[`select`,`multiple`,``,`formControl`,``,3,`ngNoCva`,``],[`select`,`multiple`,``,`ngModel`,``,3,`ngNoCva`,``]],hostBindings:function(a,r){a&1&&sg(`change`,function(i){return r.onChange(i.target)})(`blur`,function(){return r.onTouched()})},inputs:{compareWith:`compareWith`},standalone:!1,features:[LI([pr]),jh]})}return n})();var ji=(()=>{class n{_element;_renderer;_select;id;_value;constructor(t,a,r){this._element=t,this._renderer=a,this._select=r,this._select&&(this.id=this._select._registerOption(this))}set ngValue(t){this._select!=null&&(this._value=t,this._setElementValue(yn(this.id,t)),this._select.writeValue(this._select.value))}set value(t){this._select?(this._value=t,this._setElementValue(yn(this.id,t)),this._select.writeValue(this._select.value)):this._setElementValue(t)}_setElementValue(t){this._renderer.setProperty(this._element.nativeElement,`value`,t)}_setSelected(t){this._renderer.setProperty(this._element.nativeElement,`selected`,t)}ngOnDestroy(){this._select&&(this._select._optionMap.delete(this.id),this._select.writeValue(this._select.value))}static ɵfac=function(a){return new(a||n)(We$1(mn$1),We$1(io),We$1(Wn,9))};static ɵdir=Fu({type:n,selectors:[[`option`]],inputs:{ngValue:`ngValue`,value:`value`},standalone:!1})}return n})();var br=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({})}return n})();var Ui=(()=>{class n{static withConfig(t){return{ngModule:n,providers:[{provide:Ht,useValue:t.callSetDisabledState??_e}]}}static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[br]})}return n})();var qn=Symbol(`FIELD_TREE`);function ws(n){return typeof n==`function`&&n[qn]===!0}var As=new C(``);export{ta as A,lo as C,re as D,po as E,za as F,tt as M,ws as N,rn as O,yt as P,ji as S,nr as T,bi as _,Bi as a,hi as b,Nn as c,Ri as d,Ui as f,Y as g,Vi as h,Ba as i,to as j,rt as k,Pa as l,Ur as m,Ao as n,Eo as o,Uo as p,As as r,Li as s,$n as t,Qr as u,cr as v,me as w,ir as x,dr as y};