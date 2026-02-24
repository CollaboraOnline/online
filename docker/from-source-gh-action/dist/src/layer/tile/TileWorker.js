// This comment required to work around preprocessor bugs

!function(f){typeof module!='undefined'&&typeof exports=='object'?module.exports=f():typeof define!='undefined'&&define.amd?define(['fzstd',f]):(typeof self!='undefined'?self:this).fzstd=f()}(function(){var _e={};"use strict";var r=ArrayBuffer,t=Uint8Array,e=Uint16Array,n=Int16Array,a=Uint32Array,s=Int32Array,i=function(r,e,n){if(t.prototype.slice)return t.prototype.slice.call(r,e,n);(null==e||e<0)&&(e=0),(null==n||n>r.length)&&(n=r.length);var a=new t(n-e);return a.set(r.subarray(e,n)),a},o=function(r,e,n,a){if(t.prototype.fill)return t.prototype.fill.call(r,e,n,a);for((null==n||n<0)&&(n=0),(null==a||a>r.length)&&(a=r.length);n<a;++n)r[n]=e;return r},u=function(r,e,n,a){if(t.prototype.copyWithin)return t.prototype.copyWithin.call(r,e,n,a);for((null==n||n<0)&&(n=0),(null==a||a>r.length)&&(a=r.length);n<a;)r[e++]=r[n++]};_e.ZstdErrorCode={InvalidData:0,WindowSizeTooLarge:1,InvalidBlockType:2,FSEAccuracyTooHigh:3,DistanceTooFarBack:4,UnexpectedEOF:5};var f=["invalid zstd data","window size too large (>2046MB)","invalid block type","FSE accuracy too high","match distance too far back","unexpected EOF"],h=function(r,t,e){var n=Error(t||f[r]);if(n.code=r,Error.captureStackTrace&&Error.captureStackTrace(n,h),!e)throw n;return n},l=function(r,t,e){for(var n=0,a=0;n<e;++n)a|=r[t++]<<(n<<3);return a},v=function(r,t){return(r[t]|r[t+1]<<8|r[t+2]<<16|r[t+3]<<24)>>>0},c=function(r,e){var n=r[0]|r[1]<<8|r[2]<<16;if(3126568==n&&253==r[3]){var a=r[4],i=a>>5&1,o=a>>2&1,u=3&a,f=a>>6;8&a&&h(0);var c=6-i,b=3==u?4:u,y=l(r,c,b),p=f?1<<f:i,w=l(r,c+=b,p)+(1==f&&256),g=w;if(!i){var d=1<<10+(r[5]>>3);g=d+(d>>3)*(7&r[5])}g>2145386496&&h(1);var m=new t((1==e?w||g:e?0:g)+12);return m[0]=1,m[4]=4,m[8]=8,{b:c+p,y:0,l:0,d:y,w:e&&1!=e?e:m.subarray(12),e:g,o:new s(m.buffer,0,3),u:w,c:o,m:Math.min(131072,g)}}if(25481893==(n>>4|r[3]<<20))return v(r,4)+8;h(0)},b=function(r){for(var t=0;1<<t<=r;++t);return t-1},y=function(a,s,i){var o=4+(s<<3),u=5+(15&a[s]);u>i&&h(3);for(var f=1<<u,l=f,v=-1,c=-1,y=-1,p=f,w=new r(512+(f<<2)),g=new n(w,0,256),d=new e(w,0,256),m=new e(w,512,f),z=512+(f<<1),E=new t(w,z,f),k=new t(w,z+f);v<255&&l>0;){var A=b(l+1),T=o>>3,x=(1<<A+1)-1,F=(a[T]|a[T+1]<<8|a[T+2]<<16)>>(7&o)&x,S=(1<<A)-1,B=x-l-1,I=F&S;if(I<B?(o+=A,F=I):(o+=A+1,F>S&&(F-=B)),g[++v]=--F,-1==F?(l+=F,E[--p]=v):l-=F,!F)do{var U=o>>3;c=(a[U]|a[U+1]<<8)>>(7&o)&3,o+=2,v+=c}while(3==c)}(v>255||l)&&h(0);for(var D=0,M=(f>>1)+(f>>3)+3,W=f-1,O=0;O<=v;++O){var j=g[O];if(j<1)d[O]=-j;else for(y=0;y<j;++y){E[D]=O;do{D=D+M&W}while(D>=p)}}for(D&&h(0),y=0;y<f;++y){var C=d[E[y]]++,H=k[y]=u-b(C);m[y]=(C<<H)-f}return[o+7>>3,{b:u,s:E,n:k,t:m}]},p=function(r,n){var a=0,s=-1,i=new t(292),u=r[n],f=i.subarray(0,256),l=i.subarray(256,268),v=new e(i.buffer,268);if(u<128){var c=y(r,n+1,6),p=c[1],w=c[0]<<3,g=r[n+=u];g||h(0);for(var d=0,m=0,z=p.b,E=z,k=(++n<<3)-8+b(g);!((k-=z)<w);){var A=k>>3;if(f[++s]=p.s[d+=(r[A]|r[A+1]<<8)>>(7&k)&(1<<z)-1],(k-=E)<w)break;f[++s]=p.s[m+=(r[A=k>>3]|r[A+1]<<8)>>(7&k)&(1<<E)-1],z=p.n[d],d=p.t[d],E=p.n[m],m=p.t[m]}++s>255&&h(0)}else{for(s=u-127;a<s;a+=2){var T=r[++n];f[a]=T>>4,f[a+1]=15&T}++n}var x=0;for(a=0;a<s;++a)(I=f[a])>11&&h(0),x+=I&&1<<I-1;var F=b(x)+1,S=1<<F,B=S-x;for(B&B-1&&h(0),f[s++]=b(B)+1,a=0;a<s;++a){var I;++l[f[a]=(I=f[a])&&F+1-I]}var U=new t(S<<1),D=U.subarray(0,S),M=U.subarray(S);for(v[F]=0,a=F;a>0;--a){var W=v[a];o(M,a,W,v[a-1]=W+l[a]*(1<<F-a))}for(v[0]!=S&&h(0),a=0;a<s;++a){var O=f[a];if(O){var j=v[O];o(D,a,j,v[O]=j+(1<<F-O))}}return[n,{n:M,b:F,s:D}]},w=y(new t([81,16,99,140,49,198,24,99,12,33,196,24,99,102,102,134,70,146,4]),0,6)[1],g=y(new t([33,20,196,24,99,140,33,132,16,66,8,33,132,16,66,8,33,68,68,68,68,68,68,68,68,36,9]),0,6)[1],d=y(new t([32,132,16,66,102,70,68,68,68,68,36,73,2]),0,5)[1],m=function(r,t){for(var e=r.length,n=new s(e),a=0;a<e;++a)n[a]=t,t+=1<<r[a];return n},z=new t(new s([0,0,0,0,16843009,50528770,134678020,202050057,269422093]).buffer,0,36),E=m(z,0),k=new t(new s([0,0,0,0,0,0,0,0,16843009,50528770,117769220,185207048,252579084,16]).buffer,0,53),A=m(k,3),T=function(r,t,e){var n=r.length,a=t.length,s=r[n-1],i=(1<<e.b)-1,o=-e.b;s||h(0);for(var u=0,f=e.b,l=(n<<3)-8+b(s)-f,v=-1;l>o&&v<a;){var c=l>>3;t[++v]=e.s[u=(u<<f|(r[c]|r[c+1]<<8|r[c+2]<<16)>>(7&l))&i],l-=f=e.n[u]}l==o&&v+1==a||h(0)},x=function(r,t,e){var n=6,a=t.length+3>>2,s=a<<1,i=a+s;T(r.subarray(n,n+=r[0]|r[1]<<8),t.subarray(0,a),e),T(r.subarray(n,n+=r[2]|r[3]<<8),t.subarray(a,s),e),T(r.subarray(n,n+=r[4]|r[5]<<8),t.subarray(s,i),e),T(r.subarray(n),t.subarray(i),e)},F=function(r,n,a){var s,u=n.b,f=r[u],l=f>>1&3;n.l=1&f;var v=f>>3|r[u+1]<<5|r[u+2]<<13,c=(u+=3)+v;if(1==l){if(u>=r.length)return;return n.b=u+1,a?(o(a,r[u],n.y,n.y+=v),a):o(new t(v),r[u])}if(!(c>r.length)){if(0==l)return n.b=c,a?(a.set(r.subarray(u,c),n.y),n.y+=v,a):i(r,u,c);if(2==l){var m=r[u],F=3&m,S=m>>2&3,B=m>>4,I=0,U=0;F<2?1&S?B|=r[++u]<<4|(2&S&&r[++u]<<12):B=m>>3:(U=S,S<2?(B|=(63&r[++u])<<4,I=r[u]>>6|r[++u]<<2):2==S?(B|=r[++u]<<4|(3&r[++u])<<12,I=r[u]>>2|r[++u]<<6):(B|=r[++u]<<4|(63&r[++u])<<12,I=r[u]>>6|r[++u]<<2|r[++u]<<10)),++u;var D=a?a.subarray(n.y,n.y+n.m):new t(n.m),M=D.length-B;if(0==F)D.set(r.subarray(u,u+=B),M);else if(1==F)o(D,r[u++],M);else{var W=n.h;if(2==F){var O=p(r,u);I+=u-(u=O[0]),n.h=W=O[1]}else W||h(0);(U?x:T)(r.subarray(u,u+=I),D.subarray(M),W)}var j=r[u++];if(j){255==j?j=32512+(r[u++]|r[u++]<<8):j>127&&(j=j-128<<8|r[u++]);var C=r[u++];3&C&&h(0);for(var H=[g,d,w],L=2;L>-1;--L){var Z=C>>2+(L<<1)&3;if(1==Z){var q=new t([0,0,r[u++]]);H[L]={s:q.subarray(2,3),n:q.subarray(0,1),t:new e(q.buffer,0,1),b:0}}else 2==Z?(u=(s=y(r,u,9-(1&L)))[0],H[L]=s[1]):3==Z&&(n.t||h(0),H[L]=n.t[L])}var G=n.t=H,J=G[0],K=G[1],N=G[2],P=r[c-1];P||h(0);var Q=(c<<3)-8+b(P)-N.b,R=Q>>3,V=0,X=(r[R]|r[R+1]<<8)>>(7&Q)&(1<<N.b)-1,Y=(r[R=(Q-=K.b)>>3]|r[R+1]<<8)>>(7&Q)&(1<<K.b)-1,$=(r[R=(Q-=J.b)>>3]|r[R+1]<<8)>>(7&Q)&(1<<J.b)-1;for(++j;--j;){var _=N.s[X],rr=N.n[X],tr=J.s[$],er=J.n[$],nr=K.s[Y],ar=K.n[Y],sr=1<<nr,ir=sr+((r[R=(Q-=nr)>>3]|r[R+1]<<8|r[R+2]<<16|r[R+3]<<24)>>>(7&Q)&sr-1);R=(Q-=k[tr])>>3;var or=A[tr]+((r[R]|r[R+1]<<8|r[R+2]<<16)>>(7&Q)&(1<<k[tr])-1);R=(Q-=z[_])>>3;var ur=E[_]+((r[R]|r[R+1]<<8|r[R+2]<<16)>>(7&Q)&(1<<z[_])-1);if(R=(Q-=rr)>>3,X=N.t[X]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<rr)-1),R=(Q-=er)>>3,$=J.t[$]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<er)-1),R=(Q-=ar)>>3,Y=K.t[Y]+((r[R]|r[R+1]<<8)>>(7&Q)&(1<<ar)-1),ir>3)n.o[2]=n.o[1],n.o[1]=n.o[0],n.o[0]=ir-=3;else{var fr=ir-(0!=ur);fr?(ir=3==fr?n.o[0]-1:n.o[fr],fr>1&&(n.o[2]=n.o[1]),n.o[1]=n.o[0],n.o[0]=ir):ir=n.o[0]}for(L=0;L<ur;++L)D[V+L]=D[M+L];M+=ur;var hr=(V+=ur)-ir;if(hr<0){var lr=-hr,vr=n.e+hr;for(lr>or&&(lr=or),L=0;L<lr;++L)D[V+L]=n.w[vr+L];V+=lr,or-=lr,hr=0}for(L=0;L<or;++L)D[V+L]=D[hr+L];V+=or}if(V!=M)for(;M<D.length;)D[V++]=D[M++];else V=D.length;a?n.y+=V:D=i(D,0,V)}else if(a){if(n.y+=B,M)for(L=0;L<B;++L)D[L]=D[M+L]}else M&&(D=i(D,M));return n.b=c,D}h(2)}},S=function(r,e){if(1==r.length)return r[0];for(var n=new t(e),a=0,s=0;a<r.length;++a){var i=r[a];n.set(i,s),s+=i.length}return n};function B(r,t){for(var e=0,n=[],a=+!t,s=0;r.length;){var i=c(r,a||t);if("object"==typeof i){for(a?(t=null,i.w.length==i.u&&(n.push(t=i.w),s+=i.u)):(n.push(t),i.e=0);!i.l;){var o=F(r,i,t);o||h(5),t?i.e=i.y:(n.push(o),s+=o.length,u(i.w,0,o.length),i.w.set(o,i.w.length-o.length))}e=i.b+4*i.c}else e=i;r=r.subarray(e)}return S(n,s)}_e.decompress=B;var I=function(){function r(r){this.ondata=r,this.c=[],this.l=0,this.z=0}return r.prototype.push=function(r,t){if("number"==typeof this.s){var e=Math.min(r.length,this.s);r=r.subarray(e),this.s-=e}var n=r.length+this.l;if(!this.s){if(t){if(!n)return;n<5&&h(5)}else if(n<18)return this.c.push(r),void(this.l=n);if(this.l&&(this.c.push(r),r=S(this.c,n),this.c=[],this.l=0),"number"==typeof(this.s=c(r)))return this.push(r,t)}if("number"!=typeof this.s){if(n<(this.z||4))return t&&h(5),this.c.push(r),void(this.l=n);if(this.l&&(this.c.push(r),r=S(this.c,n),this.c=[],this.l=0),!this.z&&n<(this.z=2&r[this.s.b]?5:4+(r[this.s.b]>>3|r[this.s.b+1]<<5|r[this.s.b+2]<<13)))return t&&h(5),this.c.push(r),void(this.l=n);for(this.z=0;;){var a=F(r,this.s);if(!a){t&&h(5);var s=r.subarray(this.s.b);return this.s.b=0,this.c.push(s),void(this.l+=s.length)}if(this.ondata(a,!1),u(this.s.w,0,a.length),this.s.w.set(a,this.s.w.length-a.length),this.s.l){var i=r.subarray(this.s.b);return this.s=4*this.s.c,void this.push(i,t)}}}},r}();_e.Decompress=I;return _e})

