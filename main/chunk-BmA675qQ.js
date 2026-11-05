import{An as gg,B as Hi,Ct as Qh,Dn as g,Dr as ue$1,En as fy,Et as Rt$1,Ft as UD,Gr as yi,In as ig,J as JE,K as Ir,Kr as yo,Ln as io$1,Mn as hI,Nr as vi,On as gC,Ot as Ss,Pr as vs,Q as K$1,Qn as mn$1,Rt as Uu,St as QE,Tn as et$1,Un as jw,Ur as xy,Vr as xE,Vt as Vg,Xr as ze$1,Yn as mC,Z as Jo,_t as PI,ar as nt$1,at as Lu,bn as ee$1,bt as Pj,cr as of,d as C,dr as pp,ft as OE,i as $w,j as Fu,jn as go,k as Fh,kr as v,lr as oo$1,nr as ne$1,on as ab,or as nu,p as Ce,qr as z,r as $u,sr as oe$1,t as $l,tt as Ku,vr as re$1,xn as eg,xt as Q$1,y as Dv,yn as ea$1,zt as V}from"./chunk-CyLWqbZG.js";import{A as un$1,C as Pn$1,D as mn$2,M as xn$1,S as Ln$1,_ as An$1,x as Hn$1,y as En$1}from"./main-BPCPYJJR.js";var ct;function je(){if(ct==null&&typeof window<`u`)try{window.addEventListener(`test`,null,Object.defineProperty({},"passive",{get:()=>ct=!0}))}finally{ct=ct||!1}return ct}function X(n){return je()?n:!!n.capture}var Ue=new C(`cdk-input-modality-detector-options`);var ze={ignoreKeys:[18,17,224,91,16]};var Ge=650;var Jt={passive:!0,capture:!0};var He=(()=>{class n{_platform=g(un$1);_listenerCleanups;modalityDetected;modalityChanged;get mostRecentModality(){return this._modality.value}_mostRecentTarget=null;_modality=new Ir(null);_options;_lastTouchMs=0;_onKeydown=t=>{this._options?.ignoreKeys?.some(a=>a===t.keyCode)||(this._modality.next(`keyboard`),this._mostRecentTarget=Hn$1(t))};_onMousedown=t=>{Date.now()-this._lastTouchMs<Ge||(this._modality.next(Pn$1(t)?`keyboard`:`mouse`),this._mostRecentTarget=Hn$1(t))};_onTouchstart=t=>{if(Ln$1(t)){this._modality.next(`keyboard`);return}this._lastTouchMs=Date.now(),this._modality.next(`touch`),this._mostRecentTarget=Hn$1(t)};constructor(){let t=g(Ce),a=g(Q$1),o=g(Ue,{optional:!0});if(this._options=V(V({},ze),o),this.modalityDetected=this._modality.pipe(xy(1)),this.modalityChanged=this.modalityDetected.pipe(Jo()),this._platform.isBrowser){let r=g(oo$1).createRenderer(null,null);this._listenerCleanups=t.runOutsideAngular(()=>[r.listen(a,`keydown`,this._onKeydown,Jt),r.listen(a,`mousedown`,this._onMousedown,Jt),r.listen(a,`touchstart`,this._onTouchstart,Jt)])}}ngOnDestroy(){this._modality.complete(),this._listenerCleanups?.forEach(t=>t())}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var mt=(function(n){return n[n.IMMEDIATE=0]=`IMMEDIATE`,n[n.EVENTUAL=1]=`EVENTUAL`,n})(mt||{});var $e=new C(`cdk-focus-monitor-default-options`);var Mt=X({passive:!0,capture:!0});var te=(()=>{class n{_ngZone=g(Ce);_platform=g(un$1);_inputModalityDetector=g(He);_origin=null;_lastFocusOrigin=null;_windowFocused=!1;_windowFocusTimeoutId;_originTimeoutId;_originFromTouchInteraction=!1;_elementInfo=new Map;_monitoredElementCount=0;_rootNodeFocusListenerCount=new Map;_detectionMode;_windowFocusListener=()=>{this._windowFocused=!0,this._windowFocusTimeoutId=setTimeout(()=>this._windowFocused=!1)};_document=g(Q$1);_stopInputModalityDetector=new ne$1;constructor(){let t=g($e,{optional:!0});this._detectionMode=t?.detectionMode||mt.IMMEDIATE}_rootNodeFocusAndBlurListener=t=>{let a=Hn$1(t);for(let o=a;o;o=o.parentElement)t.type===`focus`?this._onFocus(t,o):this._onBlur(t,o)};monitor(t,a=!1){let o=mn$2(t);if(!this._platform.isBrowser||o.nodeType!==1)return ea$1();let r=xn$1(o)||this._document,i=this._elementInfo.get(o);if(i)return a&&(i.checkChildren=!0),i.subject;let m={checkChildren:a,subject:new ne$1,rootNode:r};return this._elementInfo.set(o,m),this._registerGlobalListeners(m),m.subject}stopMonitoring(t){let a=mn$2(t),o=this._elementInfo.get(a);o&&(o.subject.complete(),this._setClasses(a),this._elementInfo.delete(a),this._removeGlobalListeners(o))}focusVia(t,a,o){let r=mn$2(t);r===this._document.activeElement?this._getClosestElementsInfo(r).forEach(([m,b])=>this._originChanged(m,a,b)):(this._setOrigin(a),typeof r.focus==`function`&&r.focus(o))}ngOnDestroy(){this._elementInfo.forEach((t,a)=>this.stopMonitoring(a))}_getWindow(){return this._document.defaultView||window}_getFocusOrigin(t){return this._origin?this._originFromTouchInteraction?this._shouldBeAttributedToTouch(t)?`touch`:`program`:this._origin:this._windowFocused&&this._lastFocusOrigin?this._lastFocusOrigin:t&&this._isLastInteractionFromInputLabel(t)?`mouse`:`program`}_shouldBeAttributedToTouch(t){return this._detectionMode===mt.EVENTUAL||!!t?.contains(this._inputModalityDetector._mostRecentTarget)}_setClasses(t,a){t.classList.toggle(`cdk-focused`,!!a),t.classList.toggle(`cdk-touch-focused`,a===`touch`),t.classList.toggle(`cdk-keyboard-focused`,a===`keyboard`),t.classList.toggle(`cdk-mouse-focused`,a===`mouse`),t.classList.toggle(`cdk-program-focused`,a===`program`)}_setOrigin(t,a=!1){this._ngZone.runOutsideAngular(()=>{if(this._origin=t,this._originFromTouchInteraction=t===`touch`&&a,this._detectionMode===mt.IMMEDIATE){clearTimeout(this._originTimeoutId);let o=this._originFromTouchInteraction?Ge:1;this._originTimeoutId=setTimeout(()=>this._origin=null,o)}})}_onFocus(t,a){let o=this._elementInfo.get(a),r=Hn$1(t);!o||!o.checkChildren&&a!==r||this._originChanged(a,this._getFocusOrigin(r),o)}_onBlur(t,a){let o=this._elementInfo.get(a);!o||o.checkChildren&&t.relatedTarget instanceof Node&&a.contains(t.relatedTarget)||(this._setClasses(a),this._emitOrigin(o,null))}_emitOrigin(t,a){t.subject.observers.length&&this._ngZone.run(()=>t.subject.next(a))}_registerGlobalListeners(t){if(!this._platform.isBrowser)return;let a=t.rootNode,o=this._rootNodeFocusListenerCount.get(a)||0;o||this._ngZone.runOutsideAngular(()=>{a.addEventListener(`focus`,this._rootNodeFocusAndBlurListener,Mt),a.addEventListener(`blur`,this._rootNodeFocusAndBlurListener,Mt)}),this._rootNodeFocusListenerCount.set(a,o+1),++this._monitoredElementCount===1&&(this._ngZone.runOutsideAngular(()=>{this._getWindow().addEventListener(`focus`,this._windowFocusListener)}),this._inputModalityDetector.modalityDetected.pipe($l(this._stopInputModalityDetector)).subscribe(r=>{this._setOrigin(r,!0)}))}_removeGlobalListeners(t){let a=t.rootNode;if(this._rootNodeFocusListenerCount.has(a)){let o=this._rootNodeFocusListenerCount.get(a);o>1?this._rootNodeFocusListenerCount.set(a,o-1):(a.removeEventListener(`focus`,this._rootNodeFocusAndBlurListener,Mt),a.removeEventListener(`blur`,this._rootNodeFocusAndBlurListener,Mt),this._rootNodeFocusListenerCount.delete(a))}--this._monitoredElementCount||(this._getWindow().removeEventListener(`focus`,this._windowFocusListener),this._stopInputModalityDetector.next(),clearTimeout(this._windowFocusTimeoutId),clearTimeout(this._originTimeoutId))}_originChanged(t,a,o){this._setClasses(t,a),this._emitOrigin(o,a),this._lastFocusOrigin=a}_getClosestElementsInfo(t){let a=[];return this._elementInfo.forEach((o,r)=>{(r===t||o.checkChildren&&r.contains(t))&&a.push([r,o])}),a}_isLastInteractionFromInputLabel(t){let{_mostRecentTarget:a,mostRecentModality:o}=this._inputModalityDetector;if(o!==`mouse`||!a||a===t||t.nodeName!==`INPUT`&&t.nodeName!==`TEXTAREA`||t.disabled)return!1;let r=t.labels;if(r){for(let i=0;i<r.length;i++)if(r[i].contains(a))return!0}return!1}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var We=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=jw({type:n,selectors:[[`ng-component`]],exportAs:[`cdkVisuallyHidden`],decls:0,vars:0,template:function(a,o){},styles:[`.cdk-visually-hidden {
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
`],encapsulation:2})}return n})();var qe=new Set;var Z;var ee=(()=>{class n{_platform=g(un$1);_nonce=g(of,{optional:!0});_matchMedia;constructor(){this._matchMedia=this._platform.isBrowser&&window.matchMedia?window.matchMedia.bind(window):Zn}matchMedia(t){return(this._platform.WEBKIT||this._platform.BLINK)&&qn(t,this._nonce),this._matchMedia(t)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function qn(n,e){if(!qe.has(n))try{Z||(Z=document.createElement(`style`),e&&Z.setAttribute(`nonce`,e),Z.setAttribute(`type`,`text/css`),document.head.appendChild(Z)),Z.sheet&&(Z.sheet.insertRule(`@media ${n.replace(/[{}]/g,``)} {body{ }}`,0),qe.add(n))}catch(t){console.error(t)}}function Zn(n){return{matches:n===`all`||n===``,media:n,addListener:()=>{},removeListener:()=>{}}}var Kn=(()=>{class n{create(t){return typeof MutationObserver>`u`?null:new MutationObserver(t)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var Lo=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({providers:[Kn]})}return n})();var Yn=(()=>{class n{_platform=g(un$1);isDisabled(t){return t.hasAttribute(`disabled`)}isVisible(t){return Qn(t)&&getComputedStyle(t).visibility===`visible`}isTabbable(t){if(!this._platform.isBrowser)return!1;let a=Xn(ia(t));if(a&&(Ze(a)===-1||!this.isVisible(a)))return!1;let o=t.nodeName.toLowerCase(),r=Ze(t);return t.hasAttribute(`contenteditable`)?r!==-1:o===`iframe`||o===`object`||this._platform.WEBKIT&&this._platform.IOS&&!oa(t)?!1:o===`audio`?t.hasAttribute(`controls`)?r!==-1:!1:o===`video`?r===-1?!1:r!==null?!0:this._platform.FIREFOX||t.hasAttribute(`controls`):t.tabIndex>=0}isFocusable(t,a){return ra(t)&&!this.isDisabled(t)&&(a?.ignoreInert||!t.closest?.(`[inert]`))&&(a?.ignoreVisibility||this.isVisible(t))}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function Xn(n){try{return n.frameElement}catch{return null}}function Qn(n){return!!(n.offsetWidth||n.offsetHeight||typeof n.getClientRects==`function`&&n.getClientRects().length)}function Jn(n){let e=n.nodeName.toLowerCase();return e===`input`||e===`select`||e===`button`||e===`textarea`}function ta(n){return na(n)&&n.type==`hidden`}function ea(n){return aa(n)&&n.hasAttribute(`href`)}function na(n){return n.nodeName.toLowerCase()==`input`}function aa(n){return n.nodeName.toLowerCase()==`a`}function Ke(n){if(!n.hasAttribute(`tabindex`)||n.tabIndex===void 0)return!1;let e=n.getAttribute(`tabindex`);return!!(e&&!isNaN(parseInt(e,10)))}function Ze(n){if(!Ke(n))return null;let e=parseInt(n.getAttribute(`tabindex`)||``,10);return isNaN(e)?-1:e}function oa(n){let e=n.nodeName.toLowerCase(),t=e===`input`&&n.type;return t===`text`||t===`password`||e===`select`||e===`textarea`}function ra(n){return ta(n)?!1:Jn(n)||ea(n)||n.hasAttribute(`contenteditable`)||Ke(n)}function ia(n){return n.ownerDocument&&n.ownerDocument.defaultView||window}var ne=class{_element;_checker;_ngZone;_document;_injector;_startAnchor=null;_endAnchor=null;_hasAttached=!1;startAnchorListener=()=>{!this.focusLastTabbableElement()&&this._checker.isFocusable(this._element)&&this._element.focus()};endAnchorListener=()=>{!this.focusFirstTabbableElement()&&this._checker.isFocusable(this._element)&&this._element.focus()};get enabled(){return this._enabled}set enabled(e){this._enabled=e,this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(e,this._startAnchor),this._toggleAnchorTabIndex(e,this._endAnchor))}_enabled=!0;constructor(e,t,a,o,r=!1,i){this._element=e,this._checker=t,this._ngZone=a,this._document=o,this._injector=i,r||this.attachAnchors()}destroy(){let e=this._startAnchor,t=this._endAnchor;e&&(e.removeEventListener(`focus`,this.startAnchorListener),e.remove()),t&&(t.removeEventListener(`focus`,this.endAnchorListener),t.remove()),this._startAnchor=this._endAnchor=null,this._hasAttached=!1}attachAnchors(){return this._hasAttached?!0:(this._ngZone.runOutsideAngular(()=>{this._startAnchor||(this._startAnchor=this._createAnchor(),this._startAnchor.addEventListener(`focus`,this.startAnchorListener)),this._endAnchor||(this._endAnchor=this._createAnchor(),this._endAnchor.addEventListener(`focus`,this.endAnchorListener))}),this._element.parentNode&&(this._element.parentNode.insertBefore(this._startAnchor,this._element),this._element.parentNode.insertBefore(this._endAnchor,this._element.nextSibling),this._hasAttached=!0),this._hasAttached)}focusInitialElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusInitialElement(e)))})}focusFirstTabbableElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusFirstTabbableElement(e)))})}focusLastTabbableElementWhenReady(e){return new Promise(t=>{this._executeOnStable(()=>t(this.focusLastTabbableElement(e)))})}_getRegionBoundary(e){let t=this._element.querySelectorAll(`[cdk-focus-region-${e}], [cdkFocusRegion${e}], [cdk-focus-${e}]`);return e==`start`?t.length?t[0]:this._getFirstTabbableElement(this._element):t.length?t[t.length-1]:this._getLastTabbableElement(this._element)}focusInitialElement(e){let t=this._element.querySelector(`[cdk-focus-initial], [cdkFocusInitial]`);if(t){if(!this._checker.isFocusable(t)){let a=this._getFirstTabbableElement(t);return a?.focus(e),!!a}return t.focus(e),!0}return this.focusFirstTabbableElement(e)}focusFirstTabbableElement(e){let t=this._getRegionBoundary(`start`);return t&&t.focus(e),!!t}focusLastTabbableElement(e){let t=this._getRegionBoundary(`end`);return t&&t.focus(e),!!t}hasAttached(){return this._hasAttached}_getFirstTabbableElement(e){if(this._checker.isFocusable(e)&&this._checker.isTabbable(e))return e;let t=e.children;for(let a=0;a<t.length;a++){let o=t[a].nodeType===this._document.ELEMENT_NODE?this._getFirstTabbableElement(t[a]):null;if(o)return o}return null}_getLastTabbableElement(e){if(this._checker.isFocusable(e)&&this._checker.isTabbable(e))return e;let t=e.children;for(let a=t.length-1;a>=0;a--){let o=t[a].nodeType===this._document.ELEMENT_NODE?this._getLastTabbableElement(t[a]):null;if(o)return o}return null}_createAnchor(){let e=this._document.createElement(`div`);return this._toggleAnchorTabIndex(this._enabled,e),e.classList.add(`cdk-visually-hidden`),e.classList.add(`cdk-focus-trap-anchor`),e.setAttribute(`aria-hidden`,`true`),e}_toggleAnchorTabIndex(e,t){e?t.setAttribute(`tabindex`,`0`):t.removeAttribute(`tabindex`)}toggleAnchors(e){this._startAnchor&&this._endAnchor&&(this._toggleAnchorTabIndex(e,this._startAnchor),this._toggleAnchorTabIndex(e,this._endAnchor))}_executeOnStable(e){UD(e,{injector:this._injector})}};var Ko=(()=>{class n{_checker=g(Yn);_ngZone=g(Ce);_document=g(Q$1);_injector=g(oe$1);constructor(){g(En$1).load(We)}create(t,a=!1){return new ne(t,this._checker,this._ngZone,this._document,a,this._injector)}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();function Xo(n,...e){return e.length?e.some(t=>n[t]):n.altKey||n.shiftKey||n.ctrlKey||n.metaKey}function rr(){return typeof __karma__<`u`&&!!__karma__||typeof jasmine<`u`&&!!jasmine||typeof jest<`u`&&!!jest||typeof Mocha<`u`&&!!Mocha}var Q;var Ye=[`color`,`button`,`checkbox`,`date`,`datetime-local`,`email`,`file`,`hidden`,`image`,`month`,`number`,`password`,`radio`,`range`,`reset`,`search`,`submit`,`tel`,`text`,`time`,`url`,`week`];function dr(){if(Q)return Q;if(typeof document!=`object`||!document)return Q=new Set(Ye),Q;let n=document.createElement(`input`);return Q=new Set(Ye.filter(e=>(n.setAttribute(`type`,e),n.type===e))),Q}var sa=new C(`MATERIAL_ANIMATIONS`);var Xe=null;function la(){return g(sa,{optional:!0})?.animationsDisabled||g(Dv,{optional:!0})===`NoopAnimations`?`di-disabled`:(Xe??=g(ee).matchMedia(`(prefers-reduced-motion)`).matches,Xe?`reduced-motion`:`enabled`)}function J(){return la()!==`enabled`}function _r(n){return n==null?``:typeof n==`string`?n:`${n}px`}function Sr(n){return n!=null&&`${n}`!=`false`}var N=(function(n){return n[n.FADING_IN=0]=`FADING_IN`,n[n.VISIBLE=1]=`VISIBLE`,n[n.FADING_OUT=2]=`FADING_OUT`,n[n.HIDDEN=3]=`HIDDEN`,n})(N||{});var ae=class{_renderer;element;config;_animationForciblyDisabledThroughCss;state=N.HIDDEN;constructor(e,t,a,o=!1){this._renderer=e,this.element=t,this.config=a,this._animationForciblyDisabledThroughCss=o}fadeOut(){this._renderer.fadeOutRipple(this)}};var Qe=X({passive:!0,capture:!0});var oe=class{_events=new Map;addHandler(e,t,a,o){let r=this._events.get(t);if(r){let i=r.get(a);i?i.add(o):r.set(a,new Set([o]))}else this._events.set(t,new Map([[a,new Set([o])]])),e.runOutsideAngular(()=>{document.addEventListener(t,this._delegateEventHandler,Qe)})}removeHandler(e,t,a){let o=this._events.get(e);if(!o)return;let r=o.get(t);r&&(r.delete(a),r.size===0&&o.delete(t),o.size===0&&(this._events.delete(e),document.removeEventListener(e,this._delegateEventHandler,Qe)))}_delegateEventHandler=e=>{let t=Hn$1(e);t&&this._events.get(e.type)?.forEach((a,o)=>{(o===t||o.contains(t))&&a.forEach(r=>r.handleEvent(e))})}};var ut={enterDuration:225,exitDuration:150};var da=800;var Je=X({passive:!0,capture:!0});var tn=[`mousedown`,`touchstart`];var en=[`mouseup`,`mouseleave`,`touchend`,`touchcancel`];var ca=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=jw({type:n,selectors:[[`ng-component`]],hostAttrs:[`mat-ripple-style-loader`,``],decls:0,vars:0,template:function(a,o){},styles:[`.mat-ripple {
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
`],encapsulation:2})}return n})();var pt=class n{_target;_ngZone;_platform;_containerElement;_triggerElement=null;_isPointerDown=!1;_activeRipples=new Map;_mostRecentTransientRipple=null;_lastTouchStartEvent;_pointerUpEventsRegistered=!1;_containerRect=null;static _eventManager=new oe;constructor(e,t,a,o,r){this._target=e,this._ngZone=t,this._platform=o,o.isBrowser&&(this._containerElement=mn$2(a)),r&&r.get(En$1).load(ca)}fadeInRipple(e,t,a={}){let o=this._containerRect=this._containerRect||this._containerElement.getBoundingClientRect(),r=V(V({},ut),a.animation);a.centered&&(e=o.left+o.width/2,t=o.top+o.height/2);let i=a.radius||ma(e,t,o),m=e-o.left,b=t-o.top,f=r.enterDuration,h=document.createElement(`div`);h.classList.add(`mat-ripple-element`),h.style.left=`${m-i}px`,h.style.top=`${b-i}px`,h.style.height=`${i*2}px`,h.style.width=`${i*2}px`,a.color!=null&&(h.style.backgroundColor=a.color),h.style.transitionDuration=`${f}ms`,this._containerElement.appendChild(h);let ve=window.getComputedStyle(h),Wn=ve.transitionProperty,ye=ve.transitionDuration,Ht=Wn===`none`||ye===`0s`||ye===`0s, 0s`||o.width===0&&o.height===0,j=new ae(this,h,a,Ht);h.style.transform=`scale3d(1, 1, 1)`,j.state=N.FADING_IN,a.persistent||(this._mostRecentTransientRipple=j);let _t=null;return!Ht&&(f||r.exitDuration)&&this._ngZone.runOutsideAngular(()=>{let _e=()=>{_t&&(_t.fallbackTimer=null),clearTimeout(xe),this._finishRippleTransition(j)},$t=()=>this._destroyRipple(j),xe=setTimeout($t,f+100);h.addEventListener(`transitionend`,_e),h.addEventListener(`transitioncancel`,$t),_t={onTransitionEnd:_e,onTransitionCancel:$t,fallbackTimer:xe}}),this._activeRipples.set(j,_t),(Ht||!f)&&this._finishRippleTransition(j),j}fadeOutRipple(e){if(e.state===N.FADING_OUT||e.state===N.HIDDEN)return;let t=e.element,a=V(V({},ut),e.config.animation);t.style.transitionDuration=`${a.exitDuration}ms`,t.style.opacity=`0`,e.state=N.FADING_OUT,(e._animationForciblyDisabledThroughCss||!a.exitDuration)&&this._finishRippleTransition(e)}fadeOutAll(){this._getActiveRipples().forEach(e=>e.fadeOut())}fadeOutAllNonPersistent(){this._getActiveRipples().forEach(e=>{e.config.persistent||e.fadeOut()})}setupTriggerEvents(e){let t=mn$2(e);!this._platform.isBrowser||!t||t===this._triggerElement||(this._removeTriggerEvents(),this._triggerElement=t,tn.forEach(a=>{n._eventManager.addHandler(this._ngZone,a,t,this)}))}handleEvent(e){e.type===`mousedown`?this._onMousedown(e):e.type===`touchstart`?this._onTouchStart(e):this._onPointerUp(),this._pointerUpEventsRegistered||(this._ngZone.runOutsideAngular(()=>{en.forEach(t=>{this._triggerElement.addEventListener(t,this,Je)})}),this._pointerUpEventsRegistered=!0)}_finishRippleTransition(e){e.state===N.FADING_IN?this._startFadeOutTransition(e):e.state===N.FADING_OUT&&this._destroyRipple(e)}_startFadeOutTransition(e){let t=e===this._mostRecentTransientRipple,{persistent:a}=e.config;e.state=N.VISIBLE,!a&&(!t||!this._isPointerDown)&&e.fadeOut()}_destroyRipple(e){let t=this._activeRipples.get(e)??null;this._activeRipples.delete(e),this._activeRipples.size||(this._containerRect=null),e===this._mostRecentTransientRipple&&(this._mostRecentTransientRipple=null),e.state=N.HIDDEN,t!==null&&(e.element.removeEventListener(`transitionend`,t.onTransitionEnd),e.element.removeEventListener(`transitioncancel`,t.onTransitionCancel),t.fallbackTimer!==null&&clearTimeout(t.fallbackTimer)),e.element.remove()}_onMousedown(e){let t=Pn$1(e),a=this._lastTouchStartEvent&&Date.now()<this._lastTouchStartEvent+da;!this._target.rippleDisabled&&!t&&!a&&(this._isPointerDown=!0,this.fadeInRipple(e.clientX,e.clientY,this._target.rippleConfig))}_onTouchStart(e){if(!this._target.rippleDisabled&&!Ln$1(e)){this._lastTouchStartEvent=Date.now(),this._isPointerDown=!0;let t=e.changedTouches;if(t)for(let a=0;a<t.length;a++)this.fadeInRipple(t[a].clientX,t[a].clientY,this._target.rippleConfig)}}_onPointerUp(){this._isPointerDown&&(this._isPointerDown=!1,this._getActiveRipples().forEach(e=>{let t=e.state===N.VISIBLE||e.config.terminateOnPointerUp&&e.state===N.FADING_IN;!e.config.persistent&&t&&e.fadeOut()}))}_getActiveRipples(){return Array.from(this._activeRipples.keys())}_removeTriggerEvents(){let e=this._triggerElement;e&&(tn.forEach(t=>n._eventManager.removeHandler(t,e,this)),this._pointerUpEventsRegistered&&(en.forEach(t=>e.removeEventListener(t,this,Je)),this._pointerUpEventsRegistered=!1))}};function ma(n,e,t){let a=Math.max(Math.abs(n-t.left),Math.abs(n-t.right)),o=Math.max(Math.abs(e-t.top),Math.abs(e-t.bottom));return Math.sqrt(a*a+o*o)}var re=new C(`mat-ripple-global-options`);var Pr=(()=>{class n{_elementRef=g(mn$1);_animationsDisabled=J();color;unbounded=!1;centered=!1;radius=0;animation;get disabled(){return this._disabled}set disabled(t){t&&this.fadeOutAllNonPersistent(),this._disabled=t,this._setupTriggerEventsIfEnabled()}_disabled=!1;get trigger(){return this._trigger||this._elementRef.nativeElement}set trigger(t){this._trigger=t,this._setupTriggerEventsIfEnabled()}_trigger;_rippleRenderer;_globalOptions;_isInitialized=!1;constructor(){let t=g(Ce),a=g(un$1),o=g(re,{optional:!0}),r=g(oe$1);this._globalOptions=o||{},this._rippleRenderer=new pt(this,t,this._elementRef,a,r)}ngOnInit(){this._isInitialized=!0,this._setupTriggerEventsIfEnabled()}ngOnDestroy(){this._rippleRenderer._removeTriggerEvents()}fadeOutAll(){this._rippleRenderer.fadeOutAll()}fadeOutAllNonPersistent(){this._rippleRenderer.fadeOutAllNonPersistent()}get rippleConfig(){return{centered:this.centered,radius:this.radius,color:this.color,animation:V(V(V({},this._globalOptions.animation),this._animationsDisabled?{enterDuration:0,exitDuration:0}:{}),this.animation),terminateOnPointerUp:this._globalOptions.terminateOnPointerUp}}get rippleDisabled(){return this.disabled||!!this._globalOptions.disabled}_setupTriggerEventsIfEnabled(){!this.disabled&&this._isInitialized&&this._rippleRenderer.setupTriggerEvents(this.trigger)}launch(t,a=0,o){return typeof t==`number`?this._rippleRenderer.fadeInRipple(t,a,V(V({},this.rippleConfig),o)):this._rippleRenderer.fadeInRipple(0,0,V(V({},this.rippleConfig),t))}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,selectors:[[``,`mat-ripple`,``],[``,`matRipple`,``]],hostAttrs:[1,`mat-ripple`],hostVars:2,hostBindings:function(a,o){a&2&&gg(`mat-ripple-unbounded`,o.unbounded)},inputs:{color:[0,`matRippleColor`,`color`],unbounded:[0,`matRippleUnbounded`,`unbounded`],centered:[0,`matRippleCentered`,`centered`],radius:[0,`matRippleRadius`,`radius`],animation:[0,`matRippleAnimation`,`animation`],disabled:[0,`matRippleDisabled`,`disabled`],trigger:[0,`matRippleTrigger`,`trigger`]},exportAs:[`matRipple`]})}return n})();var ua={capture:!0};var pa=[`focus`,`mousedown`,`mouseenter`,`touchstart`];var ie=`mat-ripple-loader-uninitialized`;var se=`mat-ripple-loader-class-name`;var nn=`mat-ripple-loader-centered`;var wt=`mat-ripple-loader-disabled`;var an=(()=>{class n{_document=g(Q$1);_animationsDisabled=J();_globalRippleOptions=g(re,{optional:!0});_platform=g(un$1);_ngZone=g(Ce);_injector=g(oe$1);_eventCleanups;_hosts=new Map;constructor(){let t=g(oo$1).createRenderer(null,null);this._eventCleanups=this._ngZone.runOutsideAngular(()=>pa.map(a=>t.listen(this._document,a,this._onInteraction,ua)))}ngOnDestroy(){let t=this._hosts.keys();for(let a of t)this.destroyRipple(a);this._eventCleanups.forEach(a=>a())}configureRipple(t,a){t.setAttribute(ie,this._globalRippleOptions?.namespace??``),(a.className||!t.hasAttribute(se))&&t.setAttribute(se,a.className||``),a.centered&&t.setAttribute(nn,``),a.disabled&&t.setAttribute(wt,``)}setDisabled(t,a){let o=this._hosts.get(t);o?(o.target.rippleDisabled=a,!a&&!o.hasSetUpEvents&&(o.hasSetUpEvents=!0,o.renderer.setupTriggerEvents(t))):a?t.setAttribute(wt,``):t.removeAttribute(wt)}_onInteraction=t=>{let a=Hn$1(t);if(a instanceof HTMLElement){let o=a.closest(`[${ie}="${this._globalRippleOptions?.namespace??``}"]`);o&&this._createRipple(o)}};_createRipple(t){if(!this._document||this._hosts.has(t))return;t.querySelector(`.mat-ripple`)?.remove();let a=this._document.createElement(`span`);a.classList.add(`mat-ripple`,t.getAttribute(se)),t.append(a);let o=this._globalRippleOptions,r=this._animationsDisabled?0:o?.animation?.enterDuration??ut.enterDuration,i=this._animationsDisabled?0:o?.animation?.exitDuration??ut.exitDuration,m={rippleDisabled:this._animationsDisabled||o?.disabled||t.hasAttribute(wt),rippleConfig:{centered:t.hasAttribute(nn),terminateOnPointerUp:o?.terminateOnPointerUp,animation:{enterDuration:r,exitDuration:i}}},b=new pt(m,this._ngZone,a,this._platform,this._injector),f=!m.rippleDisabled;f&&b.setupTriggerEvents(t),this._hosts.set(t,{target:m,renderer:b,hasSetUpEvents:f}),t.removeAttribute(ie)}destroyRipple(t){let a=this._hosts.get(t);a&&(a.renderer._removeTriggerEvents(),this._hosts.delete(t))}static ɵfac=function(a){return new(a||n)};static ɵprov=Rt$1({token:n,factory:n.ɵfac})}return n})();var on=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵcmp=jw({type:n,selectors:[[`structural-styles`]],decls:0,vars:0,template:function(a,o){},styles:[`.mat-focus-indicator {
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
`],encapsulation:2})}return n})();var ba=new C(`MAT_BUTTON_CONFIG`);function rn(n){return n==null?void 0:mC(n)}var sn=(()=>{class n{_elementRef=g(mn$1);_ngZone=g(Ce);_animationsDisabled=J();_config=g(ba,{optional:!0});_focusMonitor=g(te);_cleanupClick;_renderer=g(io$1);_rippleLoader=g(an);_isAnchor;_isFab=!1;color;get disableRipple(){return this._disableRipple}set disableRipple(t){this._disableRipple=t,this._updateRippleDisabled()}_disableRipple=!1;get disabled(){return this._disabled}set disabled(t){this._disabled=t,this._updateRippleDisabled()}_disabled=!1;ariaDisabled;disabledInteractive;tabIndex;set _tabindex(t){this.tabIndex=t}showProgress=Pj(!1,{transform:gC});constructor(){g(En$1).load(on);let t=this._elementRef.nativeElement;this._isAnchor=t.tagName===`A`,this.disabledInteractive=this._config?.disabledInteractive??!1,this.color=this._config?.color??null,this._rippleLoader?.configureRipple(t,{className:`mat-mdc-button-ripple`})}ngAfterViewInit(){this._focusMonitor.monitor(this._elementRef,!0),this._isAnchor&&this._setupAsAnchor()}ngOnDestroy(){this._cleanupClick?.(),this._focusMonitor.stopMonitoring(this._elementRef),this._rippleLoader?.destroyRipple(this._elementRef.nativeElement)}focus(t=`program`,a){t?this._focusMonitor.focusVia(this._elementRef.nativeElement,t,a):this._elementRef.nativeElement.focus(a)}_getAriaDisabled(){return this.ariaDisabled!=null?this.ariaDisabled:this._isAnchor?this.disabled||null:this.disabled&&this.disabledInteractive?!0:null}_getDisabledAttribute(){return this.disabledInteractive||!this.disabled?null:!0}_updateRippleDisabled(){this._rippleLoader?.setDisabled(this._elementRef.nativeElement,this.disableRipple||this.disabled)}_getTabIndex(){return this._isAnchor?this.disabled&&!this.disabledInteractive?-1:this.tabIndex:this.tabIndex}_setupAsAnchor(){this._cleanupClick=this._ngZone.runOutsideAngular(()=>this._renderer.listen(this._elementRef.nativeElement,`click`,t=>{this.disabled&&(t.preventDefault(),t.stopImmediatePropagation())}))}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,hostAttrs:[1,`mat-mdc-button-base`],hostVars:15,hostBindings:function(a,o){a&2&&(Qh(`disabled`,o._getDisabledAttribute())(`aria-disabled`,o._getAriaDisabled())(`tabindex`,o._getTabIndex()),hI(o.color?`mat-`+o.color:``),gg(`mat-mdc-button-progress-indicator-shown`,o.showProgress())(`mat-mdc-button-disabled`,o.disabled)(`mat-mdc-button-disabled-interactive`,o.disabledInteractive)(`mat-unthemed`,!o.color)(`_mat-animation-noopable`,o._animationsDisabled))},inputs:{color:`color`,disableRipple:[2,`disableRipple`,`disableRipple`,gC],disabled:[2,`disabled`,`disabled`,gC],ariaDisabled:[2,`aria-disabled`,`ariaDisabled`,gC],disabledInteractive:[2,`disabledInteractive`,`disabledInteractive`,gC],tabIndex:[2,`tabIndex`,`tabIndex`,rn],_tabindex:[2,`tabindex`,`_tabindex`,rn],showProgress:[1,`showProgress`]}})}return n})();var ln=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[An$1]})}return n})();var dn=new Map([[`text`,[`mat-mdc-button`]],[`filled`,[`mdc-button--unelevated`,`mat-mdc-unelevated-button`]],[`elevated`,[`mdc-button--raised`,`mat-mdc-raised-button`]],[`outlined`,[`mdc-button--outlined`,`mat-mdc-outlined-button`]],[`tonal`,[`mat-tonal-button`]]]);var mi=(()=>{class n extends sn{get appearance(){return this._appearance}set appearance(t){this.setAppearance(t||this._config?.defaultAppearance||`text`)}_appearance=null;constructor(){super();let t=fa(this._elementRef.nativeElement);t&&this.setAppearance(t)}setAppearance(t){if(t===this._appearance)return;let a=this._elementRef.nativeElement.classList,o=this._appearance?dn.get(this._appearance):null,r=dn.get(t);o&&a.remove(...o),a.add(...r),this._appearance=t}static ɵfac=function(a){return new(a||n)};static ɵcmp=(function(){let t=[[[``,8,`material-icons`,3,`iconPositionEnd`,``],[`mat-icon`,3,`iconPositionEnd`,``],[``,`matButtonIcon`,``,3,`iconPositionEnd`,``],[``,8,`material-symbols-outlined`,3,`iconPositionEnd`,``],[``,8,`material-symbols-rounded`,3,`iconPositionEnd`,``],[``,8,`material-symbols-sharp`,3,`iconPositionEnd`,``]],`*`,[[``,`iconPositionEnd`,``,8,`material-icons`],[`mat-icon`,`iconPositionEnd`,``],[``,`matButtonIcon`,``,`iconPositionEnd`,``],[``,`iconPositionEnd`,``,8,`material-symbols-outlined`],[``,`iconPositionEnd`,``,8,`material-symbols-rounded`],[``,`iconPositionEnd`,``,8,`material-symbols-sharp`]],[[``,`progressIndicator`,``]]],a=[`.material-icons:not([iconPositionEnd]), mat-icon:not([iconPositionEnd]), [matButtonIcon]:not([iconPositionEnd]), .material-symbols-outlined:not([iconPositionEnd]), .material-symbols-rounded:not([iconPositionEnd]), .material-symbols-sharp:not([iconPositionEnd])`,`*`,`.material-icons[iconPositionEnd], mat-icon[iconPositionEnd], [matButtonIcon][iconPositionEnd], .material-symbols-outlined[iconPositionEnd], .material-symbols-rounded[iconPositionEnd], .material-symbols-sharp[iconPositionEnd]`,`[progressIndicator]`];function o(r,i){r&1&&(Uu(0,`div`,2),JE(1,3),$u())}return jw({type:n,selectors:[[`button`,`matButton`,``],[`a`,`matButton`,``],[`button`,`mat-button`,``],[`button`,`mat-raised-button`,``],[`button`,`mat-flat-button`,``],[`button`,`mat-stroked-button`,``],[`a`,`mat-button`,``],[`a`,`mat-raised-button`,``],[`a`,`mat-flat-button`,``],[`a`,`mat-stroked-button`,``]],hostAttrs:[1,`mdc-button`],inputs:{appearance:[0,`matButton`,`appearance`]},exportAs:[`matButton`,`matAnchor`],features:[Fh],ngContentSelectors:a,decls:8,vars:5,consts:[[1,`mat-mdc-button-persistent-ripple`],[1,`mdc-button__label`],[1,`mat-mdc-button-progress-indicator-container`],[1,`mat-focus-indicator`],[1,`mat-mdc-button-touch-target`]],template:function(i,m){i&1&&(QE(t),eg(0,`span`,0),JE(1),Uu(2,`span`,1),JE(3,1),$u(),JE(4,2),xE(5,o,2,0,`div`,2),eg(6,`span`,3)(7,`span`,4)),i&2&&(gg(`mdc-button__ripple`,!m._isFab)(`mdc-fab__ripple`,m._isFab),ab(5),OE(m.showProgress()?5:-1))},styles:[`.mat-mdc-button-base {
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
`],encapsulation:2})})()}return n})();function fa(n){return n.hasAttribute(`mat-raised-button`)?`elevated`:n.hasAttribute(`mat-stroked-button`)?`outlined`:n.hasAttribute(`mat-flat-button`)?`filled`:n.hasAttribute(`mat-button`)?`text`:null}var ui=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[ln,An$1]})}return n})();var yn=(()=>{class n{_renderer;_elementRef;onChange=t=>{};onTouched=()=>{};constructor(t,a){this._renderer=t,this._elementRef=a}setProperty(t,a){this._renderer.setProperty(this._elementRef.nativeElement,t,a)}registerOnTouched(t){this.onTouched=t}registerOnChange(t){this.onChange=t}setDisabledState(t){this.setProperty(`disabled`,t)}static ɵfac=function(a){return new(a||n)(ze$1(io$1),ze$1(mn$1))};static ɵdir=Fu({type:n})}return n})();var jt=(()=>{class n extends yn{static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,features:[Fh]})}return n})();var yt=new C(``);var ha={provide:yt,useExisting:yi(()=>_n),multi:!0};function ga(){let n=Ss()?Ss().getUserAgent():``;return/android (\d+)/.test(n.toLowerCase())}var va=new C(``);var _n=(()=>{class n extends yn{_compositionMode;_composing=!1;constructor(t,a,o){super(t,a),this._compositionMode=o,this._compositionMode??=!ga()}writeValue(t){let a=t??``;this.setProperty(`value`,a)}_handleInput(t){(!this._compositionMode||this._compositionMode&&!this._composing)&&this.onChange(t)}_compositionStart(){this._composing=!0}_compositionEnd(t){this._composing=!1,this._compositionMode&&this.onChange(t)}static ɵfac=function(a){return new(a||n)(ze$1(io$1),ze$1(mn$1),ze$1(va,8))};static ɵdir=Fu({type:n,selectors:[[`input`,`formControlName`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`formControlName`,``,3,`ngNoCva`,``],[`input`,`formControl`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`formControl`,``,3,`ngNoCva`,``],[`input`,`ngModel`,``,3,`type`,`checkbox`,3,`ngNoCva`,``],[`textarea`,`ngModel`,``,3,`ngNoCva`,``],[``,`ngDefaultControl`,``]],hostBindings:function(a,o){a&1&&ig(`input`,function(i){return o._handleInput(i.target.value)})(`blur`,function(){return o.onTouched()})(`compositionstart`,function(){return o._compositionStart()})(`compositionend`,function(i){return o._compositionEnd(i.target.value)})},standalone:!1,features:[PI([ha]),Fh]})}return n})();function me(n){return n==null||ue(n)===0}function ue(n){return n==null?null:Array.isArray(n)||typeof n==`string`?n.length:n instanceof Set?n.size:null}var K=new C(``);var pe=new C(``);var ya=/^(?=.{1,254}$)(?=.{1,64}@)[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-zA-Z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;var le=class{static min(e){return xn(e)}static max(e){return Cn(e)}static required(e){return Nn(e)}static requiredTrue(e){return _a(e)}static email(e){return xa(e)}static minLength(e){return Ca(e)}static maxLength(e){return Sn(e)}static pattern(e){return Na(e)}static nullValidator(e){return It()}static compose(e){return In(e)}static composeAsync(e){return Vn(e)}};function xn(n){return e=>{if(e.value==null||n==null)return null;let t=parseFloat(e.value);return!isNaN(t)&&t<n?{min:{min:n,actual:e.value}}:null}}function Cn(n){return e=>{if(e.value==null||n==null)return null;let t=parseFloat(e.value);return!isNaN(t)&&t>n?{max:{max:n,actual:e.value}}:null}}function Nn(n){return me(n.value)?{required:!0}:null}function _a(n){return n.value===!0?null:{required:!0}}function xa(n){return me(n.value)||ya.test(n.value)?null:{email:!0}}function Ca(n){return e=>{let t=e.value?.length??ue(e.value);return t===null||t===0?null:t<n?{minlength:{requiredLength:n,actualLength:t}}:null}}function Sn(n){return e=>{let t=e.value?.length??ue(e.value);return t!==null&&t>n?{maxlength:{requiredLength:n,actualLength:t}}:null}}function Na(n){if(!n)return It;let e,t;return typeof n==`string`?(t=``,n.charAt(0)!==`^`&&(t+=`^`),t+=n,n.charAt(n.length-1)!==`$`&&(t+=`$`),e=new RegExp(t)):(t=n.toString(),e=n),a=>{if(me(a.value))return null;let o=a.value;return e.test(o)?null:{pattern:{requiredPattern:t,actualValue:o}}}}function It(n){return null}function En(n){return n!=null}function An(n){return vs(n)?et$1(n):n}function Mn(n){let e={};return n.forEach(t=>{e=t!=null?V(V({},e),t):e}),Object.keys(e).length===0?null:e}function wn(n,e){return e.map(t=>t(n))}function Sa(n){return!n.validate}function Dn(n){return n.map(e=>Sa(e)?e:t=>e.validate(t))}function In(n){if(!n)return null;let e=n.filter(En);return e.length==0?null:function(t){return Mn(wn(t,e))}}function be(n){return n!=null?In(Dn(n)):null}function Vn(n){if(!n)return null;let e=n.filter(En);return e.length==0?null:function(t){let a=wn(t,e).map(An);return fy(a).pipe(z(Mn))}}function fe(n){return n!=null?Vn(Dn(n)):null}function cn(n,e){return n===null?[e]:Array.isArray(n)?[...n,e]:[n,e]}function Fn(n){return n._rawValidators}function kn(n){return n._rawAsyncValidators}function de(n){return n?Array.isArray(n)?n:[n]:[]}function Vt(n,e){return Array.isArray(n)?n.includes(e):n===e}function mn(n,e){let t=de(e);return de(n).forEach(o=>{Vt(t,o)||t.push(o)}),t}function un(n,e){return de(e).filter(t=>!Vt(n,t))}var Ft=class{get value(){return this.control?this.control.value:null}get valid(){return this.control?this.control.valid:null}get invalid(){return this.control?this.control.invalid:null}get pending(){return this.control?this.control.pending:null}get disabled(){return this.control?this.control.disabled:null}get enabled(){return this.control?this.control.enabled:null}get errors(){return this.control?this.control.errors:null}get pristine(){return this.control?this.control.pristine:null}get dirty(){return this.control?this.control.dirty:null}get touched(){return this.control?this.control.touched:null}get status(){return this.control?this.control.status:null}get untouched(){return this.control?this.control.untouched:null}get statusChanges(){return this.control?this.control.statusChanges:null}get valueChanges(){return this.control?this.control.valueChanges:null}get path(){return null}_composedValidatorFn;_composedAsyncValidatorFn;_rawValidators=[];_rawAsyncValidators=[];_setValidators(e){this._rawValidators=e||[],this._composedValidatorFn=be(this._rawValidators)}_setAsyncValidators(e){this._rawAsyncValidators=e||[],this._composedAsyncValidatorFn=fe(this._rawAsyncValidators)}get validator(){return this._composedValidatorFn||null}get asyncValidator(){return this._composedAsyncValidatorFn||null}_onDestroyCallbacks=[];_registerOnDestroy(e){this._onDestroyCallbacks.push(e)}_invokeOnDestroyCallbacks(){this._onDestroyCallbacks.forEach(e=>e()),this._onDestroyCallbacks=[]}reset(e=void 0){this.control?.reset(e)}hasError(e,t){return this.control?this.control.hasError(e,t):!1}getError(e,t){return this.control?this.control.getError(e,t):null}};var L=class extends Ft{name;get formDirective(){return null}get path(){return null}};var bt=`VALID`;var Dt=`INVALID`;var tt=`PENDING`;var ft=`DISABLED`;var B=class{};var kt=class extends B{value;source;constructor(e,t){super(),this.value=e,this.source=t}};var gt=class extends B{pristine;source;constructor(e,t){super(),this.pristine=e,this.source=t}};var vt=class extends B{touched;source;constructor(e,t){super(),this.touched=e,this.source=t}};var et=class extends B{status;source;constructor(e,t){super(),this.status=e,this.source=t}};var Ot=class extends B{source;constructor(e){super(),this.source=e}};var nt=class extends B{source;constructor(e){super(),this.source=e}};function On(n){return(Ut(n)?n.validators:n)||null}function Ea(n){return Array.isArray(n)?be(n):n||null}function Tn(n,e){return(Ut(e)?e.asyncValidators:n)||null}function Aa(n){return Array.isArray(n)?fe(n):n||null}function Ut(n){return n!=null&&!Array.isArray(n)&&typeof n==`object`}function Ma(n,e,t){let a=n.controls;if(!(e?Object.keys(a):a).length)throw new v(1e3,``);if(!Rn(a,t))throw new v(1001,``)}function wa(n,e,t){n._forEachChild((a,o)=>{if(t[o]===void 0)throw new v(-1002,``)})}var Tt=class{_pendingDirty=!1;_hasOwnPendingAsyncValidator=null;_pendingTouched=!1;_onCollectionChange=()=>{};_updateOn;_hasRequired=ue$1(!1);_parent=null;_asyncValidationSubscription;_composedValidatorFn;_composedAsyncValidatorFn;_rawValidators;_rawAsyncValidators;value;constructor(e,t){this._assignValidators(e),this._assignAsyncValidators(t)}get validator(){return this._composedValidatorFn}set validator(e){this._rawValidators=this._composedValidatorFn=e,this._updateHasRequiredValidator()}get asyncValidator(){return this._composedAsyncValidatorFn}set asyncValidator(e){this._rawAsyncValidators=this._composedAsyncValidatorFn=e}get parent(){return this._parent}get status(){return yo(this.statusReactive)}set status(e){yo(()=>this.statusReactive.set(e))}_status=Ku(()=>this.statusReactive());statusReactive=ue$1(void 0);get valid(){return this.status===bt}get invalid(){return this.status===Dt}get pending(){return this.status===tt}get disabled(){return this.status===ft}get enabled(){return this.status!==ft}errors;get pristine(){return yo(this.pristineReactive)}set pristine(e){yo(()=>this.pristineReactive.set(e))}_pristine=Ku(()=>this.pristineReactive());pristineReactive=ue$1(!0);get dirty(){return!this.pristine}get touched(){return yo(this.touchedReactive)}set touched(e){yo(()=>this.touchedReactive.set(e))}_touched=Ku(()=>this.touchedReactive());touchedReactive=ue$1(!1);get untouched(){return!this.touched}_events=new ne$1;events=this._events.asObservable();valueChanges;statusChanges;get updateOn(){return this._updateOn?this._updateOn:this.parent?this.parent.updateOn:`change`}setValidators(e){this._assignValidators(e)}setAsyncValidators(e){this._assignAsyncValidators(e)}addValidators(e){this.setValidators(mn(e,this._rawValidators))}addAsyncValidators(e){this.setAsyncValidators(mn(e,this._rawAsyncValidators))}removeValidators(e){this.setValidators(un(e,this._rawValidators))}removeAsyncValidators(e){this.setAsyncValidators(un(e,this._rawAsyncValidators))}hasValidator(e){return Vt(this._rawValidators,e)}hasAsyncValidator(e){return Vt(this._rawAsyncValidators,e)}clearValidators(){this.validator=null}clearAsyncValidators(){this.asyncValidator=null}markAsTouched(e={}){let t=this.touched===!1;this.touched=!0;let a=e.sourceControl??this;e.onlySelf||this._parent?.markAsTouched(K$1(V({},e),{sourceControl:a})),t&&e.emitEvent!==!1&&this._events.next(new vt(!0,a))}markAllAsDirty(e={}){this.markAsDirty({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:this}),this._forEachChild(t=>t.markAllAsDirty(e))}markAllAsTouched(e={}){this.markAsTouched({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:this}),this._forEachChild(t=>t.markAllAsTouched(e))}markAsUntouched(e={}){let t=this.touched===!0;this.touched=!1,this._pendingTouched=!1;let a=e.sourceControl??this;this._forEachChild(o=>{o.markAsUntouched({onlySelf:!0,emitEvent:e.emitEvent,sourceControl:a})}),e.onlySelf||this._parent?._updateTouched(e,a),t&&e.emitEvent!==!1&&this._events.next(new vt(!1,a))}markAsDirty(e={}){let t=this.pristine===!0;this.pristine=!1;let a=e.sourceControl??this;e.onlySelf||this._parent?.markAsDirty(K$1(V({},e),{sourceControl:a})),t&&e.emitEvent!==!1&&this._events.next(new gt(!1,a))}markAsPristine(e={}){let t=this.pristine===!1;this.pristine=!0,this._pendingDirty=!1;let a=e.sourceControl??this;this._forEachChild(o=>{o.markAsPristine({onlySelf:!0,emitEvent:e.emitEvent})}),e.onlySelf||this._parent?._updatePristine(e,a),t&&e.emitEvent!==!1&&this._events.next(new gt(!0,a))}markAsPending(e={}){this.status=tt;let t=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new et(this.status,t)),this.statusChanges.emit(this.status)),e.onlySelf||this._parent?.markAsPending(K$1(V({},e),{sourceControl:t}))}disable(e={}){let t=this._parentMarkedDirty(e.onlySelf);this.status=ft,this.errors=null,this._forEachChild(o=>{o.disable(K$1(V({},e),{onlySelf:!0}))}),this._updateValue();let a=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new kt(this.value,a)),this._events.next(new et(this.status,a)),this.valueChanges.emit(this.value),this.statusChanges.emit(this.status)),this._updateAncestors(K$1(V({},e),{skipPristineCheck:t}),this),this._onDisabledChange.forEach(o=>o(!0))}enable(e={}){let t=this._parentMarkedDirty(e.onlySelf);this.status=bt,this._forEachChild(a=>{a.enable(K$1(V({},e),{onlySelf:!0}))}),this.updateValueAndValidity({onlySelf:!0,emitEvent:e.emitEvent}),this._updateAncestors(K$1(V({},e),{skipPristineCheck:t}),this),this._onDisabledChange.forEach(a=>a(!1))}_updateAncestors(e,t){e.onlySelf||(this._parent?.updateValueAndValidity(e),e.skipPristineCheck||this._parent?._updatePristine({},t),this._parent?._updateTouched({},t))}setParent(e){this._parent=e}getRawValue(){return this.value}updateValueAndValidity(e={}){if(this._setInitialStatus(),this._updateValue(),this.enabled){let a=this._cancelExistingSubscription();this.errors=this._runValidator(),this.status=this._calculateStatus(),(this.status===bt||this.status===tt)&&this._runAsyncValidator(a,e.emitEvent)}let t=e.sourceControl??this;e.emitEvent!==!1&&(this._events.next(new kt(this.value,t)),this._events.next(new et(this.status,t)),this.valueChanges.emit(this.value),this.statusChanges.emit(this.status)),e.onlySelf||this._parent?.updateValueAndValidity(K$1(V({},e),{sourceControl:t}))}_updateTreeValidity(e={emitEvent:!0}){this._forEachChild(t=>t._updateTreeValidity(e)),this.updateValueAndValidity({onlySelf:!0,emitEvent:e.emitEvent})}_setInitialStatus(){this.status=this._allControlsDisabled()?ft:bt}_runValidator(){return this.validator?this.validator(this):null}_runAsyncValidator(e,t){if(this.asyncValidator){this.status=tt,this._hasOwnPendingAsyncValidator={emitEvent:t!==!1,shouldHaveEmitted:e!==!1};let a=An(this.asyncValidator(this));this._asyncValidationSubscription=a.subscribe(o=>{this._hasOwnPendingAsyncValidator=null,this.setErrors(o,{emitEvent:t,shouldHaveEmitted:e})})}}_cancelExistingSubscription(){if(this._asyncValidationSubscription){this._asyncValidationSubscription.unsubscribe();let e=(this._hasOwnPendingAsyncValidator?.emitEvent||this._hasOwnPendingAsyncValidator?.shouldHaveEmitted)??!1;return this._hasOwnPendingAsyncValidator=null,e}return!1}setErrors(e,t={}){this.errors=e,this._updateControlsErrors(t.emitEvent!==!1,this,t.shouldHaveEmitted)}get(e){let t=e;return t==null||(Array.isArray(t)||(t=t.split(`.`)),t.length===0)?null:t.reduce((a,o)=>a&&a._find(o),this)}getError(e,t){let a=t?this.get(t):this;return a?.errors?a.errors[e]:null}hasError(e,t){return!!this.getError(e,t)}get root(){let e=this;for(;e._parent;)e=e._parent;return e}_updateControlsErrors(e,t,a){this.status=this._calculateStatus(),e&&this.statusChanges.emit(this.status),(e||a)&&this._events.next(new et(this.status,t)),this._parent&&this._parent._updateControlsErrors(e,t,a)}_initObservables(){this.valueChanges=new nt$1,this.statusChanges=new nt$1}_calculateStatus(){return this._allControlsDisabled()?ft:this.errors?Dt:this._hasOwnPendingAsyncValidator||this._anyControlsHaveStatus(tt)?tt:this._anyControlsHaveStatus(Dt)?Dt:bt}_anyControlsHaveStatus(e){return this._anyControls(t=>t.status===e)}_anyControlsDirty(){return this._anyControls(e=>e.dirty)}_anyControlsTouched(){return this._anyControls(e=>e.touched)}_updatePristine(e,t){let a=!this._anyControlsDirty(),o=this.pristine!==a;this.pristine=a,e.onlySelf||this._parent?._updatePristine(e,t),o&&this._events.next(new gt(this.pristine,t))}_updateTouched(e={},t){this.touched=this._anyControlsTouched(),this._events.next(new vt(this.touched,t)),e.onlySelf||this._parent?._updateTouched(e,t)}_onDisabledChange=[];_registerOnCollectionChange(e){this._onCollectionChange=e}_setUpdateStrategy(e){Ut(e)&&e.updateOn!=null&&(this._updateOn=e.updateOn)}_parentMarkedDirty(e){return!e&&!!this._parent?.dirty&&!this._parent._anyControlsDirty()}_find(e){return null}_assignValidators(e){this._rawValidators=Array.isArray(e)?e.slice():e,this._composedValidatorFn=Ea(this._rawValidators),this._updateHasRequiredValidator()}_assignAsyncValidators(e){this._rawAsyncValidators=Array.isArray(e)?e.slice():e,this._composedAsyncValidatorFn=Aa(this._rawAsyncValidators)}_updateHasRequiredValidator(){yo(()=>this._hasRequired.set(this.hasValidator(le.required)))}};function Rn(n,e){return Object.hasOwn(n,e)}function Da(n){return n.tagName===`INPUT`||n.tagName===`SELECT`||n.tagName===`TEXTAREA`}function Ia(n,e,t,a){switch(t){case`name`:n.setAttribute(e,t,a);break;case`disabled`:case`readonly`:case`required`:a?n.setAttribute(e,t,``):n.removeAttribute(e,t);break;case`max`:case`min`:case`minLength`:case`maxLength`:a!==void 0?n.setAttribute(e,t,a.toString()):n.removeAttribute(e,t)}}var ce=class{kind;context;control;message;constructor({kind:e,context:t,control:a}){this.kind=e,this.context=t,this.control=a}};function Va(n){return typeof n==`number`?n:parseInt(n,10)}function Pn(n){return typeof n==`number`?n:parseFloat(n)}var zt=(()=>{class n{_validator=It;_onChange;_enabled;ngOnChanges(t){if(this.inputName in t){let a=this.normalizeInput(t[this.inputName].currentValue);this._enabled=this.enabled(a),this._validator=this._enabled?this.createValidator(a):It,this._onChange?.()}}validate(t){return this._validator(t)}registerOnValidatorChange(t){this._onChange=t}enabled(t){return t!=null}static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,features:[nu]})}return n})();var Fa={provide:K,useExisting:yi(()=>ka),multi:!0};var ka=(()=>{class n extends zt{max;inputName=`max`;normalizeInput=t=>Pn(t);createValidator=t=>Cn(t);static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[`input`,`type`,`number`,`max`,``,`formControlName`,``],[`input`,`type`,`number`,`max`,``,`formControl`,``],[`input`,`type`,`number`,`max`,``,`ngModel`,``]],hostVars:1,hostBindings:function(a,o){a&2&&Qh(`max`,o._enabled?o.max:null)},inputs:{max:`max`},standalone:!1,features:[PI([Fa]),Fh]})}return n})();var Oa={provide:K,useExisting:yi(()=>Ta),multi:!0};var Ta=(()=>{class n extends zt{min;inputName=`min`;normalizeInput=t=>Pn(t);createValidator=t=>xn(t);static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[`input`,`type`,`number`,`min`,``,`formControlName`,``],[`input`,`type`,`number`,`min`,``,`formControl`,``],[`input`,`type`,`number`,`min`,``,`ngModel`,``]],hostVars:1,hostBindings:function(a,o){a&2&&Qh(`min`,o._enabled?o.min:null)},inputs:{min:`min`},standalone:!1,features:[PI([Oa]),Fh]})}return n})();var Ra={provide:K,useExisting:yi(()=>Ln),multi:!0};var Ln=(()=>{class n extends zt{required;inputName=`required`;normalizeInput=gC;createValidator=t=>Nn;enabled(t){return t}static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`required`,``,`formControlName`,``,3,`type`,`checkbox`],[``,`required`,``,`formControl`,``,3,`type`,`checkbox`],[``,`required`,``,`ngModel`,``,3,`type`,`checkbox`]],hostVars:1,hostBindings:function(a,o){a&2&&Qh(`required`,o._enabled?``:null)},inputs:{required:`required`},standalone:!1,features:[PI([Ra]),Fh]})}return n})();var Pa={provide:K,useExisting:yi(()=>La),multi:!0};var La=(()=>{class n extends zt{maxlength;inputName=`maxlength`;normalizeInput=t=>Va(t);createValidator=t=>Sn(t);static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`maxlength`,``,`formControlName`,``],[``,`maxlength`,``,`formControl`,``],[``,`maxlength`,``,`ngModel`,``]],hostVars:1,hostBindings:function(a,o){a&2&&Qh(`maxlength`,o._enabled?o.maxlength:null)},inputs:{maxlength:`maxlength`},standalone:!1,features:[PI([Pa]),Fh]})}return n})();var Ba=new C(``);var Gt=new C(``,{factory:()=>he});var he=`always`;function ja(n,e){return[...e.path,n]}function pn(n,e,t=he){ge(n,e),e.valueAccessor.writeValue(n.value),(n.disabled||t===`always`)&&e.valueAccessor.setDisabledState?.(n.disabled),za(n,e),Ha(n,e),Ga(n,e),Ua(n,e)}function bn(n,e,t=!0){let a=()=>{};e?.valueAccessor?.registerOnChange(a),e?.valueAccessor?.registerOnTouched(a),Pt(n,e),n&&(e._invokeOnDestroyCallbacks(),n._registerOnCollectionChange(()=>{}))}function Rt(n,e){n.forEach(t=>{t.registerOnValidatorChange&&t.registerOnValidatorChange(e)})}function Ua(n,e){if(e.valueAccessor.setDisabledState){let t=a=>{e.valueAccessor.setDisabledState(a)};n.registerOnDisabledChange(t),e._registerOnDestroy(()=>{n._unregisterOnDisabledChange(t)})}}function ge(n,e){let t=Fn(n);e.validator!==null?n.setValidators(cn(t,e.validator)):typeof t==`function`&&n.setValidators([t]);let a=kn(n);e.asyncValidator!==null?n.setAsyncValidators(cn(a,e.asyncValidator)):typeof a==`function`&&n.setAsyncValidators([a]);let o=()=>n.updateValueAndValidity();Rt(e._rawValidators,o),Rt(e._rawAsyncValidators,o)}function Pt(n,e){let t=!1;if(n!==null){if(e.validator!==null){let o=Fn(n);if(Array.isArray(o)&&o.length>0){let r=o.filter(i=>i!==e.validator);r.length!==o.length&&(t=!0,n.setValidators(r))}}if(e.asyncValidator!==null){let o=kn(n);if(Array.isArray(o)&&o.length>0){let r=o.filter(i=>i!==e.asyncValidator);r.length!==o.length&&(t=!0,n.setAsyncValidators(r))}}}let a=()=>{};return Rt(e._rawValidators,a),Rt(e._rawAsyncValidators,a),t}function za(n,e){e.valueAccessor.registerOnChange(t=>{n._pendingValue=t,n._pendingChange=!0,n._pendingDirty=!0,n.updateOn===`change`&&Bn(n,e)})}function Ga(n,e){e.valueAccessor.registerOnTouched(()=>{n._pendingTouched=!0,n.updateOn===`blur`&&n._pendingChange&&Bn(n,e),n.updateOn!==`submit`&&n.markAsTouched()})}function Bn(n,e){n._pendingDirty&&n.markAsDirty(),n.setValue(n._pendingValue,{emitModelToViewChange:!1}),e.viewToModelUpdate(n._pendingValue),n._pendingChange=!1}function Ha(n,e){let t=(a,o)=>{e.valueAccessor.writeValue(a),o&&e.viewToModelUpdate(a)};n.registerOnChange(t),e._registerOnDestroy(()=>{n._unregisterOnChange(t)})}function jn(n,e){ge(n,e)}function $a(n,e){return Pt(n,e)}function Wa(n,e){if(!Object.hasOwn(n,`model`))return!1;let t=n.model;return t.isFirstChange()?!0:!Object.is(e,t.currentValue)}function qa(n){return Object.getPrototypeOf(n.constructor)===jt}function Un(n,e){n._syncPendingControls(),e.forEach(t=>{let a=t.control;a.updateOn===`submit`&&a._pendingChange&&(t.viewToModelUpdate(a._pendingValue),a._pendingChange=!1)})}function Za(n,e){if(!e)return null;let t,a,o;return e.forEach(r=>{r.constructor===_n?t=r:qa(r)?a=r:o=r}),o||a||t||null}function Ka(n,e){let t=n.indexOf(e);t>-1&&n.splice(t,1)}var Ya={provide:Ba,useFactory:()=>{let n=g(at,{self:!0});return{setParseErrors:e=>{n.setParseErrorSource(e)},set onReset(e){n.onReset=e}}}};var at=class extends Ft{_parent=null;name=null;valueAccessor=null;isCustomControlBased=!1;userOnReset;resetSubscription;set onReset(e){this.userOnReset=e,this.resetSubscription?.unsubscribe(),this.resetSubscription=void 0,this.control&&(this.resetSubscription=this.control.events.subscribe(t=>{t instanceof nt&&this.control&&this.userOnReset?.(this.control.value)}),this.subscription?.add(this.resetSubscription))}isNativeFormElement=!1;rawValueAccessors;_selectedValueAccessor=null;get selectedValueAccessor(){return this._selectedValueAccessor??=Za(this,this.rawValueAccessors)}parseErrorsValidator=null;renderer;injector;requiredValidatorViaDi;subscription;customControlBindings=null;constructor(e,t,a){super(),this.injector=e,this.renderer=t,this.rawValueAccessors=a,this.injector?.get(re$1)?.onDestroy(()=>{this.removeParseErrorsValidator(this.control),this.subscription?.unsubscribe()})}setupCustomControl(){this.subscription?.unsubscribe();let e=this.injector?.get(Vg);if(!this.control||!e)return;let t=e.markForCheck.bind(e);this.subscription=new ee$1,this.subscription.add(this.control.valueChanges.subscribe(t)),this.subscription.add(this.control.statusChanges.subscribe(t)),this.resetSubscription?.unsubscribe(),this.resetSubscription=void 0,this.userOnReset&&(this.resetSubscription=this.control.events.subscribe(a=>{a instanceof nt&&this.control&&this.userOnReset?.(this.control.value)}),this.subscription.add(this.resetSubscription)),this.parseErrorsValidator&&this.control.addValidators(this.parseErrorsValidator)}ngControlCreate(e){!e.nativeElement.hasAttribute?.(`ngNoCva`)&&(this.rawValueAccessors&&this.rawValueAccessors.length>0||this.valueAccessor!==null)||!e.customControl||(this.isCustomControlBased=!0,e.listenToCustomControlModel(o=>{this.control?.markAsDirty(),this.control?.setValue(o,{emitModelToViewChange:!1}),this.viewToModelUpdate(o)}),e.listenToCustomControlOutput(`touch`,()=>{this.control?.markAsTouched()}),this.customControlBindings={},this.isNativeFormElement=Da(e.nativeElement),this.requiredValidatorViaDi=this._rawValidators.find(o=>o instanceof Ln))}ngControlUpdate(e,t){if(!this.isCustomControlBased)return;let a=this.control,o=this.customControlBindings;Object.is(o.value,a.value)||(o.value=a.value,e.setCustomControlModelInput(a.value)),this.bindControlProperty(e,o,`touched`,a.touched),this.bindControlProperty(e,o,`dirty`,a.dirty),this.bindControlProperty(e,o,`valid`,a.valid),this.bindControlProperty(e,o,`invalid`,a.invalid),this.bindControlProperty(e,o,`pending`,a.pending),this.bindControlProperty(e,o,`disabled`,a.disabled),this.shouldBindRequired&&this.bindControlProperty(e,o,`required`,this.isRequired);let r=a.errors;if(o.errors!==r){o.errors=r;let i=this._convertErrors(r);e.setInputOnDirectives(`errors`,i)}}get isRequired(){return(this.requiredValidatorViaDi?._enabled||this.control?._hasRequired())??!1}get shouldBindRequired(){return!0}bindControlProperty(e,t,a,o){if(t[a]===o)return;t[a]=o;let r=e.setInputOnDirectives(a,o);this.isNativeFormElement&&!r&&(a===`disabled`||a===`required`)&&this.renderer&&Ia(this.renderer,e.nativeElement,a,o)}_convertErrors(e){if(e===null)return[];let t=this.control;return Object.entries(e).map(([a,o])=>new ce({context:o,kind:a,control:t}))}setParseErrorSource(e){if(e===void 0)return;let t=null,a=Ku(()=>{let o=e();return o.length===0?null:o.reduce((r,i)=>(r[i.kind]=i,r),{})});this.parseErrorsValidator=(()=>t).bind(this),Hi(()=>{t=a(),this.control?.updateValueAndValidity({emitEvent:!1})},{injector:this.injector})}removeParseErrorsValidator(e){this.parseErrorsValidator&&(e?.removeValidators(this.parseErrorsValidator),e?.updateValueAndValidity({emitEvent:!1}))}};var Lt=class{_cd;constructor(e){this._cd=e}get isTouched(){return this._cd?.control?._touched?.(),!!this._cd?.control?.touched}get isUntouched(){return!!this._cd?.control?.untouched}get isPristine(){return this._cd?.control?._pristine?.(),!!this._cd?.control?.pristine}get isDirty(){return!!this._cd?.control?.dirty}get isValid(){return this._cd?.control?._status?.(),!!this._cd?.control?.valid}get isInvalid(){return!!this._cd?.control?.invalid}get isPending(){return!!this._cd?.control?.pending}get isSubmitted(){return this._cd?._submitted?.(),!!this._cd?.submitted}};var Vi=(()=>{class n extends Lt{constructor(t){super(t)}static ɵfac=function(a){return new(a||n)(ze$1(at,2))};static ɵdir=Fu({type:n,selectors:[[``,`formControlName`,``],[``,`ngModel`,``],[``,`formControl`,``]],hostVars:14,hostBindings:function(a,o){a&2&&gg(`ng-untouched`,o.isUntouched)(`ng-touched`,o.isTouched)(`ng-pristine`,o.isPristine)(`ng-dirty`,o.isDirty)(`ng-valid`,o.isValid)(`ng-invalid`,o.isInvalid)(`ng-pending`,o.isPending)},standalone:!1,features:[Fh]})}return n})();var Fi=(()=>{class n extends Lt{constructor(t){super(t)}static ɵfac=function(a){return new(a||n)(ze$1(L,10))};static ɵdir=Fu({type:n,selectors:[[``,`formGroupName`,``],[``,`formArrayName`,``],[``,`ngModelGroup`,``],[``,`formGroup`,``],[``,`formArray`,``],[`form`,3,`ngNoForm`,``],[``,`ngForm`,``]],hostVars:16,hostBindings:function(a,o){a&2&&gg(`ng-untouched`,o.isUntouched)(`ng-touched`,o.isTouched)(`ng-pristine`,o.isPristine)(`ng-dirty`,o.isDirty)(`ng-valid`,o.isValid)(`ng-invalid`,o.isInvalid)(`ng-pending`,o.isPending)(`ng-submitted`,o.isSubmitted)},standalone:!1,features:[Fh]})}return n})();var Bt=class extends Tt{constructor(e,t,a){super(On(t),Tn(a,t)),this.controls=e,this._initObservables(),this._setUpdateStrategy(t),this._setUpControls(),this.updateValueAndValidity({onlySelf:!0,emitEvent:!!this.asyncValidator})}controls;registerControl(e,t){return this._find(e)||(this.controls[e]=t,t.setParent(this),t._registerOnCollectionChange(this._onCollectionChange),t)}addControl(e,t,a={}){this.registerControl(e,t),this.updateValueAndValidity({emitEvent:a.emitEvent}),this._onCollectionChange()}removeControl(e,t={}){let a=this._find(e);a&&a._registerOnCollectionChange(()=>{}),delete this.controls[e],this.updateValueAndValidity({emitEvent:t.emitEvent}),this._onCollectionChange()}setControl(e,t,a={}){let o=this._find(e);o&&o._registerOnCollectionChange(()=>{}),delete this.controls[e],t&&this.registerControl(e,t),this.updateValueAndValidity({emitEvent:a.emitEvent}),this._onCollectionChange()}contains(e){return this._find(e)?.enabled===!0}setValue(e,t={}){yo(()=>{wa(this,!0,e),Object.keys(e).forEach(a=>{Ma(this,!0,a),this.controls[a].setValue(e[a],{onlySelf:!0,emitEvent:t.emitEvent})}),this.updateValueAndValidity(t)})}patchValue(e,t={}){e!=null&&(Object.keys(e).forEach(a=>{let o=this._find(a);o&&o.patchValue(e[a],{onlySelf:!0,emitEvent:t.emitEvent})}),this.updateValueAndValidity(t))}reset(e={},t={}){this._forEachChild((a,o)=>{a.reset(e?e[o]:null,K$1(V({},t),{onlySelf:!0}))}),this._updatePristine(t,this),this._updateTouched(t,this),this.updateValueAndValidity(t),t?.emitEvent!==!1&&this._events.next(new nt(this))}getRawValue(){return this._reduceChildren({},(e,t,a)=>(e[a]=t.getRawValue(),e))}_syncPendingControls(){let e=this._reduceChildren(!1,(t,a)=>a._syncPendingControls()?!0:t);return e&&this.updateValueAndValidity({onlySelf:!0}),e}_forEachChild(e){Object.keys(this.controls).forEach(t=>{let a=this.controls[t];a&&e(a,t)})}_setUpControls(){this._forEachChild(e=>{e.setParent(this),e._registerOnCollectionChange(this._onCollectionChange)})}_updateValue(){this.value=this._reduceValue()}_anyControls(e){for(let[t,a]of Object.entries(this.controls))if(this.contains(t)&&e(a))return!0;return!1}_reduceValue(){return this._reduceChildren({},(t,a,o)=>((a.enabled||this.disabled)&&(t[o]=a.value),t))}_reduceChildren(e,t){let a=e;return this._forEachChild((o,r)=>{a=t(a,o,r)}),a}_allControlsDisabled(){for(let e of Object.keys(this.controls))if(this.controls[e].enabled)return!1;return Object.keys(this.controls).length>0||this.disabled}_find(e){return Rn(this.controls,e)?this.controls[e]:null}};var Xa={provide:L,useExisting:yi(()=>Qa)};var ht=Promise.resolve();var Qa=(()=>{class n extends L{callSetDisabledState;get submitted(){return yo(this.submittedReactive)}_submitted=Ku(()=>this.submittedReactive());submittedReactive=ue$1(!1);_directives=new Set;form;ngSubmit=new nt$1;options;constructor(t,a,o){super(),this.callSetDisabledState=o,this.form=new Bt({},be(t),fe(a))}ngAfterViewInit(){this._setUpdateStrategy()}get formDirective(){return this}get control(){return this.form}get path(){return[]}get controls(){return this.form.controls}addControl(t){ht.then(()=>{t.control=this._findContainer(t.path).registerControl(t.name,t.control),t._setupWithForm(this.callSetDisabledState),t.control.updateValueAndValidity({emitEvent:!1}),this._directives.add(t)})}getControl(t){return this.form.get(t.path)}removeControl(t){ht.then(()=>{this._findContainer(t.path)?.removeControl(t.name),this._directives.delete(t)})}addFormGroup(t){ht.then(()=>{let a=this._findContainer(t.path),o=new Bt({});jn(o,t),a.registerControl(t.name,o),o.updateValueAndValidity({emitEvent:!1})})}removeFormGroup(t){ht.then(()=>{this._findContainer(t.path)?.removeControl?.(t.name)})}getFormGroup(t){return this.form.get(t.path)}updateModel(t,a){ht.then(()=>{this.form.get(t.path).setValue(a)})}setValue(t){this.control.setValue(t)}onSubmit(t){return this.submittedReactive.set(!0),Un(this.form,this._directives),this.ngSubmit.emit(t),this.form._events.next(new Ot(this.control)),t?.target?.method===`dialog`}onReset(){this.resetForm()}resetForm(t=void 0){this.form.reset(t),this.submittedReactive.set(!1)}_setUpdateStrategy(){this.options&&this.options.updateOn!=null&&(this.form._updateOn=this.options.updateOn)}_findContainer(t){return t.pop(),t.length?this.form.get(t):this.form}static ɵfac=function(a){return new(a||n)(ze$1(K,10),ze$1(pe,10),ze$1(Gt,8))};static ɵdir=Fu({type:n,selectors:[[`form`,3,`ngNoForm`,``,3,`formGroup`,``,3,`formArray`,``],[`ng-form`],[``,`ngForm`,``]],hostBindings:function(a,o){a&1&&ig(`submit`,function(i){return o.onSubmit(i)})(`reset`,function(){return o.onReset()})},inputs:{options:[0,`ngFormOptions`,`options`]},outputs:{ngSubmit:`ngSubmit`},exportAs:[`ngForm`],standalone:!1,features:[PI([Xa]),Fh]})}return n})();function fn(n,e){let t=n.indexOf(e);t>-1&&n.splice(t,1)}function hn(n){return typeof n==`object`&&n!==null&&Object.keys(n).length===2&&`value`in n&&`disabled`in n}var zn=class extends Tt{defaultValue=null;_onChange=[];_pendingValue;_pendingChange=!1;constructor(e=null,t,a){super(On(t),Tn(a,t)),this._applyFormState(e),this._setUpdateStrategy(t),this._initObservables(),this.updateValueAndValidity({onlySelf:!0,emitEvent:!!this.asyncValidator}),Ut(t)&&(t.nonNullable||t.initialValueIsDefault)&&(hn(e)?this.defaultValue=e.value:this.defaultValue=e)}setValue(e,t={}){yo(()=>{this.value=this._pendingValue=e,this._onChange.length&&t.emitModelToViewChange!==!1&&this._onChange.forEach(a=>a(this.value,t.emitViewToModelChange!==!1)),this.updateValueAndValidity(t)})}patchValue(e,t={}){this.setValue(e,t)}reset(e=this.defaultValue,t={}){this._applyFormState(e),this.markAsPristine(t),this.markAsUntouched(t),this.setValue(this.value,t),t.overwriteDefaultValue&&(this.defaultValue=this.value),this._pendingChange=!1,t?.emitEvent!==!1&&this._events.next(new nt(this))}_updateValue(){}_anyControls(e){return!1}_allControlsDisabled(){return this.disabled}registerOnChange(e){this._onChange.push(e)}_unregisterOnChange(e){fn(this._onChange,e)}registerOnDisabledChange(e){this._onDisabledChange.push(e)}_unregisterOnDisabledChange(e){fn(this._onDisabledChange,e)}_forEachChild(e){}_syncPendingControls(){return this.updateOn===`submit`&&(this._pendingDirty&&this.markAsDirty(),this._pendingTouched&&this.markAsTouched(),this._pendingChange)?(this.setValue(this._pendingValue,{onlySelf:!0,emitModelToViewChange:!1}),!0):!1}_applyFormState(e){hn(e)?(this.value=this._pendingValue=e.value,e.disabled?this.disable({onlySelf:!0,emitEvent:!1}):this.enable({onlySelf:!0,emitEvent:!1})):this.value=this._pendingValue=e}};var Ja=n=>n instanceof zn;var to=(()=>{class n extends L{callSetDisabledState;get submitted(){return yo(this._submittedReactive)}set submitted(t){this._submittedReactive.set(t)}_submitted=Ku(()=>this._submittedReactive());_submittedReactive=ue$1(!1);_oldForm;_onCollectionChange=()=>this._updateDomValue();directives=[];constructor(t,a,o){super(),this.callSetDisabledState=o,this._setValidators(t),this._setAsyncValidators(a)}ngOnChanges(t){this.onChanges(t)}ngOnDestroy(){this.onDestroy()}onChanges(t){if(!this.form)throw new v(1052,!1);Object.hasOwn(t,`form`)&&(this._updateValidators(),this._updateDomValue(),this._updateRegistrations(),this._oldForm=this.form)}onDestroy(){this.form&&(Pt(this.form,this),this.form._onCollectionChange===this._onCollectionChange&&this.form._registerOnCollectionChange(()=>{}))}get formDirective(){return this}get path(){return[]}addControl(t){let a=this.form.get(t.path);return t._setupWithForm(a,this.callSetDisabledState),a.updateValueAndValidity({emitEvent:!1}),this.directives.push(t),a}getControl(t){return this.form.get(t.path)}removeControl(t){bn(t.control||null,t,!1),Ka(this.directives,t)}addFormGroup(t){this._setUpFormContainer(t)}removeFormGroup(t){this._cleanUpFormContainer(t)}getFormGroup(t){return this.form.get(t.path)}getFormArray(t){return this.form.get(t.path)}addFormArray(t){this._setUpFormContainer(t)}removeFormArray(t){this._cleanUpFormContainer(t)}updateModel(t,a){this.form.get(t.path).setValue(a)}onReset(){this.resetForm()}resetForm(t=void 0,a={}){this.form.reset(t,a),this._submittedReactive.set(!1)}onSubmit(t){return this.submitted=!0,Un(this.form,this.directives),this.ngSubmit.emit(t),this.form._events.next(new Ot(this.control)),t?.target?.method===`dialog`}_updateDomValue(){this.directives.forEach(t=>{let a=t.control,o=this.form.get(t.path);a!==o&&(bn(a||null,t),Ja(o)&&t._setupWithForm(o,this.callSetDisabledState))}),this.form._updateTreeValidity({emitEvent:!1})}_setUpFormContainer(t){let a=this.form.get(t.path);jn(a,t),a.updateValueAndValidity({emitEvent:!1})}_cleanUpFormContainer(t){let a=this.form?.get(t.path);a&&$a(a,t)&&a.updateValueAndValidity({emitEvent:!1})}_updateRegistrations(){this.form._registerOnCollectionChange(this._onCollectionChange),this._oldForm?._registerOnCollectionChange(()=>{})}_updateValidators(){ge(this.form,this),this._oldForm&&Pt(this._oldForm,this)}static ɵfac=function(a){return new(a||n)(ze$1(K,10),ze$1(pe,10),ze$1(Gt,8))};static ɵdir=Fu({type:n,features:[Fh,nu]})}return n})();var eo={provide:L,useExisting:yi(()=>no)};var no=(()=>{class n extends to{form=null;ngSubmit=new nt$1;get control(){return this.form}static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[``,`formGroup`,``]],hostBindings:function(a,o){a&1&&ig(`submit`,function(i){return o.onSubmit(i)})(`reset`,function(){return o.onReset()})},inputs:{form:[0,`formGroup`,`form`]},outputs:{ngSubmit:`ngSubmit`},exportAs:[`ngForm`],standalone:!1,features:[PI([eo]),Fh]})}return n})();var ao={provide:at,useExisting:yi(()=>oo)};var gn=Promise.resolve();var oo=(()=>{class n extends at{_changeDetectorRef;callSetDisabledState;control=new zn;static ngAcceptInputType_isDisabled;_registered=!1;_ngModelInjector;viewModel;name=``;isDisabled;model;options;update=new nt$1;constructor(t,a,o,r,i,m,b,f){super(b,f,r),this._changeDetectorRef=i,this.callSetDisabledState=m,this._parent=t,this._setValidators(a),this._setAsyncValidators(o)}ngOnChanges(t){if(this._registered,this._checkForErrors(),!this._registered||`name`in t){if(this._registered&&(this._checkName(),this.formDirective)){let a=t.name.previousValue;this.formDirective.removeControl({name:a,path:this._getPath(a)})}this._setUpControl()}`isDisabled`in t&&this._updateDisabled(t),Wa(t,this.viewModel)&&(this._updateValue(this.model),this.viewModel=this.model)}ngOnDestroy(){this.formDirective?.removeControl(this)}ɵngControlCreate(t){super.ngControlCreate(t)}ɵngControlUpdate(t){super.ngControlUpdate(t,!1)}get shouldBindRequired(){return!1}get path(){return this._getPath(this.name)}get formDirective(){return this._parent?this._parent.formDirective:null}viewToModelUpdate(t){this.viewModel=t,this.update.emit(t)}_setUpControl(){this._setUpdateStrategy(),this._isStandalone()?this._setUpStandalone():this.formDirective.addControl(this),this._registered=!0}_setUpdateStrategy(){this.options&&this.options.updateOn!=null&&(this.control._updateOn=this.options.updateOn)}_isStandalone(){return!this._parent||!!(this.options&&this.options.standalone)}_setUpStandalone(){this.isCustomControlBased?this.setupCustomControl():(this.valueAccessor??=this.selectedValueAccessor,pn(this.control,this,this.callSetDisabledState)),this.control.updateValueAndValidity({emitEvent:!1})}_setupWithForm(t){this.isCustomControlBased?this.setupCustomControl():(this.valueAccessor??=this.selectedValueAccessor,pn(this.control,this,t))}_checkForErrors(){this._checkName()}_checkName(){this.options&&this.options.name&&(this.name=this.options.name),!this._isStandalone()&&this.name}_updateValue(t){gn.then(()=>{this.control.setValue(t,{emitViewToModelChange:!1}),this._changeDetectorRef?.markForCheck()})}_updateDisabled(t){let a=t.isDisabled.currentValue,o=a!==0&&gC(a);gn.then(()=>{o&&!this.control.disabled?this.control.disable():!o&&this.control.disabled&&this.control.enable(),this._changeDetectorRef?.markForCheck()})}_getPath(t){return this._parent?ja(t,this._parent):[t]}static ɵfac=function(a){return new(a||n)(ze$1(L,9),ze$1(K,10),ze$1(pe,10),ze$1(yt,10),ze$1(Vg,8),ze$1(Gt,8),ze$1(oe$1,8),ze$1(io$1,8))};static ɵdir=Fu({type:n,selectors:[[``,`ngModel`,``,3,`formControlName`,``,3,`formControl`,``]],inputs:{name:`name`,isDisabled:[0,`disabled`,`isDisabled`],model:[0,`ngModel`,`model`],options:[0,`ngModelOptions`,`options`]},outputs:{update:`ngModelChange`},exportAs:[`ngModel`],standalone:!1,features:[PI([ao,Ya]),Fh,nu,$w(null)]})}return n})();var Oi=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵdir=Fu({type:n,selectors:[[`form`,3,`ngNoForm`,``,3,`ngNativeValidate`,``]],hostAttrs:[`novalidate`,``],standalone:!1})}return n})();var ro={provide:yt,useExisting:yi(()=>io),multi:!0};var io=(()=>{class n extends jt{writeValue(t){let a=t??``;this.setProperty(`value`,a)}registerOnChange(t){this.onChange=a=>{t(a==``?null:parseFloat(a))}}static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[`input`,`type`,`number`,`formControlName`,``,3,`ngNoCva`,``],[`input`,`type`,`number`,`formControl`,``,3,`ngNoCva`,``],[`input`,`type`,`number`,`ngModel`,``,3,`ngNoCva`,``]],hostBindings:function(a,o){a&1&&ig(`input`,function(i){return o.onChange(i.target.value)})(`blur`,function(){return o.onTouched()})},standalone:!1,features:[PI([ro]),Fh]})}return n})();var so={provide:yt,useExisting:yi(()=>Hn),multi:!0};function Gn(n,e){return n==null?`${e}`:(e&&typeof e==`object`&&(e=`Object`),`${n}: ${e}`.slice(0,50))}function lo(n){return n.split(`:`)[0]}var Hn=(()=>{class n extends jt{value;_optionMap=new Map;_idCounter=0;set compareWith(t){this._compareWith=t}_compareWith=Object.is;appRefInjector=g(go).injector;destroyRef=g(re$1);cdr=g(Vg);_queuedWrite=!1;_writeValueAfterRender(){this._queuedWrite||this.appRefInjector.destroyed||(this._queuedWrite=!0,UD({write:()=>{this.destroyRef.destroyed||(this._queuedWrite=!1,this.writeValue(this.value))}},{injector:this.appRefInjector}))}writeValue(t){this.cdr.markForCheck(),this.value=t;let o=Gn(this._getOptionId(t),t);this.setProperty(`value`,o)}registerOnChange(t){this.onChange=a=>{this.value=this._getOptionValue(a),t(this.value)}}_registerOption(){return(this._idCounter++).toString()}_getOptionId(t){for(let a of this._optionMap.keys())if(this._compareWith(this._optionMap.get(a),t))return a;return null}_getOptionValue(t){let a=lo(t);return this._optionMap.has(a)?this._optionMap.get(a):t}static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[`select`,`formControlName`,``,3,`multiple`,``,3,`ngNoCva`,``],[`select`,`formControl`,``,3,`multiple`,``,3,`ngNoCva`,``],[`select`,`ngModel`,``,3,`multiple`,``,3,`ngNoCva`,``]],hostBindings:function(a,o){a&1&&ig(`change`,function(i){return o.onChange(i.target.value)})(`blur`,function(){return o.onTouched()})},inputs:{compareWith:`compareWith`},standalone:!1,features:[PI([so]),Fh]})}return n})();var Ti=(()=>{class n{_element;_renderer;_select;id;constructor(t,a,o){this._element=t,this._renderer=a,this._select=o,this._select&&(this.id=this._select._registerOption())}set ngValue(t){this._select!=null&&(this._select._optionMap.set(this.id,t),this._setElementValue(Gn(this.id,t)),this._select._writeValueAfterRender())}set value(t){this._setElementValue(t),this._select?._writeValueAfterRender()}_setElementValue(t){this._renderer.setProperty(this._element.nativeElement,`value`,t)}ngOnDestroy(){this._select?._optionMap.delete(this.id),this._select?._writeValueAfterRender()}static ɵfac=function(a){return new(a||n)(ze$1(mn$1),ze$1(io$1),ze$1(Hn,9))};static ɵdir=Fu({type:n,selectors:[[`option`]],inputs:{ngValue:`ngValue`,value:`value`},standalone:!1})}return n})();var co={provide:yt,useExisting:yi(()=>$n),multi:!0};function vn(n,e){return n==null?`${e}`:(typeof e==`string`&&(e=`'${e}'`),e&&typeof e==`object`&&(e=`Object`),`${n}: ${e}`.slice(0,50))}function mo(n){return n.split(`:`)[0]}var $n=(()=>{class n extends jt{value;_optionMap=new Map;_idCounter=0;set compareWith(t){this._compareWith=t}_compareWith=Object.is;writeValue(t){this.value=t;let a;if(Array.isArray(t)){let o=t.map(r=>this._getOptionId(r));a=(r,i)=>{r._setSelected(o.indexOf(i)>-1)}}else a=o=>{o._setSelected(!1)};this._optionMap.forEach(a)}registerOnChange(t){this.onChange=a=>{let o=[],r=a.selectedOptions;if(r!==void 0){let i=r;for(let m=0;m<i.length;m++){let b=i[m],f=this._getOptionValue(b.value);o.push(f)}}else{let i=a.options;for(let m=0;m<i.length;m++){let b=i[m];if(b.selected){let f=this._getOptionValue(b.value);o.push(f)}}}this.value=o,t(o)}}_registerOption(t){let a=(this._idCounter++).toString();return this._optionMap.set(a,t),a}_getOptionId(t){for(let a of this._optionMap.keys())if(this._compareWith(this._optionMap.get(a)._value,t))return a;return null}_getOptionValue(t){let a=mo(t);return this._optionMap.has(a)?this._optionMap.get(a)._value:t}static ɵfac=(()=>{let t;return function(o){return(t||(t=pp(n)))(o||n)}})();static ɵdir=Fu({type:n,selectors:[[`select`,`multiple`,``,`formControlName`,``,3,`ngNoCva`,``],[`select`,`multiple`,``,`formControl`,``,3,`ngNoCva`,``],[`select`,`multiple`,``,`ngModel`,``,3,`ngNoCva`,``]],hostBindings:function(a,o){a&1&&ig(`change`,function(i){return o.onChange(i.target)})(`blur`,function(){return o.onTouched()})},inputs:{compareWith:`compareWith`},standalone:!1,features:[PI([co]),Fh]})}return n})();var Ri=(()=>{class n{_element;_renderer;_select;id;_value;constructor(t,a,o){this._element=t,this._renderer=a,this._select=o,this._select&&(this.id=this._select._registerOption(this))}set ngValue(t){this._select!=null&&(this._value=t,this._setElementValue(vn(this.id,t)),this._select.writeValue(this._select.value))}set value(t){this._select?(this._value=t,this._setElementValue(vn(this.id,t)),this._select.writeValue(this._select.value)):this._setElementValue(t)}_setElementValue(t){this._renderer.setProperty(this._element.nativeElement,`value`,t)}_setSelected(t){this._renderer.setProperty(this._element.nativeElement,`selected`,t)}ngOnDestroy(){this._select&&(this._select._optionMap.delete(this.id),this._select.writeValue(this._select.value))}static ɵfac=function(a){return new(a||n)(ze$1(mn$1),ze$1(io$1),ze$1($n,9))};static ɵdir=Fu({type:n,selectors:[[`option`]],inputs:{ngValue:`ngValue`,value:`value`},standalone:!1})}return n})();var uo=(()=>{class n{static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({})}return n})();var Pi=(()=>{class n{static withConfig(t){return{ngModule:n,providers:[{provide:Gt,useValue:t.callSetDisabledState??he}]}}static ɵfac=function(a){return new(a||n)};static ɵmod=Lu({type:n});static ɵinj=vi({imports:[uo]})}return n})();export{rr as A,io as C,no as D,mi as E,ui as M,yt as N,on as O,dr as S,le as T,Xo as _,Ko as a,_r as b,Oi as c,Qa as d,Ri as f,Vi as g,Ti as h,K as i,te as j,oo as k,Pi as l,Ta as m,Hn as n,La as o,Sr as p,J as r,Lo as s,Fi as t,Pr as u,Yn as v,ka as w,at as x,_n as y};