import{$ as LE,An as fV,B as Hi$1,Br as xE,Bt as V,Cn as ea,Ct as Qb,Dt as Rd,En as ei$1,Et as RE,F as GI,Gn as ig,Gt as Vu,In as gg,It as Ty,K as Je$1,Kn as io,Lr as wg,M as Fu,Mr as vi$1,N as Fw,Nn as g,O as FE,Or as ue,P as GB,Pt as Tg,Q as Ku,Qn as kj,Qt as Xh,Rr as wr,Rt as Uu,Sn as eI,St as QE,Tn as eg,Tr as ta,Ut as Vg,V as Hm,Vn as hV,Wt as Vt,X as Kb,Xr as zo,Xt as XE,Y as K,Yt as Wo,Zn as kd,_n as cg,_r as re$1,an as _I,dt as Nm,en as YE,er as lg,et as LI,ft as Ny,g as Cg,gn as cV,gr as qu,h as Ce,i as $l,ir as ne,jt as Sn$1,kn as fT,kr as ug,kt as Rt,l as Ay,ln as aV,m as CI,mt as OI,nn as ZE,nr as mn,nt as Lu,o as $u,on as _j,p as C,pn as bm,q as Jh,qr as z,qt as Wd,rn as Zr,rr as nI,sr as nu,st as N,t as $E,ur as oo,ut as Nj,vt as PE,w as Er,wn as ee,wr as tI,wt as Qh,xn as dg,xr as sb,xt as Q,yn as cs,yr as rg,z as Hh,zn as hC}from"./chunk-Dg_jPLlI.js";import{A as je,D as dn,O as fe,b as Fe$1,h as q,j as yn$1,k as he}from"./main-2JMPNU7S.js";import{C as ud,E as yo,S as rn,T as wc,_ as hd,a as Mi$1,b as pd,c as Ra,d as Vr,f as Vs,g as gr,h as bd,i as Kt,l as St$1,m as ac,n as G,o as Ni$1,p as Zr$1,r as Ii$1,s as Ps,t as Fi$1,u as Ui$1,v as ic,w as ui$1,x as rc,y as nc}from"./chunk-D68jew_r.js";var un=Symbol(`FIELD_TREE`);function Fe(n){return typeof n==`function`&&n[un]===!0}var hn=new C(``);var _t=class{_box;_destroyed=new ne;_resizeSubject=new ne;_resizeObserver;_elementObservables=new Map;constructor(r){this._box=r,typeof ResizeObserver<`u`&&(this._resizeObserver=new ResizeObserver(e=>this._resizeSubject.next(e)))}observe(r){return this._elementObservables.has(r)||this._elementObservables.set(r,new N(e=>{let t=this._resizeSubject.subscribe(e);return this._resizeObserver?.observe(r,{box:this._box}),()=>{this._resizeObserver?.unobserve(r),t.unsubscribe(),this._elementObservables.delete(r)}}).pipe(Sn$1(e=>e.some(t=>t.target===r)),Ay({bufferSize:1,refCount:!0}),$l(this._destroyed))),this._elementObservables.get(r)}destroy(){this._destroyed.next(),this._destroyed.complete(),this._resizeSubject.complete(),this._elementObservables.clear()}};var gn=(()=>{class n{_cleanupErrorListener;_observers=new Map;_ngZone=g(Ce);constructor(){}ngOnDestroy(){for(let[,e]of this._observers)e.destroy();this._observers.clear(),this._cleanupErrorListener?.()}observe(e,t){let i=t?.box||`content-box`;return this._observers.has(i)||this._observers.set(i,new _t(i)),this._observers.get(i).observe(e)}static ɵfac=function(t){return new(t||n)};static ɵprov=Rt({token:n,factory:n.ɵfac})}return n})();var re=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵdir=Fu({type:n,selectors:[[`mat-label`]]})}return n})();var Kn=new C(`MatError`);var ae=(()=>{class n{align=`start`;id=g(je).getId(`mat-mdc-hint-`);static ɵfac=function(t){return new(t||n)};static ɵdir=Fu({type:n,selectors:[[`mat-hint`]],hostAttrs:[1,`mat-mdc-form-field-hint`,`mat-mdc-form-field-bottom-align`],hostVars:4,hostBindings:function(t,i){t&2&&(rg(`id`,i.id),Qh(`align`,null),gg(`mat-mdc-form-field-hint-end`,i.align===`end`))},inputs:{align:`align`,id:`id`}})}return n})();var Wn=new C(`MatPrefix`);var Un=new C(`MatSuffix`);var wn=new C(`FloatingLabelParent`);var bn=(()=>{class n{_elementRef=g(mn);get floating(){return this._floating}set floating(e){this._floating=e,this.monitorResize&&this._handleResize()}_floating=!1;get monitorResize(){return this._monitorResize}set monitorResize(e){this._monitorResize=e,this._monitorResize?this._subscribeToResize():this._resizeSubscription.unsubscribe()}_monitorResize=!1;_resizeObserver=g(gn);_ngZone=g(Ce);_parent=g(wn);_resizeSubscription=new ee;ngOnDestroy(){this._resizeSubscription.unsubscribe()}getWidth(){return Gn(this._elementRef.nativeElement)}get element(){return this._elementRef.nativeElement}_handleResize(){setTimeout(()=>this._parent._handleLabelResized())}_subscribeToResize(){this._resizeSubscription.unsubscribe(),this._ngZone.runOutsideAngular(()=>{this._resizeSubscription=this._resizeObserver.observe(this._elementRef.nativeElement,{box:`border-box`}).subscribe(()=>this._handleResize())})}static ɵfac=function(t){return new(t||n)};static ɵdir=Fu({type:n,selectors:[[`label`,`matFormFieldFloatingLabel`,``]],hostAttrs:[1,`mdc-floating-label`,`mat-mdc-floating-label`],hostVars:2,hostBindings:function(t,i){t&2&&gg(`mdc-floating-label--float-above`,i.floating)},inputs:{floating:`floating`,monitorResize:`monitorResize`}})}return n})();function Gn(n){let r=n;if(r.offsetParent!==null)return r.scrollWidth;let e=r.cloneNode(!0);e.style.setProperty(`position`,`absolute`),e.style.setProperty(`transform`,`translate(-9999px, -9999px)`),document.documentElement.appendChild(e);let t=e.scrollWidth;return e.remove(),t}var xn=`mdc-line-ripple--active`;var Je=`mdc-line-ripple--deactivating`;var _n=(()=>{class n{_elementRef=g(mn);_cleanupTransitionEnd;constructor(){let e=g(Ce),t=g(io);e.runOutsideAngular(()=>{this._cleanupTransitionEnd=t.listen(this._elementRef.nativeElement,`transitionend`,this._handleTransitionEnd)})}activate(){let e=this._elementRef.nativeElement.classList;e.remove(Je),e.add(xn)}deactivate(){this._elementRef.nativeElement.classList.add(Je)}_handleTransitionEnd=e=>{let t=this._elementRef.nativeElement.classList,i=t.contains(Je);e.propertyName===`opacity`&&i&&t.remove(xn,Je)};ngOnDestroy(){this._cleanupTransitionEnd()}static ɵfac=function(t){return new(t||n)};static ɵdir=Fu({type:n,selectors:[[`div`,`matFormFieldLineRipple`,``]],hostAttrs:[1,`mdc-line-ripple`]})}return n})();var vn=(()=>{class n{_elementRef=g(mn);_ngZone=g(Ce);open=!1;_notch;ngAfterViewInit(){let e=this._elementRef.nativeElement,t=e.querySelector(`.mdc-floating-label`);t?(e.classList.add(`mdc-notched-outline--upgraded`),typeof requestAnimationFrame==`function`&&(t.style.transitionDuration=`0s`,this._ngZone.runOutsideAngular(()=>{requestAnimationFrame(()=>t.style.transitionDuration=``)}))):e.classList.add(`mdc-notched-outline--no-label`)}_setNotchWidth(e){let t=this._notch.nativeElement;!this.open||!e?t.style.width=``:t.style.width=`calc(${e}px * var(--mat-mdc-form-field-floating-label-scale, 0.75) + 9px)`}_setMaxWidth(e){this._notch.nativeElement.style.setProperty(`--mat-form-field-notch-max-width`,`calc(100% - ${e}px)`)}static ɵfac=function(t){return new(t||n)};static ɵcmp=(function(){let e=[`notch`];return Fw({type:n,selectors:[[`div`,`matFormFieldNotchedOutline`,``]],viewQuery:function(a,c){if(a&1&&ug(e,5),a&2){let m;XE(m=eI())&&(c._notch=m.first)}},hostAttrs:[1,`mdc-notched-outline`],hostVars:2,hostBindings:function(a,c){a&2&&gg(`mdc-notched-outline--notched`,c.open)},inputs:{open:[0,`matFormFieldNotchedOutlineOpen`,`open`]},ngContentSelectors:[`*`],decls:5,vars:0,consts:[[`notch`,``],[1,`mat-mdc-notch-piece`,`mdc-notched-outline__leading`],[1,`mat-mdc-notch-piece`,`mdc-notched-outline__notch`],[1,`mat-mdc-notch-piece`,`mdc-notched-outline__trailing`]],template:function(a,c){a&1&&(YE(),eg(0,`div`,1),Uu(1,`div`,2,0),QE(3),$u(),eg(4,`div`,3))},encapsulation:2})})()}return n})();var vt=(()=>{class n{id;ngField=null;ngControl=null;focused=!1;empty=!1;shouldLabelFloat=!1;required=!1;disabled=!1;errorState=!1;controlType;autofilled;userAriaDescribedBy;disableAutomaticLabeling;describedByIds;stateChanges=null;value;static ɵfac=function(t){return new(t||n)};static ɵdir=Fu({type:n})}return n})();var yt=new C(`MatFormField`);var $n=new C(`MAT_FORM_FIELD_DEFAULT_OPTIONS`);var yn=`fill`;var Yn=`auto`;var Sn=`fixed`;var Zn=`translateY(-50%)`;var _e=(()=>{class n{_elementRef=g(mn);_changeDetectorRef=g(Vg);_platform=g(he);_idGenerator=g(je);_ngZone=g(Ce);_defaults=g($n,{optional:!0});_currentDirection;_unwrapMaybeSignal(e){return Zr(e)?e():e}_textField;_iconPrefixContainer;_textPrefixContainer;_iconSuffixContainer;_textSuffixContainer;_floatingLabel;_notchedOutline;_lineRipple;_iconPrefixContainerSignal=_j(`iconPrefixContainer`);_textPrefixContainerSignal=_j(`textPrefixContainer`);_iconSuffixContainerSignal=_j(`iconSuffixContainer`);_textSuffixContainerSignal=_j(`textSuffixContainer`);_prefixSuffixContainers=Ku(()=>[this._iconPrefixContainerSignal(),this._textPrefixContainerSignal(),this._iconSuffixContainerSignal(),this._textSuffixContainerSignal()].map(e=>e?.nativeElement).filter(e=>e!==void 0));_formFieldControl;_prefixChildren;_suffixChildren;_errorChildren;_hintChildren;_labelChild=Nj(re);get hideRequiredMarker(){return this._hideRequiredMarker}set hideRequiredMarker(e){this._hideRequiredMarker=Zr$1(e)}_hideRequiredMarker=!1;color=`primary`;get floatLabel(){return this._floatLabel||this._defaults?.floatLabel||Yn}set floatLabel(e){e!==this._floatLabel&&(this._floatLabel=e,this._changeDetectorRef.markForCheck())}_floatLabel;get appearance(){return this._appearanceSignal()}set appearance(e){let t=e||this._defaults?.appearance||yn;this._appearanceSignal.set(t)}_appearanceSignal=ue(yn);get subscriptSizing(){return this._subscriptSizing||this._defaults?.subscriptSizing||Sn}set subscriptSizing(e){this._subscriptSizing=e||this._defaults?.subscriptSizing||Sn}_subscriptSizing=null;get hintLabel(){return this._hintLabel}set hintLabel(e){this._hintLabel=e,this._processHints()}_hintLabel=``;_hasIconPrefix=!1;_hasTextPrefix=!1;_hasIconSuffix=!1;_hasTextSuffix=!1;_labelId=this._idGenerator.getId(`mat-mdc-form-field-label-`);_hintLabelId=this._idGenerator.getId(`mat-mdc-hint-`);_describedByIds;get _control(){return this._explicitFormFieldControl||this._formFieldControl}set _control(e){this._explicitFormFieldControl=e}_destroyed=new ne;_isFocused=null;_explicitFormFieldControl;_previousControl=null;_previousControlValidatorFn=null;_stateChanges;_valueChanges;_describedByChanges;_outlineLabelOffsetResizeObserver=null;_animationsDisabled=G();constructor(){let e=this._defaults,t=g(fe);e&&(e.appearance&&(this.appearance=e.appearance),this._hideRequiredMarker=!!e?.hideRequiredMarker,e.color&&(this.color=e.color)),Hi$1(()=>this._currentDirection=t.valueSignal()),this._syncOutlineLabelOffset()}ngAfterViewInit(){this._updateFocusState(),this._animationsDisabled||this._ngZone.runOutsideAngular(()=>{setTimeout(()=>{this._elementRef.nativeElement.classList.add(`mat-form-field-animations-enabled`)},300)}),this._changeDetectorRef.detectChanges()}ngAfterContentInit(){this._assertFormFieldControl(),this._initializeSubscript(),this._initializePrefixAndSuffix()}ngAfterContentChecked(){this._assertFormFieldControl(),this._control!==this._previousControl&&(this._initializeControl(this._previousControl),this._control.ngControl&&this._control.ngControl.control&&(this._previousControlValidatorFn=Fe(this._control.ngField)?null:this._control.ngControl.control.validator),this._previousControl=this._control,this._changeDetectorRef.markForCheck()),this._control.ngControl&&this._control.ngControl.control&&!Fe(this._control.ngField)&&this._control.ngControl.control.validator!==this._previousControlValidatorFn&&this._changeDetectorRef.markForCheck()}ngOnDestroy(){this._outlineLabelOffsetResizeObserver?.disconnect(),this._stateChanges?.unsubscribe(),this._valueChanges?.unsubscribe(),this._describedByChanges?.unsubscribe(),this._destroyed.next(),this._destroyed.complete()}getLabelId=Ku(()=>this._hasFloatingLabel()?this._labelId:null);getConnectedOverlayOrigin(){return this._textField||this._elementRef}_animateAndLockLabel(){this._hasFloatingLabel()&&(this.floatLabel=`always`)}_initializeControl(e){let t=this._control,i=`mat-mdc-form-field-type-`;e&&this._elementRef.nativeElement.classList.remove(i+e.controlType),t.controlType&&this._elementRef.nativeElement.classList.add(i+t.controlType),this._stateChanges?.unsubscribe(),this._stateChanges=t.stateChanges?.subscribe(()=>{this._updateFocusState(),this._changeDetectorRef.markForCheck()}),this._describedByChanges?.unsubscribe(),this._describedByChanges=t.stateChanges?.pipe(ei$1([void 0,void 0]),z(()=>[this._unwrapMaybeSignal(t.errorState),t.userAriaDescribedBy]),Ny(),Sn$1(([[a,c],[m,b]])=>a!==m||c!==b)).subscribe(()=>this._syncDescribedByIds()),this._valueChanges?.unsubscribe(),t.ngControl&&t.ngControl.valueChanges&&!Fe(t.ngField)&&(this._valueChanges=t.ngControl.valueChanges.pipe($l(this._destroyed)).subscribe(()=>this._changeDetectorRef.markForCheck()))}_checkPrefixAndSuffixTypes(){this._hasIconPrefix=!!this._prefixChildren.find(e=>!e._isText),this._hasTextPrefix=!!this._prefixChildren.find(e=>e._isText),this._hasIconSuffix=!!this._suffixChildren.find(e=>!e._isText),this._hasTextSuffix=!!this._suffixChildren.find(e=>e._isText)}_initializePrefixAndSuffix(){this._checkPrefixAndSuffixTypes(),Ty(this._prefixChildren.changes,this._suffixChildren.changes).subscribe(()=>{this._checkPrefixAndSuffixTypes(),this._changeDetectorRef.markForCheck()})}_initializeSubscript(){this._hintChildren.changes.subscribe(()=>{this._processHints(),this._changeDetectorRef.markForCheck()}),this._errorChildren.changes.subscribe(()=>{this._syncDescribedByIds(),this._changeDetectorRef.markForCheck()}),this._validateHints(),this._syncDescribedByIds()}_assertFormFieldControl(){this._control}_updateFocusState(){let e=this._unwrapMaybeSignal(this._control.focused);e&&!this._isFocused?(this._isFocused=!0,this._lineRipple?.activate()):!e&&(this._isFocused||this._isFocused===null)&&(this._isFocused=!1,this._lineRipple?.deactivate()),this._elementRef.nativeElement.classList.toggle(`mat-focused`,e),this._textField?.nativeElement.classList.toggle(`mdc-text-field--focused`,e)}_syncOutlineLabelOffset(){kj({earlyRead:()=>{if(this._appearanceSignal()!==`outline`)return this._outlineLabelOffsetResizeObserver?.disconnect(),null;if(globalThis.ResizeObserver){this._outlineLabelOffsetResizeObserver||=new globalThis.ResizeObserver(()=>{this._writeOutlinedLabelStyles(this._getOutlinedLabelOffset())});for(let e of this._prefixSuffixContainers())this._outlineLabelOffsetResizeObserver.observe(e,{box:`border-box`})}return this._getOutlinedLabelOffset()},write:e=>this._writeOutlinedLabelStyles(e())})}_shouldAlwaysFloat(){return this.floatLabel===`always`}_hasOutline(){return this.appearance===`outline`}_forceDisplayInfixLabel(){return!this._platform.isBrowser&&this._prefixChildren.length&&!this._shouldLabelFloat()}_hasFloatingLabel=Ku(()=>!!this._labelChild());_shouldLabelFloat(){return this._hasFloatingLabel()?this._shouldAlwaysFloat()||this._unwrapMaybeSignal(this._control.shouldLabelFloat):!1}_shouldForward(e){let t=this._control?.ngField||this._control?.ngControl;if(!t)return!1;if(Fe(t)){let i=t();return e===`valid`?i.valid():e===`dirty`?i.dirty():e===`touched`?i.touched():e===`pending`?i.pending():e===`untouched`?!i.touched():e===`pristine`?!i.dirty():e===`invalid`?!i.valid():!1}else{let i=t;return e===`valid`?i.valid:e===`dirty`?i.dirty:e===`touched`?i.touched:e===`pending`?i.pending:e===`untouched`?i.untouched:e===`pristine`?i.pristine:e===`invalid`?i.invalid:!1}}_getSubscriptMessageType(){return this._errorChildren&&this._errorChildren.length>0&&this._unwrapMaybeSignal(this._control.errorState)?`error`:`hint`}_handleLabelResized(){this._refreshOutlineNotchWidth()}_refreshOutlineNotchWidth(){!this._hasOutline()||!this._floatingLabel||!this._shouldLabelFloat()?this._notchedOutline?._setNotchWidth(0):this._notchedOutline?._setNotchWidth(this._floatingLabel.getWidth())}_processHints(){this._validateHints(),this._syncDescribedByIds()}_validateHints(){this._hintChildren}_syncDescribedByIds(){if(this._control){let e=[];if(this._control.userAriaDescribedBy&&typeof this._control.userAriaDescribedBy==`string`&&e.push(...this._control.userAriaDescribedBy.split(` `)),this._getSubscriptMessageType()===`hint`){let a=this._hintChildren?this._hintChildren.find(m=>m.align===`start`):null,c=this._hintChildren?this._hintChildren.find(m=>m.align===`end`):null;a?e.push(a.id):this._hintLabel&&e.push(this._hintLabelId),c&&e.push(c.id)}else this._errorChildren&&e.push(...this._errorChildren.map(a=>a.id));let t=this._control.describedByIds,i;if(t){let a=this._describedByIds||e;i=e.concat(t.filter(c=>c&&!a.includes(c)))}else i=e;this._control.setDescribedByIds(i),this._describedByIds=e}}_getOutlinedLabelOffset(){if(!this._hasOutline()||!this._floatingLabel)return null;if(!this._iconPrefixContainer&&!this._textPrefixContainer)return[``,null];if(!this._isAttachedToDom())return null;let e=this._iconPrefixContainer?.nativeElement,t=this._textPrefixContainer?.nativeElement,i=this._iconSuffixContainer?.nativeElement,a=this._textSuffixContainer?.nativeElement,c=e?.getBoundingClientRect().width??0,m=t?.getBoundingClientRect().width??0,b=i?.getBoundingClientRect().width??0,D=a?.getBoundingClientRect().width??0;return[`var(--mat-mdc-form-field-label-transform, ${Zn} translateX(${`calc(${this._currentDirection===`rtl`?`-1`:`1`} * (${`${c+m}px`} + var(--mat-mdc-form-field-label-offset-x, 0px)))`}))`,c+m+b+D]}_writeOutlinedLabelStyles(e){if(e!==null){let[t,i]=e;this._floatingLabel&&(this._floatingLabel.element.style.transform=t),i!==null&&this._notchedOutline?._setMaxWidth(i)}}_isAttachedToDom(){let e=this._elementRef.nativeElement;if(e.getRootNode){let t=e.getRootNode();return t&&t!==e}return document.documentElement.contains(e)}static ɵfac=function(t){return new(t||n)};static ɵcmp=(function(){let e=[`iconPrefixContainer`],t=[`textPrefixContainer`],i=[`iconSuffixContainer`],a=[`textSuffixContainer`],c=[`textField`],m=[`*`,[[`mat-label`]],[[``,`matPrefix`,``],[``,`matIconPrefix`,``]],[[``,`matTextPrefix`,``]],[[``,`matTextSuffix`,``]],[[``,`matSuffix`,``],[``,`matIconSuffix`,``]],[[`mat-error`],[``,`matError`,``]],[[`mat-hint`,3,`align`,`end`]],[[`mat-hint`,`align`,`end`]]],b=[`*`,`mat-label`,`[matPrefix], [matIconPrefix]`,`[matTextPrefix]`,`[matTextSuffix]`,`[matSuffix], [matIconSuffix]`,`mat-error, [matError]`,`mat-hint:not([align='end'])`,`mat-hint[align='end']`];function D(g,y){g&1&&Xh(0,`span`,21)}function J(g,y){if(g&1&&(cs(0,`label`,20),QE(1,1),xE(2,D,1,0,`span`,21),Vu()),g&2){let s=ZE(2);Jh(`floating`,s._shouldLabelFloat())(`monitorResize`,s._hasOutline())(`id`,s._labelId),Qh(`for`,s._control.disableAutomaticLabeling?null:s._control.id),sb(2),RE(!s.hideRequiredMarker&&s._unwrapMaybeSignal(s._control.required)?2:-1)}}function ve(g,y){if(g&1&&xE(0,J,3,5,`label`,20),g&2){let s=ZE();RE(s._hasFloatingLabel()?0:-1)}}function ye(g,y){g&1&&Xh(0,`div`,7)}function le(g,y){}function ee(g,y){if(g&1&&Hh(0,le,0,0,`ng-template`,13),g&2){ZE(2);let s=nI(1);Jh(`ngTemplateOutlet`,s)}}function v(g,y){if(g&1&&(cs(0,`div`,9),xE(1,ee,1,1,null,13),Vu()),g&2){let s=ZE();Jh(`matFormFieldNotchedOutlineOpen`,s._shouldLabelFloat()),sb(),RE(s._forceDisplayInfixLabel()?-1:1)}}function P(g,y){g&1&&(cs(0,`div`,10,2),QE(2,2),Vu())}function K(g,y){g&1&&(cs(0,`div`,11,3),QE(2,3),Vu())}function ke(g,y){}function On(g,y){if(g&1&&Hh(0,ke,0,0,`ng-template`,13),g&2){ZE();let s=nI(1);Jh(`ngTemplateOutlet`,s)}}function Ln(g,y){g&1&&(cs(0,`div`,14,4),QE(2,4),Vu())}function zn(g,y){g&1&&(cs(0,`div`,15,5),QE(2,5),Vu())}function Vn(g,y){g&1&&Xh(0,`div`,16)}function Hn(g,y){g&1&&(cs(0,`div`,18),QE(1,6),Vu())}function Bn(g,y){if(g&1&&(cs(0,`mat-hint`,22),CI(1),Vu()),g&2){let s=ZE(2);Jh(`id`,s._hintLabelId),sb(),wg(s.hintLabel)}}function jn(g,y){if(g&1&&(cs(0,`div`,19),xE(1,Bn,2,2,`mat-hint`,22),QE(2,7),Xh(3,`div`,23),QE(4,8),Vu()),g&2){let s=ZE();sb(),RE(s.hintLabel?1:-1)}}return Fw({type:n,selectors:[[`mat-form-field`]],contentQueries:function(y,s,S){if(y&1&&(lg(S,s._labelChild,re,5),cg(S,vt,5)(S,Wn,5)(S,Un,5)(S,Kn,5)(S,ae,5)),y&2){tI();let F;XE(F=eI())&&(s._formFieldControl=F.first),XE(F=eI())&&(s._prefixChildren=F),XE(F=eI())&&(s._suffixChildren=F),XE(F=eI())&&(s._errorChildren=F),XE(F=eI())&&(s._hintChildren=F)}},viewQuery:function(y,s){if(y&1&&(dg(s._iconPrefixContainerSignal,e,5)(s._textPrefixContainerSignal,t,5)(s._iconSuffixContainerSignal,i,5)(s._textSuffixContainerSignal,a,5),ug(c,5)(e,5)(t,5)(i,5)(a,5)(bn,5)(vn,5)(_n,5)),y&2){tI(4);let S;XE(S=eI())&&(s._textField=S.first),XE(S=eI())&&(s._iconPrefixContainer=S.first),XE(S=eI())&&(s._textPrefixContainer=S.first),XE(S=eI())&&(s._iconSuffixContainer=S.first),XE(S=eI())&&(s._textSuffixContainer=S.first),XE(S=eI())&&(s._floatingLabel=S.first),XE(S=eI())&&(s._notchedOutline=S.first),XE(S=eI())&&(s._lineRipple=S.first)}},hostAttrs:[1,`mat-mdc-form-field`],hostVars:38,hostBindings:function(y,s){y&2&&gg(`mat-mdc-form-field-label-always-float`,s._shouldAlwaysFloat())(`mat-mdc-form-field-has-icon-prefix`,s._hasIconPrefix)(`mat-mdc-form-field-has-icon-suffix`,s._hasIconSuffix)(`mat-form-field-invalid`,s._unwrapMaybeSignal(s._control.errorState))(`mat-form-field-disabled`,s._unwrapMaybeSignal(s._control.disabled))(`mat-form-field-autofilled`,s._unwrapMaybeSignal(s._control.autofilled))(`mat-form-field-appearance-fill`,s.appearance==`fill`)(`mat-form-field-appearance-outline`,s.appearance==`outline`)(`mat-form-field-hide-placeholder`,s._hasFloatingLabel()&&!s._shouldLabelFloat())(`mat-primary`,s.color!==`accent`&&s.color!==`warn`)(`mat-accent`,s.color===`accent`)(`mat-warn`,s.color===`warn`)(`ng-untouched`,s._shouldForward(`untouched`))(`ng-touched`,s._shouldForward(`touched`))(`ng-pristine`,s._shouldForward(`pristine`))(`ng-dirty`,s._shouldForward(`dirty`))(`ng-valid`,s._shouldForward(`valid`))(`ng-invalid`,s._shouldForward(`invalid`))(`ng-pending`,s._shouldForward(`pending`))},inputs:{hideRequiredMarker:`hideRequiredMarker`,color:`color`,floatLabel:`floatLabel`,appearance:`appearance`,subscriptSizing:`subscriptSizing`,hintLabel:`hintLabel`},exportAs:[`matFormField`],features:[OI([{provide:yt,useExisting:n},{provide:wn,useExisting:n}])],ngContentSelectors:b,decls:18,vars:21,consts:[[`labelTemplate`,``],[`textField`,``],[`iconPrefixContainer`,``],[`textPrefixContainer`,``],[`textSuffixContainer`,``],[`iconSuffixContainer`,``],[1,`mat-mdc-text-field-wrapper`,`mdc-text-field`,3,`click`],[1,`mat-mdc-form-field-focus-overlay`],[1,`mat-mdc-form-field-flex`],[`matFormFieldNotchedOutline`,``,3,`matFormFieldNotchedOutlineOpen`],[1,`mat-mdc-form-field-icon-prefix`],[1,`mat-mdc-form-field-text-prefix`],[1,`mat-mdc-form-field-infix`],[3,`ngTemplateOutlet`],[1,`mat-mdc-form-field-text-suffix`],[1,`mat-mdc-form-field-icon-suffix`],[`matFormFieldLineRipple`,``],[`aria-atomic`,`true`,`aria-live`,`polite`,1,`mat-mdc-form-field-subscript-wrapper`,`mat-mdc-form-field-bottom-align`],[1,`mat-mdc-form-field-error-wrapper`],[1,`mat-mdc-form-field-hint-wrapper`],[`matFormFieldFloatingLabel`,``,3,`floating`,`monitorResize`,`id`],[`aria-hidden`,`true`,1,`mat-mdc-form-field-required-marker`,`mdc-floating-label--required`],[3,`id`],[1,`mat-mdc-form-field-hint-spacer`]],template:function(y,s){if(y&1&&(YE(m),Hh(0,ve,1,1,`ng-template`,null,0,GI),cs(2,`div`,6,1),ig(`click`,function(F){return s._control.onContainerClick(F)}),xE(4,ye,1,0,`div`,7),cs(5,`div`,8),xE(6,v,2,2,`div`,9),xE(7,P,3,0,`div`,10),xE(8,K,3,0,`div`,11),cs(9,`div`,12),xE(10,On,1,1,null,13),QE(11),Vu(),xE(12,Ln,3,0,`div`,14),xE(13,zn,3,0,`div`,15),Vu(),xE(14,Vn,1,0,`div`,16),Vu(),cs(15,`div`,17),xE(16,Hn,2,0,`div`,18)(17,jn,5,1,`div`,19),Vu()),y&2){let S,F=s._unwrapMaybeSignal(s._control.disabled);sb(2),gg(`mdc-text-field--filled`,!s._hasOutline())(`mdc-text-field--outlined`,s._hasOutline())(`mdc-text-field--no-label`,!s._hasFloatingLabel())(`mdc-text-field--disabled`,F)(`mdc-text-field--invalid`,s._unwrapMaybeSignal(s._control.errorState)),sb(2),RE(!s._hasOutline()&&!F?4:-1),sb(2),RE(s._hasOutline()?6:-1),sb(),RE(s._hasIconPrefix?7:-1),sb(),RE(s._hasTextPrefix?8:-1),sb(2),RE(!s._hasOutline()||s._forceDisplayInfixLabel()?10:-1),sb(2),RE(s._hasTextSuffix?12:-1),sb(),RE(s._hasIconSuffix?13:-1),sb(),RE(s._hasOutline()?-1:14),sb(),gg(`mat-mdc-form-field-subscript-dynamic-size`,s.subscriptSizing===`dynamic`);let qn=s._getSubscriptMessageType();sb(),RE((S=qn)===`error`?16:S===`hint`?17:-1)}},dependencies:[bn,vn,fT,_n,ae],styles:[`.mdc-text-field {
  display: inline-flex;
  align-items: baseline;
  padding: 0 16px;
  position: relative;
  box-sizing: border-box;
  overflow: hidden;
  will-change: opacity, transform, color;
  border-top-left-radius: 4px;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
}

.mdc-text-field__input {
  width: 100%;
  min-width: 0;
  border: none;
  border-radius: 0;
  background: none;
  padding: 0;
  -moz-appearance: none;
  -webkit-appearance: none;
  height: 28px;
}
.mdc-text-field__input::-webkit-calendar-picker-indicator, .mdc-text-field__input::-webkit-search-cancel-button {
  display: none;
}
.mdc-text-field__input::-ms-clear {
  display: none;
}
.mdc-text-field__input:focus {
  outline: none;
}
.mdc-text-field__input:invalid {
  box-shadow: none;
}
.mdc-text-field__input::placeholder {
  opacity: 0;
}
.mdc-text-field__input::-moz-placeholder {
  opacity: 0;
}
.mdc-text-field__input::-webkit-input-placeholder {
  opacity: 0;
}
.mdc-text-field__input:-ms-input-placeholder {
  opacity: 0;
}
.mdc-text-field--no-label .mdc-text-field__input::placeholder, .mdc-text-field--focused .mdc-text-field__input::placeholder {
  opacity: 1;
}
.mdc-text-field--no-label .mdc-text-field__input::-moz-placeholder, .mdc-text-field--focused .mdc-text-field__input::-moz-placeholder {
  opacity: 1;
}
.mdc-text-field--no-label .mdc-text-field__input::-webkit-input-placeholder, .mdc-text-field--focused .mdc-text-field__input::-webkit-input-placeholder {
  opacity: 1;
}
.mdc-text-field--no-label .mdc-text-field__input:-ms-input-placeholder, .mdc-text-field--focused .mdc-text-field__input:-ms-input-placeholder {
  opacity: 1;
}
.mdc-text-field--%NS%disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive::placeholder {
  opacity: 0;
}
.mdc-text-field--%NS%disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive::-moz-placeholder {
  opacity: 0;
}
.mdc-text-field--%NS%disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive::-webkit-input-placeholder {
  opacity: 0;
}
.mdc-text-field--%NS%disabled:not(.mdc-text-field--no-label) .mdc-text-field__input.mat-mdc-input-disabled-interactive:-ms-input-placeholder {
  opacity: 0;
}
.mdc-text-field--outlined .mdc-text-field__input, .mdc-text-field--filled.mdc-text-field--no-label .mdc-text-field__input {
  height: 100%;
}
.mdc-text-field--outlined .mdc-text-field__input {
  display: flex;
  border: none !important;
  background-color: transparent;
}
.mdc-text-field--disabled .mdc-text-field__input {
  pointer-events: auto;
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-text-field__input {
  color: var(--%NS%mat-form-field-filled-input-text-color, var(--%NS%mat-sys-on-surface));
  caret-color: var(--%NS%mat-form-field-filled-caret-color, var(--%NS%mat-sys-primary));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-text-field__input::placeholder {
  color: var(--%NS%mat-form-field-filled-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-text-field__input::-moz-placeholder {
  color: var(--%NS%mat-form-field-filled-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-text-field__input::-webkit-input-placeholder {
  color: var(--%NS%mat-form-field-filled-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-text-field__input:-ms-input-placeholder {
  color: var(--%NS%mat-form-field-filled-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled) .mdc-text-field__input {
  color: var(--%NS%mat-form-field-outlined-input-text-color, var(--%NS%mat-sys-on-surface));
  caret-color: var(--%NS%mat-form-field-outlined-caret-color, var(--%NS%mat-sys-primary));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled) .mdc-text-field__input::placeholder {
  color: var(--%NS%mat-form-field-outlined-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled) .mdc-text-field__input::-moz-placeholder {
  color: var(--%NS%mat-form-field-outlined-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled) .mdc-text-field__input::-webkit-input-placeholder {
  color: var(--%NS%mat-form-field-outlined-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled) .mdc-text-field__input:-ms-input-placeholder {
  color: var(--%NS%mat-form-field-outlined-input-text-placeholder-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--filled.mdc-text-field--%NS%invalid:not(.mdc-text-field--disabled) .mdc-text-field__input {
  caret-color: var(--%NS%mat-form-field-filled-error-caret-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--outlined.mdc-text-field--%NS%invalid:not(.mdc-text-field--disabled) .mdc-text-field__input {
  caret-color: var(--%NS%mat-form-field-outlined-error-caret-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--filled.mdc-text-field--disabled .mdc-text-field__input {
  color: var(--%NS%mat-form-field-filled-disabled-input-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--outlined.mdc-text-field--disabled .mdc-text-field__input {
  color: var(--%NS%mat-form-field-outlined-disabled-input-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
@media (forced-colors: active) {
  .mdc-text-field--disabled .mdc-text-field__input {
    background-color: Window;
  }
}

.mdc-text-field--filled {
  height: 56px;
  border-bottom-right-radius: 0;
  border-bottom-left-radius: 0;
  border-top-left-radius: var(--%NS%mat-form-field-filled-container-shape, var(--%NS%mat-sys-corner-extra-small));
  border-top-right-radius: var(--%NS%mat-form-field-filled-container-shape, var(--%NS%mat-sys-corner-extra-small));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) {
  background-color: var(--%NS%mat-form-field-filled-container-color, var(--%NS%mat-sys-surface-variant));
}
.mdc-text-field--filled.mdc-text-field--disabled {
  background-color: var(--%NS%mat-form-field-filled-disabled-container-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 4%, transparent));
}

.mdc-text-field--outlined {
  height: 56px;
  overflow: visible;
  padding-right: max(16px, var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small)));
  padding-left: max(16px, var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small)) + 4px);
}
[dir=rtl] .mdc-text-field--outlined {
  padding-right: max(16px, var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small)) + 4px);
  padding-left: max(16px, var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small)));
}

.mdc-floating-label {
  position: absolute;
  left: 0;
  transform-origin: left top;
  line-height: 1.15rem;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
  overflow: hidden;
  will-change: transform;
}
[dir=rtl] .mdc-floating-label {
  right: 0;
  left: auto;
  transform-origin: right top;
  text-align: right;
}
.mdc-text-field .mdc-floating-label {
  top: 50%;
  transform: translateY(-50%);
  pointer-events: none;
}
.mdc-notched-outline .mdc-floating-label {
  display: inline-block;
  position: relative;
  max-width: 100%;
}
.mdc-text-field--outlined .mdc-floating-label {
  left: 4px;
  right: auto;
}
[dir=rtl] .mdc-text-field--outlined .mdc-floating-label {
  left: auto;
  right: 4px;
}
.mdc-text-field--filled .mdc-floating-label {
  left: 16px;
  right: auto;
}
[dir=rtl] .mdc-text-field--filled .mdc-floating-label {
  left: auto;
  right: 16px;
}
.mdc-text-field--disabled .mdc-floating-label {
  cursor: default;
}
@media (forced-colors: active) {
  .mdc-text-field--disabled .mdc-floating-label {
    z-index: 1;
  }
}
.mdc-text-field--filled.mdc-text-field--no-label .mdc-floating-label {
  display: none;
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-floating-label {
  color: var(--%NS%mat-form-field-filled-label-text-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-floating-label {
  color: var(--%NS%mat-form-field-filled-focus-label-text-color, var(--%NS%mat-sys-primary));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-floating-label {
  color: var(--%NS%mat-form-field-filled-hover-label-text-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--filled.mdc-text-field--disabled .mdc-floating-label {
  color: var(--%NS%mat-form-field-filled-disabled-label-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled).mdc-text-field--invalid .mdc-floating-label {
  color: var(--%NS%mat-form-field-filled-error-label-text-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled).mdc-text-field--invalid.mdc-text-field--focused .mdc-floating-label {
  color: var(--%NS%mat-form-field-filled-error-focus-label-text-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled).mdc-text-field--%NS%invalid:not(.mdc-text-field--disabled):hover .mdc-floating-label {
  color: var(--%NS%mat-form-field-filled-error-hover-label-text-color, var(--%NS%mat-sys-on-error-container));
}
.mdc-text-field--filled .mdc-floating-label {
  font-family: var(--%NS%mat-form-field-filled-label-text-font, var(--%NS%mat-sys-body-large-font));
  font-size: var(--%NS%mat-form-field-filled-label-text-size, var(--%NS%mat-sys-body-large-size));
  font-weight: var(--%NS%mat-form-field-filled-label-text-weight, var(--%NS%mat-sys-body-large-weight));
  letter-spacing: var(--%NS%mat-form-field-filled-label-text-tracking, var(--%NS%mat-sys-body-large-tracking));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled) .mdc-floating-label {
  color: var(--%NS%mat-form-field-outlined-label-text-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-floating-label {
  color: var(--%NS%mat-form-field-outlined-focus-label-text-color, var(--%NS%mat-sys-primary));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-floating-label {
  color: var(--%NS%mat-form-field-outlined-hover-label-text-color, var(--%NS%mat-sys-on-surface));
}
.mdc-text-field--outlined.mdc-text-field--disabled .mdc-floating-label {
  color: var(--%NS%mat-form-field-outlined-disabled-label-text-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid .mdc-floating-label {
  color: var(--%NS%mat-form-field-outlined-error-label-text-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid.mdc-text-field--focused .mdc-floating-label {
  color: var(--%NS%mat-form-field-outlined-error-focus-label-text-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--%NS%invalid:not(.mdc-text-field--disabled):hover .mdc-floating-label {
  color: var(--%NS%mat-form-field-outlined-error-hover-label-text-color, var(--%NS%mat-sys-on-error-container));
}
.mdc-text-field--outlined .mdc-floating-label {
  font-family: var(--%NS%mat-form-field-outlined-label-text-font, var(--%NS%mat-sys-body-large-font));
  font-size: var(--%NS%mat-form-field-outlined-label-text-size, var(--%NS%mat-sys-body-large-size));
  font-weight: var(--%NS%mat-form-field-outlined-label-text-weight, var(--%NS%mat-sys-body-large-weight));
  letter-spacing: var(--%NS%mat-form-field-outlined-label-text-tracking, var(--%NS%mat-sys-body-large-tracking));
}

.mdc-floating-label--float-above {
  cursor: auto;
  transform: translateY(-106%) scale(0.75);
}
.mdc-text-field--filled .mdc-floating-label--float-above {
  transform: translateY(-106%) scale(0.75);
}
.mdc-text-field--outlined .mdc-floating-label--float-above {
  transform: translateY(-37.25px) scale(1);
  font-size: 0.75rem;
}
.mdc-notched-outline .mdc-floating-label--float-above {
  text-overflow: clip;
}
.mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  max-width: 133.3333333333%;
}
.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above, .mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  transform: translateY(-34.75px) scale(0.75);
}
.mdc-text-field--outlined.mdc-notched-outline--upgraded .mdc-floating-label--float-above, .mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  font-size: 1rem;
}

.mdc-floating-label--%NS%required:not(.mdc-floating-label--hide-required-marker)::after {
  margin-left: 1px;
  margin-right: 0;
  content: "*";
}
[dir=rtl] .mdc-floating-label--%NS%required:not(.mdc-floating-label--hide-required-marker)::after {
  margin-left: 0;
  margin-right: 1px;
}

.mdc-notched-outline {
  display: flex;
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  height: 100%;
  text-align: left;
  pointer-events: none;
}
[dir=rtl] .mdc-notched-outline {
  text-align: right;
}
.mdc-text-field--outlined .mdc-notched-outline {
  z-index: 1;
}

.mat-mdc-notch-piece {
  box-sizing: border-box;
  height: 100%;
  pointer-events: none;
  border: none;
  border-top: 1px solid;
  border-bottom: 1px solid;
}
.mdc-text-field--focused .mat-mdc-notch-piece {
  border-width: 2px;
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled) .mat-mdc-notch-piece {
  border-color: var(--%NS%mat-form-field-outlined-outline-color, var(--%NS%mat-sys-outline));
  border-width: var(--%NS%mat-form-field-outlined-outline-width, 1px);
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mat-mdc-notch-piece {
  border-color: var(--%NS%mat-form-field-outlined-hover-outline-color, var(--%NS%mat-sys-on-surface));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mat-mdc-notch-piece {
  border-color: var(--%NS%mat-form-field-outlined-focus-outline-color, var(--%NS%mat-sys-primary));
}
.mdc-text-field--outlined.mdc-text-field--disabled .mat-mdc-notch-piece {
  border-color: var(--%NS%mat-form-field-outlined-disabled-outline-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 12%, transparent));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid .mat-mdc-notch-piece {
  border-color: var(--%NS%mat-form-field-outlined-error-outline-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--%NS%invalid:not(.mdc-text-field--focused):hover .mdc-notched-outline .mat-mdc-notch-piece {
  border-color: var(--%NS%mat-form-field-outlined-error-hover-outline-color, var(--%NS%mat-sys-on-error-container));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--invalid.mdc-text-field--focused .mat-mdc-notch-piece {
  border-color: var(--%NS%mat-form-field-outlined-error-focus-outline-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--%NS%outlined:not(.mdc-text-field--disabled).mdc-text-field--focused .mdc-notched-outline .mat-mdc-notch-piece {
  border-width: var(--%NS%mat-form-field-outlined-focus-outline-width, 2px);
}

.mdc-notched-outline__leading {
  border-left: 1px solid;
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
  border-bottom-left-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
}
.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__leading {
  width: max(12px, var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small)));
}
[dir=rtl] .mdc-notched-outline__leading {
  border-left: none;
  border-right: 1px solid;
  border-bottom-left-radius: 0;
  border-top-left-radius: 0;
  border-top-right-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
  border-bottom-right-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
}

.mdc-notched-outline__trailing {
  flex-grow: 1;
  border-left: none;
  border-right: 1px solid;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  border-top-right-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
  border-bottom-right-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
}
[dir=rtl] .mdc-notched-outline__trailing {
  border-left: 1px solid;
  border-right: none;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-top-left-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
  border-bottom-left-radius: var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small));
}

.mdc-notched-outline__notch {
  flex: 0 0 auto;
  width: auto;
}
.mdc-text-field--outlined .mdc-notched-outline .mdc-notched-outline__notch {
  max-width: min(var(--%NS%mat-form-field-notch-max-width, 100%), calc(100% - max(12px, var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small))) * 2));
}
.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch {
  max-width: min(100%, calc(100% - max(12px, var(--%NS%mat-form-field-outlined-container-shape, var(--%NS%mat-sys-corner-extra-small))) * 2));
}
.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-top: 1px;
}
.mdc-text-field--focused.mdc-text-field--outlined .mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-top: 2px;
}
.mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-left: 0;
  padding-right: 8px;
  border-top: none;
}
[dir=rtl] .mdc-notched-outline--notched .mdc-notched-outline__notch {
  padding-left: 8px;
  padding-right: 0;
}
.mdc-notched-outline--no-label .mdc-notched-outline__notch {
  display: none;
}

.mdc-line-ripple::before, .mdc-line-ripple::after {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  border-bottom-style: solid;
  content: "";
}
.mdc-line-ripple::before {
  z-index: 1;
  border-bottom-width: var(--%NS%mat-form-field-filled-active-indicator-height, 1px);
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-line-ripple::before {
  border-bottom-color: var(--%NS%mat-form-field-filled-active-indicator-color, var(--%NS%mat-sys-on-surface-variant));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled):not(.mdc-text-field--focused):hover .mdc-line-ripple::before {
  border-bottom-color: var(--%NS%mat-form-field-filled-hover-active-indicator-color, var(--%NS%mat-sys-on-surface));
}
.mdc-text-field--filled.mdc-text-field--disabled .mdc-line-ripple::before {
  border-bottom-color: var(--%NS%mat-form-field-filled-disabled-active-indicator-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled).mdc-text-field--invalid .mdc-line-ripple::before {
  border-bottom-color: var(--%NS%mat-form-field-filled-error-active-indicator-color, var(--%NS%mat-sys-error));
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled).mdc-text-field--%NS%invalid:not(.mdc-text-field--focused):hover .mdc-line-ripple::before {
  border-bottom-color: var(--%NS%mat-form-field-filled-error-hover-active-indicator-color, var(--%NS%mat-sys-on-error-container));
}
.mdc-line-ripple::after {
  transform: scaleX(0);
  opacity: 0;
  z-index: 2;
}
.mdc-text-field--filled .mdc-line-ripple::after {
  border-bottom-width: var(--%NS%mat-form-field-filled-focus-active-indicator-height, 2px);
}
.mdc-text-field--%NS%filled:not(.mdc-text-field--disabled) .mdc-line-ripple::after {
  border-bottom-color: var(--%NS%mat-form-field-filled-focus-active-indicator-color, var(--%NS%mat-sys-primary));
}
.mdc-text-field--filled.mdc-text-field--%NS%invalid:not(.mdc-text-field--disabled) .mdc-line-ripple::after {
  border-bottom-color: var(--%NS%mat-form-field-filled-error-focus-active-indicator-color, var(--%NS%mat-sys-error));
}

.mdc-line-ripple--%NS%active::after {
  transform: scaleX(1);
  opacity: 1;
}

.mdc-line-ripple--%NS%deactivating::after {
  opacity: 0;
}

.mdc-text-field--disabled {
  pointer-events: none;
}

.mat-mdc-form-field-textarea-control {
  vertical-align: middle;
  resize: vertical;
  box-sizing: border-box;
  height: auto;
  margin: 0;
  padding: 0;
  border: none;
  overflow: auto;
}

.mat-mdc-form-field-input-control.mat-mdc-form-field-input-control {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  font: inherit;
  letter-spacing: inherit;
  text-decoration: inherit;
  text-transform: inherit;
  border: none;
}

.mat-mdc-form-field .mat-mdc-floating-label.mdc-floating-label {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  line-height: normal;
  pointer-events: all;
  will-change: auto;
}

.mat-mdc-form-field:not(.mat-form-field-disabled) .mat-mdc-floating-label.mdc-floating-label {
  cursor: inherit;
}

.mdc-text-field--%NS%no-label:not(.mdc-text-field--textarea) .mat-mdc-form-field-input-control.mdc-text-field__input,
.mat-mdc-text-field-wrapper .mat-mdc-form-field-input-control {
  height: auto;
}

.mat-mdc-text-field-wrapper .mat-mdc-form-field-input-control.mdc-text-field__input[type=color] {
  height: 23px;
}

.mat-mdc-text-field-wrapper {
  height: auto;
  flex: auto;
  will-change: auto;
}

.mat-mdc-form-field-has-icon-prefix .mat-mdc-text-field-wrapper {
  padding-left: 0;
  --%NS%mat-mdc-form-field-label-offset-x: -16px;
}

.mat-mdc-form-field-has-icon-suffix .mat-mdc-text-field-wrapper {
  padding-right: 0;
}

[dir=rtl] .mat-mdc-text-field-wrapper {
  padding-left: 16px;
  padding-right: 16px;
}
[dir=rtl] .mat-mdc-form-field-has-icon-suffix .mat-mdc-text-field-wrapper {
  padding-left: 0;
}
[dir=rtl] .mat-mdc-form-field-has-icon-prefix .mat-mdc-text-field-wrapper {
  padding-right: 0;
}

.mat-form-field-disabled .mdc-text-field__input::placeholder {
  color: var(--%NS%mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-disabled .mdc-text-field__input::-moz-placeholder {
  color: var(--%NS%mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-disabled .mdc-text-field__input::-webkit-input-placeholder {
  color: var(--%NS%mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-disabled .mdc-text-field__input:-ms-input-placeholder {
  color: var(--%NS%mat-form-field-disabled-input-text-placeholder-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}

.mat-mdc-form-field-label-always-float .mdc-text-field__input::placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
  opacity: 1;
}

.mat-mdc-text-field-wrapper .mat-mdc-form-field-infix .mat-mdc-floating-label {
  left: auto;
  right: auto;
}

.mat-mdc-text-field-wrapper.mdc-text-field--outlined .mdc-text-field__input {
  display: inline-block;
}

.mat-mdc-form-field .mat-mdc-text-field-wrapper.mdc-text-field .mdc-notched-outline__notch {
  padding-top: 0;
}

.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field .mdc-notched-outline__notch {
  border-left: 1px solid transparent;
}

[dir=rtl] .mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field.mat-mdc-form-field .mdc-notched-outline__notch {
  border-left: none;
  border-right: 1px solid transparent;
}

.mat-mdc-form-field-infix {
  min-height: var(--%NS%mat-form-field-container-height, 56px);
  padding-top: var(--%NS%mat-form-field-filled-with-label-container-padding-top, 24px);
  padding-bottom: var(--%NS%mat-form-field-filled-with-label-container-padding-bottom, 8px);
}
.mdc-text-field--outlined .mat-mdc-form-field-infix, .mdc-text-field--no-label .mat-mdc-form-field-infix {
  padding-top: var(--%NS%mat-form-field-container-vertical-padding, 16px);
  padding-bottom: var(--%NS%mat-form-field-container-vertical-padding, 16px);
}

.mat-mdc-text-field-wrapper .mat-mdc-form-field-flex .mat-mdc-floating-label {
  top: calc(var(--%NS%mat-form-field-container-height, 56px) / 2);
}

.mdc-text-field--filled .mat-mdc-floating-label {
  display: var(--%NS%mat-form-field-filled-label-display, block);
}

.mat-mdc-text-field-wrapper.mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  --%NS%mat-mdc-form-field-label-transform: translateY(calc(calc(6.75px + var(--%NS%mat-form-field-container-height, 56px) / 2) * -1))
    scale(var(--%NS%mat-mdc-form-field-floating-label-scale, 0.75));
  transform: var(--%NS%mat-mdc-form-field-label-transform);
}

@keyframes _mat-form-field-subscript-animation {
  from {
    opacity: 0;
    transform: translateY(-5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.mat-mdc-form-field-subscript-wrapper {
  box-sizing: border-box;
  width: 100%;
  position: relative;
}

.mat-mdc-form-field-hint-wrapper,
.mat-mdc-form-field-error-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  padding: 0 16px;
  opacity: 1;
  transform: translateY(0);
  animation: _mat-form-field-subscript-animation 0ms cubic-bezier(0.55, 0, 0.55, 0.2);
}

.mat-mdc-form-field-subscript-dynamic-size .mat-mdc-form-field-hint-wrapper,
.mat-mdc-form-field-subscript-dynamic-size .mat-mdc-form-field-error-wrapper {
  position: static;
}

.mat-mdc-form-field-bottom-align::before {
  content: "";
  display: inline-block;
  height: 16px;
}

.mat-mdc-form-field-bottom-align.mat-mdc-form-field-subscript-dynamic-size::before {
  content: unset;
}

.mat-mdc-form-field-hint-end {
  order: 1;
}

.mat-mdc-form-field-hint-wrapper {
  display: flex;
}

.mat-mdc-form-field-hint-spacer {
  flex: 1 0 1em;
}

.mat-mdc-form-field-error {
  display: block;
  color: var(--%NS%mat-form-field-error-text-color, var(--%NS%mat-sys-error));
}

.mat-mdc-form-field-subscript-wrapper,
.mat-mdc-form-field-bottom-align::before {
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  font-family: var(--%NS%mat-form-field-subscript-text-font, var(--%NS%mat-sys-body-small-font));
  line-height: var(--%NS%mat-form-field-subscript-text-line-height, var(--%NS%mat-sys-body-small-line-height));
  font-size: var(--%NS%mat-form-field-subscript-text-size, var(--%NS%mat-sys-body-small-size));
  letter-spacing: var(--%NS%mat-form-field-subscript-text-tracking, var(--%NS%mat-sys-body-small-tracking));
  font-weight: var(--%NS%mat-form-field-subscript-text-weight, var(--%NS%mat-sys-body-small-weight));
}

.mat-mdc-form-field-focus-overlay {
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  position: absolute;
  opacity: 0;
  pointer-events: none;
  background-color: var(--%NS%mat-form-field-state-layer-color, var(--%NS%mat-sys-on-surface));
}
.mat-mdc-text-field-wrapper:hover .mat-mdc-form-field-focus-overlay {
  opacity: var(--%NS%mat-form-field-hover-state-layer-opacity, var(--%NS%mat-sys-hover-state-layer-opacity));
}
.mat-mdc-form-field.mat-focused .mat-mdc-form-field-focus-overlay {
  opacity: var(--%NS%mat-form-field-focus-state-layer-opacity, 0);
}

select.mat-mdc-form-field-input-control {
  -moz-appearance: none;
  -webkit-appearance: none;
  background-color: transparent;
  display: inline-flex;
  box-sizing: border-box;
}
select.mat-mdc-form-field-input-control:not(:disabled) {
  cursor: pointer;
}
select.mat-mdc-form-field-input-control:not(.mat-mdc-native-select-inline) option {
  color: var(--%NS%mat-form-field-select-option-text-color, var(--%NS%mat-sys-neutral10));
}
select.mat-mdc-form-field-input-control:not(.mat-mdc-native-select-inline) option:disabled {
  color: var(--%NS%mat-form-field-select-disabled-option-text-color, color-mix(in srgb, var(--%NS%mat-sys-neutral10) 38%, transparent));
}

.mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-infix::after {
  content: "";
  width: 0;
  height: 0;
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 5px solid;
  position: absolute;
  right: 0;
  top: 50%;
  margin-top: -2.5px;
  pointer-events: none;
  color: var(--%NS%mat-form-field-enabled-select-arrow-color, var(--%NS%mat-sys-on-surface-variant));
}
[dir=rtl] .mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-infix::after {
  right: auto;
  left: 0;
}
.mat-mdc-form-field-type-mat-native-select.mat-focused .mat-mdc-form-field-infix::after {
  color: var(--%NS%mat-form-field-focus-select-arrow-color, var(--%NS%mat-sys-primary));
}
.mat-mdc-form-field-type-mat-native-select.mat-form-field-disabled .mat-mdc-form-field-infix::after {
  color: var(--%NS%mat-form-field-disabled-select-arrow-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-input-control {
  padding-right: 15px;
}
[dir=rtl] .mat-mdc-form-field-type-mat-native-select .mat-mdc-form-field-input-control {
  padding-right: 0;
  padding-left: 15px;
}

@media (forced-colors: active) {
  .mat-form-field-appearance-fill .mat-mdc-text-field-wrapper {
    outline: solid 1px;
  }
}
@media (forced-colors: active) {
  .mat-form-field-appearance-fill.mat-form-field-disabled .mat-mdc-text-field-wrapper {
    outline-color: GrayText;
  }
}

@media (forced-colors: active) {
  .mat-form-field-appearance-fill.mat-focused .mat-mdc-text-field-wrapper {
    outline: dashed 3px;
  }
}

@media (forced-colors: active) {
  .mat-mdc-form-field.mat-focused .mdc-notched-outline {
    border: dashed 3px;
  }
}

.mat-mdc-form-field-input-control[type=date], .mat-mdc-form-field-input-control[type=datetime], .mat-mdc-form-field-input-control[type=datetime-local], .mat-mdc-form-field-input-control[type=month], .mat-mdc-form-field-input-control[type=week], .mat-mdc-form-field-input-control[type=time] {
  line-height: 1;
}
.mat-mdc-form-field-input-control::-webkit-datetime-edit {
  line-height: 1;
  padding: 0;
  margin-bottom: -2px;
}

.mat-mdc-form-field {
  --%NS%mat-mdc-form-field-floating-label-scale: 0.75;
  display: inline-flex;
  flex-direction: column;
  min-width: 0;
  text-align: left;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  font-family: var(--%NS%mat-form-field-container-text-font, var(--%NS%mat-sys-body-large-font));
  line-height: var(--%NS%mat-form-field-container-text-line-height, var(--%NS%mat-sys-body-large-line-height));
  font-size: var(--%NS%mat-form-field-container-text-size, var(--%NS%mat-sys-body-large-size));
  letter-spacing: var(--%NS%mat-form-field-container-text-tracking, var(--%NS%mat-sys-body-large-tracking));
  font-weight: var(--%NS%mat-form-field-container-text-weight, var(--%NS%mat-sys-body-large-weight));
}
.mat-mdc-form-field .mdc-text-field--outlined .mdc-floating-label--float-above {
  font-size: calc(var(--%NS%mat-form-field-outlined-label-text-populated-size) * var(--%NS%mat-mdc-form-field-floating-label-scale));
}
.mat-mdc-form-field .mdc-text-field--outlined .mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  font-size: var(--%NS%mat-form-field-outlined-label-text-populated-size);
}
[dir=rtl] .mat-mdc-form-field {
  text-align: right;
}

.mat-mdc-form-field-flex {
  display: inline-flex;
  align-items: baseline;
  box-sizing: border-box;
  width: 100%;
}

.mat-mdc-text-field-wrapper {
  width: 100%;
  z-index: 0;
}

.mat-mdc-form-field-icon-prefix,
.mat-mdc-form-field-icon-suffix {
  align-self: center;
  line-height: 0;
  pointer-events: auto;
  position: relative;
  z-index: 1;
}
.mat-mdc-form-field-icon-prefix > .mat-icon,
.mat-mdc-form-field-icon-suffix > .mat-icon {
  padding: 0 12px;
  box-sizing: content-box;
}

.mat-mdc-form-field-icon-prefix {
  color: var(--%NS%mat-form-field-leading-icon-color, var(--%NS%mat-sys-on-surface-variant));
}
.mat-form-field-disabled .mat-mdc-form-field-icon-prefix {
  color: var(--%NS%mat-form-field-disabled-leading-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}

.mat-mdc-form-field-icon-suffix {
  color: var(--%NS%mat-form-field-trailing-icon-color, var(--%NS%mat-sys-on-surface-variant));
}
.mat-form-field-disabled .mat-mdc-form-field-icon-suffix {
  color: var(--%NS%mat-form-field-disabled-trailing-icon-color, color-mix(in srgb, var(--%NS%mat-sys-on-surface) 38%, transparent));
}
.mat-form-field-invalid .mat-mdc-form-field-icon-suffix {
  color: var(--%NS%mat-form-field-error-trailing-icon-color, var(--%NS%mat-sys-error));
}
.mat-form-field-invalid:not(.mat-focused):not(.mat-form-field-disabled) .mat-mdc-text-field-wrapper:hover .mat-mdc-form-field-icon-suffix {
  color: var(--%NS%mat-form-field-error-hover-trailing-icon-color, var(--%NS%mat-sys-on-error-container));
}
.mat-form-field-invalid.mat-focused .mat-mdc-text-field-wrapper .mat-mdc-form-field-icon-suffix {
  color: var(--%NS%mat-form-field-error-focus-trailing-icon-color, var(--%NS%mat-sys-error));
}

.mat-mdc-form-field-icon-prefix,
[dir=rtl] .mat-mdc-form-field-icon-suffix {
  padding: 0 4px 0 0;
}

.mat-mdc-form-field-icon-suffix,
[dir=rtl] .mat-mdc-form-field-icon-prefix {
  padding: 0 0 0 4px;
}

.mat-mdc-form-field-subscript-wrapper .mat-icon,
.mat-mdc-form-field label .mat-icon {
  width: 1em;
  height: 1em;
  font-size: inherit;
}

.mat-mdc-form-field-infix {
  flex: auto;
  min-width: 0;
  width: 180px;
  position: relative;
  box-sizing: border-box;
}
.mat-mdc-form-field-infix:has(textarea[cols]) {
  width: auto;
}

.mat-mdc-form-field .mdc-notched-outline__notch {
  margin-left: -1px;
  -webkit-clip-path: inset(-9em -999em -9em 1px);
  clip-path: inset(-9em -999em -9em 1px);
}
[dir=rtl] .mat-mdc-form-field .mdc-notched-outline__notch {
  margin-left: 0;
  margin-right: -1px;
  -webkit-clip-path: inset(-9em 1px -9em -999em);
  clip-path: inset(-9em 1px -9em -999em);
}

.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-floating-label {
  transition: transform 150ms cubic-bezier(0.4, 0, 0.2, 1), color 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input {
  transition: opacity 150ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input::placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input::-moz-placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input::-webkit-input-placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field__input:-ms-input-placeholder {
  transition: opacity 67ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input::placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input::placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input::-moz-placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input::-moz-placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input::-webkit-input-placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input::-webkit-input-placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--no-label .mdc-text-field__input:-ms-input-placeholder, .mat-mdc-form-field.mat-form-field-animations-enabled.mdc-text-field--focused .mdc-text-field__input:-ms-input-placeholder {
  transition-delay: 40ms;
  transition-duration: 110ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-text-field--%NS%filled:not(.mdc-ripple-upgraded):focus .mdc-text-field__ripple::before {
  transition-duration: 75ms;
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mdc-line-ripple::after {
  transition: transform 180ms cubic-bezier(0.4, 0, 0.2, 1), opacity 180ms cubic-bezier(0.4, 0, 0.2, 1);
}
.mat-mdc-form-field.mat-form-field-animations-enabled .mat-mdc-form-field-hint-wrapper,
.mat-mdc-form-field.mat-form-field-animations-enabled .mat-mdc-form-field-error-wrapper {
  animation-duration: 300ms;
}

.mdc-notched-outline .mdc-floating-label {
  max-width: calc(100% + 1px);
}

.mdc-notched-outline--upgraded .mdc-floating-label--float-above {
  max-width: calc(133.3333333333% + 1px);
}
`],encapsulation:2})})()}return n})();var oe=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵmod=Lu({type:n});static ɵinj=vi$1({imports:[gr,_e,yn$1]})}return n})();var Qn=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵcmp=Fw({type:n,selectors:[[`ng-component`]],hostAttrs:[`cdk-text-field-style-loader`,``],decls:0,vars:0,template:function(t,i){},styles:[`textarea.cdk-textarea-autosize {
  resize: none;
}

textarea.cdk-textarea-autosize-measuring {
  padding: 2px 0 !important;
  box-sizing: content-box !important;
  height: auto !important;
  overflow: hidden !important;
}

textarea.cdk-textarea-autosize-measuring-firefox {
  padding: 2px 0 !important;
  box-sizing: content-box !important;
  height: 0 !important;
}

@keyframes cdk-text-field-autofill-start { /*!*/ }
@keyframes cdk-text-field-autofill-end { /*!*/ }
.cdk-text-field-autofill-monitored:-webkit-autofill {
  animation: cdk-text-field-autofill-start 0s 1ms;
}

.cdk-text-field-autofill-monitored:not(:-webkit-autofill) {
  animation: cdk-text-field-autofill-end 0s 1ms;
}
`],encapsulation:2})}return n})();var Xn={passive:!0};var Mn=(()=>{class n{_platform=g(he);_ngZone=g(Ce);_renderer=g(oo).createRenderer(null,null);_styleLoader=g(dn);_monitoredElements=new Map;monitor(e){if(!this._platform.isBrowser)return Je$1;this._styleLoader.load(Qn);let t=Fe$1(e),i=this._monitoredElements.get(t);if(i)return i.subject;let a=new ne,c=`cdk-text-field-autofilled`,m=D=>{D.animationName===`cdk-text-field-autofill-start`&&!t.classList.contains(c)?(t.classList.add(c),this._ngZone.run(()=>a.next({target:D.target,isAutofilled:!0}))):D.animationName===`cdk-text-field-autofill-end`&&t.classList.contains(c)&&(t.classList.remove(c),this._ngZone.run(()=>a.next({target:D.target,isAutofilled:!1})))},b=this._ngZone.runOutsideAngular(()=>(t.classList.add(`cdk-text-field-autofill-monitored`),this._renderer.listen(t,`animationstart`,m,Xn)));return this._monitoredElements.set(t,{subject:a,unlisten:b}),a}stopMonitoring(e){let t=Fe$1(e),i=this._monitoredElements.get(t);i&&(i.unlisten(),i.subject.complete(),t.classList.remove(`cdk-text-field-autofill-monitored`),t.classList.remove(`cdk-text-field-autofilled`),this._monitoredElements.delete(t))}ngOnDestroy(){this._monitoredElements.forEach((e,t)=>this.stopMonitoring(t))}static ɵfac=function(t){return new(t||n)};static ɵprov=Rt({token:n,factory:n.ɵfac})}return n})();var Nn=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵmod=Lu({type:n});static ɵinj=vi$1({})}return n})();var Dn=new C(`MAT_INPUT_VALUE_ACCESSOR`);var En=(()=>{class n{isErrorState(e,t){return!!(e&&e.invalid&&(e.touched||t&&t.submitted))}isSignalErrorState(e){if(!e)return!1;let t=e().invalid(),i=e().touched();return t&&i}static ɵfac=function(t){return new(t||n)};static ɵprov=Rt({token:n,factory:n.ɵfac})}return n})();var et=class{_defaultMatcher;_parentFormGroup;_parentForm;_stateChanges;errorState=!1;matcher;ngControl;formField;constructor(r,e,t,i,a){this._defaultMatcher=r,this._parentFormGroup=t,this._parentForm=i,this._stateChanges=a,e?Zr(e.field)&&!e.updateValueAndValidity?(this.formField=e,this.ngControl=null):(this.formField=null,this.ngControl=e):this.ngControl=this.formField=null}updateErrorState(){let r=this.errorState,e=this._getCurrentErrorState(this.matcher||this._defaultMatcher);e!==r&&(this.errorState=e,this._stateChanges.next())}_getCurrentErrorState(r){if(this.formField&&r?.isSignalErrorState)return r.isSignalErrorState(this.formField.field())??!1;let e=this._parentFormGroup||this._parentForm,t=this.ngControl?this.ngControl.control:null;return r?.isErrorState(t,e)??!1}};var Jn=[`button`,`checkbox`,`file`,`hidden`,`image`,`radio`,`range`,`reset`,`submit`];var ei=new C(`MAT_INPUT_CONFIG`);var tt=(()=>{class n{_elementRef=g(mn);_platform=g(he);ngControl=g(St$1,{optional:!0,self:!0});_autofillMonitor=g(Mn);_ngZone=g(Ce);_formField=g(yt,{optional:!0});_renderer=g(io);_uid=g(je).getId(`mat-input-`);_previousNativeValue;_inputValueAccessor;_signalBasedValueAccessor;_previousPlaceholder=null;_errorStateTracker;_config=g(ei,{optional:!0});_cleanupIosKeyup;_cleanupWebkitWheel;_isServer=!1;_isNativeSelect=!1;_isTextarea=!1;_isInFormField=!1;focused=!1;stateChanges=new ne;controlType=`mat-input`;autofilled=!1;get disabled(){return this._disabled}set disabled(e){this._disabled=Zr$1(e),this.focused&&(this.focused=!1,this.stateChanges.next())}_disabled=!1;get id(){return this._id}set id(e){this._id=e||this._uid}_id;placeholder;name;get required(){return this._required??this.ngControl?.control?.hasValidator(rn.required)??!1}set required(e){this._required=Zr$1(e)}_required;get type(){return this._type}set type(e){this._type=e||`text`,this._validateType(),!this._isTextarea&&Vr().has(this._type)&&(this._elementRef.nativeElement.type=this._type)}_type=`text`;get errorStateMatcher(){return this._errorStateTracker.matcher}set errorStateMatcher(e){this._errorStateTracker.matcher=e}userAriaDescribedBy;get value(){return this._signalBasedValueAccessor?this._signalBasedValueAccessor.value():this._inputValueAccessor.value}set value(e){e!==this.value&&(this._signalBasedValueAccessor?this._signalBasedValueAccessor.value.set(e):this._inputValueAccessor.value=e,this.stateChanges.next())}get readonly(){return this._readonly}set readonly(e){this._readonly=Zr$1(e)}_readonly=!1;disabledInteractive;get errorState(){return this._errorStateTracker.errorState}set errorState(e){this._errorStateTracker.errorState=e}_neverEmptyInputTypes=[`date`,`datetime`,`datetime-local`,`month`,`time`,`week`].filter(e=>Vr().has(e));constructor(){let e=g(Ni$1,{optional:!0}),t=g(Mi$1,{optional:!0}),i=g(En),a=g(Dn,{optional:!0,self:!0}),c=g(hn,{optional:!0,self:!0}),m=this._elementRef.nativeElement,b=m.nodeName.toLowerCase();a?Zr(a.value)?this._signalBasedValueAccessor=a:this._inputValueAccessor=a:this._inputValueAccessor=m,this._previousNativeValue=this.value,this.id=this.id,this._platform.IOS&&this._ngZone.runOutsideAngular(()=>{this._cleanupIosKeyup=this._renderer.listen(m,`keyup`,this._iOSKeyupListener)}),this._errorStateTracker=new et(i,c||this.ngControl,t,e,this.stateChanges),this._isServer=!this._platform.isBrowser,this._isNativeSelect=b===`select`,this._isTextarea=b===`textarea`,this._isInFormField=!!this._formField,this.disabledInteractive=this._config?.disabledInteractive||!1,this._isNativeSelect&&(this.controlType=m.multiple?`mat-native-select-multiple`:`mat-native-select`),this._signalBasedValueAccessor&&Hi$1(()=>{this._signalBasedValueAccessor.value(),this.stateChanges.next()})}ngAfterViewInit(){this._platform.isBrowser&&this._autofillMonitor.monitor(this._elementRef.nativeElement).subscribe(e=>{this.autofilled=e.isAutofilled,this.stateChanges.next()})}ngOnChanges(){this.stateChanges.next()}ngOnDestroy(){this.stateChanges.complete(),this._platform.isBrowser&&this._autofillMonitor.stopMonitoring(this._elementRef.nativeElement),this._cleanupIosKeyup?.(),this._cleanupWebkitWheel?.()}ngDoCheck(){this.ngControl&&(this.updateErrorState(),this.ngControl.disabled!==null&&this.ngControl.disabled!==this.disabled&&(this.disabled=this.ngControl.disabled,this.stateChanges.next())),this._dirtyCheckNativeValue(),this._dirtyCheckPlaceholder()}focus(e){this._elementRef.nativeElement.focus(e)}updateErrorState(){this._errorStateTracker.updateErrorState()}_focusChanged(e){if(e!==this.focused){if(!this._isNativeSelect&&e&&this.disabled&&this.disabledInteractive){let t=this._elementRef.nativeElement;t.type===`number`?(t.type=`text`,t.setSelectionRange(0,0),t.type=`number`):t.setSelectionRange(0,0)}this.focused=e,this.stateChanges.next()}}_onInput(){}_dirtyCheckNativeValue(){let e=this._elementRef.nativeElement.value;this._previousNativeValue!==e&&(this._previousNativeValue=e,this.stateChanges.next())}_dirtyCheckPlaceholder(){let e=this._getPlaceholder();if(e!==this._previousPlaceholder){let t=this._elementRef.nativeElement;this._previousPlaceholder=e,e?t.setAttribute(`placeholder`,e):t.removeAttribute(`placeholder`)}}_getPlaceholder(){return this.placeholder||null}_validateType(){Jn.indexOf(this._type)}_isNeverEmpty(){return this._neverEmptyInputTypes.indexOf(this._type)>-1}_isBadInput(){let e=this._elementRef.nativeElement.validity;return e&&e.badInput}get empty(){return!this._isNeverEmpty()&&!this._elementRef.nativeElement.value&&!this._isBadInput()&&!this.autofilled}get shouldLabelFloat(){if(this._isNativeSelect){let e=this._elementRef.nativeElement,t=e.options[0];return this.focused||e.multiple||!this.empty||!!(e.selectedIndex>-1&&t&&t.label)}else return this.focused&&!this.disabled||!this.empty}get describedByIds(){return this._elementRef.nativeElement.getAttribute(`aria-describedby`)?.split(` `)||[]}setDescribedByIds(e){let t=this._elementRef.nativeElement;e.length?t.setAttribute(`aria-describedby`,e.join(` `)):t.removeAttribute(`aria-describedby`)}onContainerClick(){this.focused||this.focus()}_isInlineSelect(){let e=this._elementRef.nativeElement;return this._isNativeSelect&&(e.multiple||e.size>1)}_iOSKeyupListener=e=>{let t=e.target;!t.value&&t.selectionStart===0&&t.selectionEnd===0&&(t.setSelectionRange(1,1),t.setSelectionRange(0,0))};_getReadonlyAttribute(){return this._isNativeSelect?null:this.readonly||this.disabled&&this.disabledInteractive?`true`:null}static ɵfac=function(t){return new(t||n)};static ɵdir=Fu({type:n,selectors:[[`input`,`matInput`,``],[`textarea`,`matInput`,``],[`select`,`matNativeControl`,``],[`input`,`matNativeControl`,``],[`textarea`,`matNativeControl`,``]],hostAttrs:[1,`mat-mdc-input-element`],hostVars:21,hostBindings:function(t,i){t&1&&ig(`focus`,function(){return i._focusChanged(!0)})(`blur`,function(){return i._focusChanged(!1)})(`input`,function(){return i._onInput()}),t&2&&(rg(`id`,i.id)(`disabled`,i.disabled&&!i.disabledInteractive)(`required`,i.required),Qh(`name`,i.name||null)(`readonly`,i._getReadonlyAttribute())(`aria-disabled`,i.disabled&&i.disabledInteractive?`true`:null)(`aria-invalid`,i.empty&&i.required?null:i.errorState)(`aria-required`,i.required)(`id`,i.id),gg(`mat-input-server`,i._isServer)(`mat-mdc-form-field-textarea-control`,i._isInFormField&&i._isTextarea)(`mat-mdc-form-field-input-control`,i._isInFormField)(`mat-mdc-input-disabled-interactive`,i.disabledInteractive)(`mdc-text-field__input`,i._isInFormField)(`mat-mdc-native-select-inline`,i._isInlineSelect()))},inputs:{disabled:`disabled`,id:`id`,placeholder:`placeholder`,name:`name`,required:`required`,type:`type`,errorStateMatcher:`errorStateMatcher`,userAriaDescribedBy:[0,`aria-describedby`,`userAriaDescribedBy`],value:`value`,readonly:`readonly`,disabledInteractive:[2,`disabledInteractive`,`disabledInteractive`,hC]},exportAs:[`matInput`],features:[OI([{provide:vt,useExisting:n}]),nu]})}return n})();var nt=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵmod=Lu({type:n});static ɵinj=vi$1({imports:[oe,oe,Nn,yn$1]})}return n})();var ri=n=>({count:n});function ai(n,r){if(n&1&&(cs(0,`p`,2),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`passwordDialog.backupHint`))}}function oi(n,r){if(n&1&&(cs(0,`p`,2),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`passwordDialog.chooseHint`))}}function li(n,r){if(n&1&&(cs(0,`mat-hint`),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`passwordDialog.minLength`,LI(1,ri,e.minLength)))}}function di(n,r){if(n&1&&(cs(0,`mat-hint`,9),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`passwordDialog.mismatch`))}}function si(n,r){if(n&1){let e=$E();cs(0,`mat-form-field`)(1,`mat-label`),CI(2),Vu(),cs(3,`input`,8),Kb(),Tg(`ngModelChange`,function(i){kd(e);let a=ZE();return _I(a.repeated,i)||(a.repeated=i),Rd(i)}),Vu(),xE(4,di,2,1,`mat-hint`,9),Vu()}if(n&2){let e=ZE();sb(2),wg(e.i18n.t(`passwordDialog.repeat`)),sb(),Cg(`ngModel`,e.repeated),Qb(),sb(),RE(e.mismatch()?4:-1)}}function ci(n,r){if(n&1){let e=$E();cs(0,`mat-checkbox`,10),Kb(),Tg(`ngModelChange`,function(i){kd(e);let a=ZE();return _I(a.keepHistory,i)||(a.keepHistory=i),Rd(i)}),CI(1),Vu()}if(n&2){let e=ZE();Cg(`ngModel`,e.keepHistory),Qb(),sb(),qu(` `,e.i18n.t(`passwordDialog.keepHistory`),` `)}}var it=class n{data=g(Ui$1);i18n=g(Hm);dialog=g(Kt);minLength=8;password=ue(``);repeated=ue(``);keepHistory=ue(!1);tooShort=Ku(()=>!this.data.passwordSet&&this.password().length<8);mismatch=Ku(()=>!this.data.passwordSet&&this.repeated()!==``&&this.repeated()!==this.password());canConfirm=Ku(()=>this.data.passwordSet?this.password()!==``:!this.tooShort()&&this.repeated()===this.password());question=Ku(()=>{let r=this.data.deviceName;switch(this.data.action){case`add`:return this.i18n.t(`passwordDialog.add`,{device:r});case`remove`:return this.i18n.t(`passwordDialog.remove`,{device:r});case`kind`:return this.i18n.t(`passwordDialog.kind`,{device:r,kind:fV(this.data.kind??`server`,this.i18n)});case`pairing`:return this.i18n.t(`passwordDialog.pairing`,{device:r});case`release`:return this.i18n.t(`passwordDialog.release`,{device:r});case`backup`:return this.i18n.t(`passwordDialog.backup`);case`statusPassword`:return this.i18n.t(`passwordDialog.statusPassword`)}});confirmLabel=Ku(()=>{switch(this.data.action){case`add`:return this.i18n.t(`passwordDialog.confirmAdd`);case`remove`:return this.i18n.t(`passwordDialog.confirmRemove`);case`kind`:case`pairing`:return this.i18n.t(`passwordDialog.confirmKind`);case`release`:return this.i18n.t(`passwordDialog.confirmRelease`);case`backup`:return this.i18n.t(`passwordDialog.confirmBackup`);case`statusPassword`:return this.i18n.t(`passwordDialog.confirmStatus`)}});confirm(){this.canConfirm()&&this.dialog.close({password:this.password(),keepHistory:this.keepHistory()})}static ɵfac=function(e){return new(e||n)};static ɵcmp=Fw({type:n,selectors:[[`app-password-dialog`]],decls:20,vars:13,consts:[[`mat-dialog-title`,``],[3,`ngSubmit`],[1,`hint`],[`matInput`,``,`type`,`password`,`name`,`password`,`cdkFocusInitial`,``,3,`ngModelChange`,`autocomplete`,`ngModel`],[`name`,`keepHistory`,3,`ngModel`],[`align`,`end`],[`mat-button`,``,`type`,`button`,`mat-dialog-close`,``],[`mat-flat-button`,``,`type`,`submit`,3,`disabled`],[`matInput`,``,`type`,`password`,`name`,`repeated`,`autocomplete`,`new-password`,3,`ngModelChange`,`ngModel`],[1,`error`],[`name`,`keepHistory`,3,`ngModelChange`,`ngModel`]],template:function(e,t){e&1&&(cs(0,`h2`,0),CI(1),Vu(),cs(2,`form`,1),ig(`ngSubmit`,function(){return t.confirm()}),cs(3,`mat-dialog-content`)(4,`p`),CI(5),Vu(),xE(6,ai,2,1,`p`,2),xE(7,oi,2,1,`p`,2),cs(8,`mat-form-field`)(9,`mat-label`),CI(10),Vu(),cs(11,`input`,3),Kb(),Tg(`ngModelChange`,function(a){return _I(t.password,a)||(t.password=a),a}),Vu(),xE(12,li,2,3,`mat-hint`),Vu(),xE(13,si,5,3,`mat-form-field`),xE(14,ci,2,2,`mat-checkbox`,4),Vu(),cs(15,`mat-dialog-actions`,5)(16,`button`,6),CI(17),Vu(),cs(18,`button`,7),CI(19),Vu()()()),e&2&&(sb(),qu(` `,t.i18n.t(t.data.passwordSet?`passwordDialog.enterTitle`:`passwordDialog.chooseTitle`),`
`),sb(4),wg(t.question()),sb(),RE(t.data.action===`backup`?6:-1),sb(),RE(t.data.passwordSet?-1:7),sb(3),wg(t.i18n.t(`passwordDialog.password`)),sb(),Jh(`autocomplete`,t.data.passwordSet?`current-password`:`new-password`),Cg(`ngModel`,t.password),Qb(),sb(),RE(t.data.passwordSet?-1:12),sb(),RE(t.data.passwordSet?-1:13),sb(),RE(t.data.action===`remove`?14:-1),sb(3),wg(t.i18n.t(`passwordDialog.cancel`)),sb(),Jh(`disabled`,!t.canConfirm()),sb(),qu(` `,t.confirmLabel(),` `))},dependencies:[rc,ic,Ra,nc,ac,Ii$1,Ni$1,Vs,Ps,wc,Fi$1,bd,ud,pd,hd,oe,_e,re,ae,nt,tt],styles:[`mat-dialog-content[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:.5rem;max-width:26rem}p[_ngcontent-%COMP%]{margin:0 0 .5rem}`]})};var Tn=[[26,10,1],[44,16,1],[70,26,1],[100,18,2],[134,24,2],[172,16,4],[196,18,4],[242,22,4],[292,22,5],[346,26,5]];var mi=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50]];var fi=0;function ui(n){let r=new TextEncoder().encode(n),e=Tn.findIndex(([c,m,b],D)=>4+kn(D+1)+r.length*8<=(c-m*b)*8);if(e<0)throw new Error(`${r.length} bytes do not fit in a QR code of version 10`);let t=new wt(e+1);t.placeData(pi(r,e+1));let i=[],a=1/0;for(let c=0;c<8;c++){let m=t.masked(c),b=xi(m);b<a&&(i=m,a=b)}return i}function kn(n){return n<10?8:16}function pi(n,r){let[e,t,i]=Tn[r-1],a=e-t*i,c=[],m=(v,P)=>{for(let K=P-1;K>=0;K--)c.push(v>>>K&1)};m(4,4),m(n.length,kn(r)),n.forEach(v=>m(v,8)),m(0,Math.min(4,a*8-c.length)),m(0,(8-c.length%8)%8);let b=[];for(let v=0;v<c.length;v+=8)b.push(c.slice(v,v+8).reduce((P,K)=>P<<1|K,0));for(let v=236;b.length<a;v^=253)b.push(v);let D=Math.floor(a/i),J=a%i,ve=hi(t),ye=[],le=[];for(let v=0,P=0;v<i;v++){let K=D+(v>=i-J?1:0),ke=b.slice(P,P+K);P+=K,ye.push(ke),le.push(gi(ke,ve))}let ee=[];for(let v=0;v<=D;v++)for(let P of ye)v<P.length&&ee.push(P[v]);for(let v=0;v<t;v++)for(let P of le)ee.push(P[v]);return ee}function St(n,r){let e=0;for(let t=7;t>=0;t--)e=e<<1^(e>>>7)*285,e^=(r>>>t&1)*n;return e}function hi(n){let r=new Array(n).fill(0);r[n-1]=1;let e=1;for(let t=0;t<n;t++){for(let i=0;i<n;i++)r[i]=St(r[i],e)^(i+1<n?r[i+1]:0);e=St(e,2)}return r}function gi(n,r){let e=new Array(r.length).fill(0);for(let t of n){let i=t^(e.shift()??0);e.push(0),r.forEach((a,c)=>e[c]^=St(a,i))}return e}var wt=class{size;dark;fixed;constructor(r){this.size=r*4+17,this.dark=Array.from({length:this.size},()=>new Array(this.size).fill(!1)),this.fixed=Array.from({length:this.size},()=>new Array(this.size).fill(!1));for(let t=0;t<this.size;t++)this.set(6,t,t%2===0),this.set(t,6,t%2===0);this.finder(3,3),this.finder(this.size-4,3),this.finder(3,this.size-4);let e=mi[r-1];for(let t of e)for(let i of e){let a=e[e.length-1];if(!(t===6&&i===6||t===6&&i===a||t===a&&i===6))for(let c=-2;c<=2;c++)for(let m=-2;m<=2;m++)this.set(t+c,i+m,Math.max(Math.abs(m),Math.abs(c))!==1)}if(this.format(0),this.set(this.size-8,8,!0),r>=7){let t=r;for(let i=0;i<12;i++)t=t<<1^(t>>>11)*7973;t=r<<12|t;for(let i=0;i<18;i++){let a=(t>>>i&1)===1,c=this.size-11+i%3,m=Math.floor(i/3);this.set(c,m,a),this.set(m,c,a)}}}set(r,e,t){this.dark[r][e]=t,this.fixed[r][e]=!0}finder(r,e){for(let t=-4;t<=4;t++)for(let i=-4;i<=4;i++){let a=r+t,c=e+i;if(a<0||a>=this.size||c<0||c>=this.size)continue;let m=Math.max(Math.abs(i),Math.abs(t));this.set(a,c,m!==2&&m!==4)}}format(r,e=this.dark){let t=fi<<3|r,i=t;for(let m=0;m<10;m++)i=i<<1^(i>>>9)*1335;i=(t<<10|i)^21522;let a=m=>(i>>>m&1)===1,c=(m,b,D)=>{e[m][b]=D,this.fixed[m][b]=!0};for(let m=0;m<=5;m++)c(m,8,a(m));c(7,8,a(6)),c(8,8,a(7)),c(8,7,a(8));for(let m=9;m<15;m++)c(8,14-m,a(m));for(let m=0;m<8;m++)c(8,this.size-1-m,a(m));for(let m=8;m<15;m++)c(this.size-15+m,8,a(m))}placeData(r){let e=0;for(let t=this.size-1;t>=1;t-=2){t===6&&(t=5);for(let i=0;i<this.size;i++)for(let a=0;a<2;a++){let c=t-a,b=(t+1&2)===0?this.size-1-i:i;this.fixed[b][c]||(e<r.length*8&&(this.dark[b][c]=(r[e>>>3]>>>7-(e&7)&1)===1),e++)}}}masked(r){let e=this.dark.map(t=>[...t]);for(let t=0;t<this.size;t++)for(let i=0;i<this.size;i++)!this.fixed[t][i]&&bi(r,t,i)&&(e[t][i]=!e[t][i]);return this.format(r,e),e}};function bi(n,r,e){switch(n){case 0:return(r+e)%2===0;case 1:return r%2===0;case 2:return e%3===0;case 3:return(r+e)%3===0;case 4:return(Math.floor(r/2)+Math.floor(e/3))%2===0;case 5:return r*e%2+r*e%3===0;case 6:return(r*e%2+r*e%3)%2===0;default:return((r+e)%2+r*e%3)%2===0}}function xi(n){let r=n.length,e=0,t=[...n,...n.map((a,c)=>n.map(m=>m[c]))];for(let a of t){let c=1;for(let b=1;b<=r;b++){if(b<r&&a[b]===a[b-1]){c++;continue}c>=5&&(e+=c-2),c=1}let m=[!1,!1,!1,!1,...a,!1,!1,!1,!1];for(let b=0;b+11<=m.length;b++){let D=m.slice(b,b+11).map(J=>J?1:0).join(``);(D===`10111010000`||D===`00001011101`)&&(e+=40)}}for(let a=0;a+1<r;a++)for(let c=0;c+1<r;c++){let m=n[a][c];n[a][c+1]===m&&n[a+1][c]===m&&n[a+1][c+1]===m&&(e+=3)}let i=n.flat().filter(Boolean).length;return e+=Math.floor(Math.abs(i*20-r*r*10)/(r*r))*10,e}function In(n){let r=ui(n),e=r.flatMap((t,i)=>t.map((a,c)=>a?`M${c} ${i}h1v1h-1z`:``)).join(``);return{size:r.length,path:e}}var _i=n=>({device:n});var vi=n=>({time:n});var Rn=n=>({address:n});var Pn=n=>({port:n});var yi=n=>({count:n});var Si=(n,r)=>r.id;function wi(n,r){if(n&1){let e=$E();cs(0,`h3`)(1,`button`,14),ig(`click`,function(){kd(e);let i=ZE();return Rd(i.toggleList())}),Xh(2,`span`,15),CI(3),cs(4,`span`,16),CI(5),Vu()()()}if(n&2){let e=ZE();sb(),Qh(`aria-expanded`,e.listOpen()),sb(2),qu(``,e.i18n.t(`devicesDialog.listTitle`),` `),sb(2),wg(e.others().length)}}function Ci(n,r){if(n&1&&(cs(0,`span`,19),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`devicesDialog.router`))}}function Mi(n,r){if(n&1&&(cs(0,`span`,19),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.kindName(`phone`,e.i18n))}}function Ni(n,r){if(n&1){let e=$E();cs(0,`button`,25),ig(`click`,function(){let i=kd(e).$implicit,a=ZE(2).$implicit,c=ZE();return Rd(c.setKind(a,i))}),CI(1),Vu()}if(n&2){let e=r.$implicit,t=ZE(2).$implicit,i=ZE();Jh(`disabled`,i.busy()),Qh(`aria-pressed`,t.kind===e),sb(),qu(` `,i.kindName(e,i.i18n),` `)}}function Di(n,r){if(n&1&&(cs(0,`span`,7),LE(1,Ni,2,3,`button`,24,PE),Vu()),n&2){let e=ZE().$implicit,t=ZE();Qh(`aria-label`,t.i18n.t(`devicesDialog.kindOf`,LI(1,_i,e.name))),sb(),FE(t.kinds)}}function Ei(n,r){if(n&1){let e=$E();cs(0,`button`,26),ig(`click`,function(){kd(e);let i=ZE().$implicit,a=ZE();return Rd(a.remove(i))}),CI(1),Vu()}if(n&2){let e=ZE(2);Jh(`disabled`,e.busy()),sb(),qu(` `,e.i18n.t(`devicesDialog.remove`),` `)}}function Fi(n,r){if(n&1&&(cs(0,`span`,21),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`devicesDialog.fixed`))}}function Ti(n,r){if(n&1&&CI(0),n&2){let e=ZE(3);qu(` `,e.i18n.t(`devicesDialog.releasedUntil`,LI(1,vi,r)),` `)}}function ki(n,r){if(n&1&&CI(0),n&2){let e=ZE(3);qu(` `,e.i18n.t(`devicesDialog.hubLocked`),` `)}}function Ii(n,r){if(n&1){let e=$E();cs(0,`div`,22)(1,`p`,1),xE(2,Ti,1,3)(3,ki,1,1),Vu(),cs(4,`button`,27),ig(`click`,function(){kd(e);let i=ZE().$implicit,a=ZE();return Rd(a.releasePhone(i))}),CI(5),Vu()()}if(n&2){let e,t=ZE().$implicit,i=ZE();sb(2),RE((e=i.releasedUntil(t))?2:3,e),sb(2),Jh(`disabled`,i.busy()),sb(),qu(` `,i.i18n.t(`devicesDialog.release`),` `)}}function Ri(n,r){if(n&1){let e=$E();cs(0,`form`,28),ig(`ngSubmit`,function(){kd(e);let i=ZE().$implicit,a=ZE();return Rd(a.setCode(i))}),cs(1,`p`,1),CI(2),Vu(),cs(3,`mat-form-field`,5)(4,`mat-label`),CI(5),Vu(),cs(6,`input`,29),Kb(),ig(`ngModelChange`,function(i){kd(e);let a=ZE().$implicit,c=ZE();return Rd(c.typeCode(a,i))}),Vu()(),cs(7,`button`,30),CI(8),Vu()()}if(n&2){let e=ZE().$implicit,t=ZE();sb(2),qu(` `,t.i18n.t(e.pairing===`wrong`?`devicesDialog.pairingWrong`:`devicesDialog.pairingNeeded`),` `),sb(3),wg(t.i18n.t(`devicesDialog.code`)),sb(),Jh(`ngModel`,t.codeFor(e)),Qb(),sb(),Jh(`disabled`,t.busy()||!t.codeFor(e).trim()),sb(),qu(` `,t.i18n.t(`devicesDialog.setCode`),` `)}}function Pi(n,r){if(n&1&&(cs(0,`li`)(1,`span`,17)(2,`span`,18),CI(3),Vu(),cs(4,`span`,1),CI(5),Vu()(),xE(6,Ci,2,1,`span`,19)(7,Mi,2,1,`span`,19)(8,Di,3,3,`span`,7),xE(9,Ei,2,2,`button`,20)(10,Fi,2,1,`span`,21),xE(11,Ii,6,3,`div`,22),xE(12,Ri,9,5,`form`,23),Vu()),n&2){let e=r.$implicit;sb(3),wg(e.name),sb(2),wg(e.address),sb(),RE(e.router?6:e.kind===`phone`?7:8),sb(3),RE(e.removable?9:10),sb(2),RE(e.kind===`phone`&&e.removable?11:-1),sb(),RE(e.pairing?12:-1)}}function Ai(n,r){if(n&1&&(cs(0,`li`,1),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`devicesDialog.empty`))}}function Oi(n,r){if(n&1&&(cs(0,`p`,1),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`devicesDialog.suggested`))}}function Li(n,r){if(n&1){let e=$E();cs(0,`mat-form-field`)(1,`mat-label`),CI(2),Vu(),cs(3,`input`,31),Kb(),Tg(`ngModelChange`,function(i){kd(e);let a=ZE();return _I(a.address,i)||(a.address=i),Rd(i)}),Vu(),cs(4,`mat-hint`),CI(5),Vu()()}if(n&2){let e=ZE();sb(2),wg(e.i18n.t(`devicesDialog.address`)),sb(),Cg(`ngModel`,e.address),Qb(),sb(2),wg(e.i18n.t(`devicesDialog.addressHint`))}}function zi(n,r){if(n&1){let e=$E();cs(0,`button`,32),ig(`click`,function(){let i=kd(e).$implicit,a=ZE();return Rd(a.kind.set(i))}),CI(1),Vu()}if(n&2){let e=r.$implicit,t=ZE();Qh(`aria-pressed`,e===t.kind()),sb(),qu(` `,t.kindName(e,t.i18n),` `)}}function Vi(n,r){if(n&1&&(cs(0,`p`,1),CI(1),Vu(),Wd(),cs(2,`svg`,33),Xh(3,`rect`,34)(4,`path`,35),Vu()),n&2){let e=r,t=ZE(2);sb(),wg(t.i18n.t(`devicesDialog.phoneHint`,LI(4,Rn,t.hubAddress()))),sb(),Qh(`viewBox`,`-4 -4 `+(e.size+8)+` `+(e.size+8))(`aria-label`,t.i18n.t(`devicesDialog.hubCode`,LI(6,Rn,t.hubAddress()))),sb(2),Qh(`d`,e.path)}}function Hi(n,r){if(n&1&&(cs(0,`p`,1),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`devicesDialog.phoneHintOnHub`,LI(1,Pn,e.hubPort())))}}function Bi(n,r){if(n&1&&xE(0,Vi,5,8)(1,Hi,2,3,`p`,1),n&2){let e,t=ZE();RE((e=t.hubCode())?0:1,e)}}function ji(n,r){if(n&1&&(cs(0,`p`,1),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`devicesDialog.kindHint`))}}function qi(n,r){if(n&1&&(cs(0,`h3`),CI(1),Vu(),cs(2,`p`,1),CI(3),Vu(),cs(4,`p`,36),CI(5),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`devicesDialog.ownCodeTitle`)),sb(2),wg(e.i18n.t(`devicesDialog.ownCodeHint`)),sb(2),wg(e.ownCode())}}function Ki(n,r){if(n&1&&(cs(0,`p`,1),CI(1),cs(2,`code`,41),CI(3),Vu()()),n&2){let e=ZE(),t=ZE();sb(),qu(` `,t.i18n.t(`devicesDialog.statusFingerprint`),` `),sb(2),wg(e.fingerprint)}}function Wi(n,r){if(n&1&&(cs(0,`mat-hint`,40),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`passwordDialog.mismatch`))}}function Ui(n,r){if(n&1){let e=$E();cs(0,`form`,37),ig(`ngSubmit`,function(){kd(e);let i=ZE();return Rd(i.setStatusPassword())}),cs(1,`h3`),CI(2),Vu(),cs(3,`p`,1),CI(4),Vu(),xE(5,Ki,4,2,`p`,1),cs(6,`p`,1),CI(7),Vu(),cs(8,`mat-form-field`)(9,`mat-label`),CI(10),Vu(),cs(11,`input`,38),Kb(),Tg(`ngModelChange`,function(i){kd(e);let a=ZE();return _I(a.statusPassword,i)||(a.statusPassword=i),Rd(i)}),Vu(),cs(12,`mat-hint`),CI(13),Vu()(),cs(14,`mat-form-field`)(15,`mat-label`),CI(16),Vu(),cs(17,`input`,39),Kb(),Tg(`ngModelChange`,function(i){kd(e);let a=ZE();return _I(a.statusRepeated,i)||(a.statusRepeated=i),Rd(i)}),Vu(),xE(18,Wi,2,1,`mat-hint`,40),Vu(),cs(19,`button`,30),CI(20),Vu()()}if(n&2){let e=r,t=ZE();sb(2),wg(t.i18n.t(`devicesDialog.statusTitle`)),sb(2),wg(t.i18n.t(`devicesDialog.statusHint`,LI(14,Pn,e.port??``))),sb(),RE(e.fingerprint?5:-1),sb(2),qu(` `,t.i18n.t(t.statusSaved()?`devicesDialog.statusSaved`:e.passwordSet?`devicesDialog.statusPasswordSet`:`devicesDialog.statusPasswordNone`),` `),sb(3),wg(t.i18n.t(`devicesDialog.statusNew`)),sb(),Jh(`maxlength`,t.maxLength),Cg(`ngModel`,t.statusPassword),Qb(),sb(2),wg(t.i18n.t(`passwordDialog.minLength`,LI(16,yi,t.minLength))),sb(3),wg(t.i18n.t(`passwordDialog.repeat`)),sb(),Jh(`maxlength`,t.maxLength),Cg(`ngModel`,t.statusRepeated),Qb(),sb(),RE(t.statusMismatch()?18:-1),sb(),Jh(`disabled`,t.busy()||!t.canSetStatusPassword()),sb(),qu(` `,t.i18n.t(e.passwordSet?`devicesDialog.statusChange`:`devicesDialog.statusSet`),` `)}}function Gi(n,r){if(n&1&&(cs(0,`p`,11),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.problem())}}var An=9393;var Ct=class n{i18n=g(Hm);devices=g(Nm);dialog=g(yo);destroyRef=g(re$1);host=g(mn);document=g(Q);others=Ku(()=>this.devices.devices().slice(1));listOpen=ue(!0);listToggled=ue(!1);name=ue(``);address=ue(``);kind=ue(`server`);code=ue(``);codes=ue({});ownCode=ue(``);kinds=aV;addKinds=cV;addsPhone=Ku(()=>this.kind()===`phone`);canAdd=Ku(()=>!!this.name().trim()&&!!(this.addsPhone()?this.code().trim():this.address().trim()));hubAddress=Ku(()=>Yi(this.document.location,this.devices.pagePort()));hubCode=Ku(()=>{let r=this.hubAddress();return r?In(`http://${r}/`):null});hubPort=Ku(()=>this.devices.pagePort()||this.document.location.port||String(An));kindName=fV;statusPage=ue(null);statusPassword=ue(``);statusRepeated=ue(``);minLength=8;maxLength=128;statusMismatch=Ku(()=>this.statusRepeated()!==``&&this.statusRepeated()!==this.statusPassword());canSetStatusPassword=Ku(()=>this.statusPassword().length>=8&&this.statusPassword().length<=128&&this.statusRepeated()===this.statusPassword());statusSaved=ue(!1);problem=ue(``);busy=ue(!1);changeStarted=new ne;suggestion=ue(null);suggested=Ku(()=>!this.addsPhone()&&this.suggestion()?.address===this.address().trim());constructor(){let r=ue(0);wr(window,`resize`).pipe(q()).subscribe(()=>r.update(e=>e+1)),kj(()=>{if(this.others(),this.suggested(),r(),this.listToggled()||!this.listOpen())return;let e=this.host.nativeElement.querySelector(`ul`);if(!e||e.scrollHeight<=e.clientHeight)return;let t=e.querySelector(`li`)?.offsetHeight||$i(5);e.clientHeight<t&&this.listOpen.set(!1)}),this.devices.pairingCode().pipe(Er(()=>ea(``)),q()).subscribe(e=>this.ownCode.set(e)),this.loadStatusPage(),this.devices.suggestion().pipe(Er(()=>ea(null)),q()).subscribe(e=>{!e||this.name()||this.address()||(this.suggestion.set(e),this.name.set(e.name),this.address.set(e.address),this.kind.set(e.kind))})}toggleList(){this.listToggled.set(!0),this.listOpen.update(r=>!r)}add(){if(!this.canAdd())return;let r=this.name().trim(),e=this.address().trim(),t=this.kind(),i=this.code().trim();this.change({action:`add`,deviceName:r},a=>t===`phone`?this.devices.addPhone(r,i,a.password):this.devices.add(r,e,t,i,a.password)).subscribe(()=>{this.name.set(``),this.address.set(``),this.kind.set(`server`),this.code.set(``)})}codeFor(r){return this.codes()[r.id]??``}typeCode(r,e){this.codes.update(t=>K(V({},t),{[r.id]:e}))}setCode(r){let e=this.codeFor(r).trim();e&&this.change({action:`pairing`,deviceName:r.name},t=>this.devices.setCode(r.id,e,t.password)).subscribe(()=>this.typeCode(r,``))}setKind(r,e){r.kind!==e&&this.change({action:`kind`,deviceName:r.name,kind:e},t=>this.devices.setKind(r.id,e,t.password)).subscribe()}remove(r){this.change({action:`remove`,deviceName:r.name},e=>this.devices.remove(r.id,e.password,e.keepHistory)).subscribe()}releasePhone(r){this.change({action:`release`,deviceName:r.name},e=>this.devices.releasePhone(r.id,e.password)).subscribe()}releasedUntil(r){return r.releasedUntil?bm(r.releasedUntil,this.i18n.t(`format.time`),this.i18n.language()):``}backup(){this.change({action:`backup`,deviceName:``},r=>this.devices.backup(r.password).pipe(Wo(e=>GB(this.document,e.file,e.name)))).subscribe()}setStatusPassword(){if(!this.canSetStatusPassword())return;let r=this.statusPassword();this.statusSaved.set(!1),this.change({action:`statusPassword`,deviceName:``},e=>this.devices.setStatusPassword(r,e.password)).subscribe(()=>{this.statusPassword.set(``),this.statusRepeated.set(``),this.statusSaved.set(!0),this.loadStatusPage()})}loadStatusPage(){this.devices.statusPage().pipe(Er(()=>ea(null)),q(this.destroyRef)).subscribe(r=>this.statusPage.set(r?.enabled?r:null))}change(r,e){let t=K(V({},r),{passwordSet:this.devices.passwordSet()});return this.dialog.open(it,{data:t}).afterClosed().pipe(Sn$1(i=>i!==void 0),Wo(()=>{this.changeStarted.next(),this.busy.set(!0),this.problem.set(``)}),Vt(i=>e(i).pipe(Vt(()=>this.devices.load().pipe(q(this.destroyRef),Er(()=>ea(null)))))),Er(i=>(this.problem.set(hV(i,this.i18n)),this.busy.set(!1),this.devices.load().pipe($l(this.changeStarted),q(this.destroyRef),ta(),Er(()=>Je$1)))),zo(()=>this.busy.set(!1)))}static ɵfac=function(e){return new(e||n)};static ɵcmp=Fw({type:n,selectors:[[`app-devices-dialog`]],decls:44,vars:25,consts:[[`mat-dialog-title`,``],[1,`hint`],[`id`,`devices-dialog-list`,3,`hidden`],[`id`,`devices-dialog-add`,3,`ngSubmit`],[`matInput`,``,`name`,`name`,`maxlength`,`64`,`autocomplete`,`off`,3,`ngModelChange`,`ngModel`],[`subscriptSizing`,`dynamic`],[`matInput`,``,`name`,`code`,`maxlength`,`32`,`placeholder`,`7KQM-X2RP`,`autocomplete`,`off`,`autocapitalize`,`characters`,`spellcheck`,`false`,3,`ngModelChange`,`ngModel`],[`role`,`group`,1,`choices`,`kind`],[`type`,`button`],[`mat-stroked-button`,``,`type`,`button`,1,`backup`,3,`click`,`disabled`],[1,`status-page`],[`role`,`alert`,1,`error`],[`mat-flat-button`,``,`type`,`submit`,`form`,`devices-dialog-add`,3,`disabled`],[`mat-button`,``,`type`,`button`,`mat-dialog-close`,``],[`type`,`button`,`aria-controls`,`devices-dialog-list`,1,`fold`,3,`click`],[`aria-hidden`,`true`,1,`chevron`],[1,`count`],[1,`who`],[1,`name`],[1,`router`,`hint`],[`mat-button`,``,`type`,`button`,3,`disabled`],[1,`fixed`,`hint`],[1,`release`],[1,`pairing`],[`type`,`button`,3,`disabled`],[`type`,`button`,3,`click`,`disabled`],[`mat-button`,``,`type`,`button`,3,`click`,`disabled`],[`mat-stroked-button`,``,`type`,`button`,3,`click`,`disabled`],[1,`pairing`,3,`ngSubmit`],[`matInput`,``,`name`,`device-code`,`maxlength`,`32`,`autocomplete`,`off`,`autocapitalize`,`characters`,`spellcheck`,`false`,3,`ngModelChange`,`ngModel`],[`mat-stroked-button`,``,`type`,`submit`,3,`disabled`],[`matInput`,``,`name`,`address`,`placeholder`,`192.168.1.20:9393`,`autocomplete`,`off`,3,`ngModelChange`,`ngModel`],[`type`,`button`,3,`click`],[`role`,`img`,1,`hub-code`],[`x`,`-4`,`y`,`-4`,`width`,`100%`,`height`,`100%`,`fill`,`#fff`],[`fill`,`#000`],[1,`own-code`],[1,`status-page`,3,`ngSubmit`],[`matInput`,``,`type`,`password`,`name`,`status-password`,`autocomplete`,`new-password`,3,`ngModelChange`,`maxlength`,`ngModel`],[`matInput`,``,`type`,`password`,`name`,`status-repeated`,`autocomplete`,`new-password`,3,`ngModelChange`,`maxlength`,`ngModel`],[1,`error`],[1,`fingerprint`]],template:function(e,t){if(e&1&&(cs(0,`h2`,0),CI(1),Vu(),cs(2,`mat-dialog-content`)(3,`p`,1),CI(4),Vu(),xE(5,wi,6,3,`h3`),cs(6,`ul`,2),LE(7,Pi,13,6,`li`,null,Si,!1,Ai,2,1,`li`,1),Vu(),cs(10,`form`,3),ig(`ngSubmit`,function(){return t.add()}),cs(11,`h3`),CI(12),Vu(),xE(13,Oi,2,1,`p`,1),cs(14,`mat-form-field`)(15,`mat-label`),CI(16),Vu(),cs(17,`input`,4),Kb(),Tg(`ngModelChange`,function(a){return _I(t.name,a)||(t.name=a),a}),Vu()(),xE(18,Li,6,3,`mat-form-field`),cs(19,`mat-form-field`,5)(20,`mat-label`),CI(21),Vu(),cs(22,`input`,6),Kb(),Tg(`ngModelChange`,function(a){return _I(t.code,a)||(t.code=a),a}),Vu(),cs(23,`mat-hint`),CI(24),Vu()(),cs(25,`div`,7),LE(26,zi,2,2,`button`,8,PE),Vu(),xE(28,Bi,2,1)(29,ji,2,1,`p`,1),Vu(),xE(30,qi,6,3),cs(31,`h3`),CI(32),Vu(),cs(33,`p`,1),CI(34),Vu(),cs(35,`button`,9),ig(`click`,function(){return t.backup()}),CI(36),Vu(),xE(37,Ui,21,18,`form`,10),xE(38,Gi,2,1,`p`,11),Vu(),cs(39,`mat-dialog-actions`)(40,`button`,12),CI(41),Vu(),cs(42,`button`,13),CI(43),Vu()()),e&2){let i;sb(),wg(t.i18n.t(`devicesDialog.title`)),sb(3),wg(t.i18n.t(`devicesDialog.intro`)),sb(),RE(t.others().length?5:-1),sb(),Jh(`hidden`,!t.listOpen()),sb(),FE(t.others()),sb(5),wg(t.i18n.t(`devicesDialog.addTitle`)),sb(),RE(t.suggested()?13:-1),sb(3),wg(t.i18n.t(`devicesDialog.name`)),sb(),Cg(`ngModel`,t.name),Qb(),sb(),RE(t.addsPhone()?-1:18),sb(3),wg(t.i18n.t(`devicesDialog.code`)),sb(),Cg(`ngModel`,t.code),Qb(),sb(2),qu(` `,t.i18n.t(t.addsPhone()?`devicesDialog.phoneCodeHint`:`devicesDialog.codeHint`),` `),sb(),Qh(`aria-label`,t.i18n.t(`devicesDialog.kind`)),sb(),FE(t.addKinds),sb(2),RE(t.addsPhone()?28:29),sb(2),RE(t.ownCode()?30:-1),sb(2),wg(t.i18n.t(`devicesDialog.backupTitle`)),sb(2),wg(t.i18n.t(`devicesDialog.backupHint`)),sb(),Jh(`disabled`,t.busy()),sb(),qu(` `,t.i18n.t(`devicesDialog.backup`),` `),sb(),RE((i=t.statusPage())?37:-1,i),sb(),RE(t.problem()?38:-1),sb(2),Jh(`disabled`,t.busy()||!t.canAdd()),sb(),qu(` `,t.i18n.t(`devicesDialog.add`),` `),sb(2),wg(t.i18n.t(`devicesDialog.close`))}},dependencies:[rc,ic,Ra,nc,ac,ui$1,Ii$1,Ni$1,Vs,Ps,bd,ud,pd,hd,oe,_e,re,ae,nt,tt],styles:[`mat-dialog-content[_ngcontent-%COMP%]{display:flex;flex-direction:column;max-width:32rem}mat-dialog-content[_ngcontent-%COMP%] > *[_ngcontent-%COMP%]{flex-shrink:0}p[_ngcontent-%COMP%]{margin:0 0 .75rem}mat-dialog-content[_ngcontent-%COMP%] > ul[_ngcontent-%COMP%]{flex-shrink:1;min-height:2.5rem;margin:0 0 1rem;padding:0;overflow-y:auto;overscroll-behavior:contain;list-style:none}li[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .75rem;min-height:2.5rem;padding:.375rem 0;border-bottom:1px solid var(--%NS%mat-sys-outline-variant)}.who[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;gap:0 .75rem;flex-basis:100%}.router[_ngcontent-%COMP%]{font:var(--%NS%mat-sys-label-medium)}.kind[_ngcontent-%COMP%] > button[_ngcontent-%COMP%]{height:1.75rem;font:var(--%NS%mat-sys-label-medium)}form[_ngcontent-%COMP%]   .kind[_ngcontent-%COMP%]{flex-basis:100%;margin:.5rem 0}.name[_ngcontent-%COMP%]{font-weight:500}li[_ngcontent-%COMP%]   button[_ngcontent-%COMP%], .fixed[_ngcontent-%COMP%]{margin-left:auto}h3[_ngcontent-%COMP%]{margin:0 0 .75rem;font:var(--%NS%mat-sys-title-small)}ul[hidden][_ngcontent-%COMP%]{display:none}form[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 .75rem}mat-dialog-actions[_ngcontent-%COMP%]{justify-content:space-between}form[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%], form[_ngcontent-%COMP%]   .hint[_ngcontent-%COMP%]{flex-basis:100%}mat-form-field[_ngcontent-%COMP%]{flex:1 1 12rem}.error[_ngcontent-%COMP%]{margin-top:.75rem}.backup[_ngcontent-%COMP%]{align-self:flex-start}form.pairing[_ngcontent-%COMP%]{flex-basis:100%;align-items:center;gap:.25rem .75rem;padding-bottom:.25rem}form.pairing[_ngcontent-%COMP%]   .hint[_ngcontent-%COMP%]{margin:0}form.pairing[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]{margin-left:0}.release[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;flex-basis:100%;align-items:center;gap:.25rem .75rem;padding-bottom:.25rem}.release[_ngcontent-%COMP%]   .hint[_ngcontent-%COMP%]{flex:1 1 12rem;margin:0}.hub-code[_ngcontent-%COMP%]{width:11rem;height:11rem;margin:0 0 .75rem;border-radius:.5rem;shape-rendering:crispEdges}.own-code[_ngcontent-%COMP%]{font:var(--%NS%mat-sys-title-large);font-family:ui-monospace,monospace;letter-spacing:.1em;-webkit-user-select:all;user-select:all}form.status-page[_ngcontent-%COMP%]{margin-top:1.25rem}form.status-page[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]{flex-basis:100%;max-width:max-content}.fingerprint[_ngcontent-%COMP%]{font-family:ui-monospace,monospace;font-size:.85em;overflow-wrap:anywhere;-webkit-user-select:all;user-select:all}`]})};function $i(n){return n*parseFloat(getComputedStyle(document.documentElement).fontSize)}function jo(n){n.get(yo).open(Ct,{autoFocus:`first-tabbable`,injector:n})}function Yi(n,r){let e=n.hostname;return e===`localhost`||e.endsWith(`.localhost`)||e.startsWith(`127.`)||e===`[::1]`?``:`${e}:${r||n.port||An}`}export{Ct as DevicesDialog,jo as openDevicesDialog,Yi as phoneAddress};