/* -*- js-indent-level: 8; fill-column: 100 -*- */
/*
 * Copyright the Collabora Online contributors.
 *
 * SPDX-License-Identifier: MPL-2.0
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/* eslint-disable no-inner-declarations */
/* eslint no-unused-vars: ["warn", { "argsIgnorePattern": "^_" }] */
/* global importScripts Uint8Array */

if ('undefined' === typeof window) {
	self.L = {};

	importScripts('CanvasTileUtils.js');
	addEventListener('message', onMessage);

	console.info('CanvasTileWorker initialised');

	function onMessage(e) {
		switch (e.data.message) {
			case 'endTransaction':
				var tileByteSize = e.data.tileSize * e.data.tileSize * 4;
				var decompressed = [];
				var buffers = [];
				for (var tile of e.data.deltas) {
					var deltas = self.fzstd.decompress(tile.rawDelta);
					tile.keyframeDeltaSize = 0;

					// Decompress the keyframe buffer
					if (tile.isKeyframe) {
						var keyframeBuffer = new Uint8Array(tileByteSize);
						tile.keyframeDeltaSize = L.CanvasTileUtils.unrle(
							deltas,
							e.data.tileSize,
							e.data.tileSize,
							keyframeBuffer,
						);
						tile.keyframeBuffer = new Uint8ClampedArray(
							keyframeBuffer.buffer,
							keyframeBuffer.byteOffset,
							keyframeBuffer.byteLength,
						);
						buffers.push(tile.keyframeBuffer.buffer);
					}

					// Unpremultiply delta updates
					var stop = false;
					for (var i = tile.keyframeDeltaSize; i < deltas.length && !stop; ) {
						switch (deltas[i]) {
							case 99: // 'c': // copy row
								i += 4;
								break;
							case 100: // 'd': // new run
								var span = deltas[i + 3] * 4;
								i += 4;
								L.CanvasTileUtils.unpremultiply(deltas, span, i);
								i += span;
								break;
							case 116: // 't': // terminate delta
								stop = true;
								i++;
								break;
							default:
								console.error(
									'[' + i + ']: ERROR: Unknown delta code ' + deltas[i],
								);
								i = deltas.length;
								break;
						}
					}

					// Now wrap as Uint8ClampedArray as that's what ImageData requires. Don't do
					// it earlier to avoid unnecessarily incurring bounds-checking penalties.
					tile.deltas = new Uint8ClampedArray(
						deltas.buffer,
						deltas.byteOffset,
						deltas.length,
					);

					decompressed.push(tile);
					buffers.push(tile.rawDelta.buffer);
					buffers.push(tile.deltas.buffer);
				}

				postMessage(
					{
						message: e.data.message,
						deltas: decompressed,
						tileSize: e.data.tileSize,
					},
					buffers,
				);
				break;

			default:
				console.error('Unrecognised worker message');
		}
	}
}

