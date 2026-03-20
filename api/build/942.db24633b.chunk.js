"use strict";(self.webpackChunkapi=self.webpackChunkapi||[]).push([[942],{60942(I,n,_){_.r(n),_.d(n,{LoginEE:()=>T});var E=_(92132),a=_(94061),O=_(48653),P=_(83997),M=_(30893),l=_(54894),i=_(79793),D=_(51193),d=_(77452),A=_(2129),C=_(15126),o=_(63299),h=_(67014),s=_(59080),L=_(79275),B=_(14718),t=_(21272),K=_(82437),m=_(61535),g=_(5790),x=_(12083),j=_(35223),f=_(5409),y=_(74930),c=_(2600),S=_(48940),$=_(41286),N=_(56336),F=_(13426),z=_(84624),G=_(77965),Z=_(54257),H=_(71210),J=_(51187),Q=_(39404),V=_(58692),X=_(501),Y=_(57646),u=_(23120),p=_(44414),e=_(25962),w=_(14664),k=_(42588),b=_(90325),q=_(62785),__=_(87443),E_=_(41032),s_=_(22957),t_=_(93179),a_=_(73055),O_=_(15747),D_=_(85306),n_=_(26509),P_=_(32058),M_=_(81185),d_=_(82261);const r=(0,i.Ay)(O.c)`
  flex: 1;
`,T=R=>{const{formatMessage:U}=(0,l.A)(),{isLoading:W,data:v=[]}=(0,D.g)(void 0,{skip:!window.strapi.features.isEnabled(window.strapi.features.SSO)});return!window.strapi.features.isEnabled(window.strapi.features.SSO)||!W&&v.length===0?(0,E.jsx)(D.L,{...R}):(0,E.jsx)(D.L,{...R,children:(0,E.jsx)(a.a,{paddingTop:7,children:(0,E.jsxs)(P.s,{direction:"column",alignItems:"stretch",gap:7,children:[(0,E.jsxs)(P.s,{children:[(0,E.jsx)(r,{}),(0,E.jsx)(a.a,{paddingLeft:3,paddingRight:3,children:(0,E.jsx)(M.o,{variant:"sigma",textColor:"neutral600",children:U({id:"Auth.login.sso.divider"})})}),(0,E.jsx)(r,{})]}),(0,E.jsx)(d.S,{providers:v,displayAllProviders:!1})]})})})}},77452(I,n,_){_.d(n,{S:()=>A});var E=_(92132),a=_(90151),O=_(68074),P=_(83997),M=_(79739),l=_(30893),i=_(54894),D=_(71389),d=_(79793);const A=({providers:s,displayAllProviders:L})=>{const{formatMessage:B}=(0,i.A)();return L?(0,E.jsx)(a.x,{gap:4,children:s.map(t=>(0,E.jsx)(O.E,{col:4,children:(0,E.jsx)(o,{provider:t})},t.uid))}):s.length>2&&!L?(0,E.jsxs)(a.x,{gap:4,children:[s.slice(0,2).map(t=>(0,E.jsx)(O.E,{col:4,children:(0,E.jsx)(o,{provider:t})},t.uid)),(0,E.jsx)(O.E,{col:4,children:(0,E.jsx)(M.m,{label:B({id:"global.see-more"}),children:(0,E.jsx)(h,{as:D.N_,to:"/auth/providers",children:(0,E.jsx)("span",{"aria-hidden":!0,children:"\u2022\u2022\u2022"})})})})]}):(0,E.jsx)(C,{justifyContent:"center",children:s.map(t=>(0,E.jsx)(o,{provider:t},t.uid))})},C=(0,d.Ay)(P.s)`
  & a:not(:first-child):not(:last-child) {
    margin: 0 ${({theme:s})=>s.spaces[2]};
  }
  & a:first-child {
    margin-right: ${({theme:s})=>s.spaces[2]};
  }
  & a:last-child {
    margin-left: ${({theme:s})=>s.spaces[2]};
  }
`,o=({provider:s})=>(0,E.jsx)(M.m,{label:s.displayName,children:(0,E.jsx)(h,{href:`${window.strapi.backendURL}/admin/connect/${s.uid}`,children:s.icon?(0,E.jsx)("img",{src:s.icon,"aria-hidden":!0,alt:"",height:"32px"}):(0,E.jsx)(l.o,{children:s.displayName})})}),h=d.Ay.a`
  width: ${136/16}rem;
  display: flex;
  justify-content: center;
  align-items: center;
  height: ${48/16}rem;
  border: 1px solid ${({theme:s})=>s.colors.neutral150};
  border-radius: ${({theme:s})=>s.borderRadius};
  text-decoration: inherit;
  &:link {
    text-decoration: none;
  }
  color: ${({theme:s})=>s.colors.neutral600};
`}}]);
