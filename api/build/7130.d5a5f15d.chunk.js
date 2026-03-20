"use strict";(self.webpackChunkapi=self.webpackChunkapi||[]).push([[7130],{27130(m,M,_){_.r(M),_.d(M,{FORMS:()=>U});var s=_(92132),a=_(94061),D=_(85963),h=_(48653),P=_(43064),C=_(38413),n=_(83997),d=_(30893),l=_(21610),A=_(54894),v=_(71389),o=_(17703),i=_(79793),E=_(51193),r=_(77452),B=_(2129),t=_(15126),g=_(63299),x=_(67014),j=_(59080),c=_(79275),f=_(14718),y=_(21272),S=_(82437),$=_(61535),N=_(5790),F=_(12083),u=_(35223),z=_(5409),G=_(74930),Z=_(2600),H=_(48940),J=_(41286),Q=_(56336),V=_(13426),X=_(84624),Y=_(77965),e=_(54257),p=_(71210),k=_(51187),w=_(39404),b=_(58692),q=_(501),__=_(57646),s_=_(23120),E_=_(44414),t_=_(25962),a_=_(14664),n_=_(42588),d_=_(90325),o_=_(62785),O_=_(87443),D_=_(41032),M_=_(22957),P_=_(93179),l_=_(73055),i_=_(15747),r_=_(85306),h_=_(26509),C_=_(32058),A_=_(81185),v_=_(82261);const T=()=>{const{push:I}=(0,o.W6)(),{formatMessage:O}=(0,A.A)(),{isLoading:R,data:W=[]}=(0,E.g)(void 0,{skip:!window.strapi.features.isEnabled(window.strapi.features.SSO)}),K=()=>{I("/auth/login")};return!window.strapi.features.isEnabled(window.strapi.features.SSO)||!R&&W.length===0?(0,s.jsx)(o.rd,{to:"/auth/login"}):(0,s.jsx)(E.U,{children:(0,s.jsxs)(C.g,{children:[(0,s.jsxs)(E.h,{children:[(0,s.jsxs)(E.C,{children:[(0,s.jsx)(E.i,{}),(0,s.jsx)(a.a,{paddingTop:6,paddingBottom:1,children:(0,s.jsx)(d.o,{as:"h1",variant:"alpha",children:O({id:"Auth.form.welcome.title"})})}),(0,s.jsx)(a.a,{paddingBottom:7,children:(0,s.jsx)(d.o,{variant:"epsilon",textColor:"neutral600",children:O({id:"Auth.login.sso.subtitle"})})})]}),(0,s.jsxs)(n.s,{direction:"column",alignItems:"stretch",gap:7,children:[R?(0,s.jsx)(n.s,{justifyContent:"center",children:(0,s.jsx)(P.a,{children:O({id:"Auth.login.sso.loading"})})}):(0,s.jsx)(r.S,{providers:W}),(0,s.jsxs)(n.s,{children:[(0,s.jsx)(L,{}),(0,s.jsx)(a.a,{paddingLeft:3,paddingRight:3,children:(0,s.jsx)(d.o,{variant:"sigma",textColor:"neutral600",children:O({id:"or"})})}),(0,s.jsx)(L,{})]}),(0,s.jsx)(D.$,{fullWidth:!0,size:"L",onClick:K,children:O({id:"Auth.form.button.login.strapi"})})]})]}),(0,s.jsx)(n.s,{justifyContent:"center",children:(0,s.jsx)(a.a,{paddingTop:4,children:(0,s.jsx)(l.N,{as:v.k2,to:"/auth/forgot-password",children:(0,s.jsx)(d.o,{variant:"pi",children:O({id:"Auth.link.forgot-password"})})})})})]})})},L=(0,i.Ay)(h.c)`
  flex: 1;
`,U={providers:T}},77452(m,M,_){_.d(M,{S:()=>A});var s=_(92132),a=_(90151),D=_(68074),h=_(83997),P=_(79739),C=_(30893),n=_(54894),d=_(71389),l=_(79793);const A=({providers:E,displayAllProviders:r})=>{const{formatMessage:B}=(0,n.A)();return r?(0,s.jsx)(a.x,{gap:4,children:E.map(t=>(0,s.jsx)(D.E,{col:4,children:(0,s.jsx)(o,{provider:t})},t.uid))}):E.length>2&&!r?(0,s.jsxs)(a.x,{gap:4,children:[E.slice(0,2).map(t=>(0,s.jsx)(D.E,{col:4,children:(0,s.jsx)(o,{provider:t})},t.uid)),(0,s.jsx)(D.E,{col:4,children:(0,s.jsx)(P.m,{label:B({id:"global.see-more"}),children:(0,s.jsx)(i,{as:d.N_,to:"/auth/providers",children:(0,s.jsx)("span",{"aria-hidden":!0,children:"\u2022\u2022\u2022"})})})})]}):(0,s.jsx)(v,{justifyContent:"center",children:E.map(t=>(0,s.jsx)(o,{provider:t},t.uid))})},v=(0,l.Ay)(h.s)`
  & a:not(:first-child):not(:last-child) {
    margin: 0 ${({theme:E})=>E.spaces[2]};
  }
  & a:first-child {
    margin-right: ${({theme:E})=>E.spaces[2]};
  }
  & a:last-child {
    margin-left: ${({theme:E})=>E.spaces[2]};
  }
`,o=({provider:E})=>(0,s.jsx)(P.m,{label:E.displayName,children:(0,s.jsx)(i,{href:`${window.strapi.backendURL}/admin/connect/${E.uid}`,children:E.icon?(0,s.jsx)("img",{src:E.icon,"aria-hidden":!0,alt:"",height:"32px"}):(0,s.jsx)(C.o,{children:E.displayName})})}),i=l.Ay.a`
  width: ${136/16}rem;
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${48/16}rem;
  border: 1px solid ${({theme:E})=>E.colors.neutral150};
  border-radius: ${({theme:E})=>E.borderRadius};
  text-decoration: inherit;
  &:link {
    text-decoration: none;
  }
  color: ${({theme:E})=>E.colors.neutral600};
`}}]);
