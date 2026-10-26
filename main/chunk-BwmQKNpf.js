import{$t as YE,A as Fh,Bt as VD,Cn as ee$1,Ct as Qh,Dr as tt,Fr as vv,Gn as ig,Gr as yi$1,H as Ir,Ht as Vg,In as gg,Jr as z,K as Jo,Kn as io,Kr as yo,Lt as Uu,M as Fw,Mn as g,Nn as gC,Nr as vi,Ot as Rt$1,Pr as vs,R as Hi,Rt as Uw,Sn as ea$1,Sr as sb,Tt as RE,Ur as xy,Vr as xE,Xt as Xe$1,Z as Ku,ar as ne$1,bt as Q$1,cr as nu,dr as oo,fr as pI,ft as OI,h as Ce,i as $l,j as Fu,jn as fy,jr as v,jt as Ss,kr as ue$1,lr as oe$1,mr as pp,o as $u,p as C,q as K$1,r as $e$1,rr as mn$1,rt as Mj,tt as Lu,ur as of,vr as re$1,wn as eg,xt as QE,zn as hC,zt as V}from"./chunk-CLmVvdmT.js";import{A as un$1,C as Pn,D as mn$2,M as xn$1,S as Ln$1,_ as An$1,x as Hn$1,y as En$1}from"./main-U6HVLNST.js";var st;function Re(){if(st==null&&typeof window<`u`)try{window.addEventListener(`test`,null,Object.defineProperty({},"passive",{get:()=>st=!0}))}finally{st=st||!1}return st}function q(n){return Re()?n:!!n.capture}var Pe=new C(`cdk-input-modality-detector-options`);var Le={ignoreKeys:[18,17,224,91,16]};var Be=650;var Kt={passive:!0,capture:!0};var je=(()=>{class n{_platform=g(un$1);_listenerCleanups;modalityDetected;modalityChanged;get mostRecentModality(){return this._modality.value}_mostRecentTarget=null;_modality=new Ir(null);_options;_lastTouchMs=0;_onKeydown=t=>{this._options?.ignoreKeys?.some(a=>a===t.keyCode)||(this._modality.next(`keyboard`),this._mostRecentTarget=Hn$1(t))};_onMousedown=t=>{Date.now()-this._lastTouchMs<Be||(this._modality.next(Pn(t)?`keyboard`:`mouse`),this._mostRecentTarget=Hn$1(t))};_onTouchstart=t=>{if(Ln$1(t)){this._modality.next(`keyboard`);return}this._lastTouchMs=Date.now(),this._modality.next(`touch`),this._mostRecentTarget=Hn$1(t)};constructor(){let t=g(Ce),a=g(Q$1),o=g(Pe,{optional:!0});if(this._options=V(V({},Le),o),this.modalityDetected=this._modality.pipe(xy(1)),this.modalityChanged=this.modalityDetected.pipe(Jo()),this._platform.isBrowser){let r=g(oo).createRenderer(null,null);this._listenerCleanups=t.runOutsideAngular(()=>[r.listen(a,`keydown`,this._onKeydown,Kt),r.listen(a,`mousedown`,this._onMousedown,Kt),r.listen(a,`touchstart`,this._onTouchstart,Kt)])}}ngOnDestroy(){this._modality.complete(),this._listenerCleanups?.forEach(t=>t())}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var lt=(function(n){return n[n.IMMEDIATE=0]=`IMMEDIATE`,n[n.EVENTUAL=1]=`EVENTUAL`,n})(lt||{});var Ue=new C(`cdk-focus-monitor-default-options`);var Et=q({passive:!0,capture:!0});var Yt=(()=>{class n{_ngZone=g(Ce);_platform=g(un$1);_inputModalityDetector=g(je);_origin=null;_lastFocusOrigin=null;_windowFocused=!1;_windowFocusTimeoutId;_originTimeoutId;_originFromTouchInteraction=!1;_elementInfo=new Map;_monitoredElementCount=0;_rootNodeFocusListenerCount=new Map;_detectionMode;_windowFocusListener=()=>{this._windowFocused=!0,this._windowFocusTimeoutId=setTimeout(()=>this._windowFocused=!1)};_document=g(Q$1);_stopInputModalityDetector=new ne$1;constructor(){let t=g(Ue,{optional:!0});this._detectionMode=t?.detectionMode||lt.IMMEDIATE}_rootNodeFocusAndBlurListener=t=>{let a=Hn$1(t);for(let o=a;o;o=o.parentElement)t.type===`focus`?this._onFocus(t,o):this._onBlur(t,o)};monitor(t,a=!1){let o=mn$2(t);if(!this._platform.isBrowser||o.nodeType!==1)return ea$1();let r=xn$1(o)||this._document,s=this._elementInfo.get(o);if(s)return a&&(s.checkChildren=!0),s.subject;let m={checkChildren:a,subject:new ne$1,rootNode:r};return this._elementInfo.set(o,m),this._registerGlobalListeners(m),m.subject}stopMonitoring(t){let a=mn$2(t),o=this._elementInfo.get(a);o&&(o.subject.complete(),this._setClasses(a),this._elementInfo.delete(a),this._removeGlobalListeners(o))}focusVia(t,a,o){let r=mn$2(t);r===this._document.activeElement?this._getClosestElementsInfo(r).forEach(([m,V])=>this._originChanged(m,a,V)):(this._setOrigin(a),typeof r.focus==`function`&&r.focus(o))}ngOnDestroy(){this._elementInfo.forEach((t,a)=>this.stopMonitoring(a))}_getWindow(){return this._document.defaultView||window}_getFocusOrigin(t){return this._origin?this._originFromTouchInteraction?this._shouldBeAttributedToTouch(t)?`touch`:`program`:this._origin:this._windowFocused&&this._lastFocusOrigin?this._lastFocusOrigin:t&&this._isLastInteractionFromInputLabel(t)?`mouse`:`program`}_shouldBeAttributedToTouch(t){return this._detectionMode===lt.EVENTUAL||!!t?.contains(this._inputModalityDetector._mostRecentTarget)}_setClasses(t,a){t.classList.toggle(`cdk-focused`,!!a),t.classList.toggle(`cdk-touch-focused`,a===`touch`),t.classList.toggle(`cdk-keyboard-focused`,a===`keyboard`),t.classList.toggle(`cdk-mouse-focused`,a===`mouse`),t.classList.toggle(`cdk-program-focused`,a===`program`)}_setOrigin(t,a=!1){this._ngZone.runOutsideAngular(()=>{if(this._origin=t,this._originFromTouchInteraction=t===`touch`&&a,this._detectionMode===lt.IMMEDIATE){clearTimeout(this._originTimeoutId);let o=this._originFromTouchInteraction?Be:1;this._originTimeoutId=setTimeout(()=>this._origin=null,o)}})}_onFocus(t,a){let o=this._elementInfo.get(a),r=Hn$1(t);!o||!o.checkChildren&&a!==r||this._originChanged(a,this._getFocusOrigin(r),o)}_onBlur(t,a){let o=this._elementInfo.get(a);!o||o.checkChildren&&t.relatedTarget instanceof Node&&a.contains(t.relatedTarget)||(this._setClasses(a),this._emitOrigin(o,null))}_emitOrigin(t,a){t.subject.observers.length&&this._ngZone.run(()=>t.subject.next(a))}_registerGlobalListeners(t){if(!this._platform.isBrowser)return;let a=t.rootNode,o=this._rootNodeFocusListenerCount.get(a)||0;o||this._ngZone.runOutsideAngular(()=>{a.addEventListener(`focus`,this._rootNodeFocusAndBlurListener,Et),a.addEventListener(`blur`,this._rootNodeFocusAndBlurListener,Et)}),this._rootNodeFocusListenerCount.set(a,o+1),++this._monitoredElementCount===1&&(this._ngZone.runOutsideAngular(()=>{this._getWindow().addEventListener(`focus`,this._windowFocusListener)}),this._inputModalityDetector.modalityDetected.pipe($l(this._stopInputModalityDetector)).subscribe(r=>{this._setOrigin(r,!0)}))}_removeGlobalListeners(t){let a=t.rootNode;if(this._rootNodeFocusListenerCount.has(a)){let o=this._rootNodeFocusListenerCount.get(a);o>1?this._rootNodeFocusListenerCount.set(a,o-1):(a.removeEventListener(`focus`,this._rootNodeFocusAndBlurListener,Et),a.removeEventListener(`blur`,this._rootNodeFocusAndBlurListener,Et),this._rootNodeFocusListenerCount.delete(a))}--this._monitoredElementCount||(this._getWindow().removeEventListener(`focus`,this._windowFocusListener),this._stopInputModalityDetector.next(),clearTimeout(this._windowFocusTimeoutId),clearTimeout(this._originTimeoutId))}_originChanged(t,a,o){this._setClasses(t,a),this._emitOrigin(o,a),this._lastFocusOrigin=a}_getClosestElementsInfo(t){let a=[];return this._elementInfo.forEach((o,r)=>{(r===t||o.checkChildren&&r.contains(t))&&a.push([r,o])}),a}_isLastInteractionFromInputLabel(t){let{_mostRecentTarget:a,mostRecentModality:o}=this._inputModalityDetector;if(o!==`mouse`||!a||a===t||t.nodeName!==`INPUT`&&t.nodeName!==`TEXTAREA`||t.disabled)return!1;let r=t.labels;if(r){for(let s=0;s<r.length;s++)if(r[s].contains(a))return!0}return!1}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var ze=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=Fw({type:n,selectors:[[`ng-component`]],exportAs:[`cdkVisuallyHidden`],decls:0,vars:0,template:function(a,o){},styles:[`.cdk-visually-hidden {
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
`],encapsulation:2})}return n})();var Ge=new Set;var H;var Xt=(()=>{class n{_platform=g(un$1);_nonce=g(of,{optional:!0});_matchMedia;constructor(){this._matchMedia=this._platform.isBrowser&&window.matchMedia?window.matchMedia.bind(window):Bn}matchMedia(t){return(this._platform.WEBKIT||this._platform.BLINK)&&Ln(t,this._nonce),this._matchMedia(t)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function Ln(n,e){if(!Ge.has(n))try{H||(H=document.createElement(`style`),e&&H.setAttribute(`nonce`,e),H.setAttribute(`type`,`text/css`),document.head.appendChild(H)),H.sheet&&(H.sheet.insertRule(`@media ${n.replace(/[{}]/g,``)} {body{ }}`,0),Ge.add(n))}catch(t){console.error(t)}}function Bn(n){return{matches:n===`all`||n===``,media:n,addListener:()=>{},removeListener:()=>{}}}var jn=(()=>{class n{create(t){return typeof MutationObserver>`u`?null:new MutationObserver(t)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var Co=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({providers:[jn]})}return n})();var Un=(()=>{class n{_platform=g(un$1);isDisabled(t){return t.hasAttribute(`disabled`)}isVisible(t){return Gn(t)&&getComputedStyle(t).visibility===`visible`}isTabbable(t){if(!this._platform.isBrowser)return!1;let a=zn(Xn(t));if(a&&(He(a)===-1||!this.isVisible(a)))return!1;let o=t.nodeName.toLowerCase(),r=He(t);return t.hasAttribute(`contenteditable`)?r!==-1:o===`iframe`||o===`object`||this._platform.WEBKIT&&this._platform.IOS&&!Kn(t)?!1:o===`audio`?t.hasAttribute(`controls`)?r!==-1:!1:o===`video`?r===-1?!1:r!==null?!0:this._platform.FIREFOX||t.hasAttribute(`controls`):t.tabIndex>=0}isFocusable(t,a){return Yn(t)&&!this.isDisabled(t)&&(a?.ignoreInert||!t.closest?.(`[inert]`))&&(a?.ignoreVisibility||this.isVisible(t))}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function zn(n){try{return n.frameElement}catch{return null}}function Gn(n){return!!(n.offsetWidth||n.offsetHeight||typeof n.getClientRects==`function`&&n.getClientRects().length)}function Hn(n){let e=n.nodeName.toLowerCase();return e===`input`||e===`select`||e===`button`||e===`textarea`}function $n(n){return qn(n)&&n.type==`hidden`}function Wn(n){return Zn(n)&&n.hasAttribute(`href`)}function qn(n){return n.nodeName.toLowerCase()==`input`}function Zn(n){return n.nodeName.toLowerCase()==`a`}function $e(n){if(!n.hasAttribute(`tabindex`)||n.tabIndex===void 0)return!1;let e=n.getAttribute(`tabindex`);return!!(e&&!isNaN(parseInt(e,10)))}function He(n){if(!$e(n))return null;let e=parseInt(n.getAttribute(`tabindex`)||``,10);return isNaN(e)?-1:e}function Kn(n){let e=n.nodeName.toLowerCase(),t=e===`input`&&n.type;return t===`text`||t===`password`||e===`select`||e===`textarea`}function Yn(n){return $n(n)?!1:Hn(n)||Wn(n)||n.hasAttribute(`contenteditable`)||$e(n)}function Xn(n){return n.ownerDocument&&n.ownerDocument.defaultView||window}var Qt=class{_element;_checker;_ngZone;_document;_injector;_startAnchor=null;_endAnchor=null;_hasAttached=!1;startAnchorListener=()=>{!this.focusLastTabbableElement()&&this._checker.isFocusable(this._element)&&this._element.focus()};endAnchorListener=()=>{!this.focusFirstTabbableElement()&&this._checker.isFocusable(this._element)&&this._element.focus()};get enabled(){return this._enabled}set enabled(e){this._enabled=e,this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(e,this._startAnchor),this._toggleAnchorTabIndex(e,this._endAnchor))}_enabled=!0;constructor(e,t,a,o,r=!1,s){this._element=e,this._checker=t,this._ngZone=a,this._document=o,this._injector=s,r||this.attachAnchors()}destroy(){let e=this._startAnchor,t=this._endAnchor;e&&(e.removeEventListener(`focus`,this.startAnchorListener),e.remove()),t&&(t.removeEventListener(`focus`,this.endAnchorListener),t.remove()),this._startAnchor=this._endAnchor=null,this._hasAttached=!1}attachAnchors(){return this._hasAttached?!0:(this._ngZone.runOutsideAngular(()=>{this._startAnchor||(this._startAnchor=this._createAnchor(),this._startAnchor.addEventListener(`focus`,this.startAnchorListener)),this._endAnchor||(this._endAnchor=this._createAnchor(),this._endAnchor.addEventListener(`focus`,this.endAnchorListener))}),this._element.parentNode&&(this._element.parentNode.insertBefore(this._startAnchor,this._element),this._element.parentNode.insertBefore(this._endAnchor,this._element.nextSibling),this._hasAttached=!0),this._hasAttached)}focusInitialElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusInitialElement(e)))})}focusFirstTabbableElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusFirstTabbableElement(e)))})}focusLastTabbableElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusLastTabbableElement(e)))})}_getRegionBoundary(e){let t=this._element.querySelectorAll(`[cdk-focus-region-${e}], [cdkFocusRegion${e}], [cdk-focus-${e}]`);return e==`start`?t.length?t[0]:this._getFirstTabbableElement(this._element):t.length?t[t.length-1]:this._getLastTabbableElement(this._element)}focusInitialElement(e){let t=this._element.querySelector(`[cdk-focus-initial], [cdkFocusInitial]`);if(t){if(!this._checker.isFocusable(t)){let a=this._getFirstTabbableElement(t);return a?.focus(e),!!a}return t.focus(e),!0}return this.focusFirstTabbableElement(e)}focusFirstTabbableElement(e){let t=this._getRegionBoundary(`start`);return t&&t.focus(e),!!t}focusLastTabbableElement(e){let t=this._getRegionBoundary(`end`);return t&&t.focus(e),!!t}hasAttached(){return this._hasAttached}_getFirstTabbableElement(e){if(this._checker.isFocusable(e)&&this._checker.isTabbable(e))return e;let t=e.children;for(let a=0;a<t.length;a++){let o=t[a].nodeType===this._document.ELEMENT_NODE?this._getFirstTabbableElement(t[a]):null;if(o)return o}return null}_getLastTabbableElement(e){if(this._checker.isFocusable(e)&&this._checker.isTabbable(e))return e;let t=e.children;for(let a=t.length-1;a>=0;a--){let o=t[a].nodeType===this._document.ELEMENT_NODE?this._getLastTabbableElement(t[a]):null;if(o)return o}return null}_createAnchor(){let e=this._document.createElement(`div`);return this._toggleAnchorTabIndex(this._enabled,e),e.classList.add(`cdk-visually-hidden`),e.classList.add(`cdk-focus-trap-anchor`),e.setAttribute(`aria-hidden`,`true`),e}_toggleAnchorTabIndex(e,t){e?t.setAttribute(`tabindex`,`0`):t.removeAttribute(`tabindex`)}toggleAnchors(e){this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(e,this._startAnchor),this._toggleAnchorTabIndex(e,this._endAnchor))}_executeOnStable(e){VD(e,{injector:this._injector})}};var ko=(()=>{class n{_checker=g(Un);_ngZone=g(Ce);_document=g(Q$1);_injector=g(oe$1);constructor(){g(En$1).load(ze)}create(t,a=!1){return new Qt(t,this._checker,this._ngZone,this._document,a,this._injector)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function To(n,...e){return e.length?e.some(t=>n[t]):n.altKey||n.shiftKey||n.ctrlKey||n.metaKey}function Go(){return typeof __karma__<`u`&&!!__karma__||typeof jasmine<`u`&&!!jasmine||typeof jest<`u`&&!!jest||typeof Mocha<`u`&&!!Mocha}var Z;var We=[`color`,`button`,`checkbox`,`date`,`datetime-local`,`email`,`file`,`hidden`,`image`,`month`,`number`,`password`,`radio`,`range`,`reset`,`search`,`submit`,`tel`,`text`,`time`,`url`,`week`];function qo(){if(Z)return Z;if(typeof document!=`object`||!document)return Z=new Set(We),Z;let n=document.createElement(`input`);return Z=new Set(We.filter(e=>(n.setAttribute(`type`,e),n.type===e))),Z}var Qn=new C(`MATERIAL_ANIMATIONS`);var qe=null;function Jn(){return g(Qn,{optional:!0})?.animationsDisabled||g(vv,{optional:!0})===`NoopAnimations`?`di-disabled`:(qe??=g(Xt).matchMedia(`(prefers-reduced-motion)`).matches,qe?`reduced-motion`:`enabled`)}function K(){return Jn()!==`enabled`}function or(n){return n==null?``:typeof n==`string`?n:`${n}px`}function lr(n){return n!=null&&`${n}`!=`false`}var y=(function(n){return n[n.FADING_IN=0]=`FADING_IN`,n[n.VISIBLE=1]=`VISIBLE`,n[n.FADING_OUT=2]=`FADING_OUT`,n[n.HIDDEN=3]=`HIDDEN`,n})(y||{});var Jt=class{_renderer;element;config;_animationForciblyDisabledThroughCss;state=y.HIDDEN;constructor(e,t,a,o=!1){this._renderer=e,this.element=t,this.config=a,this._animationForciblyDisabledThroughCss=o}fadeOut(){this._renderer.fadeOutRipple(this)}};var Ze=q({passive:!0,capture:!0});var te=class{_events=new Map;addHandler(e,t,a,o){let r=this._events.get(t);if(r){let s=r.get(a);s?s.add(o):r.set(a,new Set([o]))}else this._events.set(t,new Map([[a,new Set([o])]])),e.runOutsideAngular(()=>{document.addEventListener(t,this._delegateEventHandler,Ze)})}removeHandler(e,t,a){let o=this._events.get(e);if(!o)return;let r=o.get(t);r&&(r.delete(a),r.size===0&&o.delete(t),o.size===0&&(this._events.delete(e),document.removeEventListener(e,this._delegateEventHandler,Ze)))}_delegateEventHandler=e=>{let t=Hn$1(e);t&&this._events.get(e.type)?.forEach((a,o)=>{(o===t||o.contains(t))&&a.forEach(r=>r.handleEvent(e))})}};var dt={enterDuration:225,exitDuration:150};var ta=800;var Ke=q({passive:!0,capture:!0});var Ye=[`mousedown`,`touchstart`];var Xe=[`mouseup`,`mouseleave`,`touchend`,`touchcancel`];var ea=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=Fw({type:n,selectors:[[`ng-component`]],hostAttrs:[`mat-ripple-style-loader`,``],decls:0,vars:0,template:function(a,o){},styles:[`.mat-ripple {
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
`],encapsulation:2})}return n})();var ct=class n{_target;_ngZone;_platform;_containerElement;_triggerElement=null;_isPointerDown=!1;_activeRipples=new Map;_mostRecentTransientRipple=null;_lastTouchStartEvent;_pointerUpEventsRegistered=!1;_containerRect=null;static _eventManager=new te;constructor(e,t,a,o,r){this._target=e,this._ngZone=t,this._platform=o,o.isBrowser&&(this._containerElement=mn$2(a)),r&&r.get(En$1).load(ea)}fadeInRipple(e,t,a={}){let o=this._containerRect=this._containerRect||this._containerElement.getBoundingClientRect(),r=V(V({},dt),a.animation);a.centered&&(e=o.left+o.width/2,t=o.top+o.height/2);let s=a.radius||na(e,t,o),m=e-o.left,V$1=t-o.top,M=r.enterDuration,b=document.createElement(`div`);b.classList.add(`mat-ripple-element`),b.style.left=`${m-s}px`,b.style.top=`${V$1-s}px`,b.style.height=`${s*2}px`,b.style.width=`${s*2}px`,a.color!=null&&(b.style.backgroundColor=a.color),b.style.transitionDuration=`${M}ms`,this._containerElement.appendChild(b);let be=window.getComputedStyle(b),Pn=be.transitionProperty,fe=be.transitionDuration,jt=Pn===`none`||fe===`0s`||fe===`0s, 0s`||o.width===0&&o.height===0,R=new Jt(this,b,a,jt);b.style.transform=`scale3d(1, 1, 1)`,R.state=y.FADING_IN,a.persistent||(this._mostRecentTransientRipple=R);let gt=null;return!jt&&(M||r.exitDuration)&&this._ngZone.runOutsideAngular(()=>{let he=()=>{gt&&(gt.fallbackTimer=null),clearTimeout(ge),this._finishRippleTransition(R)},Ut=()=>this._destroyRipple(R),ge=setTimeout(Ut,M+100);b.addEventListener(`transitionend`,he),b.addEventListener(`transitioncancel`,Ut),gt={onTransitionEnd:he,onTransitionCancel:Ut,fallbackTimer:ge}}),this._activeRipples.set(R,gt),(jt||!M)&&this._finishRippleTransition(R),R}fadeOutRipple(e){if(e.state===y.FADING_OUT||e.state===y.HIDDEN)return;let t=e.element,a=V(V({},dt),e.config.animation);t.style.transitionDuration=`${a.exitDuration}ms`,t.style.opacity=`0`,e.state=y.FADING_OUT,(e._animationForciblyDisabledThroughCss||!a.exitDuration)&&this._finishRippleTransition(e)}fadeOutAll(){this._getActiveRipples().forEach(e=>e.fadeOut())}fadeOutAllNonPersistent(){this._getActiveRipples().forEach(e=>{e.config.persistent||e.fadeOut()})}setupTriggerEvents(e){let t=mn$2(e);!this._platform.isBrowser||!t||t===this._triggerElement||(this._removeTriggerEvents(),this._triggerElement=t,Ye.forEach(a=>{n._eventManager.addHandler(this._ngZone,a,t,this)}))}handleEvent(e){e.type===`mousedown`?this._onMousedown(e):e.type===`touchstart`?this._onTouchStart(e):this._onPointerUp(),this._pointerUpEventsRegistered||(this._ngZone.runOutsideAngular(()=>{Xe.forEach(t=>{this._triggerElement.addEventListener(t,this,Ke)})}),this._pointerUpEventsRegistered=!0)}_finishRippleTransition(e){e.state===y.FADING_IN?this._startFadeOutTransition(e):e.state===y.FADING_OUT&&this._destroyRipple(e)}_startFadeOutTransition(e){let t=e===this._mostRecentTransientRipple,{persistent:a}=e.config;e.state=y.VISIBLE,!a&&(!t||!this._isPointerDown)&&e.fadeOut()}_destroyRipple(e){let t=this._activeRipples.get(e)??null;this._activeRipples.delete(e),this._activeRipples.size||(this._containerRect=null),e===this._mostRecentTransientRipple&&(this._mostRecentTransientRipple=null),e.state=y.HIDDEN,t!==null&&(e.element.removeEventListener(`transitionend`,t.onTransitionEnd),e.element.removeEventListener(`transitioncancel`,t.onTransitionCancel),t.fallbackTimer!==null&&clearTimeout(t.fallbackTimer)),e.element.remove()}_onMousedown(e){let t=Pn(e),a=this._lastTouchStartEvent&&Date.now()<this._lastTouchStartEvent+ta;!this._target.rippleDisabled&&!t&&!a&&(this._isPointerDown=!0,this.fadeInRipple(e.clientX,e.clientY,this._target.rippleConfig))}_onTouchStart(e){if(!this._target.rippleDisabled&&!Ln$1(e)){this._lastTouchStartEvent=Date.now(),this._isPointerDown=!0;let t=e.changedTouches;if(t)for(let a=0;a<t.length;a++)this.fadeInRipple(t[a].clientX,t[a].clientY,this._target.rippleConfig)}}_onPointerUp(){this._isPointerDown&&(this._isPointerDown=!1,this._getActiveRipples().forEach(e=>{let t=e.state===y.VISIBLE||e.config.terminateOnPointerUp&&e.state===y.FADING_IN;!e.config.persistent&&t&&e.fadeOut()}))}_getActiveRipples(){return Array.from(this._activeRipples.keys())}_removeTriggerEvents(){let e=this._triggerElement;e&&(Ye.forEach(t=>n._eventManager.removeHandler(t,e,this)),this._pointerUpEventsRegistered&&(Xe.forEach(t=>e.removeEventListener(t,this,Ke)),this._pointerUpEventsRegistered=!1))}};function na(n,e,t){let a=Math.max(Math.abs(n-t.left),Math.abs(n-t.right)),o=Math.max(Math.abs(e-t.top),Math.abs(e-t.bottom));return Math.sqrt(a*a+o*o)}var ee=new C(`mat-ripple-global-options`);var xr=(()=>{class n{_elementRef=g(mn$1);_animationsDisabled=K();color;unbounded=!1;centered=!1;radius=0;animation;get disabled(){return this._disabled}set disabled(t){t&&this.fadeOutAllNonPersistent(),this._disabled=t,this._setupTriggerEventsIfEnabled()}_disabled=!1;get trigger(){return this._trigger||this._elementRef.nativeElement}set trigger(t){this._trigger=t,this._setupTriggerEventsIfEnabled()}_trigger;_rippleRenderer;_globalOptions;_isInitialized=!1;constructor(){let t=g(Ce),a=g(un$1),o=g(ee,{optional:!0}),r=g(oe$1);this._globalOptions=o||{},this._rippleRenderer=new ct(this,t,this._elementRef,a,r)}ngOnInit(){this._isInitialized=!0,this._setupTriggerEventsIfEnabled()}ngOnDestroy(){this._rippleRenderer._removeTriggerEvents()}fadeOutAll(){this._rippleRenderer.fadeOutAll()}fadeOutAllNonPersistent(){this._rippleRenderer.fadeOutAllNonPersistent()}get rippleConfig(){return{centered:this.centered,radius:this.radius,color:this.color,animation:V(V(V({},this._globalOptions.animation),this._animationsDisabled?{enterDuration:0,exitDuration:0}:{}),this.animation),terminateOnPointerUp:this._globalOptions.terminateOnPointerUp}}get rippleDisabled(){return this.disabled||!!this._globalOptions.disabled}_setupTriggerEventsIfEnabled(){!this.disabled&&this._isInitialized&&this._rippleRenderer.setupTriggerEvents(this.trigger)}launch(t,a=0,o){return typeof t==`number`?this._rippleRenderer.fadeInRipple(t,a,V(V({},this.rippleConfig),o)):this._rippleRenderer.fadeInRipple(0,0,V(V({},this.rippleConfig),t))}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,selectors:[[``,`mat-ripple`,``],[``,`matRipple`,``]],hostAttrs:[1,`mat-ripple`],hostVars:2,hostBindings:function(a,o){a&2&&gg(`mat-ripple-unbounded`,o.unbounded)},inputs:{color:[0,`matRippleColor`,`color`],unbounded:[0,`matRippleUnbounded`,`unbounded`],centered:[0,`matRippleCentered`,`centered`],radius:[0,`matRippleRadius`,`radius`],animation:[0,`matRippleAnimation`,`animation`],disabled:[0,`matRippleDisabled`,`disabled`],trigger:[0,`matRippleTrigger`,`trigger`]},exportAs:[`matRipple`]})}return n})();var aa={capture:!0};var oa=[`focus`,`mousedown`,`mouseenter`,`touchstart`];var ne=`mat-ripple-loader-uninitialized`;var ae=`mat-ripple-loader-class-name`;var Qe=`mat-ripple-loader-centered`;var At=`mat-ripple-loader-disabled`;var Je=(()=>{class n{_document=g(Q$1);_animationsDisabled=K();_globalRippleOptions=g(ee,{optional:!0});_platform=g(un$1);_ngZone=g(Ce);_injector=g(oe$1);_eventCleanups;_hosts=new Map;constructor(){let t=g(oo).createRenderer(null,null);this._eventCleanups=this._ngZone.runOutsideAngular(()=>oa.map(a=>t.listen(this._document,a,this._onInteraction,aa)))}ngOnDestroy(){let t=this._hosts.keys();for(let a of t)this.destroyRipple(a);this._eventCleanups.forEach(a=>a())}configureRipple(t,a){t.setAttribute(ne,this._globalRippleOptions?.namespace??``),(a.className||!t.hasAttribute(ae))&&t.setAttribute(ae,a.className||``),a.centered&&t.setAttribute(Qe,``),a.disabled&&t.setAttribute(At,``)}setDisabled(t,a){let o=this._hosts.get(t);o?(o.target.rippleDisabled=a,!a&&!o.hasSetUpEvents&&(o.hasSetUpEvents=!0,o.renderer.setupTriggerEvents(t))):a?t.setAttribute(At,``):t.removeAttribute(At)}_onInteraction=t=>{let a=Hn$1(t);if(a instanceof HTMLElement){let o=a.closest(`[${ne}="${this._globalRippleOptions?.namespace??``}"]`);o&&this._createRipple(o)}};_createRipple(t){if(!this._document||this._hosts.has(t))return;t.querySelector(`.mat-ripple`)?.remove();let a=this._document.createElement(`span`);a.classList.add(`mat-ripple`,t.getAttribute(ae)),t.append(a);let o=this._globalRippleOptions,r=this._animationsDisabled?0:o?.animation?.enterDuration??dt.enterDuration,s=this._animationsDisabled?0:o?.animation?.exitDuration??dt.exitDuration,m={rippleDisabled:this._animationsDisabled||o?.disabled||t.hasAttribute(At),rippleConfig:{centered:t.hasAttribute(Qe),terminateOnPointerUp:o?.terminateOnPointerUp,animation:{enterDuration:r,exitDuration:s}}},V=new ct(m,this._ngZone,a,this._platform,this._injector),M=!m.rippleDisabled;M&&V.setupTriggerEvents(t),this._hosts.set(t,{target:m,renderer:V,hasSetUpEvents:M}),t.removeAttribute(ne)}destroyRipple(t){let a=this._hosts.get(t);a&&(a.renderer._removeTriggerEvents(),this._hosts.delete(t))}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var tn=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=Fw({type:n,selectors:[[`structural-styles`]],decls:0,vars:0,template:function(a,o){},styles:[`.mat-focus-indicator {
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
`],encapsulation:2})}return n})();var ra=new C(`MAT_BUTTON_CONFIG`);function en(n){return n==null?void 0:gC(n)}var nn=(()=>{class n{_elementRef=g(mn$1);_ngZone=g(Ce);_animationsDisabled=K();_config=g(ra,{optional:!0});_focusMonitor=g(Yt);_cleanupClick;_renderer=g(io);_rippleLoader=g(Je);_isAnchor;_isFab=!1;color;get disableRipple(){return this._disableRipple}set disableRipple(t){this._disableRipple=t,this._updateRippleDisabled()}_disableRipple=!1;get disabled(){return this._disabled}set disabled(t){this._disabled=t,this._updateRippleDisabled()}_disabled=!1;ariaDisabled;disabledInteractive;tabIndex;set _tabindex(t){this.tabIndex=t}showProgress=Mj(!1,{transform:hC});constructor(){g(En$1).load(tn);let t=this._elementRef.nativeElement;this._isAnchor=t.tagName===`A`,this.disabledInteractive=this._config?.disabledInteractive??!1,this.color=this._config?.color??null,this._rippleLoader?.configureRipple(t,{className:`mat-mdc-button-ripple`})}ngAfterViewInit(){this._focusMonitor.monitor(this._elementRef,!0),this._isAnchor&&this._setupAsAnchor()}ngOnDestroy(){this._cleanupClick?.(),this._focusMonitor.stopMonitoring(this._elementRef),this._rippleLoader?.destroyRipple(this._elementRef.nativeElement)}focus(t=`program`,a){t?this._focusMonitor.focusVia(this._elementRef.nativeElement,t,a):this._elementRef.nativeElement.focus(a)}_getAriaDisabled(){return this.ariaDisabled!=null?this.ariaDisabled:this._isAnchor?this.disabled||null:this.disabled&&this.disabledInteractive?!0:null}_getDisabledAttribute(){return this.disabledInteractive||!this.disabled?null:!0}_updateRippleDisabled(){this._rippleLoader?.setDisabled(this._elementRef.nativeElement,this.disableRipple||this.disabled)}_getTabIndex(){return this._isAnchor?this.disabled&&!this.disabledInteractive?-1:this.tabIndex:this.tabIndex}_setupAsAnchor(){this._cleanupClick=this._ngZone.runOutsideAngular(()=>this._renderer.listen(this._elementRef.nativeElement,`click`,t=>{this.disabled&&(t.preventDefault(),t.stopImmediatePropagation())}))}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,hostAttrs:[1,`mat-mdc-button-base`],hostVars:15,hostBindings:function(a,o){a&2&&(Qh(`disabled`,o._getDisabledAttribute())(`aria-disabled`,o._getAriaDisabled())(`tabindex`,o._getTabIndex()),pI(o.color?`mat-`+o.color:``),gg(`mat-mdc-button-progress-indicator-shown`,o.showProgress())(`mat-mdc-button-disabled`,o.disabled)(`mat-mdc-button-disabled-interactive`,o.disabledInteractive)(`mat-unthemed`,!o.color)(`_mat-animation-noopable`,o._animationsDisabled))},inputs:{color:`color`,disableRipple:[2,`disableRipple`,`disableRipple`,hC],disabled:[2,`disabled`,`disabled`,hC],ariaDisabled:[2,`aria-disabled`,`ariaDisabled`,hC],disabledInteractive:[2,`disabledInteractive`,`disabledInteractive`,hC],tabIndex:[2,`tabIndex`,`tabIndex`,en],_tabindex:[2,`tabindex`,`_tabindex`,en],showProgress:[1,`showProgress`]}})}return n})();var an=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[An$1]})}return n})();var on=new Map([[`text`,[`mat-mdc-button`]],[`filled`,[`mdc-button--unelevated`,`mat-mdc-unelevated-button`]],[`elevated`,[`mdc-button--raised`,`mat-mdc-raised-button`]],[`outlined`,[`mdc-button--outlined`,`mat-mdc-outlined-button`]],[`tonal`,[`mat-tonal-button`]]]);var Kr=(()=>{class n extends nn{get appearance(){return this._appearance}set appearance(t){this.setAppearance(t||this._config?.defaultAppearance||`text`)}_appearance=null;constructor(){super();let t=ia(this._elementRef.nativeElement);t&&this.setAppearance(t)}setAppearance(t){if(t===this._appearance)return;let a=this._elementRef.nativeElement.classList,o=this._appearance?on.get(this._appearance):null,r=on.get(t);o&&a.remove(...o),a.add(...r),this._appearance=t}static ɵfac=function(a){return new(a||n)};static ɵcmp=(function(){let t=[[[``,8,`material-icons`,3,`iconPositionEnd`,``],[`mat-icon`,3,`iconPositionEnd`,``],[``,`matButtonIcon`,``,3,`iconPositionEnd`,``],[``,8,`material-symbols-outlined`,3,`iconPositionEnd`,``],[``,8,`material-symbols-rounded`,3,`iconPositionEnd`,``],[``,8,`material-symbols-sharp`,3,`iconPositionEnd`,``]],`*`,[[``,`iconPositionEnd`,``,8,`material-icons`],[`mat-icon`,`iconPositionEnd`,``],[``,`matButtonIcon`,``,`iconPositionEnd`,``],[``,`iconPositionEnd`,``,8,`material-symbols-outlined`],[``,`iconPositionEnd`,``,8,`material-symbols-rounded`],[``,`iconPositionEnd`,``,8,`material-symbols-sharp`]],[[``,`progressIndicator`,``]]],a=[`.material-icons:not([iconPositionEnd]), mat-icon:not([iconPositionEnd]), [matButtonIcon]:not([iconPositionEnd]), .material-symbols-outlined:not([iconPositionEnd]), .material-symbols-rounded:not([iconPositionEnd]), .material-symbols-sharp:not([iconPositionEnd])`,`*`,`.material-icons[iconPositionEnd], mat-icon[iconPositionEnd], [matButtonIcon][iconPositionEnd], .material-symbols-outlined[iconPositionEnd], .material-symbols-rounded[iconPositionEnd], .material-symbols-sharp[iconPositionEnd]`,`[progressIndicator]`];function o(r,s){r&1&&(Uu(0,`div`,2),QE(1,3),$u())}return Fw({type:n,selectors:[[`button`,`matButton`,``],[`a`,`matButton`,``],[`button`,`mat-button`,``],[`button`,`mat-raised-button`,``],[`button`,`mat-flat-button`,``],[`button`,`mat-stroked-button`,``],[`a`,`mat-button`,``],[`a`,`mat-raised-button`,``],[`a`,`mat-flat-button`,``],[`a`,`mat-stroked-button`,``]],hostAttrs:[1,`mdc-button`],inputs:{appearance:[0,`matButton`,`appearance`]},exportAs:[`matButton`,`matAnchor`],features:[Fh],ngContentSelectors:a,decls:8,vars:5,consts:[[1,`mat-mdc-button-persistent-ripple`],[1,`mdc-button__label`],[1,`mat-mdc-button-progress-indicator-container`],[1,`mat-focus-indicator`],[1,`mat-mdc-button-touch-target`]],template:function(s,m){s&1&&(YE(t),eg(0,`span`,0),QE(1),Uu(2,`span`,1),QE(3,1),$u(),QE(4,2),xE(5,o,2,0,`div`,2),eg(6,`span`,3)(7,`span`,4)),s&2&&(gg(`mdc-button__ripple`,!m._isFab)(`mdc-fab__ripple`,m._isFab),sb(5),RE(m.showProgress()?5:-1))},styles:[`.mat-mdc-button-base {
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
`],encapsulation:2})})()}return n})();function ia(n){return n.hasAttribute(`mat-raised-button`)?`elevated`:n.hasAttribute(`mat-stroked-button`)?`outlined`:n.hasAttribute(`mat-flat-button`)?`filled`:n.hasAttribute(`mat-button`)?`text`:null}var Yr=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[an,An$1]})}return n})();var bn=(()=>{class n{_renderer;_elementRef;onChange=t=>{};onTouched=()=>{};constructor(t,a){this._renderer=t,this._elementRef=a}setProperty(t,a){this._renderer.setProperty(this._elementRef.nativeElement,t,a)}registerOnTouched(t){this.onTouched=t}registerOnChange(t){this.onChange=t}setDisabledState(t){this.setProperty(`disabled`,t)}static ɵfac=function(a){return new(a||n)($e$1(io),$e$1(mn$1))};static ɵdir=Fu({type:n})}return n})();var sa=(()=>{class n extends bn{static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,features:[Fh]})}return n})();var fn=new C(``);var la={provide:fn,useExisting:yi$1(()=>hn),multi:!0};function da(){let n=Ss()?Ss().getUserAgent():``;return/android (\d+)/.test(n.toLowerCase())}var ca=new C(``);var hn=(()=>{class n extends bn{_compositionMode;_composing=!1;constructor(t,a,o){super(t,a),this._compositionMode=o,this._compositionMode??=!da()}writeValue(t){let a=t??``;this.setProperty(`value`,a)}_handleInput(t){(!this._compositionMode||this._compositionMode&&!this._composing)&&this.onChange(t)}_compositionStart(){this._composing=!0}_compositionEnd(t){this._composing=!1,this._compositionMode&&this.onChange(t)}static ɵfac=function(a){return new(a||n)($e$1(io),$e$1(mn$1),$e$1(ca,8))};static ɵdir=Fu({type:n,selectors:[[`input`,`formControlName`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`formControlName`,``,3,`ngNoCva`,``],[`input`,`formControl`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`formControl`,``,3,`ngNoCva`,``],[`input`,`ngModel`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`ngModel`,``,3,`ngNoCva`,``],[``,`ngDefaultControl`,``]],hostBindings:function(a,o){a&1&&ig(`input`,function(s){return o._handleInput(s.target.value)})(`blur`,function(){return o.onTouched()})(`compositionstart`,function(){return o._compositionStart()})(`compositionend`,function(s){return o._compositionEnd(s.target.value)})},standalone:!1,features:[OI([la]),Fh]})}return n})();function se(n){return n==null||le(n)===0}function le(n){return n==null?null:Array.isArray(n)||typeof n==`string`?n.length:n instanceof Set?n.size:null}var ht=new C(``);var de=new C(``);var ma=/^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;var oe=class{static min(e){return ua(e)}static max(e){return pa(e)}static required(e){return gn(e)}static requiredTrue(e){return ba(e)}static email(e){return fa(e)}static minLength(e){return ha(e)}static maxLength(e){return vn(e)}static pattern(e){return ga(e)}static nullValidator(e){return wt()}static compose(e){return Sn(e)}static composeAsync(e){return En(e)}};function ua(n){return e=>{if(e.value==null||n==null)return null;let t=parseFloat(e.value);return!isNaN(t)&&t<n?{min:{min:n,actual:e.value}}:null}}function pa(n){return e=>{if(e.value==null||n==null)return null;let t=parseFloat(e.value);return!isNaN(t)&&t>n?{max:{max:n,actual:e.value}}:null}}function gn(n){return se(n.value)?{required:!0}:null}function ba(n){return n.value===!0?null:{required:!0}}function fa(n){return se(n.value)||ma.test(n.value)?null:{email:!0}}function ha(n){return e=>{let t=e.value?.length??le(e.value);return t===null||t===0?null:t<n?{minlength:{requiredLength:n,actualLength:t}}:null}}function vn(n){return e=>{let t=e.value?.length??le(e.value);return t!==null&&t>n?{maxlength:{requiredLength:n,actualLength:t}}:null}}function ga(n){if(!n)return wt;let e,t;return typeof n==`string`?(t=``,n.charAt(0)!==`^`&&(t+=`^`),t+=n,n.charAt(n.length-1)!==`$`&&(t+=`$`),e=new RegExp(t)):(t=n.toString(),e=n),a=>{if(se(a.value))return null;let o=a.value;return e.test(o)?null:{pattern:{requiredPattern:t,actualValue:o}}}}function wt(n){return null}function yn(n){return n!=null}function _n(n){return vs(n)?Xe$1(n):n}function xn(n){let e={};return n.forEach(t=>{e=t!=null?V(V({},e),t):e}),Object.keys(e).length===0?null:e}function Cn(n,e){return e.map(t=>t(n))}function va(n){return!n.validate}function Nn(n){return n.map(e=>va(e)?e:t=>e.validate(t))}function Sn(n){if(!n)return null;let e=n.filter(yn);return e.length==0?null:function(t){return xn(Cn(t,e))}}function ce(n){return n!=null?Sn(Nn(n)):null}function En(n){if(!n)return null;let e=n.filter(yn);return e.length==0?null:function(t){let a=Cn(t,e).map(_n);return fy(a).pipe(z(xn))}}function me(n){return n!=null?En(Nn(n)):null}function rn(n,e){return n===null?[e]:Array.isArray(n)?[...n,e]:[n,e]}function An(n){return n._rawValidators}function Mn(n){return n._rawAsyncValidators}function re(n){return n?Array.isArray(n)?n:[n]:[]}function Dt(n,e){return Array.isArray(n)?n.includes(e):n===e}function sn(n,e){let t=re(e);return re(n).forEach(o=>{Dt(t,o)||t.push(o)}),t}function ln(n,e){return re(e).filter(t=>!Dt(n,t))}var It=class{get value(){return this.control?this.control.value:null}get valid(){return this.control?this.control.valid:null}get invalid(){return this.control?this.control.invalid:null}get pending(){return this.control?this.control.pending:null}get disabled(){return this.control?this.control.disabled:null}get enabled(){return this.control?this.control.enabled:null}get errors(){return this.control?this.control.errors:null}get pristine(){return this.control?this.control.pristine:null}get dirty(){return this.control?this.control.dirty:null}get touched(){return this.control?this.control.touched:null}get status(){return this.control?this.control.status:null}get untouched(){return this.control?this.control.untouched:null}get statusChanges(){return this.control?this.control.statusChanges:null}get valueChanges(){return this.control?this.control.valueChanges:null}get path(){return null}_composedValidatorFn;_composedAsyncValidatorFn;_rawValidators=[];_rawAsyncValidators=[];_setValidators(e){this._rawValidators=e||[],this._composedValidatorFn=ce(this._rawValidators)}_setAsyncValidators(e){this._rawAsyncValidators=e||[],this._composedAsyncValidatorFn=me(this._rawAsyncValidators)}get validator(){return this._composedValidatorFn||null}get asyncValidator(){return this._composedAsyncValidatorFn||null}_onDestroyCallbacks=[];_registerOnDestroy(e){this._onDestroyCallbacks.push(e)}_invokeOnDestroyCallbacks(){this._onDestroyCallbacks.forEach(e=>e()),this._onDestroyCallbacks=[]}reset(e=void 0){this.control?.reset(e)}hasError(e,t){return this.control?this.control.hasError(e,t):!1}getError(e,t){return this.control?this.control.getError(e,t):null}};var O=class extends It{name;get formDirective(){return null}get path(){return null}};var mt=`VALID`;var Mt=`INVALID`;var Y=`PENDING`;var ut=`DISABLED`;var T=class{};var Vt=class extends T{value;source;constructor(e,t){super(),this.value=e,this.source=t}};var bt=class extends T{pristine;source;constructor(e,t){super(),this.pristine=e,this.source=t}};var ft=class extends T{touched;source;constructor(e,t){super(),this.touched=e,this.source=t}};var X=class extends T{status;source;constructor(e,t){super(),this.status=e,this.source=t}};var Ft=class extends T{source;constructor(e){super(),this.source=e}};var Q=class extends T{source;constructor(e){super(),this.source=e}};function wn(n){return(Lt(n)?n.validators:n)||null}function ya(n){return Array.isArray(n)?ce(n):n||null}function Dn(n,e){return(Lt(e)?e.asyncValidators:n)||null}function _a(n){return Array.isArray(n)?me(n):n||null}function Lt(n){return n!=null&&!Array.isArray(n)&&typeof n==`object`}function xa(n,e,t){let a=n.controls;if(!(e?Object.keys(a):a).length)throw new v(1e3,``);if(!In(a,t))throw new v(1001,``)}function Ca(n,e,t){n._forEachChild((a,o)=>{if(t[o]===void 0)throw new v(-1002,``)})}var kt=class{_pendingDirty=!1;_hasOwnPendingAsyncValidator=null;_pendingTouched=!1;_onCollectionChange=()=>{};_updateOn;_hasRequired=ue$1(!1);_parent=null;_asyncValidationSubscription;_composedValidatorFn;_composedAsyncValidatorFn;_rawValidators;_rawAsyncValidators;value;constructor(e,t){this._assignValidators(e),this._assignAsyncValidators(t)}get validator(){return this._composedValidatorFn}set validator(e){this._rawValidators=this._composedValidatorFn=e,this._updateHasRequiredValidator()}get asyncValidator(){return this._composedAsyncValidatorFn}set asyncValidator(e){this._rawAsyncValidators=this._composedAsyncValidatorFn=e}get parent(){return this._parent}get status(){return yo(this.statusReactive)}set status(e){yo(()=>this.statusReactive.set(e))}_status=Ku(()=>this.statusReactive());statusReactive=ue$1(void 0);get valid(){return this.status===mt}get invalid(){return this.status===Mt}get pending(){return this.status===Y}get disabled(){return this.status===ut}get enabled(){return this.status!==ut}errors;get pristine(){return yo(this.pristineReactive)}set pristine(e){yo(()=>this.pristineReactive.set(e))}_pristine=Ku(()=>this.pristineReactive());pristineReactive=ue$1(!0);get dirty(){return!this.pristine}get touched(){return yo(this.touchedReactive)}set touched(e){yo(()=>this.touchedReactive.set(e))}_touched=Ku(()=>this.touchedReactive());touchedReactive=ue$1(!1);get untouched(){return!this.touched}_events=new ne$1;events=this._events.asObservable();valueChanges;statusChanges;get updateOn(){return this._updateOn?this._updateOn:this.parent?this.parent.updateOn:`change`}setValidators(e){this._assignValidators(e)}setAsyncValidators(e){this._assignAsyncValidators(e)}addValidators(e){this.setValidators(sn(e,this._rawValidators))}addAsyncValidators(e){this.setAsyncValidators(sn(e,this._rawAsyncValidators))}removeValidators(e){this.setValidators(ln(e,this._rawValidators))}removeAsyncValidators(e){this.setAsyncValidators(ln(e,this._rawAsyncValidators))}hasValidator(e){return Dt(this._rawValidators,e)}hasAsyncValidator(e){return Dt(this._rawAsyncValidators,e)}clearValidators(){this.validator=null}clearAsyncValidators(){this.asyncValidator=null}markAsTouched(e={}){let t=this.touched===!1;this.touched=!0;let a=e.sourceControl??this;e.onlySelf||this._parent?.markAsTouched(K$1(V({},e),{sourceControl:a})),t&&e.emitEvent!==!1&&this._events.next(new ft(!0,a))}markAllAsDirty(e={}){this.markAsDirty({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:this}),this._forEachChild(t=>t.markAllAsDirty(e))}markAllAsTouched(e={}){this.markAsTouched({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:this}),this._forEachChild(t=>t.markAllAsTouched(e))}markAsUntouched(e={}){let t=this.touched===!0;this.touched=!1,this._pendingTouched=!1;let a=e.sourceControl??this;this._forEachChild(o=>{o.markAsUntouched({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:a})}),e.onlySelf||this._parent?._updateTouched(e,a),t&&e.emitEvent!==!1&&this._events.next(new ft(!1,a))}markAsDirty(e={}){let t=this.pristine===!0;this.pristine=!1;let a=e.sourceControl??this;e.onlySelf||this._parent?.markAsDirty(K$1(V({},e),{sourceControl:a})),t&&e.emitEvent!==!1&&this._events.next(new bt(!1,a))}markAsPristine(e={}){let t=this.pristine===!1;this.pristine=!0,this._pendingDirty=!1;let a=e.sourceControl??this;this._forEachChild(o=>{o.markAsPristine({onlySelf:!0,emitEvent:e.emitEvent})}),e.onlySelf||this._parent?._updatePristine(e,a),t&&e.emitEvent!==!1&&this._events.next(new bt(!0,a))}markAsPending(e={}){this.status=Y;let t=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new X(this.status,t)),this.statusChanges.emit(this.status)),e.onlySelf||this._parent?.markAsPending(K$1(V({},e),{sourceControl:t}))}disable(e={}){let t=this._parentMarkedDirty(e.onlySelf);this.status=ut,this.errors=null,this._forEachChild(o=>{o.disable(K$1(V({},e),{onlySelf:!0}))}),this._updateValue();let a=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new Vt(this.value,a)),this._events.next(new X(this.status,a)),this.valueChanges.emit(this.value),this.statusChanges.emit(this.status)),this._updateAncestors(K$1(V({},e),{skipPristineCheck:t}),this),this._onDisabledChange.forEach(o=>o(!0))}enable(e={}){let t=this._parentMarkedDirty(e.onlySelf);this.status=mt,this._forEachChild(a=>{a.enable(K$1(V({},e),{onlySelf:!0}))}),this.updateValueAndValidity({onlySelf:!0,emitEvent:e.emitEvent}),this._updateAncestors(K$1(V({},e),{skipPristineCheck:t}),this),this._onDisabledChange.forEach(a=>a(!1))}_updateAncestors(e,t){e.onlySelf||(this._parent?.updateValueAndValidity(e),e.skipPristineCheck||this._parent?._updatePristine({},t),this._parent?._updateTouched({},t))}setParent(e){this._parent=e}getRawValue(){return this.value}updateValueAndValidity(e={}){if(this._setInitialStatus(),this._updateValue(),this.enabled){let a=this._cancelExistingSubscription();this.errors=this._runValidator(),this.status=this._calculateStatus(),(this.status===mt||this.status===Y)&&this._runAsyncValidator(a,e.emitEvent)}let t=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new Vt(this.value,t)),this._events.next(new X(this.status,t)),this.valueChanges.emit(this.value),this.statusChanges.emit(this.status)),e.onlySelf||this._parent?.updateValueAndValidity(K$1(V({},e),{sourceControl:t}))}_updateTreeValidity(e={emitEvent:!0}){this._forEachChild(t=>t._updateTreeValidity(e)),this.updateValueAndValidity({onlySelf:!0,emitEvent:e.emitEvent})}_setInitialStatus(){this.status=this._allControlsDisabled()?ut:mt}_runValidator(){return this.validator?this.validator(this):null}_runAsyncValidator(e,t){if(this.asyncValidator){this.status=Y,this._hasOwnPendingAsyncValidator={emitEvent:t!==!1,shouldHaveEmitted:e!==!1};let a=_n(this.asyncValidator(this));this._asyncValidationSubscription=a.subscribe(o=>{this._hasOwnPendingAsyncValidator=null,this.setErrors(o,{emitEvent:t,shouldHaveEmitted:e})})}}_cancelExistingSubscription(){if(this._asyncValidationSubscription){this._asyncValidationSubscription.unsubscribe();let e=(this._hasOwnPendingAsyncValidator?.emitEvent||this._hasOwnPendingAsyncValidator?.shouldHaveEmitted)??!1;return this._hasOwnPendingAsyncValidator=null,e}return!1}setErrors(e,t={}){this.errors=e,this._updateControlsErrors(t.emitEvent!==!1,this,t.shouldHaveEmitted)}get(e){let t=e;return t==null||(Array.isArray(t)||(t=t.split(`.`)),t.length===0)?null:t.reduce((a,o)=>a&&a._find(o),this)}getError(e,t){let a=t?this.get(t):this;return a?.errors?a.errors[e]:null}hasError(e,t){return!!this.getError(e,t)}get root(){let e=this;for(;e._parent;)e=e._parent;return e}_updateControlsErrors(e,t,a){this.status=this._calculateStatus(),e&&this.statusChanges.emit(this.status),(e||a)&&this._events.next(new X(this.status,t)),this._parent&&this._parent._updateControlsErrors(e,t,a)}_initObservables(){this.valueChanges=new tt,this.statusChanges=new tt}_calculateStatus(){return this._allControlsDisabled()?ut:this.errors?Mt:this._hasOwnPendingAsyncValidator||this._anyControlsHaveStatus(Y)?Y:this._anyControlsHaveStatus(Mt)?Mt:mt}_anyControlsHaveStatus(e){return this._anyControls(t=>t.status===e)}_anyControlsDirty(){return this._anyControls(e=>e.dirty)}_anyControlsTouched(){return this._anyControls(e=>e.touched)}_updatePristine(e,t){let a=!this._anyControlsDirty(),o=this.pristine!==a;this.pristine=a,e.onlySelf||this._parent?._updatePristine(e,t),o&&this._events.next(new bt(this.pristine,t))}_updateTouched(e={},t){this.touched=this._anyControlsTouched(),this._events.next(new ft(this.touched,t)),e.onlySelf||this._parent?._updateTouched(e,t)}_onDisabledChange=[];_registerOnCollectionChange(e){this._onCollectionChange=e}_setUpdateStrategy(e){Lt(e)&&e.updateOn!=null&&(this._updateOn=e.updateOn)}_parentMarkedDirty(e){return!e&&!!this._parent?.dirty&&!this._parent._anyControlsDirty()}_find(e){return null}_assignValidators(e){this._rawValidators=Array.isArray(e)?e.slice():e,this._composedValidatorFn=ya(this._rawValidators),this._updateHasRequiredValidator()}_assignAsyncValidators(e){this._rawAsyncValidators=Array.isArray(e)?e.slice():e,this._composedAsyncValidatorFn=_a(this._rawAsyncValidators)}_updateHasRequiredValidator(){yo(()=>this._hasRequired.set(this.hasValidator(oe.required)))}};function In(n,e){return Object.hasOwn(n,e)}function Na(n){return n.tagName===`INPUT`||n.tagName===`SELECT`||n.tagName===`TEXTAREA`}function Sa(n,e,t,a){switch(t){case`name`:n.setAttribute(e,t,a);break;case`disabled`:case`readonly`:case`required`:a?n.setAttribute(e,t,``):n.removeAttribute(e,t);break;case`max`:case`min`:case`minLength`:case`maxLength`:a!==void 0?n.setAttribute(e,t,a.toString()):n.removeAttribute(e,t)}}var ie=class{kind;context;control;message;constructor({kind:e,context:t,control:a}){this.kind=e,this.context=t,this.control=a}};function Ea(n){return typeof n==`number`?n:parseInt(n,10)}var Vn=(()=>{class n{_validator=wt;_onChange;_enabled;ngOnChanges(t){if(this.inputName in t){let a=this.normalizeInput(t[this.inputName].currentValue);this._enabled=this.enabled(a),this._validator=this._enabled?this.createValidator(a):wt,this._onChange?.()}}validate(t){return this._validator(t)}registerOnValidatorChange(t){this._onChange=t}enabled(t){return t!=null}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,features:[nu]})}return n})();var Aa={provide:ht,useExisting:yi$1(()=>Fn),multi:!0};var Fn=(()=>{class n extends Vn{required;inputName=`required`;normalizeInput=hC;createValidator=t=>gn;enabled(t){return t}static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`required`,``,`formControlName`,``,3,`type`,`checkbox`],[``,`required`,``,`formControl`,``,3,`type`,`checkbox`],[``,`required`,``,`ngModel`,``,3,`type`,`checkbox`]],hostVars:1,hostBindings:function(a,o){a&2&&Qh(`required`,o._enabled?``:null)},inputs:{required:`required`},standalone:!1,features:[OI([Aa]),Fh]})}return n})();var Ma={provide:ht,useExisting:yi$1(()=>wa),multi:!0};var wa=(()=>{class n extends Vn{maxlength;inputName=`maxlength`;normalizeInput=t=>Ea(t);createValidator=t=>vn(t);static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`maxlength`,``,`formControlName`,``],[``,`maxlength`,``,`formControl`,``],[``,`maxlength`,``,`ngModel`,``]],hostVars:1,hostBindings:function(a,o){a&2&&Qh(`maxlength`,o._enabled?o.maxlength:null)},inputs:{maxlength:`maxlength`},standalone:!1,features:[OI([Ma]),Fh]})}return n})();var Da=new C(``);var Bt=new C(``,{factory:()=>ue});var ue=`always`;function Ia(n,e){return[...e.path,n]}function dn(n,e,t=ue){pe(n,e),e.valueAccessor.writeValue(n.value),(n.disabled||t===`always`)&&e.valueAccessor.setDisabledState?.(n.disabled),Fa(n,e),Oa(n,e),ka(n,e),Va(n,e)}function cn(n,e,t=!0){let a=()=>{};e?.valueAccessor?.registerOnChange(a),e?.valueAccessor?.registerOnTouched(a),Tt(n,e),n&&(e._invokeOnDestroyCallbacks(),n._registerOnCollectionChange(()=>{}))}function Ot(n,e){n.forEach(t=>{t.registerOnValidatorChange&&t.registerOnValidatorChange(e)})}function Va(n,e){if(e.valueAccessor.setDisabledState){let t=a=>{e.valueAccessor.setDisabledState(a)};n.registerOnDisabledChange(t),e._registerOnDestroy(()=>{n._unregisterOnDisabledChange(t)})}}function pe(n,e){let t=An(n);e.validator!==null?n.setValidators(rn(t,e.validator)):typeof t==`function`&&n.setValidators([t]);let a=Mn(n);e.asyncValidator!==null?n.setAsyncValidators(rn(a,e.asyncValidator)):typeof a==`function`&&n.setAsyncValidators([a]);let o=()=>n.updateValueAndValidity();Ot(e._rawValidators,o),Ot(e._rawAsyncValidators,o)}function Tt(n,e){let t=!1;if(n!==null){if(e.validator!==null){let o=An(n);if(Array.isArray(o)&&o.length>0){let r=o.filter(s=>s!==e.validator);r.length!==o.length&&(t=!0,n.setValidators(r))}}if(e.asyncValidator!==null){let o=Mn(n);if(Array.isArray(o)&&o.length>0){let r=o.filter(s=>s!==e.asyncValidator);r.length!==o.length&&(t=!0,n.setAsyncValidators(r))}}}let a=()=>{};return Ot(e._rawValidators,a),Ot(e._rawAsyncValidators,a),t}function Fa(n,e){e.valueAccessor.registerOnChange(t=>{n._pendingValue=t,n._pendingChange=!0,n._pendingDirty=!0,n.updateOn===`change`&&kn(n,e)})}function ka(n,e){e.valueAccessor.registerOnTouched(()=>{n._pendingTouched=!0,n.updateOn===`blur`&&n._pendingChange&&kn(n,e),n.updateOn!==`submit`&&n.markAsTouched()})}function kn(n,e){n._pendingDirty&&n.markAsDirty(),n.setValue(n._pendingValue,{emitModelToViewChange:!1}),e.viewToModelUpdate(n._pendingValue),n._pendingChange=!1}function Oa(n,e){let t=(a,o)=>{e.valueAccessor.writeValue(a),o&&e.viewToModelUpdate(a)};n.registerOnChange(t),e._registerOnDestroy(()=>{n._unregisterOnChange(t)})}function On(n,e){pe(n,e)}function Ta(n,e){return Tt(n,e)}function Ra(n,e){if(!Object.hasOwn(n,`model`))return!1;let t=n.model;return t.isFirstChange()?!0:!Object.is(e,t.currentValue)}function Pa(n){return Object.getPrototypeOf(n.constructor)===sa}function Tn(n,e){n._syncPendingControls(),e.forEach(t=>{let a=t.control;a.updateOn===`submit`&&a._pendingChange&&(t.viewToModelUpdate(a._pendingValue),a._pendingChange=!1)})}function La(n,e){if(!e)return null;let t,a,o;return e.forEach(r=>{r.constructor===hn?t=r:Pa(r)?a=r:o=r}),o||a||t||null}function Ba(n,e){let t=n.indexOf(e);t>-1&&n.splice(t,1)}var ja={provide:Da,useFactory:()=>{let n=g(J,{self:!0});return{setParseErrors:e=>{n.setParseErrorSource(e)},set onReset(e){n.onReset=e}}}};var J=class extends It{_parent=null;name=null;valueAccessor=null;isCustomControlBased=!1;userOnReset;resetSubscription;set onReset(e){this.userOnReset=e,this.resetSubscription?.unsubscribe(),this.resetSubscription=void 0,this.control&&(this.resetSubscription=this.control.events.subscribe(t=>{t instanceof Q&&this.control&&this.userOnReset?.(this.control.value)}),this.subscription?.add(this.resetSubscription))}isNativeFormElement=!1;rawValueAccessors;_selectedValueAccessor=null;get selectedValueAccessor(){return this._selectedValueAccessor??=La(this,this.rawValueAccessors)}parseErrorsValidator=null;renderer;injector;requiredValidatorViaDi;subscription;customControlBindings=null;constructor(e,t,a){super(),this.injector=e,this.renderer=t,this.rawValueAccessors=a,this.injector?.get(re$1)?.onDestroy(()=>{this.removeParseErrorsValidator(this.control),this.subscription?.unsubscribe()})}setupCustomControl(){this.subscription?.unsubscribe();let e=this.injector?.get(Vg);if(!this.control||!e)return;let t=e.markForCheck.bind(e);this.subscription=new ee$1,this.subscription.add(this.control.valueChanges.subscribe(t)),this.subscription.add(this.control.statusChanges.subscribe(t)),this.resetSubscription?.unsubscribe(),this.resetSubscription=void 0,this.userOnReset&&(this.resetSubscription=this.control.events.subscribe(a=>{a instanceof Q&&this.control&&this.userOnReset?.(this.control.value)}),this.subscription.add(this.resetSubscription)),this.parseErrorsValidator&&this.control.addValidators(this.parseErrorsValidator)}ngControlCreate(e){!e.nativeElement.hasAttribute?.(`ngNoCva`)&&(this.rawValueAccessors&&this.rawValueAccessors.length>0||this.valueAccessor!==null)||!e.customControl||(this.isCustomControlBased=!0,e.listenToCustomControlModel(o=>{this.control?.markAsDirty(),this.control?.setValue(o,{emitModelToViewChange:!1}),this.viewToModelUpdate(o)}),e.listenToCustomControlOutput(`touch`,()=>{this.control?.markAsTouched()}),this.customControlBindings={},this.isNativeFormElement=Na(e.nativeElement),this.requiredValidatorViaDi=this._rawValidators.find(o=>o instanceof Fn))}ngControlUpdate(e,t){if(!this.isCustomControlBased)return;let a=this.control,o=this.customControlBindings;Object.is(o.value,a.value)||(o.value=a.value,e.setCustomControlModelInput(a.value)),this.bindControlProperty(e,o,`touched`,a.touched),this.bindControlProperty(e,o,`dirty`,a.dirty),this.bindControlProperty(e,o,`valid`,a.valid),this.bindControlProperty(e,o,`invalid`,a.invalid),this.bindControlProperty(e,o,`pending`,a.pending),this.bindControlProperty(e,o,`disabled`,a.disabled),this.shouldBindRequired&&this.bindControlProperty(e,o,`required`,this.isRequired);let r=a.errors;if(o.errors!==r){o.errors=r;let s=this._convertErrors(r);e.setInputOnDirectives(`errors`,s)}}get isRequired(){return(this.requiredValidatorViaDi?._enabled||this.control?._hasRequired())??!1}get shouldBindRequired(){return!0}bindControlProperty(e,t,a,o){if(t[a]===o)return;t[a]=o;let r=e.setInputOnDirectives(a,o);this.isNativeFormElement&&!r&&(a===`disabled`||a===`required`)&&this.renderer&&Sa(this.renderer,e.nativeElement,a,o)}_convertErrors(e){if(e===null)return[];let t=this.control;return Object.entries(e).map(([a,o])=>new ie({context:o,kind:a,control:t}))}setParseErrorSource(e){if(e===void 0)return;let t=null,a=Ku(()=>{let o=e();return o.length===0?null:o.reduce((r,s)=>(r[s.kind]=s,r),{})});this.parseErrorsValidator=(()=>t).bind(this),Hi(()=>{t=a(),this.control?.updateValueAndValidity({emitEvent:!1})},{injector:this.injector})}removeParseErrorsValidator(e){this.parseErrorsValidator&&(e?.removeValidators(this.parseErrorsValidator),e?.updateValueAndValidity({emitEvent:!1}))}};var Rt=class{_cd;constructor(e){this._cd=e}get isTouched(){return this._cd?.control?._touched?.(),!!this._cd?.control?.touched}get isUntouched(){return!!this._cd?.control?.untouched}get isPristine(){return this._cd?.control?._pristine?.(),!!this._cd?.control?.pristine}get isDirty(){return!!this._cd?.control?.dirty}get isValid(){return this._cd?.control?._status?.(),!!this._cd?.control?.valid}get isInvalid(){return!!this._cd?.control?.invalid}get isPending(){return!!this._cd?.control?.pending}get isSubmitted(){return this._cd?._submitted?.(),!!this._cd?.submitted}};var hi=(()=>{class n extends Rt{constructor(t){super(t)}static ɵfac=function(a){return new(a||n)($e$1(J,2))};static ɵdir=Fu({type:n,selectors:[[``,`formControlName`,``],[``,`ngModel`,``],[``,`formControl`,``]],hostVars:14,hostBindings:function(a,o){a&2&&gg(`ng-untouched`,o.isUntouched)(`ng-touched`,o.isTouched)(`ng-pristine`,o.isPristine)(`ng-dirty`,o.isDirty)(`ng-valid`,o.isValid)(`ng-invalid`,o.isInvalid)(`ng-pending`,o.isPending)},standalone:!1,features:[Fh]})}return n})();var gi=(()=>{class n extends Rt{constructor(t){super(t)}static ɵfac=function(a){return new(a||n)($e$1(O,10))};static ɵdir=Fu({type:n,selectors:[[``,`formGroupName`,``],[``,`formArrayName`,``],[``,`ngModelGroup`,``],[``,`formGroup`,``],[``,`formArray`,``],[`form`,3,`ngNoForm`,``],[``,`ngForm`,``]],hostVars:16,hostBindings:function(a,o){a&2&&gg(`ng-untouched`,o.isUntouched)(`ng-touched`,o.isTouched)(`ng-pristine`,o.isPristine)(`ng-dirty`,o.isDirty)(`ng-valid`,o.isValid)(`ng-invalid`,o.isInvalid)(`ng-pending`,o.isPending)(`ng-submitted`,o.isSubmitted)},standalone:!1,features:[Fh]})}return n})();var Pt=class extends kt{constructor(e,t,a){super(wn(t),Dn(a,t)),this.controls=e,this._initObservables(),this._setUpdateStrategy(t),this._setUpControls(),this.updateValueAndValidity({onlySelf:!0,emitEvent:!!this.asyncValidator})}controls;registerControl(e,t){return this._find(e)||(this.controls[e]=t,t.setParent(this),t._registerOnCollectionChange(this._onCollectionChange),t)}addControl(e,t,a={}){this.registerControl(e,t),this.updateValueAndValidity({emitEvent:a.emitEvent}),this._onCollectionChange()}removeControl(e,t={}){let a=this._find(e);a&&a._registerOnCollectionChange(()=>{}),delete this.controls[e],this.updateValueAndValidity({emitEvent:t.emitEvent}),this._onCollectionChange()}setControl(e,t,a={}){let o=this._find(e);o&&o._registerOnCollectionChange(()=>{}),delete this.controls[e],t&&this.registerControl(e,t),this.updateValueAndValidity({emitEvent:a.emitEvent}),this._onCollectionChange()}contains(e){return this._find(e)?.enabled===!0}setValue(e,t={}){yo(()=>{Ca(this,!0,e),Object.keys(e).forEach(a=>{xa(this,!0,a),this.controls[a].setValue(e[a],{onlySelf:!0,emitEvent:t.emitEvent})}),this.updateValueAndValidity(t)})}patchValue(e,t={}){e!=null&&(Object.keys(e).forEach(a=>{let o=this._find(a);o&&o.patchValue(e[a],{onlySelf:!0,emitEvent:t.emitEvent})}),this.updateValueAndValidity(t))}reset(e={},t={}){this._forEachChild((a,o)=>{a.reset(e?e[o]:null,K$1(V({},t),{onlySelf:!0}))}),this._updatePristine(t,this),this._updateTouched(t,this),this.updateValueAndValidity(t),t?.emitEvent!==!1&&this._events.next(new Q(this))}getRawValue(){return this._reduceChildren({},(e,t,a)=>(e[a]=t.getRawValue(),e))}_syncPendingControls(){let e=this._reduceChildren(!1,(t,a)=>a._syncPendingControls()?!0:t);return e&&this.updateValueAndValidity({onlySelf:!0}),e}_forEachChild(e){Object.keys(this.controls).forEach(t=>{let a=this.controls[t];a&&e(a,t)})}_setUpControls(){this._forEachChild(e=>{e.setParent(this),e._registerOnCollectionChange(this._onCollectionChange)})}_updateValue(){this.value=this._reduceValue()}_anyControls(e){for(let[t,a]of Object.entries(this.controls))if(this.contains(t)&&e(a))return!0;return!1}_reduceValue(){return this._reduceChildren({},(t,a,o)=>((a.enabled||this.disabled)&&(t[o]=a.value),t))}_reduceChildren(e,t){let a=e;return this._forEachChild((o,r)=>{a=t(a,o,r)}),a}_allControlsDisabled(){for(let e of Object.keys(this.controls))if(this.controls[e].enabled)return!1;return Object.keys(this.controls).length>0||this.disabled}_find(e){return In(this.controls,e)?this.controls[e]:null}};var Ua={provide:O,useExisting:yi$1(()=>za)};var pt=Promise.resolve();var za=(()=>{class n extends O{callSetDisabledState;get submitted(){return yo(this.submittedReactive)}_submitted=Ku(()=>this.submittedReactive());submittedReactive=ue$1(!1);_directives=new Set;form;ngSubmit=new tt;options;constructor(t,a,o){super(),this.callSetDisabledState=o,this.form=new Pt({},ce(t),me(a))}ngAfterViewInit(){this._setUpdateStrategy()}get formDirective(){return this}get control(){return this.form}get path(){return[]}get controls(){return this.form.controls}addControl(t){pt.then(()=>{t.control=this._findContainer(t.path).registerControl(t.name,t.control),t._setupWithForm(this.callSetDisabledState),t.control.updateValueAndValidity({emitEvent:!1}),this._directives.add(t)})}getControl(t){return this.form.get(t.path)}removeControl(t){pt.then(()=>{this._findContainer(t.path)?.removeControl(t.name),this._directives.delete(t)})}addFormGroup(t){pt.then(()=>{let a=this._findContainer(t.path),o=new Pt({});On(o,t),a.registerControl(t.name,o),o.updateValueAndValidity({emitEvent:!1})})}removeFormGroup(t){pt.then(()=>{this._findContainer(t.path)?.removeControl?.(t.name)})}getFormGroup(t){return this.form.get(t.path)}updateModel(t,a){pt.then(()=>{this.form.get(t.path).setValue(a)})}setValue(t){this.control.setValue(t)}onSubmit(t){return this.submittedReactive.set(!0),Tn(this.form,this._directives),this.ngSubmit.emit(t),this.form._events.next(new Ft(this.control)),t?.target?.method===`dialog`}onReset(){this.resetForm()}resetForm(t=void 0){this.form.reset(t),this.submittedReactive.set(!1)}_setUpdateStrategy(){this.options&&this.options.updateOn!=null&&(this.form._updateOn=this.options.updateOn)}_findContainer(t){return t.pop(),t.length?this.form.get(t):this.form}static ɵfac=function(a){return new(a||n)($e$1(ht,10),$e$1(de,10),$e$1(Bt,8))};static ɵdir=Fu({type:n,selectors:[[`form`,3,`ngNoForm`,``,3,`formGroup`,``,3,`formArray`,``],[`ng-form`],[``,`ngForm`,``]],hostBindings:function(a,o){a&1&&ig(`submit`,function(s){return o.onSubmit(s)})(`reset`,function(){return o.onReset()})},inputs:{options:[0,`ngFormOptions`,`options`]},outputs:{ngSubmit:`ngSubmit`},exportAs:[`ngForm`],standalone:!1,features:[OI([Ua]),Fh]})}return n})();function mn(n,e){let t=n.indexOf(e);t>-1&&n.splice(t,1)}function un(n){return typeof n==`object`&&n!==null&&Object.keys(n).length===2&&`value`in n&&`disabled`in n}var Rn=class extends kt{defaultValue=null;_onChange=[];_pendingValue;_pendingChange=!1;constructor(e=null,t,a){super(wn(t),Dn(a,t)),this._applyFormState(e),this._setUpdateStrategy(t),this._initObservables(),this.updateValueAndValidity({onlySelf:!0,emitEvent:!!this.asyncValidator}),Lt(t)&&(t.nonNullable||t.initialValueIsDefault)&&(un(e)?this.defaultValue=e.value:this.defaultValue=e)}setValue(e,t={}){yo(()=>{this.value=this._pendingValue=e,this._onChange.length&&t.emitModelToViewChange!==!1&&this._onChange.forEach(a=>a(this.value,t.emitViewToModelChange!==!1)),this.updateValueAndValidity(t)})}patchValue(e,t={}){this.setValue(e,t)}reset(e=this.defaultValue,t={}){this._applyFormState(e),this.markAsPristine(t),this.markAsUntouched(t),this.setValue(this.value,t),t.overwriteDefaultValue&&(this.defaultValue=this.value),this._pendingChange=!1,t?.emitEvent!==!1&&this._events.next(new Q(this))}_updateValue(){}_anyControls(e){return!1}_allControlsDisabled(){return this.disabled}registerOnChange(e){this._onChange.push(e)}_unregisterOnChange(e){mn(this._onChange,e)}registerOnDisabledChange(e){this._onDisabledChange.push(e)}_unregisterOnDisabledChange(e){mn(this._onDisabledChange,e)}_forEachChild(e){}_syncPendingControls(){return this.updateOn===`submit`&&(this._pendingDirty&&this.markAsDirty(),this._pendingTouched&&this.markAsTouched(),this._pendingChange)?(this.setValue(this._pendingValue,{onlySelf:!0,emitModelToViewChange:!1}),!0):!1}_applyFormState(e){un(e)?(this.value=this._pendingValue=e.value,e.disabled?this.disable({onlySelf:!0,emitEvent:!1}):this.enable({onlySelf:!0,emitEvent:!1})):this.value=this._pendingValue=e}};var Ga=n=>n instanceof Rn;var Ha=(()=>{class n extends O{callSetDisabledState;get submitted(){return yo(this._submittedReactive)}set submitted(t){this._submittedReactive.set(t)}_submitted=Ku(()=>this._submittedReactive());_submittedReactive=ue$1(!1);_oldForm;_onCollectionChange=()=>this._updateDomValue();directives=[];constructor(t,a,o){super(),this.callSetDisabledState=o,this._setValidators(t),this._setAsyncValidators(a)}ngOnChanges(t){this.onChanges(t)}ngOnDestroy(){this.onDestroy()}onChanges(t){if(!this.form)throw new v(1052,!1);Object.hasOwn(t,`form`)&&(this._updateValidators(),this._updateDomValue(),this._updateRegistrations(),this._oldForm=this.form)}onDestroy(){this.form&&(Tt(this.form,this),this.form._onCollectionChange===this._onCollectionChange&&this.form._registerOnCollectionChange(()=>{}))}get formDirective(){return this}get path(){return[]}addControl(t){let a=this.form.get(t.path);return t._setupWithForm(a,this.callSetDisabledState),a.updateValueAndValidity({emitEvent:!1}),this.directives.push(t),a}getControl(t){return this.form.get(t.path)}removeControl(t){cn(t.control||null,t,!1),Ba(this.directives,t)}addFormGroup(t){this._setUpFormContainer(t)}removeFormGroup(t){this._cleanUpFormContainer(t)}getFormGroup(t){return this.form.get(t.path)}getFormArray(t){return this.form.get(t.path)}addFormArray(t){this._setUpFormContainer(t)}removeFormArray(t){this._cleanUpFormContainer(t)}updateModel(t,a){this.form.get(t.path).setValue(a)}onReset(){this.resetForm()}resetForm(t=void 0,a={}){this.form.reset(t,a),this._submittedReactive.set(!1)}onSubmit(t){return this.submitted=!0,Tn(this.form,this.directives),this.ngSubmit.emit(t),this.form._events.next(new Ft(this.control)),t?.target?.method===`dialog`}_updateDomValue(){this.directives.forEach(t=>{let a=t.control,o=this.form.get(t.path);a!==o&&(cn(a||null,t),Ga(o)&&t._setupWithForm(o,this.callSetDisabledState))}),this.form._updateTreeValidity({emitEvent:!1})}_setUpFormContainer(t){let a=this.form.get(t.path);On(a,t),a.updateValueAndValidity({emitEvent:!1})}_cleanUpFormContainer(t){let a=this.form?.get(t.path);a&&Ta(a,t)&&a.updateValueAndValidity({emitEvent:!1})}_updateRegistrations(){this.form._registerOnCollectionChange(this._onCollectionChange),this._oldForm?._registerOnCollectionChange(()=>{})}_updateValidators(){pe(this.form,this),this._oldForm&&Tt(this._oldForm,this)}static ɵfac=function(a){return new(a||n)($e$1(ht,10),$e$1(de,10),$e$1(Bt,8))};static ɵdir=Fu({type:n,features:[Fh,nu]})}return n})();var $a={provide:O,useExisting:yi$1(()=>Wa)};var Wa=(()=>{class n extends Ha{form=null;ngSubmit=new tt;get control(){return this.form}static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`formGroup`,``]],hostBindings:function(a,o){a&1&&ig(`submit`,function(s){return o.onSubmit(s)})(`reset`,function(){return o.onReset()})},inputs:{form:[0,`formGroup`,`form`]},outputs:{ngSubmit:`ngSubmit`},exportAs:[`ngForm`],standalone:!1,features:[OI([$a]),Fh]})}return n})();var qa={provide:J,useExisting:yi$1(()=>Za)};var pn=Promise.resolve();var Za=(()=>{class n extends J{_changeDetectorRef;callSetDisabledState;control=new Rn;static ngAcceptInputType_isDisabled;_registered=!1;_ngModelInjector;viewModel;name=``;isDisabled;model;options;update=new tt;constructor(t,a,o,r,s,m,V,M){super(V,M,r),this._changeDetectorRef=s,this.callSetDisabledState=m,this._parent=t,this._setValidators(a),this._setAsyncValidators(o)}ngOnChanges(t){if(this._registered,this._checkForErrors(),!this._registered||`name`in t){if(this._registered&&(this._checkName(),this.formDirective)){let a=t.name.previousValue;this.formDirective.removeControl({name:a,path:this._getPath(a)})}this._setUpControl()}`isDisabled`in t&&this._updateDisabled(t),Ra(t,this.viewModel)&&(this._updateValue(this.model),this.viewModel=this.model)}ngOnDestroy(){this.formDirective?.removeControl(this)}ɵngControlCreate(t){super.ngControlCreate(t)}ɵngControlUpdate(t){super.ngControlUpdate(t,!1)}get shouldBindRequired(){return!1}get path(){return this._getPath(this.name)}get formDirective(){return this._parent?this._parent.formDirective:null}viewToModelUpdate(t){this.viewModel=t,this.update.emit(t)}_setUpControl(){this._setUpdateStrategy(),this._isStandalone()?this._setUpStandalone():this.formDirective.addControl(this),this._registered=!0}_setUpdateStrategy(){this.options&&this.options.updateOn!=null&&(this.control._updateOn=this.options.updateOn)}_isStandalone(){return!this._parent||!!(this.options&&this.options.standalone)}_setUpStandalone(){this.isCustomControlBased?this.setupCustomControl():(this.valueAccessor??=this.selectedValueAccessor,dn(this.control,this,this.callSetDisabledState)),this.control.updateValueAndValidity({emitEvent:!1})}_setupWithForm(t){this.isCustomControlBased?this.setupCustomControl():(this.valueAccessor??=this.selectedValueAccessor,dn(this.control,this,t))}_checkForErrors(){this._checkName()}_checkName(){this.options&&this.options.name&&(this.name=this.options.name),!this._isStandalone()&&this.name}_updateValue(t){pn.then(()=>{this.control.setValue(t,{emitViewToModelChange:!1}),this._changeDetectorRef?.markForCheck()})}_updateDisabled(t){let a=t.isDisabled.currentValue,o=a!==0&&hC(a);pn.then(()=>{o&&!this.control.disabled?this.control.disable():!o&&this.control.disabled&&this.control.enable(),this._changeDetectorRef?.markForCheck()})}_getPath(t){return this._parent?Ia(t,this._parent):[t]}static ɵfac=function(a){return new(a||n)($e$1(O,9),$e$1(ht,10),$e$1(de,10),$e$1(fn,10),$e$1(Vg,8),$e$1(Bt,8),$e$1(oe$1,8),$e$1(io,8))};static ɵdir=Fu({type:n,selectors:[[``,`ngModel`,``,3,`formControlName`,``,3,`formControl`,``]],inputs:{name:`name`,isDisabled:[0,`disabled`,`isDisabled`],model:[0,`ngModel`,`model`],options:[0,`ngModelOptions`,`options`]},outputs:{update:`ngModelChange`},exportAs:[`ngModel`],standalone:!1,features:[OI([qa,ja]),Fh,nu,Uw(null)]})}return n})();var yi=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,selectors:[[`form`,3,`ngNoForm`,``,3,`ngNativeValidate`,``]],hostAttrs:[`novalidate`,``],standalone:!1})}return n})();var Ka=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({})}return n})();var _i=(()=>{class n{static withConfig(t){return{ngModule:n,providers:[{provide:Bt,useValue:t.callSetDisabledState??ue}]}}static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[Ka]})}return n})();export{tn as C,za as D,yi as E,qo as S,xr as T,ht as _,Kr as a,oe as b,Wa as c,Za as d,_i as f,hn as g,hi as h,K as i,Yr as l,gi as m,Go as n,To as o,fn as p,J as r,Un as s,Co as t,Yt as u,ko as v,wa as w,or as x,lr as y};