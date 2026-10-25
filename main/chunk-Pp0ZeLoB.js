import{$ as LE,$n as lg,An as fT,Br as xj,Cn as eI,Ct as Qb,D as FE,Dn as ei$1,En as eg,Et as RE,G as Jh,Gn as ig,Gt as Vt,Ir as wg,J as Kb,Kn as io,Kr as z,Kt as Vu,L as Hh,Ln as ge,Lr as wr,Lt as Ty,N as GI,O as FI,Or as ug,Ot as Rd,Pn as g,Pt as Tg,Qn as lV,Qt as XE,R as Hi,Rn as gg,Sn as dg,St as QE,T as Er,Tn as ee$1,Tr as ta,Vn as hC,Vt as V,W as Je,Wt as Vg,X as Ku,Xn as kd,Yr as zo,Zt as Wo,_ as Cg,bn as cs,br as sV,en as Xh,ft as Nm,g as Ce,gr as re,h as CI,hr as qu,ht as OI,i as $l,in as Zr,it as Lw,j as Fu,jn as fV,jr as vi$1,jt as Sn,kt as Rt,lr as oo,lt as N,m as C,nn as YE,nr as nI,o as $u,on as _I,or as nu,ot as Mj,pt as Ny,q as K,qt as WB,rn as ZE,rr as ne,rt as Lu,sn as _j,t as $E,tr as mn$1,u as Ay,vn as cg,vr as rg,vt as PE,wn as ea,wr as tI,wt as Qh,xr as sb,xt as Q,z as Hm,zr as xE,zt as Uu}from"./chunk-8VTk9adQ.js";import{A as je,D as dn$1,O as fe,b as Fe,h as q,j as yn,k as he}from"./main-NGQTVPVZ.js";import{C as ud,E as yo,S as rn$1,T as wc,_ as hd,a as Mi,b as pd,c as Ra,d as Vr,f as Vs,g as gr,h as bd,i as Kt,l as St,m as ac,n as G,o as Ni,p as Zr$1,r as Ii,s as Ps,t as Fi,u as Ui,v as ic,w as ui$1,x as rc,y as nc}from"./chunk-BRaKjryF.js";var rn=Symbol(`FIELD_TREE`);function ye(n){return typeof n==`function`&&n[rn]===!0}var on=new C(``);var pt=class{_box;_destroyed=new ne;_resizeSubject=new ne;_resizeObserver;_elementObservables=new Map;constructor(a){this._box=a,typeof ResizeObserver<`u`&&(this._resizeObserver=new ResizeObserver(e=>this._resizeSubject.next(e)))}observe(a){return this._elementObservables.has(a)||this._elementObservables.set(a,new N(e=>{let t=this._resizeSubject.subscribe(e);return this._resizeObserver?.observe(a,{box:this._box}),()=>{this._resizeObserver?.unobserve(a),t.unsubscribe(),this._elementObservables.delete(a)}}).pipe(Sn(e=>e.some(t=>t.target===a)),Ay({bufferSize:1,refCount:!0}),$l(this._destroyed))),this._elementObservables.get(a)}destroy(){this._destroyed.next(),this._destroyed.complete(),this._resizeSubject.complete(),this._elementObservables.clear()}};var ln=(()=>{class n{_cleanupErrorListener;_observers=new Map;_ngZone=g(Ce);constructor(){}ngOnDestroy(){for(let[,e]of this._observers)e.destroy();this._observers.clear(),this._cleanupErrorListener?.()}observe(e,t){let i=t?.box||`content-box`;return this._observers.has(i)||this._observers.set(i,new pt(i)),this._observers.get(i).observe(e)}static ɵfac=function(t){return new(t||n)};static ɵprov=Rt({token:n,factory:n.ɵfac})}return n})();var X=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵdir=Lu({type:n,selectors:[[`mat-label`]]})}return n})();var In=new C(`MatError`);var J=(()=>{class n{align=`start`;id=g(je).getId(`mat-mdc-hint-`);static ɵfac=function(t){return new(t||n)};static ɵdir=Lu({type:n,selectors:[[`mat-hint`]],hostAttrs:[1,`mat-mdc-form-field-hint`,`mat-mdc-form-field-bottom-align`],hostVars:4,hostBindings:function(t,i){t&2&&(rg(`id`,i.id),Qh(`align`,null),gg(`mat-mdc-form-field-hint-end`,i.align===`end`))},inputs:{align:`align`,id:`id`}})}return n})();var Rn=new C(`MatPrefix`);var Pn=new C(`MatSuffix`);var pn=new C(`FloatingLabelParent`);var dn=(()=>{class n{_elementRef=g(mn$1);get floating(){return this._floating}set floating(e){this._floating=e,this.monitorResize&&this._handleResize()}_floating=!1;get monitorResize(){return this._monitorResize}set monitorResize(e){this._monitorResize=e,this._monitorResize?this._subscribeToResize():this._resizeSubscription.unsubscribe()}_monitorResize=!1;_resizeObserver=g(ln);_ngZone=g(Ce);_parent=g(pn);_resizeSubscription=new ee$1;ngOnDestroy(){this._resizeSubscription.unsubscribe()}getWidth(){return An(this._elementRef.nativeElement)}get element(){return this._elementRef.nativeElement}_handleResize(){setTimeout(()=>this._parent._handleLabelResized())}_subscribeToResize(){this._resizeSubscription.unsubscribe(),this._ngZone.runOutsideAngular(()=>{this._resizeSubscription=this._resizeObserver.observe(this._elementRef.nativeElement,{box:`border-box`}).subscribe(()=>this._handleResize())})}static ɵfac=function(t){return new(t||n)};static ɵdir=Lu({type:n,selectors:[[`label`,`matFormFieldFloatingLabel`,``]],hostAttrs:[1,`mdc-floating-label`,`mat-mdc-floating-label`],hostVars:2,hostBindings:function(t,i){t&2&&gg(`mdc-floating-label--float-above`,i.floating)},inputs:{floating:`floating`,monitorResize:`monitorResize`}})}return n})();function An(n){let a=n;if(a.offsetParent!==null)return a.scrollWidth;let e=a.cloneNode(!0);e.style.setProperty(`position`,`absolute`),e.style.setProperty(`transform`,`translate(-9999px, -9999px)`),document.documentElement.appendChild(e);let t=e.scrollWidth;return e.remove(),t}var sn=`mdc-line-ripple--active`;var Ke=`mdc-line-ripple--deactivating`;var cn=(()=>{class n{_elementRef=g(mn$1);_cleanupTransitionEnd;constructor(){let e=g(Ce),t=g(io);e.runOutsideAngular(()=>{this._cleanupTransitionEnd=t.listen(this._elementRef.nativeElement,`transitionend`,this._handleTransitionEnd)})}activate(){let e=this._elementRef.nativeElement.classList;e.remove(Ke),e.add(sn)}deactivate(){this._elementRef.nativeElement.classList.add(Ke)}_handleTransitionEnd=e=>{let t=this._elementRef.nativeElement.classList,i=t.contains(Ke);e.propertyName===`opacity`&&i&&t.remove(sn,Ke)};ngOnDestroy(){this._cleanupTransitionEnd()}static ɵfac=function(t){return new(t||n)};static ɵdir=Lu({type:n,selectors:[[`div`,`matFormFieldLineRipple`,``]],hostAttrs:[1,`mdc-line-ripple`]})}return n})();var mn=(()=>{class n{_elementRef=g(mn$1);_ngZone=g(Ce);open=!1;_notch;ngAfterViewInit(){let e=this._elementRef.nativeElement,t=e.querySelector(`.mdc-floating-label`);t?(e.classList.add(`mdc-notched-outline--upgraded`),typeof requestAnimationFrame==`function`&&(t.style.transitionDuration=`0s`,this._ngZone.runOutsideAngular(()=>{requestAnimationFrame(()=>t.style.transitionDuration=``)}))):e.classList.add(`mdc-notched-outline--no-label`)}_setNotchWidth(e){let t=this._notch.nativeElement;!this.open||!e?t.style.width=``:t.style.width=`calc(${e}px * var(--mat-mdc-form-field-floating-label-scale, 0.75) + 9px)`}_setMaxWidth(e){this._notch.nativeElement.style.setProperty(`--mat-form-field-notch-max-width`,`calc(100% - ${e}px)`)}static ɵfac=function(t){return new(t||n)};static ɵcmp=(function(){let e=[`notch`];return Lw({type:n,selectors:[[`div`,`matFormFieldNotchedOutline`,``]],viewQuery:function(s,b){if(s&1&&ug(e,5),s&2){let y;XE(y=eI())&&(b._notch=y.first)}},hostAttrs:[1,`mdc-notched-outline`],hostVars:2,hostBindings:function(s,b){s&2&&gg(`mdc-notched-outline--notched`,b.open)},inputs:{open:[0,`matFormFieldNotchedOutlineOpen`,`open`]},ngContentSelectors:[`*`],decls:5,vars:0,consts:[[`notch`,``],[1,`mat-mdc-notch-piece`,`mdc-notched-outline__leading`],[1,`mat-mdc-notch-piece`,`mdc-notched-outline__notch`],[1,`mat-mdc-notch-piece`,`mdc-notched-outline__trailing`]],template:function(s,b){s&1&&(YE(),eg(0,`div`,1),Uu(1,`div`,2,0),QE(3),$u(),eg(4,`div`,3))},encapsulation:2})})()}return n})();var ht=(()=>{class n{id;ngField=null;ngControl=null;focused=!1;empty=!1;shouldLabelFloat=!1;required=!1;disabled=!1;errorState=!1;controlType;autofilled;userAriaDescribedBy;disableAutomaticLabeling;describedByIds;stateChanges=null;value;static ɵfac=function(t){return new(t||n)};static ɵdir=Lu({type:n})}return n})();var gt=new C(`MatFormField`);var On=new C(`MAT_FORM_FIELD_DEFAULT_OPTIONS`);var fn=`fill`;var Ln=`auto`;var un=`fixed`;var zn=`translateY(-50%)`;var ue=(()=>{class n{_elementRef=g(mn$1);_changeDetectorRef=g(Vg);_platform=g(he);_idGenerator=g(je);_ngZone=g(Ce);_defaults=g(On,{optional:!0});_currentDirection;_unwrapMaybeSignal(e){return Zr(e)?e():e}_textField;_iconPrefixContainer;_textPrefixContainer;_iconSuffixContainer;_textSuffixContainer;_floatingLabel;_notchedOutline;_lineRipple;_iconPrefixContainerSignal=Mj(`iconPrefixContainer`);_textPrefixContainerSignal=Mj(`textPrefixContainer`);_iconSuffixContainerSignal=Mj(`iconSuffixContainer`);_textSuffixContainerSignal=Mj(`textSuffixContainer`);_prefixSuffixContainers=Ku(()=>[this._iconPrefixContainerSignal(),this._textPrefixContainerSignal(),this._iconSuffixContainerSignal(),this._textSuffixContainerSignal()].map(e=>e?.nativeElement).filter(e=>e!==void 0));_formFieldControl;_prefixChildren;_suffixChildren;_errorChildren;_hintChildren;_labelChild=_j(X);get hideRequiredMarker(){return this._hideRequiredMarker}set hideRequiredMarker(e){this._hideRequiredMarker=Zr$1(e)}_hideRequiredMarker=!1;color=`primary`;get floatLabel(){return this._floatLabel||this._defaults?.floatLabel||Ln}set floatLabel(e){e!==this._floatLabel&&(this._floatLabel=e,this._changeDetectorRef.markForCheck())}_floatLabel;get appearance(){return this._appearanceSignal()}set appearance(e){let t=e||this._defaults?.appearance||fn;this._appearanceSignal.set(t)}_appearanceSignal=ge(fn);get subscriptSizing(){return this._subscriptSizing||this._defaults?.subscriptSizing||un}set subscriptSizing(e){this._subscriptSizing=e||this._defaults?.subscriptSizing||un}_subscriptSizing=null;get hintLabel(){return this._hintLabel}set hintLabel(e){this._hintLabel=e,this._processHints()}_hintLabel=``;_hasIconPrefix=!1;_hasTextPrefix=!1;_hasIconSuffix=!1;_hasTextSuffix=!1;_labelId=this._idGenerator.getId(`mat-mdc-form-field-label-`);_hintLabelId=this._idGenerator.getId(`mat-mdc-hint-`);_describedByIds;get _control(){return this._explicitFormFieldControl||this._formFieldControl}set _control(e){this._explicitFormFieldControl=e}_destroyed=new ne;_isFocused=null;_explicitFormFieldControl;_previousControl=null;_previousControlValidatorFn=null;_stateChanges;_valueChanges;_describedByChanges;_outlineLabelOffsetResizeObserver=null;_animationsDisabled=G();constructor(){let e=this._defaults,t=g(fe);e&&(e.appearance&&(this.appearance=e.appearance),this._hideRequiredMarker=!!e?.hideRequiredMarker,e.color&&(this.color=e.color)),Hi(()=>this._currentDirection=t.valueSignal()),this._syncOutlineLabelOffset()}ngAfterViewInit(){this._updateFocusState(),this._animationsDisabled||this._ngZone.runOutsideAngular(()=>{setTimeout(()=>{this._elementRef.nativeElement.classList.add(`mat-form-field-animations-enabled`)},300)}),this._changeDetectorRef.detectChanges()}ngAfterContentInit(){this._assertFormFieldControl(),this._initializeSubscript(),this._initializePrefixAndSuffix()}ngAfterContentChecked(){this._assertFormFieldControl(),this._control!==this._previousControl&&(this._initializeControl(this._previousControl),this._control.ngControl&&this._control.ngControl.control&&(this._previousControlValidatorFn=ye(this._control.ngField)?null:this._control.ngControl.control.validator),this._previousControl=this._control,this._changeDetectorRef.markForCheck()),this._control.ngControl&&this._control.ngControl.control&&!ye(this._control.ngField)&&this._control.ngControl.control.validator!==this._previousControlValidatorFn&&this._changeDetectorRef.markForCheck()}ngOnDestroy(){this._outlineLabelOffsetResizeObserver?.disconnect(),this._stateChanges?.unsubscribe(),this._valueChanges?.unsubscribe(),this._describedByChanges?.unsubscribe(),this._destroyed.next(),this._destroyed.complete()}getLabelId=Ku(()=>this._hasFloatingLabel()?this._labelId:null);getConnectedOverlayOrigin(){return this._textField||this._elementRef}_animateAndLockLabel(){this._hasFloatingLabel()&&(this.floatLabel=`always`)}_initializeControl(e){let t=this._control,i=`mat-mdc-form-field-type-`;e&&this._elementRef.nativeElement.classList.remove(i+e.controlType),t.controlType&&this._elementRef.nativeElement.classList.add(i+t.controlType),this._stateChanges?.unsubscribe(),this._stateChanges=t.stateChanges?.subscribe(()=>{this._updateFocusState(),this._changeDetectorRef.markForCheck()}),this._describedByChanges?.unsubscribe(),this._describedByChanges=t.stateChanges?.pipe(ei$1([void 0,void 0]),z(()=>[this._unwrapMaybeSignal(t.errorState),t.userAriaDescribedBy]),Ny(),Sn(([[s,b],[y,V]])=>s!==y||b!==V)).subscribe(()=>this._syncDescribedByIds()),this._valueChanges?.unsubscribe(),t.ngControl&&t.ngControl.valueChanges&&!ye(t.ngField)&&(this._valueChanges=t.ngControl.valueChanges.pipe($l(this._destroyed)).subscribe(()=>this._changeDetectorRef.markForCheck()))}_checkPrefixAndSuffixTypes(){this._hasIconPrefix=!!this._prefixChildren.find(e=>!e._isText),this._hasTextPrefix=!!this._prefixChildren.find(e=>e._isText),this._hasIconSuffix=!!this._suffixChildren.find(e=>!e._isText),this._hasTextSuffix=!!this._suffixChildren.find(e=>e._isText)}_initializePrefixAndSuffix(){this._checkPrefixAndSuffixTypes(),Ty(this._prefixChildren.changes,this._suffixChildren.changes).subscribe(()=>{this._checkPrefixAndSuffixTypes(),this._changeDetectorRef.markForCheck()})}_initializeSubscript(){this._hintChildren.changes.subscribe(()=>{this._processHints(),this._changeDetectorRef.markForCheck()}),this._errorChildren.changes.subscribe(()=>{this._syncDescribedByIds(),this._changeDetectorRef.markForCheck()}),this._validateHints(),this._syncDescribedByIds()}_assertFormFieldControl(){this._control}_updateFocusState(){let e=this._unwrapMaybeSignal(this._control.focused);e&&!this._isFocused?(this._isFocused=!0,this._lineRipple?.activate()):!e&&(this._isFocused||this._isFocused===null)&&(this._isFocused=!1,this._lineRipple?.deactivate()),this._elementRef.nativeElement.classList.toggle(`mat-focused`,e),this._textField?.nativeElement.classList.toggle(`mdc-text-field--focused`,e)}_syncOutlineLabelOffset(){xj({earlyRead:()=>{if(this._appearanceSignal()!==`outline`)return this._outlineLabelOffsetResizeObserver?.disconnect(),null;if(globalThis.ResizeObserver){this._outlineLabelOffsetResizeObserver||=new globalThis.ResizeObserver(()=>{this._writeOutlinedLabelStyles(this._getOutlinedLabelOffset())});for(let e of this._prefixSuffixContainers())this._outlineLabelOffsetResizeObserver.observe(e,{box:`border-box`})}return this._getOutlinedLabelOffset()},write:e=>this._writeOutlinedLabelStyles(e())})}_shouldAlwaysFloat(){return this.floatLabel===`always`}_hasOutline(){return this.appearance===`outline`}_forceDisplayInfixLabel(){return!this._platform.isBrowser&&this._prefixChildren.length&&!this._shouldLabelFloat()}_hasFloatingLabel=Ku(()=>!!this._labelChild());_shouldLabelFloat(){return this._hasFloatingLabel()?this._shouldAlwaysFloat()||this._unwrapMaybeSignal(this._control.shouldLabelFloat):!1}_shouldForward(e){let t=this._control?.ngField||this._control?.ngControl;if(!t)return!1;if(ye(t)){let i=t();return e===`valid`?i.valid():e===`dirty`?i.dirty():e===`touched`?i.touched():e===`pending`?i.pending():e===`untouched`?!i.touched():e===`pristine`?!i.dirty():e===`invalid`?!i.valid():!1}else{let i=t;return e===`valid`?i.valid:e===`dirty`?i.dirty:e===`touched`?i.touched:e===`pending`?i.pending:e===`untouched`?i.untouched:e===`pristine`?i.pristine:e===`invalid`?i.invalid:!1}}_getSubscriptMessageType(){return this._errorChildren&&this._errorChildren.length>0&&this._unwrapMaybeSignal(this._control.errorState)?`error`:`hint`}_handleLabelResized(){this._refreshOutlineNotchWidth()}_refreshOutlineNotchWidth(){!this._hasOutline()||!this._floatingLabel||!this._shouldLabelFloat()?this._notchedOutline?._setNotchWidth(0):this._notchedOutline?._setNotchWidth(this._floatingLabel.getWidth())}_processHints(){this._validateHints(),this._syncDescribedByIds()}_validateHints(){this._hintChildren}_syncDescribedByIds(){if(this._control){let e=[];if(this._control.userAriaDescribedBy&&typeof this._control.userAriaDescribedBy==`string`&&e.push(...this._control.userAriaDescribedBy.split(` `)),this._getSubscriptMessageType()===`hint`){let s=this._hintChildren?this._hintChildren.find(y=>y.align===`start`):null,b=this._hintChildren?this._hintChildren.find(y=>y.align===`end`):null;s?e.push(s.id):this._hintLabel&&e.push(this._hintLabelId),b&&e.push(b.id)}else this._errorChildren&&e.push(...this._errorChildren.map(s=>s.id));let t=this._control.describedByIds,i;if(t){let s=this._describedByIds||e;i=e.concat(t.filter(b=>b&&!s.includes(b)))}else i=e;this._control.setDescribedByIds(i),this._describedByIds=e}}_getOutlinedLabelOffset(){if(!this._hasOutline()||!this._floatingLabel)return null;if(!this._iconPrefixContainer&&!this._textPrefixContainer)return[``,null];if(!this._isAttachedToDom())return null;let e=this._iconPrefixContainer?.nativeElement,t=this._textPrefixContainer?.nativeElement,i=this._iconSuffixContainer?.nativeElement,s=this._textSuffixContainer?.nativeElement,b=e?.getBoundingClientRect().width??0,y=t?.getBoundingClientRect().width??0,V=i?.getBoundingClientRect().width??0,G=s?.getBoundingClientRect().width??0;return[`var(--mat-mdc-form-field-label-transform, ${zn} translateX(${`calc(${this._currentDirection===`rtl`?`-1`:`1`} * (${`${b+y}px`} + var(--mat-mdc-form-field-label-offset-x, 0px)))`}))`,b+y+V+G]}_writeOutlinedLabelStyles(e){if(e!==null){let[t,i]=e;this._floatingLabel&&(this._floatingLabel.element.style.transform=t),i!==null&&this._notchedOutline?._setMaxWidth(i)}}_isAttachedToDom(){let e=this._elementRef.nativeElement;if(e.getRootNode){let t=e.getRootNode();return t&&t!==e}return document.documentElement.contains(e)}static ɵfac=function(t){return new(t||n)};static ɵcmp=(function(){let e=[`iconPrefixContainer`],t=[`textPrefixContainer`],i=[`iconSuffixContainer`],s=[`textSuffixContainer`],b=[`textField`],y=[`*`,[[`mat-label`]],[[``,`matPrefix`,``],[``,`matIconPrefix`,``]],[[``,`matTextPrefix`,``]],[[``,`matTextSuffix`,``]],[[``,`matSuffix`,``],[``,`matIconSuffix`,``]],[[`mat-error`],[``,`matError`,``]],[[`mat-hint`,3,`align`,`end`]],[[`mat-hint`,`align`,`end`]]],V=[`*`,`mat-label`,`[matPrefix], [matIconPrefix]`,`[matTextPrefix]`,`[matTextSuffix]`,`[matSuffix], [matIconSuffix]`,`mat-error, [matError]`,`mat-hint:not([align='end'])`,`mat-hint[align='end']`];function G(p,x){p&1&&Xh(0,`span`,21)}function Ye(p,x){if(p&1&&(cs(0,`label`,20),QE(1,1),xE(2,G,1,0,`span`,21),Vu()),p&2){let o=ZE(2);Jh(`floating`,o._shouldLabelFloat())(`monitorResize`,o._hasOutline())(`id`,o._labelId),Qh(`for`,o._control.disableAutomaticLabeling?null:o._control.id),sb(2),RE(!o.hideRequiredMarker&&o._unwrapMaybeSignal(o._control.required)?2:-1)}}function Ze(p,x){if(p&1&&xE(0,Ye,3,5,`label`,20),p&2){let o=ZE();RE(o._hasFloatingLabel()?0:-1)}}function xt(p,x){p&1&&Xh(0,`div`,7)}function Qe(p,x){}function Xe(p,x){if(p&1&&Hh(0,Qe,0,0,`ng-template`,13),p&2){ZE(2);let o=nI(1);Jh(`ngTemplateOutlet`,o)}}function Je(p,x){if(p&1&&(cs(0,`div`,9),xE(1,Xe,1,1,null,13),Vu()),p&2){let o=ZE();Jh(`matFormFieldNotchedOutlineOpen`,o._shouldLabelFloat()),sb(),RE(o._forceDisplayInfixLabel()?-1:1)}}function yn(p,x){p&1&&(cs(0,`div`,10,2),QE(2,2),Vu())}function Sn(p,x){p&1&&(cs(0,`div`,11,3),QE(2,3),Vu())}function wn(p,x){}function Cn(p,x){if(p&1&&Hh(0,wn,0,0,`ng-template`,13),p&2){ZE();let o=nI(1);Jh(`ngTemplateOutlet`,o)}}function Mn(p,x){p&1&&(cs(0,`div`,14,4),QE(2,4),Vu())}function Nn(p,x){p&1&&(cs(0,`div`,15,5),QE(2,5),Vu())}function Fn(p,x){p&1&&Xh(0,`div`,16)}function Dn(p,x){p&1&&(cs(0,`div`,18),QE(1,6),Vu())}function En(p,x){if(p&1&&(cs(0,`mat-hint`,22),CI(1),Vu()),p&2){let o=ZE(2);Jh(`id`,o._hintLabelId),sb(),wg(o.hintLabel)}}function Tn(p,x){if(p&1&&(cs(0,`div`,19),xE(1,En,2,2,`mat-hint`,22),QE(2,7),Xh(3,`div`,23),QE(4,8),Vu()),p&2){let o=ZE();sb(),RE(o.hintLabel?1:-1)}}return Lw({type:n,selectors:[[`mat-form-field`]],contentQueries:function(x,o,v){if(x&1&&(lg(v,o._labelChild,X,5),cg(v,ht,5)(v,Rn,5)(v,Pn,5)(v,In,5)(v,J,5)),x&2){tI();let N;XE(N=eI())&&(o._formFieldControl=N.first),XE(N=eI())&&(o._prefixChildren=N),XE(N=eI())&&(o._suffixChildren=N),XE(N=eI())&&(o._errorChildren=N),XE(N=eI())&&(o._hintChildren=N)}},viewQuery:function(x,o){if(x&1&&(dg(o._iconPrefixContainerSignal,e,5)(o._textPrefixContainerSignal,t,5)(o._iconSuffixContainerSignal,i,5)(o._textSuffixContainerSignal,s,5),ug(b,5)(e,5)(t,5)(i,5)(s,5)(dn,5)(mn,5)(cn,5)),x&2){tI(4);let v;XE(v=eI())&&(o._textField=v.first),XE(v=eI())&&(o._iconPrefixContainer=v.first),XE(v=eI())&&(o._textPrefixContainer=v.first),XE(v=eI())&&(o._iconSuffixContainer=v.first),XE(v=eI())&&(o._textSuffixContainer=v.first),XE(v=eI())&&(o._floatingLabel=v.first),XE(v=eI())&&(o._notchedOutline=v.first),XE(v=eI())&&(o._lineRipple=v.first)}},hostAttrs:[1,`mat-mdc-form-field`],hostVars:38,hostBindings:function(x,o){x&2&&gg(`mat-mdc-form-field-label-always-float`,o._shouldAlwaysFloat())(`mat-mdc-form-field-has-icon-prefix`,o._hasIconPrefix)(`mat-mdc-form-field-has-icon-suffix`,o._hasIconSuffix)(`mat-form-field-invalid`,o._unwrapMaybeSignal(o._control.errorState))(`mat-form-field-disabled`,o._unwrapMaybeSignal(o._control.disabled))(`mat-form-field-autofilled`,o._unwrapMaybeSignal(o._control.autofilled))(`mat-form-field-appearance-fill`,o.appearance==`fill`)(`mat-form-field-appearance-outline`,o.appearance==`outline`)(`mat-form-field-hide-placeholder`,o._hasFloatingLabel()&&!o._shouldLabelFloat())(`mat-primary`,o.color!==`accent`&&o.color!==`warn`)(`mat-accent`,o.color===`accent`)(`mat-warn`,o.color===`warn`)(`ng-untouched`,o._shouldForward(`untouched`))(`ng-touched`,o._shouldForward(`touched`))(`ng-pristine`,o._shouldForward(`pristine`))(`ng-dirty`,o._shouldForward(`dirty`))(`ng-valid`,o._shouldForward(`valid`))(`ng-invalid`,o._shouldForward(`invalid`))(`ng-pending`,o._shouldForward(`pending`))},inputs:{hideRequiredMarker:`hideRequiredMarker`,color:`color`,floatLabel:`floatLabel`,appearance:`appearance`,subscriptSizing:`subscriptSizing`,hintLabel:`hintLabel`},exportAs:[`matFormField`],features:[OI([{provide:gt,useExisting:n},{provide:pn,useExisting:n}])],ngContentSelectors:V,decls:18,vars:21,consts:[[`labelTemplate`,``],[`textField`,``],[`iconPrefixContainer`,``],[`textPrefixContainer`,``],[`textSuffixContainer`,``],[`iconSuffixContainer`,``],[1,`mat-mdc-text-field-wrapper`,`mdc-text-field`,3,`click`],[1,`mat-mdc-form-field-focus-overlay`],[1,`mat-mdc-form-field-flex`],[`matFormFieldNotchedOutline`,``,3,`matFormFieldNotchedOutlineOpen`],[1,`mat-mdc-form-field-icon-prefix`],[1,`mat-mdc-form-field-text-prefix`],[1,`mat-mdc-form-field-infix`],[3,`ngTemplateOutlet`],[1,`mat-mdc-form-field-text-suffix`],[1,`mat-mdc-form-field-icon-suffix`],[`matFormFieldLineRipple`,``],[`aria-atomic`,`true`,`aria-live`,`polite`,1,`mat-mdc-form-field-subscript-wrapper`,`mat-mdc-form-field-bottom-align`],[1,`mat-mdc-form-field-error-wrapper`],[1,`mat-mdc-form-field-hint-wrapper`],[`matFormFieldFloatingLabel`,``,3,`floating`,`monitorResize`,`id`],[`aria-hidden`,`true`,1,`mat-mdc-form-field-required-marker`,`mdc-floating-label--required`],[3,`id`],[1,`mat-mdc-form-field-hint-spacer`]],template:function(x,o){if(x&1&&(YE(y),Hh(0,Ze,1,1,`ng-template`,null,0,GI),cs(2,`div`,6,1),ig(`click`,function(N){return o._control.onContainerClick(N)}),xE(4,xt,1,0,`div`,7),cs(5,`div`,8),xE(6,Je,2,2,`div`,9),xE(7,yn,3,0,`div`,10),xE(8,Sn,3,0,`div`,11),cs(9,`div`,12),xE(10,Cn,1,1,null,13),QE(11),Vu(),xE(12,Mn,3,0,`div`,14),xE(13,Nn,3,0,`div`,15),Vu(),xE(14,Fn,1,0,`div`,16),Vu(),cs(15,`div`,17),xE(16,Dn,2,0,`div`,18)(17,Tn,5,1,`div`,19),Vu()),x&2){let v,N=o._unwrapMaybeSignal(o._control.disabled);sb(2),gg(`mdc-text-field--filled`,!o._hasOutline())(`mdc-text-field--outlined`,o._hasOutline())(`mdc-text-field--no-label`,!o._hasFloatingLabel())(`mdc-text-field--disabled`,N)(`mdc-text-field--invalid`,o._unwrapMaybeSignal(o._control.errorState)),sb(2),RE(!o._hasOutline()&&!N?4:-1),sb(2),RE(o._hasOutline()?6:-1),sb(),RE(o._hasIconPrefix?7:-1),sb(),RE(o._hasTextPrefix?8:-1),sb(2),RE(!o._hasOutline()||o._forceDisplayInfixLabel()?10:-1),sb(2),RE(o._hasTextSuffix?12:-1),sb(),RE(o._hasIconSuffix?13:-1),sb(),RE(o._hasOutline()?-1:14),sb(),gg(`mat-mdc-form-field-subscript-dynamic-size`,o.subscriptSizing===`dynamic`);let kn=o._getSubscriptMessageType();sb(),RE((v=kn)===`error`?16:v===`hint`?17:-1)}},dependencies:[dn,mn,fT,cn,J],styles:[`.mdc-text-field {
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
`],encapsulation:2})})()}return n})();var ee=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵmod=Fu({type:n});static ɵinj=vi$1({imports:[gr,ue,yn]})}return n})();var Vn=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵcmp=Lw({type:n,selectors:[[`ng-component`]],hostAttrs:[`cdk-text-field-style-loader`,``],decls:0,vars:0,template:function(t,i){},styles:[`textarea.cdk-textarea-autosize {
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
`],encapsulation:2})}return n})();var Hn={passive:!0};var gn=(()=>{class n{_platform=g(he);_ngZone=g(Ce);_renderer=g(oo).createRenderer(null,null);_styleLoader=g(dn$1);_monitoredElements=new Map;monitor(e){if(!this._platform.isBrowser)return Je;this._styleLoader.load(Vn);let t=Fe(e),i=this._monitoredElements.get(t);if(i)return i.subject;let s=new ne,b=`cdk-text-field-autofilled`,y=G=>{G.animationName===`cdk-text-field-autofill-start`&&!t.classList.contains(b)?(t.classList.add(b),this._ngZone.run(()=>s.next({target:G.target,isAutofilled:!0}))):G.animationName===`cdk-text-field-autofill-end`&&t.classList.contains(b)&&(t.classList.remove(b),this._ngZone.run(()=>s.next({target:G.target,isAutofilled:!1})))},V=this._ngZone.runOutsideAngular(()=>(t.classList.add(`cdk-text-field-autofill-monitored`),this._renderer.listen(t,`animationstart`,y,Hn)));return this._monitoredElements.set(t,{subject:s,unlisten:V}),s}stopMonitoring(e){let t=Fe(e),i=this._monitoredElements.get(t);i&&(i.unlisten(),i.subject.complete(),t.classList.remove(`cdk-text-field-autofill-monitored`),t.classList.remove(`cdk-text-field-autofilled`),this._monitoredElements.delete(t))}ngOnDestroy(){this._monitoredElements.forEach((e,t)=>this.stopMonitoring(t))}static ɵfac=function(t){return new(t||n)};static ɵprov=Rt({token:n,factory:n.ɵfac})}return n})();var bn=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵmod=Fu({type:n});static ɵinj=vi$1({})}return n})();var xn=new C(`MAT_INPUT_VALUE_ACCESSOR`);var vn=(()=>{class n{isErrorState(e,t){return!!(e&&e.invalid&&(e.touched||t&&t.submitted))}isSignalErrorState(e){if(!e)return!1;let t=e().invalid(),i=e().touched();return t&&i}static ɵfac=function(t){return new(t||n)};static ɵprov=Rt({token:n,factory:n.ɵfac})}return n})();var We=class{_defaultMatcher;_parentFormGroup;_parentForm;_stateChanges;errorState=!1;matcher;ngControl;formField;constructor(a,e,t,i,s){this._defaultMatcher=a,this._parentFormGroup=t,this._parentForm=i,this._stateChanges=s,e?Zr(e.field)&&!e.updateValueAndValidity?(this.formField=e,this.ngControl=null):(this.formField=null,this.ngControl=e):this.ngControl=this.formField=null}updateErrorState(){let a=this.errorState,e=this._getCurrentErrorState(this.matcher||this._defaultMatcher);e!==a&&(this.errorState=e,this._stateChanges.next())}_getCurrentErrorState(a){if(this.formField&&a?.isSignalErrorState)return a.isSignalErrorState(this.formField.field())??!1;let e=this._parentFormGroup||this._parentForm,t=this.ngControl?this.ngControl.control:null;return a?.isErrorState(t,e)??!1}};var Bn=[`button`,`checkbox`,`file`,`hidden`,`image`,`radio`,`range`,`reset`,`submit`];var jn=new C(`MAT_INPUT_CONFIG`);var Ue=(()=>{class n{_elementRef=g(mn$1);_platform=g(he);ngControl=g(St,{optional:!0,self:!0});_autofillMonitor=g(gn);_ngZone=g(Ce);_formField=g(gt,{optional:!0});_renderer=g(io);_uid=g(je).getId(`mat-input-`);_previousNativeValue;_inputValueAccessor;_signalBasedValueAccessor;_previousPlaceholder=null;_errorStateTracker;_config=g(jn,{optional:!0});_cleanupIosKeyup;_cleanupWebkitWheel;_isServer=!1;_isNativeSelect=!1;_isTextarea=!1;_isInFormField=!1;focused=!1;stateChanges=new ne;controlType=`mat-input`;autofilled=!1;get disabled(){return this._disabled}set disabled(e){this._disabled=Zr$1(e),this.focused&&(this.focused=!1,this.stateChanges.next())}_disabled=!1;get id(){return this._id}set id(e){this._id=e||this._uid}_id;placeholder;name;get required(){return this._required??this.ngControl?.control?.hasValidator(rn$1.required)??!1}set required(e){this._required=Zr$1(e)}_required;get type(){return this._type}set type(e){this._type=e||`text`,this._validateType(),!this._isTextarea&&Vr().has(this._type)&&(this._elementRef.nativeElement.type=this._type)}_type=`text`;get errorStateMatcher(){return this._errorStateTracker.matcher}set errorStateMatcher(e){this._errorStateTracker.matcher=e}userAriaDescribedBy;get value(){return this._signalBasedValueAccessor?this._signalBasedValueAccessor.value():this._inputValueAccessor.value}set value(e){e!==this.value&&(this._signalBasedValueAccessor?this._signalBasedValueAccessor.value.set(e):this._inputValueAccessor.value=e,this.stateChanges.next())}get readonly(){return this._readonly}set readonly(e){this._readonly=Zr$1(e)}_readonly=!1;disabledInteractive;get errorState(){return this._errorStateTracker.errorState}set errorState(e){this._errorStateTracker.errorState=e}_neverEmptyInputTypes=[`date`,`datetime`,`datetime-local`,`month`,`time`,`week`].filter(e=>Vr().has(e));constructor(){let e=g(Ni,{optional:!0}),t=g(Mi,{optional:!0}),i=g(vn),s=g(xn,{optional:!0,self:!0}),b=g(on,{optional:!0,self:!0}),y=this._elementRef.nativeElement,V=y.nodeName.toLowerCase();s?Zr(s.value)?this._signalBasedValueAccessor=s:this._inputValueAccessor=s:this._inputValueAccessor=y,this._previousNativeValue=this.value,this.id=this.id,this._platform.IOS&&this._ngZone.runOutsideAngular(()=>{this._cleanupIosKeyup=this._renderer.listen(y,`keyup`,this._iOSKeyupListener)}),this._errorStateTracker=new We(i,b||this.ngControl,t,e,this.stateChanges),this._isServer=!this._platform.isBrowser,this._isNativeSelect=V===`select`,this._isTextarea=V===`textarea`,this._isInFormField=!!this._formField,this.disabledInteractive=this._config?.disabledInteractive||!1,this._isNativeSelect&&(this.controlType=y.multiple?`mat-native-select-multiple`:`mat-native-select`),this._signalBasedValueAccessor&&Hi(()=>{this._signalBasedValueAccessor.value(),this.stateChanges.next()})}ngAfterViewInit(){this._platform.isBrowser&&this._autofillMonitor.monitor(this._elementRef.nativeElement).subscribe(e=>{this.autofilled=e.isAutofilled,this.stateChanges.next()})}ngOnChanges(){this.stateChanges.next()}ngOnDestroy(){this.stateChanges.complete(),this._platform.isBrowser&&this._autofillMonitor.stopMonitoring(this._elementRef.nativeElement),this._cleanupIosKeyup?.(),this._cleanupWebkitWheel?.()}ngDoCheck(){this.ngControl&&(this.updateErrorState(),this.ngControl.disabled!==null&&this.ngControl.disabled!==this.disabled&&(this.disabled=this.ngControl.disabled,this.stateChanges.next())),this._dirtyCheckNativeValue(),this._dirtyCheckPlaceholder()}focus(e){this._elementRef.nativeElement.focus(e)}updateErrorState(){this._errorStateTracker.updateErrorState()}_focusChanged(e){if(e!==this.focused){if(!this._isNativeSelect&&e&&this.disabled&&this.disabledInteractive){let t=this._elementRef.nativeElement;t.type===`number`?(t.type=`text`,t.setSelectionRange(0,0),t.type=`number`):t.setSelectionRange(0,0)}this.focused=e,this.stateChanges.next()}}_onInput(){}_dirtyCheckNativeValue(){let e=this._elementRef.nativeElement.value;this._previousNativeValue!==e&&(this._previousNativeValue=e,this.stateChanges.next())}_dirtyCheckPlaceholder(){let e=this._getPlaceholder();if(e!==this._previousPlaceholder){let t=this._elementRef.nativeElement;this._previousPlaceholder=e,e?t.setAttribute(`placeholder`,e):t.removeAttribute(`placeholder`)}}_getPlaceholder(){return this.placeholder||null}_validateType(){Bn.indexOf(this._type)}_isNeverEmpty(){return this._neverEmptyInputTypes.indexOf(this._type)>-1}_isBadInput(){let e=this._elementRef.nativeElement.validity;return e&&e.badInput}get empty(){return!this._isNeverEmpty()&&!this._elementRef.nativeElement.value&&!this._isBadInput()&&!this.autofilled}get shouldLabelFloat(){if(this._isNativeSelect){let e=this._elementRef.nativeElement,t=e.options[0];return this.focused||e.multiple||!this.empty||!!(e.selectedIndex>-1&&t&&t.label)}else return this.focused&&!this.disabled||!this.empty}get describedByIds(){return this._elementRef.nativeElement.getAttribute(`aria-describedby`)?.split(` `)||[]}setDescribedByIds(e){let t=this._elementRef.nativeElement;e.length?t.setAttribute(`aria-describedby`,e.join(` `)):t.removeAttribute(`aria-describedby`)}onContainerClick(){this.focused||this.focus()}_isInlineSelect(){let e=this._elementRef.nativeElement;return this._isNativeSelect&&(e.multiple||e.size>1)}_iOSKeyupListener=e=>{let t=e.target;!t.value&&t.selectionStart===0&&t.selectionEnd===0&&(t.setSelectionRange(1,1),t.setSelectionRange(0,0))};_getReadonlyAttribute(){return this._isNativeSelect?null:this.readonly||this.disabled&&this.disabledInteractive?`true`:null}static ɵfac=function(t){return new(t||n)};static ɵdir=Lu({type:n,selectors:[[`input`,`matInput`,``],[`textarea`,`matInput`,``],[`select`,`matNativeControl`,``],[`input`,`matNativeControl`,``],[`textarea`,`matNativeControl`,``]],hostAttrs:[1,`mat-mdc-input-element`],hostVars:21,hostBindings:function(t,i){t&1&&ig(`focus`,function(){return i._focusChanged(!0)})(`blur`,function(){return i._focusChanged(!1)})(`input`,function(){return i._onInput()}),t&2&&(rg(`id`,i.id)(`disabled`,i.disabled&&!i.disabledInteractive)(`required`,i.required),Qh(`name`,i.name||null)(`readonly`,i._getReadonlyAttribute())(`aria-disabled`,i.disabled&&i.disabledInteractive?`true`:null)(`aria-invalid`,i.empty&&i.required?null:i.errorState)(`aria-required`,i.required)(`id`,i.id),gg(`mat-input-server`,i._isServer)(`mat-mdc-form-field-textarea-control`,i._isInFormField&&i._isTextarea)(`mat-mdc-form-field-input-control`,i._isInFormField)(`mat-mdc-input-disabled-interactive`,i.disabledInteractive)(`mdc-text-field__input`,i._isInFormField)(`mat-mdc-native-select-inline`,i._isInlineSelect()))},inputs:{disabled:`disabled`,id:`id`,placeholder:`placeholder`,name:`name`,required:`required`,type:`type`,errorStateMatcher:`errorStateMatcher`,userAriaDescribedBy:[0,`aria-describedby`,`userAriaDescribedBy`],value:`value`,readonly:`readonly`,disabledInteractive:[2,`disabledInteractive`,`disabledInteractive`,hC]},exportAs:[`matInput`],features:[OI([{provide:ht,useExisting:n}]),nu]})}return n})();var Ge=(()=>{class n{static ɵfac=function(t){return new(t||n)};static ɵmod=Fu({type:n});static ɵinj=vi$1({imports:[ee,ee,bn,yn]})}return n})();var Un=n=>({count:n});function Gn(n,a){if(n&1&&(cs(0,`p`,2),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`passwordDialog.backupHint`))}}function $n(n,a){if(n&1&&(cs(0,`p`,2),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`passwordDialog.chooseHint`))}}function Yn(n,a){if(n&1&&(cs(0,`mat-hint`),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`passwordDialog.minLength`,FI(1,Un,e.minLength)))}}function Zn(n,a){if(n&1&&(cs(0,`mat-hint`,9),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`passwordDialog.mismatch`))}}function Qn(n,a){if(n&1){let e=$E();cs(0,`mat-form-field`)(1,`mat-label`),CI(2),Vu(),cs(3,`input`,8),Kb(),Tg(`ngModelChange`,function(i){kd(e);let s=ZE();return _I(s.repeated,i)||(s.repeated=i),Rd(i)}),Vu(),xE(4,Zn,2,1,`mat-hint`,9),Vu()}if(n&2){let e=ZE();sb(2),wg(e.i18n.t(`passwordDialog.repeat`)),sb(),Cg(`ngModel`,e.repeated),Qb(),sb(),RE(e.mismatch()?4:-1)}}function Xn(n,a){if(n&1){let e=$E();cs(0,`mat-checkbox`,10),Kb(),Tg(`ngModelChange`,function(i){kd(e);let s=ZE();return _I(s.keepHistory,i)||(s.keepHistory=i),Rd(i)}),CI(1),Vu()}if(n&2){let e=ZE();Cg(`ngModel`,e.keepHistory),Qb(),sb(),qu(` `,e.i18n.t(`passwordDialog.keepHistory`),` `)}}var $e=class n{data=g(Ui);i18n=g(Hm);dialog=g(Kt);minLength=8;password=ge(``);repeated=ge(``);keepHistory=ge(!1);tooShort=Ku(()=>!this.data.passwordSet&&this.password().length<8);mismatch=Ku(()=>!this.data.passwordSet&&this.repeated()!==``&&this.repeated()!==this.password());canConfirm=Ku(()=>this.data.passwordSet?this.password()!==``:!this.tooShort()&&this.repeated()===this.password());question=Ku(()=>{let a=this.data.deviceName;switch(this.data.action){case`add`:return this.i18n.t(`passwordDialog.add`,{device:a});case`remove`:return this.i18n.t(`passwordDialog.remove`,{device:a});case`kind`:return this.i18n.t(`passwordDialog.kind`,{device:a,kind:lV(this.data.kind??`server`,this.i18n)});case`pairing`:return this.i18n.t(`passwordDialog.pairing`,{device:a});case`backup`:return this.i18n.t(`passwordDialog.backup`);case`statusPassword`:return this.i18n.t(`passwordDialog.statusPassword`)}});confirmLabel=Ku(()=>{switch(this.data.action){case`add`:return this.i18n.t(`passwordDialog.confirmAdd`);case`remove`:return this.i18n.t(`passwordDialog.confirmRemove`);case`kind`:case`pairing`:return this.i18n.t(`passwordDialog.confirmKind`);case`backup`:return this.i18n.t(`passwordDialog.confirmBackup`);case`statusPassword`:return this.i18n.t(`passwordDialog.confirmStatus`)}});confirm(){this.canConfirm()&&this.dialog.close({password:this.password(),keepHistory:this.keepHistory()})}static ɵfac=function(e){return new(e||n)};static ɵcmp=Lw({type:n,selectors:[[`app-password-dialog`]],decls:20,vars:13,consts:[[`mat-dialog-title`,``],[3,`ngSubmit`],[1,`hint`],[`matInput`,``,`type`,`password`,`name`,`password`,`cdkFocusInitial`,``,3,`ngModelChange`,`autocomplete`,`ngModel`],[`name`,`keepHistory`,3,`ngModel`],[`align`,`end`],[`mat-button`,``,`type`,`button`,`mat-dialog-close`,``],[`mat-flat-button`,``,`type`,`submit`,3,`disabled`],[`matInput`,``,`type`,`password`,`name`,`repeated`,`autocomplete`,`new-password`,3,`ngModelChange`,`ngModel`],[1,`error`],[`name`,`keepHistory`,3,`ngModelChange`,`ngModel`]],template:function(e,t){e&1&&(cs(0,`h2`,0),CI(1),Vu(),cs(2,`form`,1),ig(`ngSubmit`,function(){return t.confirm()}),cs(3,`mat-dialog-content`)(4,`p`),CI(5),Vu(),xE(6,Gn,2,1,`p`,2),xE(7,$n,2,1,`p`,2),cs(8,`mat-form-field`)(9,`mat-label`),CI(10),Vu(),cs(11,`input`,3),Kb(),Tg(`ngModelChange`,function(s){return _I(t.password,s)||(t.password=s),s}),Vu(),xE(12,Yn,2,3,`mat-hint`),Vu(),xE(13,Qn,5,3,`mat-form-field`),xE(14,Xn,2,2,`mat-checkbox`,4),Vu(),cs(15,`mat-dialog-actions`,5)(16,`button`,6),CI(17),Vu(),cs(18,`button`,7),CI(19),Vu()()()),e&2&&(sb(),qu(` `,t.i18n.t(t.data.passwordSet?`passwordDialog.enterTitle`:`passwordDialog.chooseTitle`),`
`),sb(4),wg(t.question()),sb(),RE(t.data.action===`backup`?6:-1),sb(),RE(t.data.passwordSet?-1:7),sb(3),wg(t.i18n.t(`passwordDialog.password`)),sb(),Jh(`autocomplete`,t.data.passwordSet?`current-password`:`new-password`),Cg(`ngModel`,t.password),Qb(),sb(),RE(t.data.passwordSet?-1:12),sb(),RE(t.data.passwordSet?-1:13),sb(),RE(t.data.action===`remove`?14:-1),sb(3),wg(t.i18n.t(`passwordDialog.cancel`)),sb(),Jh(`disabled`,!t.canConfirm()),sb(),qu(` `,t.confirmLabel(),` `))},dependencies:[rc,ic,Ra,nc,ac,Ii,Ni,Vs,Ps,wc,Fi,bd,ud,pd,hd,ee,ue,X,J,Ge,Ue],styles:[`mat-dialog-content[_ngcontent-%COMP%]{display:flex;flex-direction:column;gap:.5rem;max-width:26rem}p[_ngcontent-%COMP%]{margin:0 0 .5rem}`]})};var Jn=n=>({device:n});var ei=n=>({port:n});var ti=n=>({count:n});var ni=(n,a)=>a.id;function ii(n,a){if(n&1){let e=$E();cs(0,`h3`)(1,`button`,15),ig(`click`,function(){kd(e);let i=ZE();return Rd(i.toggleList())}),Xh(2,`span`,16),CI(3),cs(4,`span`,17),CI(5),Vu()()()}if(n&2){let e=ZE();sb(),Qh(`aria-expanded`,e.listOpen()),sb(2),qu(``,e.i18n.t(`devicesDialog.listTitle`),` `),sb(2),wg(e.others().length)}}function ri(n,a){if(n&1&&(cs(0,`span`,20),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`devicesDialog.router`))}}function ai(n,a){if(n&1&&(cs(0,`span`,20),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.kindName(`phone`,e.i18n))}}function oi(n,a){if(n&1){let e=$E();cs(0,`button`,25),ig(`click`,function(){let i=kd(e).$implicit,s=ZE(2).$implicit,b=ZE();return Rd(b.setKind(s,i))}),CI(1),Vu()}if(n&2){let e=a.$implicit,t=ZE(2).$implicit,i=ZE();Jh(`disabled`,i.busy()),Qh(`aria-pressed`,t.kind===e),sb(),qu(` `,i.kindName(e,i.i18n),` `)}}function li(n,a){if(n&1&&(cs(0,`span`,8),FE(1,oi,2,3,`button`,24,PE),Vu()),n&2){let e=ZE().$implicit,t=ZE();Qh(`aria-label`,t.i18n.t(`devicesDialog.kindOf`,FI(1,Jn,e.name))),sb(),LE(t.kinds)}}function di(n,a){if(n&1){let e=$E();cs(0,`button`,26),ig(`click`,function(){kd(e);let i=ZE().$implicit,s=ZE();return Rd(s.remove(i))}),CI(1),Vu()}if(n&2){let e=ZE(2);Jh(`disabled`,e.busy()),sb(),qu(` `,e.i18n.t(`devicesDialog.remove`),` `)}}function si(n,a){if(n&1&&(cs(0,`span`,22),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`devicesDialog.fixed`))}}function ci(n,a){if(n&1){let e=$E();cs(0,`form`,27),ig(`ngSubmit`,function(){kd(e);let i=ZE().$implicit,s=ZE();return Rd(s.setCode(i))}),cs(1,`p`,1),CI(2),Vu(),cs(3,`mat-form-field`,6)(4,`mat-label`),CI(5),Vu(),cs(6,`input`,28),Kb(),ig(`ngModelChange`,function(i){kd(e);let s=ZE().$implicit,b=ZE();return Rd(b.typeCode(s,i))}),Vu()(),cs(7,`button`,29),CI(8),Vu()()}if(n&2){let e=ZE().$implicit,t=ZE();sb(2),qu(` `,t.i18n.t(e.pairing===`wrong`?`devicesDialog.pairingWrong`:`devicesDialog.pairingNeeded`),` `),sb(3),wg(t.i18n.t(`devicesDialog.code`)),sb(),Jh(`ngModel`,t.codeFor(e)),Qb(),sb(),Jh(`disabled`,t.busy()||!t.codeFor(e).trim()),sb(),qu(` `,t.i18n.t(`devicesDialog.setCode`),` `)}}function mi(n,a){if(n&1&&(cs(0,`li`)(1,`span`,18)(2,`span`,19),CI(3),Vu(),cs(4,`span`,1),CI(5),Vu()(),xE(6,ri,2,1,`span`,20)(7,ai,2,1,`span`,20)(8,li,3,3,`span`,8),xE(9,di,2,2,`button`,21)(10,si,2,1,`span`,22),xE(11,ci,9,5,`form`,23),Vu()),n&2){let e=a.$implicit;sb(3),wg(e.name),sb(2),wg(e.address),sb(),RE(e.router?6:e.kind===`phone`?7:8),sb(3),RE(e.removable?9:10),sb(2),RE(e.pairing?11:-1)}}function fi(n,a){if(n&1&&(cs(0,`li`,1),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`devicesDialog.empty`))}}function ui(n,a){if(n&1&&(cs(0,`p`,1),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`devicesDialog.suggested`))}}function pi(n,a){if(n&1){let e=$E();cs(0,`button`,30),ig(`click`,function(){let i=kd(e).$implicit,s=ZE();return Rd(s.kind.set(i))}),CI(1),Vu()}if(n&2){let e=a.$implicit,t=ZE();Qh(`aria-pressed`,e===t.kind()),sb(),qu(` `,t.kindName(e,t.i18n),` `)}}function hi(n,a){if(n&1&&(cs(0,`h3`),CI(1),Vu(),cs(2,`p`,1),CI(3),Vu(),cs(4,`p`,31),CI(5),Vu()),n&2){let e=ZE();sb(),wg(e.i18n.t(`devicesDialog.ownCodeTitle`)),sb(2),wg(e.i18n.t(`devicesDialog.ownCodeHint`)),sb(2),wg(e.ownCode())}}function gi(n,a){if(n&1&&(cs(0,`p`,1),CI(1),cs(2,`code`,36),CI(3),Vu()()),n&2){let e=ZE(),t=ZE();sb(),qu(` `,t.i18n.t(`devicesDialog.statusFingerprint`),` `),sb(2),wg(e.fingerprint)}}function bi(n,a){if(n&1&&(cs(0,`mat-hint`,35),CI(1),Vu()),n&2){let e=ZE(2);sb(),wg(e.i18n.t(`passwordDialog.mismatch`))}}function xi(n,a){if(n&1){let e=$E();cs(0,`form`,32),ig(`ngSubmit`,function(){kd(e);let i=ZE();return Rd(i.setStatusPassword())}),cs(1,`h3`),CI(2),Vu(),cs(3,`p`,1),CI(4),Vu(),xE(5,gi,4,2,`p`,1),cs(6,`p`,1),CI(7),Vu(),cs(8,`mat-form-field`)(9,`mat-label`),CI(10),Vu(),cs(11,`input`,33),Kb(),Tg(`ngModelChange`,function(i){kd(e);let s=ZE();return _I(s.statusPassword,i)||(s.statusPassword=i),Rd(i)}),Vu(),cs(12,`mat-hint`),CI(13),Vu()(),cs(14,`mat-form-field`)(15,`mat-label`),CI(16),Vu(),cs(17,`input`,34),Kb(),Tg(`ngModelChange`,function(i){kd(e);let s=ZE();return _I(s.statusRepeated,i)||(s.statusRepeated=i),Rd(i)}),Vu(),xE(18,bi,2,1,`mat-hint`,35),Vu(),cs(19,`button`,29),CI(20),Vu()()}if(n&2){let e=a,t=ZE();sb(2),wg(t.i18n.t(`devicesDialog.statusTitle`)),sb(2),wg(t.i18n.t(`devicesDialog.statusHint`,FI(12,ei,e.port??``))),sb(),RE(e.fingerprint?5:-1),sb(2),qu(` `,t.i18n.t(t.statusSaved()?`devicesDialog.statusSaved`:e.passwordSet?`devicesDialog.statusPasswordSet`:`devicesDialog.statusPasswordNone`),` `),sb(3),wg(t.i18n.t(`devicesDialog.statusNew`)),sb(),Cg(`ngModel`,t.statusPassword),Qb(),sb(2),wg(t.i18n.t(`passwordDialog.minLength`,FI(14,ti,t.minLength))),sb(3),wg(t.i18n.t(`passwordDialog.repeat`)),sb(),Cg(`ngModel`,t.statusRepeated),Qb(),sb(),RE(t.statusMismatch()?18:-1),sb(),Jh(`disabled`,t.busy()||!t.canSetStatusPassword()),sb(),qu(` `,t.i18n.t(e.passwordSet?`devicesDialog.statusChange`:`devicesDialog.statusSet`),` `)}}function vi(n,a){if(n&1&&(cs(0,`p`,12),CI(1),Vu()),n&2){let e=ZE();sb(),wg(e.problem())}}var bt=class n{i18n=g(Hm);devices=g(Nm);dialog=g(yo);destroyRef=g(re);host=g(mn$1);document=g(Q);others=Ku(()=>this.devices.devices().slice(1));listOpen=ge(!0);listToggled=ge(!1);name=ge(``);address=ge(``);kind=ge(`server`);code=ge(``);codes=ge({});ownCode=ge(``);kinds=sV;kindName=lV;statusPage=ge(null);statusPassword=ge(``);statusRepeated=ge(``);minLength=8;statusMismatch=Ku(()=>this.statusRepeated()!==``&&this.statusRepeated()!==this.statusPassword());canSetStatusPassword=Ku(()=>this.statusPassword().length>=8&&this.statusRepeated()===this.statusPassword());statusSaved=ge(!1);problem=ge(``);busy=ge(!1);changeStarted=new ne;suggestion=ge(null);suggested=Ku(()=>this.suggestion()?.address===this.address().trim());constructor(){let a=ge(0);wr(window,`resize`).pipe(q()).subscribe(()=>a.update(e=>e+1)),xj(()=>{if(this.others(),this.suggested(),a(),this.listToggled()||!this.listOpen())return;let e=this.host.nativeElement.querySelector(`ul`);if(!e||e.scrollHeight<=e.clientHeight)return;let t=e.querySelector(`li`)?.offsetHeight||_i(5);e.clientHeight<t&&this.listOpen.set(!1)}),this.devices.pairingCode().pipe(Er(()=>ea(``)),q()).subscribe(e=>this.ownCode.set(e)),this.loadStatusPage(),this.devices.suggestion().pipe(Er(()=>ea(null)),q()).subscribe(e=>{!e||this.name()||this.address()||(this.suggestion.set(e),this.name.set(e.name),this.address.set(e.address),this.kind.set(e.kind))})}toggleList(){this.listToggled.set(!0),this.listOpen.update(a=>!a)}add(){let a=this.name().trim(),e=this.address().trim();if(!a||!e)return;let t=this.kind(),i=this.code().trim();this.change({action:`add`,deviceName:a},s=>this.devices.add(a,e,t,i,s.password)).subscribe(()=>{this.name.set(``),this.address.set(``),this.kind.set(`server`),this.code.set(``)})}codeFor(a){return this.codes()[a.id]??``}typeCode(a,e){this.codes.update(t=>K(V({},t),{[a.id]:e}))}setCode(a){let e=this.codeFor(a).trim();e&&this.change({action:`pairing`,deviceName:a.name},t=>this.devices.setCode(a.id,e,t.password)).subscribe(()=>this.typeCode(a,``))}setKind(a,e){a.kind!==e&&this.change({action:`kind`,deviceName:a.name,kind:e},t=>this.devices.setKind(a.id,e,t.password)).subscribe()}remove(a){this.change({action:`remove`,deviceName:a.name},e=>this.devices.remove(a.id,e.password,e.keepHistory)).subscribe()}backup(){this.change({action:`backup`,deviceName:``},a=>this.devices.backup(a.password).pipe(Wo(e=>WB(this.document,e.file,e.name)))).subscribe()}setStatusPassword(){if(!this.canSetStatusPassword())return;let a=this.statusPassword();this.statusSaved.set(!1),this.change({action:`statusPassword`,deviceName:``},e=>this.devices.setStatusPassword(a,e.password)).subscribe(()=>{this.statusPassword.set(``),this.statusRepeated.set(``),this.statusSaved.set(!0),this.loadStatusPage()})}loadStatusPage(){this.devices.statusPage().pipe(Er(()=>ea(null)),q(this.destroyRef)).subscribe(a=>this.statusPage.set(a?.enabled?a:null))}change(a,e){let t=K(V({},a),{passwordSet:this.devices.passwordSet()});return this.dialog.open($e,{data:t}).afterClosed().pipe(Sn(i=>i!==void 0),Wo(()=>{this.changeStarted.next(),this.busy.set(!0),this.problem.set(``)}),Vt(i=>e(i).pipe(Vt(()=>this.devices.load().pipe(q(this.destroyRef),Er(()=>ea(null)))))),Er(i=>(this.problem.set(fV(i,this.i18n)),this.busy.set(!1),this.devices.load().pipe($l(this.changeStarted),q(this.destroyRef),ta(),Er(()=>Je)))),zo(()=>this.busy.set(!1)))}static ɵfac=function(e){return new(e||n)};static ɵcmp=Lw({type:n,selectors:[[`app-devices-dialog`]],decls:49,vars:27,consts:[[`mat-dialog-title`,``],[1,`hint`],[`id`,`devices-dialog-list`,3,`hidden`],[`id`,`devices-dialog-add`,3,`ngSubmit`],[`matInput`,``,`name`,`name`,`maxlength`,`64`,`autocomplete`,`off`,3,`ngModelChange`,`ngModel`],[`matInput`,``,`name`,`address`,`placeholder`,`192.168.1.20:9393`,`autocomplete`,`off`,3,`ngModelChange`,`ngModel`],[`subscriptSizing`,`dynamic`],[`matInput`,``,`name`,`code`,`maxlength`,`32`,`placeholder`,`7KQM-X2RP`,`autocomplete`,`off`,`autocapitalize`,`characters`,`spellcheck`,`false`,3,`ngModelChange`,`ngModel`],[`role`,`group`,1,`choices`,`kind`],[`type`,`button`],[`mat-stroked-button`,``,`type`,`button`,1,`backup`,3,`click`,`disabled`],[1,`status-page`],[`role`,`alert`,1,`error`],[`mat-flat-button`,``,`type`,`submit`,`form`,`devices-dialog-add`,3,`disabled`],[`mat-button`,``,`type`,`button`,`mat-dialog-close`,``],[`type`,`button`,`aria-controls`,`devices-dialog-list`,1,`fold`,3,`click`],[`aria-hidden`,`true`,1,`chevron`],[1,`count`],[1,`who`],[1,`name`],[1,`router`,`hint`],[`mat-button`,``,`type`,`button`,3,`disabled`],[1,`fixed`,`hint`],[1,`pairing`],[`type`,`button`,3,`disabled`],[`type`,`button`,3,`click`,`disabled`],[`mat-button`,``,`type`,`button`,3,`click`,`disabled`],[1,`pairing`,3,`ngSubmit`],[`matInput`,``,`name`,`device-code`,`maxlength`,`32`,`autocomplete`,`off`,`autocapitalize`,`characters`,`spellcheck`,`false`,3,`ngModelChange`,`ngModel`],[`mat-stroked-button`,``,`type`,`submit`,3,`disabled`],[`type`,`button`,3,`click`],[1,`own-code`],[1,`status-page`,3,`ngSubmit`],[`matInput`,``,`type`,`password`,`name`,`status-password`,`autocomplete`,`new-password`,3,`ngModelChange`,`ngModel`],[`matInput`,``,`type`,`password`,`name`,`status-repeated`,`autocomplete`,`new-password`,3,`ngModelChange`,`ngModel`],[1,`error`],[1,`fingerprint`]],template:function(e,t){if(e&1&&(cs(0,`h2`,0),CI(1),Vu(),cs(2,`mat-dialog-content`)(3,`p`,1),CI(4),Vu(),xE(5,ii,6,3,`h3`),cs(6,`ul`,2),FE(7,mi,12,5,`li`,null,ni,!1,fi,2,1,`li`,1),Vu(),cs(10,`form`,3),ig(`ngSubmit`,function(){return t.add()}),cs(11,`h3`),CI(12),Vu(),xE(13,ui,2,1,`p`,1),cs(14,`mat-form-field`)(15,`mat-label`),CI(16),Vu(),cs(17,`input`,4),Kb(),Tg(`ngModelChange`,function(s){return _I(t.name,s)||(t.name=s),s}),Vu()(),cs(18,`mat-form-field`)(19,`mat-label`),CI(20),Vu(),cs(21,`input`,5),Kb(),Tg(`ngModelChange`,function(s){return _I(t.address,s)||(t.address=s),s}),Vu(),cs(22,`mat-hint`),CI(23),Vu()(),cs(24,`mat-form-field`,6)(25,`mat-label`),CI(26),Vu(),cs(27,`input`,7),Kb(),Tg(`ngModelChange`,function(s){return _I(t.code,s)||(t.code=s),s}),Vu(),cs(28,`mat-hint`),CI(29),Vu()(),cs(30,`div`,8),FE(31,pi,2,2,`button`,9,PE),Vu(),cs(33,`p`,1),CI(34),Vu()(),xE(35,hi,6,3),cs(36,`h3`),CI(37),Vu(),cs(38,`p`,1),CI(39),Vu(),cs(40,`button`,10),ig(`click`,function(){return t.backup()}),CI(41),Vu(),xE(42,xi,21,16,`form`,11),xE(43,vi,2,1,`p`,12),Vu(),cs(44,`mat-dialog-actions`)(45,`button`,13),CI(46),Vu(),cs(47,`button`,14),CI(48),Vu()()),e&2){let i;sb(),wg(t.i18n.t(`devicesDialog.title`)),sb(3),wg(t.i18n.t(`devicesDialog.intro`)),sb(),RE(t.others().length?5:-1),sb(),Jh(`hidden`,!t.listOpen()),sb(),LE(t.others()),sb(5),wg(t.i18n.t(`devicesDialog.addTitle`)),sb(),RE(t.suggested()?13:-1),sb(3),wg(t.i18n.t(`devicesDialog.name`)),sb(),Cg(`ngModel`,t.name),Qb(),sb(3),wg(t.i18n.t(`devicesDialog.address`)),sb(),Cg(`ngModel`,t.address),Qb(),sb(2),wg(t.i18n.t(`devicesDialog.addressHint`)),sb(3),wg(t.i18n.t(`devicesDialog.code`)),sb(),Cg(`ngModel`,t.code),Qb(),sb(2),wg(t.i18n.t(`devicesDialog.codeHint`)),sb(),Qh(`aria-label`,t.i18n.t(`devicesDialog.kind`)),sb(),LE(t.kinds),sb(3),wg(t.i18n.t(`devicesDialog.kindHint`)),sb(),RE(t.ownCode()?35:-1),sb(2),wg(t.i18n.t(`devicesDialog.backupTitle`)),sb(2),wg(t.i18n.t(`devicesDialog.backupHint`)),sb(),Jh(`disabled`,t.busy()),sb(),qu(` `,t.i18n.t(`devicesDialog.backup`),` `),sb(),RE((i=t.statusPage())?42:-1,i),sb(),RE(t.problem()?43:-1),sb(2),Jh(`disabled`,t.busy()||!t.name().trim()||!t.address().trim()),sb(),qu(` `,t.i18n.t(`devicesDialog.add`),` `),sb(2),wg(t.i18n.t(`devicesDialog.close`))}},dependencies:[rc,ic,Ra,nc,ac,ui$1,Ii,Ni,Vs,Ps,bd,ud,pd,hd,ee,ue,X,J,Ge,Ue],styles:[`mat-dialog-content[_ngcontent-%COMP%]{display:flex;flex-direction:column;max-width:32rem}mat-dialog-content[_ngcontent-%COMP%] > *[_ngcontent-%COMP%]{flex-shrink:0}p[_ngcontent-%COMP%]{margin:0 0 .75rem}mat-dialog-content[_ngcontent-%COMP%] > ul[_ngcontent-%COMP%]{flex-shrink:1;min-height:2.5rem;margin:0 0 1rem;padding:0;overflow-y:auto;overscroll-behavior:contain;list-style:none}li[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;align-items:center;gap:.25rem .75rem;min-height:2.5rem;padding:.375rem 0;border-bottom:1px solid var(--%NS%mat-sys-outline-variant)}.who[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;gap:0 .75rem;flex-basis:100%}.router[_ngcontent-%COMP%]{font:var(--%NS%mat-sys-label-medium)}.kind[_ngcontent-%COMP%] > button[_ngcontent-%COMP%]{height:1.75rem;font:var(--%NS%mat-sys-label-medium)}form[_ngcontent-%COMP%]   .kind[_ngcontent-%COMP%]{flex-basis:100%;margin:.5rem 0}.name[_ngcontent-%COMP%]{font-weight:500}li[_ngcontent-%COMP%]   button[_ngcontent-%COMP%], .fixed[_ngcontent-%COMP%]{margin-left:auto}h3[_ngcontent-%COMP%]{margin:0 0 .75rem;font:var(--%NS%mat-sys-title-small)}ul[hidden][_ngcontent-%COMP%]{display:none}form[_ngcontent-%COMP%]{display:flex;flex-wrap:wrap;align-items:baseline;gap:0 .75rem}mat-dialog-actions[_ngcontent-%COMP%]{justify-content:space-between}form[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%], form[_ngcontent-%COMP%]   .hint[_ngcontent-%COMP%]{flex-basis:100%}mat-form-field[_ngcontent-%COMP%]{flex:1 1 12rem}.error[_ngcontent-%COMP%]{margin-top:.75rem}.backup[_ngcontent-%COMP%]{align-self:flex-start}form.pairing[_ngcontent-%COMP%]{flex-basis:100%;align-items:center;gap:.25rem .75rem;padding-bottom:.25rem}form.pairing[_ngcontent-%COMP%]   .hint[_ngcontent-%COMP%]{margin:0}form.pairing[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]{margin-left:0}.own-code[_ngcontent-%COMP%]{font:var(--%NS%mat-sys-title-large);font-family:ui-monospace,monospace;letter-spacing:.1em;-webkit-user-select:all;user-select:all}form.status-page[_ngcontent-%COMP%]{margin-top:1.25rem}form.status-page[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]{flex-basis:100%;max-width:max-content}.fingerprint[_ngcontent-%COMP%]{font-family:ui-monospace,monospace;font-size:.85em;overflow-wrap:anywhere;-webkit-user-select:all;user-select:all}`]})};function _i(n){return n*parseFloat(getComputedStyle(document.documentElement).fontSize)}function co(n){n.get(yo).open(bt,{autoFocus:`first-tabbable`,injector:n})}export{bt as DevicesDialog,co as openDevicesDialog};